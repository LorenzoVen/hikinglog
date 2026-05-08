/**
 * check-gtfs.mjs
 *
 * Tests every zip file in gtfs-data/ before running build-trailheads.mjs
 * Reports which files are valid, which are corrupted, and which use
 * unsupported compression.
 *
 * HOW TO RUN:
 *   node check-gtfs.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const GTFS_DIR = path.join(__dirname, 'gtfs-data')

function log(msg) { process.stdout.write(msg + '\n') }

async function testZip(zipPath) {
  const result = { ok: false, stops: 0, compression: null, error: null, sizeMb: 0 }

  try {
    const stat = fs.statSync(zipPath)
    result.sizeMb = (stat.size / 1048576).toFixed(1)

    if (stat.size < 100) {
      result.error = 'File too small — likely empty or truncated'
      return result
    }

    const buf = fs.readFileSync(zipPath)

    // Check ZIP signature
    if (buf[0] !== 0x50 || buf[1] !== 0x4b) {
      result.error = 'Not a valid ZIP file (wrong header)'
      return result
    }

    // Scan entries
    const sig = Buffer.from([0x50, 0x4b, 0x03, 0x04])
    let offset = 0
    const entries = []
    let parseError = null

    while (offset < buf.length - 4) {
      const pos = buf.indexOf(sig, offset)
      if (pos === -1) break

      // Bounds check before reading header fields
      if (pos + 30 > buf.length) {
        parseError = 'Unexpected end of file while reading ZIP header'
        break
      }

      const compression  = buf.readUInt16LE(pos + 8)
      const compressedSz = buf.readUInt32LE(pos + 18)
      const fnLen        = buf.readUInt16LE(pos + 26)
      const extraLen     = buf.readUInt16LE(pos + 28)

      if (pos + 30 + fnLen > buf.length) {
        parseError = 'Unexpected end of file while reading filename'
        break
      }

      const filename  = buf.slice(pos + 30, pos + 30 + fnLen).toString('utf8')
      const dataStart = pos + 30 + fnLen + extraLen

      if (dataStart + compressedSz > buf.length) {
        parseError = `Unexpected end of file in entry: ${filename} (expected ${compressedSz} bytes, only ${buf.length - dataStart} available)`
        break
      }

      entries.push({ filename, compression, compressedSz, dataStart })
      offset = dataStart + compressedSz
    }

    if (parseError) {
      result.error = parseError
      return result
    }

    if (entries.length === 0) {
      result.error = 'ZIP contains no entries'
      return result
    }

    // Check for stops.txt
    const stopsEntry = entries.find(e =>
      e.filename === 'stops.txt' || e.filename.endsWith('/stops.txt')
    )

    if (!stopsEntry) {
      const allFiles = entries.map(e => e.filename).join(', ')
      result.error = `No stops.txt found. Files in ZIP: ${allFiles.slice(0, 200)}`
      return result
    }

    result.compression = stopsEntry.compression === 0 ? 'stored' :
                         stopsEntry.compression === 8 ? 'deflate' :
                         `unknown (${stopsEntry.compression})`

    if (stopsEntry.compression !== 0 && stopsEntry.compression !== 8) {
      result.error = `Unsupported compression method: ${stopsEntry.compression}. Only stored(0) and deflate(8) are supported.`
      return result
    }

    // Try to actually decompress stops.txt
    const compressed = buf.slice(stopsEntry.dataStart, stopsEntry.dataStart + stopsEntry.compressedSz)
    let stopsContent

    if (stopsEntry.compression === 0) {
      stopsContent = compressed.toString('utf8')
    } else {
      const zlib = await import('zlib')
      stopsContent = await new Promise((resolve, reject) => {
        zlib.inflateRaw(compressed, (err, r) => err ? reject(err) : resolve(r.toString('utf8')))
      })
    }

    // Count stop rows
    const lines = stopsContent.trim().split('\n')
    result.stops = Math.max(0, lines.length - 1) // minus header row

    // List all GTFS files present
    result.files = entries.map(e => e.filename.split('/').pop()).filter(Boolean)
    result.ok = true

  } catch (e) {
    result.error = e.message
  }

  return result
}

async function main() {
  log('\n🔍 HikingLog — GTFS File Diagnostic')
  log('═════════════════════════════════════\n')

  if (!fs.existsSync(GTFS_DIR)) {
    log('✗ gtfs-data/ folder not found')
    process.exit(1)
  }

  const zips = fs.readdirSync(GTFS_DIR).filter(f => f.endsWith('.zip')).sort()

  if (!zips.length) {
    log('✗ No .zip files found in gtfs-data/')
    process.exit(1)
  }

  log(`Found ${zips.length} zip files:\n`)

  const good = []
  const bad  = []

  for (const zip of zips) {
    const zipPath = path.join(GTFS_DIR, zip)
    process.stdout.write(`  Testing ${zip} … `)
    const result = await testZip(zipPath)

    if (result.ok) {
      log(`✓  ${result.sizeMb} MB · ${result.stops.toLocaleString()} stops · compression: ${result.compression}`)
      good.push({ zip, ...result })
    } else {
      log(`✗  ${result.sizeMb} MB · ERROR: ${result.error}`)
      bad.push({ zip, ...result })
    }
  }

  log('\n═════════════════════════════════════')
  log(`SUMMARY: ${good.length} valid, ${bad.length} failed\n`)

  if (bad.length > 0) {
    log('Files that need attention:')
    bad.forEach(b => {
      log(`\n  ✗ ${b.zip}`)
      log(`    Error: ${b.error}`)
      log(`    Size: ${b.sizeMb} MB`)
      log(`    Fix:`)

      if (b.error.includes('too small') || b.error.includes('truncated') || b.error.includes('end of file')) {
        log(`    → The file is incomplete. Re-download it from the NJ Transit developer portal.`)
        log(`    → Make sure the download fully completed before copying to gtfs-data/`)
      } else if (b.error.includes('Not a valid ZIP')) {
        log(`    → The file is not a ZIP. It may have downloaded as HTML (an error page).`)
        log(`    → Open the file in a text editor to check — if it starts with <html>, re-download.`)
      } else if (b.error.includes('Unsupported compression')) {
        log(`    → Rare compression format. Try opening the zip manually and re-saving it.`)
        log(`    → On Windows: right-click → Extract All, then zip the folder again.`)
      } else if (b.error.includes('No stops.txt')) {
        log(`    → This ZIP exists but doesn't contain stops.txt.`)
        log(`    → It may not be a standard GTFS feed. Check what files it contains.`)
        if (b.files) log(`    → Files found: ${b.files.join(', ')}`)
      }
    })

    log(`\nOnce fixed, re-run: node check-gtfs.mjs`)
    log(`Then run:          node build-trailheads.mjs\n`)
  } else {
    log('All files look good!')
    log('Run: node build-trailheads.mjs\n')
  }
}

main().catch(e => { log(`\n✗ ${e.message}`); process.exit(1) })
