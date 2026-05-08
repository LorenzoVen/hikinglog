/**
 * json-to-csv.mjs
 *
 * Converts data/supabase-import.json to data/supabase-import.csv
 * with empty strings instead of null values, so Supabase can import it.
 *
 * HOW TO RUN:
 *   node json-to-csv.mjs
 *
 * Then import data/supabase-import.csv into Supabase Table Editor.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const JSON_IN  = path.join(__dirname, 'data', 'supabase-import.json')
const CSV_OUT  = path.join(__dirname, 'data', 'supabase-import.csv')

function log(msg) { process.stdout.write(msg + '\n') }

function csvEscape(v) {
  // Convert null/undefined to empty string
  if (v === null || v === undefined) return ''
  const s = String(v)
  // Wrap in quotes if contains comma, quote, or newline
  return (s.includes(',') || s.includes('"') || s.includes('\n'))
    ? '"' + s.replace(/"/g, '""') + '"'
    : s
}

try {
  log('\n📄 Converting supabase-import.json → supabase-import.csv\n')

  if (!fs.existsSync(JSON_IN)) {
    log('✗ data/supabase-import.json not found')
    log('  Run node build-trailheads.mjs first to generate it.')
    process.exit(1)
  }

  const rows = JSON.parse(fs.readFileSync(JSON_IN, 'utf8'))

  if (!Array.isArray(rows) || rows.length === 0) {
    log('✗ JSON file is empty or not an array')
    process.exit(1)
  }

  const headers = Object.keys(rows[0])
  const csvLines = [
    headers.join(','),
    ...rows.map(row =>
      headers.map(h => csvEscape(row[h])).join(',')
    )
  ]

  fs.writeFileSync(CSV_OUT, csvLines.join('\n'), 'utf8')

  log(`✓ Converted ${rows.length} rows`)
  log(`✓ Saved to: data/supabase-import.csv\n`)
  log('Next steps:')
  log('  1. Go to Supabase Dashboard → Table Editor → trailheads')
  log('  2. Click the arrow next to Insert → Import data from CSV')
  log('  3. Select data/supabase-import.csv')
  log('  4. Supabase will show a column preview — click Import')
  log('  5. After import, run in SQL Editor:')
  log('        update trailheads set approved = true;')
  log('     (or approve selectively per operator in the Table Editor)\n')

} catch (e) {
  log(`✗ Error: ${e.message}`)
  process.exit(1)
}
