/**
 * build-trailheads.mjs
 *
 * Discovers transit-accessible trailheads near NYC by:
 *   1. Downloading GTFS stop data from MTA (Metro-North + LIRR) — no login needed
 *   2. Loading NJ Transit stops from a local GTFS file (requires free registration)
 *   3. Querying OpenStreetMap Overpass for all trailheads in the region
 *   4. For each trailhead, finding the nearest transit stop within MAX_WALK_MILES
 *   5. Writing results to data/discovered-trailheads.json
 *
 * OUTPUT FORMAT (per trailhead):
 * {
 *   id, name, osmId,
 *   trailheadCoords: { lat, lng },
 *   station, line, operator,
 *   stationCoords: { lat, lng },
 *   walkMi, walkMin,
 *   transitMin  (Manhattan → station, estimated from known anchors)
 * }
 *
 * HOW TO RUN:
 *   node build-trailheads.mjs
 *
 * OPTIONAL — NJ Transit stops (adds NJ Transit rail coverage):
 *   1. Register free at: https://developer.njtransit.com
 *   2. Download the rail GTFS zip
 *   3. Place it at: gtfs-data/njtransit-rail.zip
 *   The script will automatically use it if present.
 *
 * Requires Node 18+. No extra packages needed.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── Config ──────────────────────────────────────────────────────────────────

const MAX_WALK_MILES    = 2.0     // max straight-line distance station → trailhead
const WALK_SPEED_MPH    = 3.0     // assumed walking speed for time estimate
const MIN_TRAILHEAD_LAT = 40.4    // bounding box for trailhead search
const MAX_TRAILHEAD_LAT = 42.2    // covers NY, NJ, CT within ~150mi of Manhattan
const MIN_TRAILHEAD_LNG = -75.5
const MAX_TRAILHEAD_LNG = -71.8

// Operators to include — excludes city subway/bus (too urban, no trailheads nearby)
const INCLUDED_OPERATORS = ['metro-north', 'lirr', 'njtransit-rail', 'njtransit-bus-coach']

// Direct GTFS download URLs (no login required)
const GTFS_SOURCES = {
  'metro-north': {
    url: 'https://rrgtfsfeeds.s3.amazonaws.com/gtfsmnr.zip',
    operator: 'Metro-North',
    type: 'rail',
  },
  'lirr': {
    url: 'https://rrgtfsfeeds.s3.amazonaws.com/gtfslirr.zip',
    operator: 'LIRR',
    type: 'rail',
  },
}

// NJ Transit GTFS — requires free registration, loaded from local file if present
const NJ_TRANSIT_LOCAL_PATH = path.join(__dirname, 'gtfs-data', 'njtransit-rail.zip')

const GTFS_CACHE_DIR = path.join(__dirname, 'gtfs-data')
const OUTPUT_PATH    = path.join(__dirname, 'data', 'discovered-trailheads.json')
const REPORT_PATH    = path.join(__dirname, 'data', 'discovery-report.json')

// ─── Known Manhattan → station travel times (minutes, off-peak estimate)
//     Used to estimate transit time for discovered stations.
//     Stations not listed here get a rough estimate from distance to Penn/GCT.
const KNOWN_TRANSIT_TIMES = {
  // Metro-North Hudson Line
  'Breakneck Ridge':      90,
  'Cold Spring':          88,
  'Beacon':               88,
  'Poughkeepsie':        100,
  'Garrison':             80,
  'Peekskill':            68,
  'Croton-Harmon':        55,
  'Tarrytown':            40,
  // Metro-North Harlem Line
  'Towners':              80,
  'Pawling':              95,
  'Southeast':            80,
  'Brewster':             75,
  'Goldens Bridge':       70,
  'Katonah':              65,
  'Mount Kisco':          60,
  'Bedford Hills':        65,
  // Metro-North Port Jervis Line (via NJ Transit)
  'Tuxedo':               65,
  'Sloatsburg':           60,
  'Suffern':              55,
  'Salisbury Mills-Cornwall': 80,
  // LIRR
  'Bay Shore':            55,
  'Cold Spring Harbor':   70,
  'Oyster Bay':           75,
  'Port Jefferson':       95,
  // NJ Transit Main/Bergen County Line
  'Mahwah':               50,
  'Ramsey':               55,
  'Westfield':            45,
  // NJ Transit Port Jervis Line
  'Port Jervis':         100,
}

// GCT coordinates (Metro-North origin)
const GCT  = { lat: 40.7527, lng: -73.9772 }
// Penn Station coordinates (NJ Transit / LIRR origin)
const PENN = { lat: 40.7506, lng: -73.9971 }
// Port Authority Bus Terminal (bus coach origin)
const PABT = { lat: 40.7571, lng: -73.9903 }

// ─── Utilities ────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function log(msg) { process.stdout.write(msg + '\n') }

// Haversine distance in miles between two lat/lng points
function distanceMiles(a, b) {
  const R = 3958.8
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const lat1 = a.lat * Math.PI / 180
  const lat2 = b.lat * Math.PI / 180
  const x = Math.sin(dLat/2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng/2) ** 2
  return R * 2 * Math.asin(Math.sqrt(x))
}

function round7(n) { return Math.round(n * 1e7) / 1e7 }
function round1(n) { return Math.round(n * 10) / 10 }

// ─── GTFS parsing ─────────────────────────────────────────────────────────────

// Parse a CSV-like stops.txt from a string
function parseStopsTxt(content) {
  const lines = content.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const stops = []
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    const stop = {}
    headers.forEach((h, idx) => { stop[h] = vals[idx] || '' })
    if (stop.stop_lat && stop.stop_lon && stop.stop_name) {
      stops.push({
        id:   stop.stop_id,
        name: stop.stop_name,
        lat:  parseFloat(stop.stop_lat),
        lng:  parseFloat(stop.stop_lon),
      })
    }
  }
  return stops
}

// Extract stops.txt from a GTFS zip file
async function extractStopsFromZip(zipPath) {
  // Use Node's built-in zlib + manual ZIP parsing via a helper
  // We'll use the 'unzipper' pattern with built-in APIs
  const { createReadStream } = await import('fs')

  // Read the zip as a buffer and find stops.txt
  const buf = fs.readFileSync(zipPath)

  // Minimal ZIP reader: find stops.txt entry
  // ZIP local file headers start with PK\x03\x04
  const magic = Buffer.from([0x50, 0x4b, 0x03, 0x04])
  const entries = []
  let offset = 0

  while (offset < buf.length - 4) {
    const pos = buf.indexOf(magic, offset)
    if (pos === -1) break

    const compression = buf.readUInt16LE(pos + 8)
    const compressedSize = buf.readUInt32LE(pos + 18)
    const filenameLen = buf.readUInt16LE(pos + 26)
    const extraLen = buf.readUInt16LE(pos + 28)
    const filename = buf.slice(pos + 30, pos + 30 + filenameLen).toString('utf8')
    const dataStart = pos + 30 + filenameLen + extraLen

    entries.push({ filename, compression, compressedSize, dataStart })
    offset = dataStart + compressedSize
  }

  const stopsEntry = entries.find(e => e.filename === 'stops.txt' || e.filename.endsWith('/stops.txt'))
  if (!stopsEntry) throw new Error('stops.txt not found in ZIP')

  const compressedData = buf.slice(stopsEntry.dataStart, stopsEntry.dataStart + stopsEntry.compressedSize)

  let content
  if (stopsEntry.compression === 0) {
    // Stored (no compression)
    content = compressedData.toString('utf8')
  } else if (stopsEntry.compression === 8) {
    // Deflate
    const zlib = await import('zlib')
    content = await new Promise((resolve, reject) => {
      zlib.inflateRaw(compressedData, (err, result) => {
        if (err) reject(err)
        else resolve(result.toString('utf8'))
      })
    })
  } else {
    throw new Error(`Unsupported ZIP compression method: ${stopsEntry.compression}`)
  }

  return parseStopsTxt(content)
}


// Extract routes.txt from GTFS zip — maps route_id to human-readable line name
async function extractRoutesFromZip(zipPath) {
  const buf = fs.readFileSync(zipPath)
  const magic = Buffer.from([0x50, 0x4b, 0x03, 0x04])
  const entries = []
  let offset = 0
  while (offset < buf.length - 4) {
    const pos = buf.indexOf(magic, offset)
    if (pos === -1) break
    const compression = buf.readUInt16LE(pos + 8)
    const compressedSize = buf.readUInt32LE(pos + 18)
    const filenameLen = buf.readUInt16LE(pos + 26)
    const extraLen = buf.readUInt16LE(pos + 28)
    const filename = buf.slice(pos + 30, pos + 30 + filenameLen).toString('utf8')
    const dataStart = pos + 30 + filenameLen + extraLen
    entries.push({ filename, compression, compressedSize, dataStart })
    offset = dataStart + compressedSize
  }
  const entry = entries.find(e => e.filename === 'routes.txt' || e.filename.endsWith('/routes.txt'))
  if (!entry) return {}
  const compressed = buf.slice(entry.dataStart, entry.dataStart + entry.compressedSize)
  let content
  if (entry.compression === 0) {
    content = compressed.toString('utf8')
  } else {
    const zlib = await import('zlib')
    content = await new Promise((res, rej) => {
      zlib.inflateRaw(compressed, (err, r) => err ? rej(err) : res(r.toString('utf8')))
    })
  }
  // Parse CSV into route_id -> route_long_name map
  const lines = content.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const idIdx = headers.indexOf('route_id')
  const nameIdx = headers.indexOf('route_long_name')
  const shortIdx = headers.indexOf('route_short_name')
  const routes = {}
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    const id = vals[idIdx]
    const name = vals[nameIdx] || vals[shortIdx] || ''
    if (id && name) routes[id] = name
  }
  return routes
}

// Build stop_id -> line name map by reading stop_times.txt + trips.txt + routes.txt
// This is expensive so we only do it when a routes map is available
async function buildStopLineMap(zipPath, routesMap) {
  if (Object.keys(routesMap).length === 0) return {}
  const buf = fs.readFileSync(zipPath)
  const magic = Buffer.from([0x50, 0x4b, 0x03, 0x04])
  const entries = []
  let offset = 0
  while (offset < buf.length - 4) {
    const pos = buf.indexOf(magic, offset)
    if (pos === -1) break
    const compression = buf.readUInt16LE(pos + 8)
    const compressedSize = buf.readUInt32LE(pos + 18)
    const filenameLen = buf.readUInt16LE(pos + 26)
    const extraLen = buf.readUInt16LE(pos + 28)
    const filename = buf.slice(pos + 30, pos + 30 + filenameLen).toString('utf8')
    const dataStart = pos + 30 + filenameLen + extraLen
    entries.push({ filename, compression, compressedSize, dataStart })
    offset = dataStart + compressedSize
  }
  async function extractFile(name) {
    const e = entries.find(x => x.filename === name || x.filename.endsWith('/'+name))
    if (!e) return ''
    const comp = buf.slice(e.dataStart, e.dataStart + e.compressedSize)
    if (e.compression === 0) return comp.toString('utf8')
    const zlib = await import('zlib')
    return new Promise((res, rej) => zlib.inflateRaw(comp, (err, r) => err ? rej(err) : res(r.toString('utf8'))))
  }
  // Parse trips.txt: trip_id -> route_id
  const tripsContent = await extractFile('trips.txt')
  const tripLines = tripsContent.trim().split('\n')
  const th = tripLines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const tripRouteMap = {}
  for (let i = 1; i < tripLines.length; i++) {
    const v = tripLines[i].split(',').map(x => x.trim().replace(/^"|"$/g, ''))
    const routeId = v[th.indexOf('route_id')]
    const tripId = v[th.indexOf('trip_id')]
    if (tripId && routeId) tripRouteMap[tripId] = routeId
  }
  // Parse stop_times.txt: stop_id -> trip_id (just first occurrence per stop)
  const stContent = await extractFile('stop_times.txt')
  const stLines = stContent.trim().split('\n')
  const sh = stLines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const stopTripMap = {}
  for (let i = 1; i < stLines.length; i++) {
    const v = stLines[i].split(',').map(x => x.trim().replace(/^"|"$/g, ''))
    const stopId = v[sh.indexOf('stop_id')]
    const tripId = v[sh.indexOf('trip_id')]
    if (stopId && tripId && !stopTripMap[stopId]) stopTripMap[stopId] = tripId
  }
  // Build final map: stop_id -> line name
  const stopLineMap = {}
  for (const [stopId, tripId] of Object.entries(stopTripMap)) {
    const routeId = tripRouteMap[tripId]
    if (routeId && routesMap[routeId]) stopLineMap[stopId] = routesMap[routeId]
  }
  return stopLineMap
}

// Download a GTFS feed zip, cache it locally
async function downloadGtfs(key, source) {
  fs.mkdirSync(GTFS_CACHE_DIR, { recursive: true })
  const cachePath = path.join(GTFS_CACHE_DIR, `${key}.zip`)

  // Use cached version if less than 7 days old
  if (fs.existsSync(cachePath)) {
    const age = Date.now() - fs.statSync(cachePath).mtimeMs
    if (age < 7 * 24 * 60 * 60 * 1000) {
      log(`  Using cached ${key}.zip`)
      return cachePath
    }
  }

  log(`  Downloading ${key} GTFS from ${source.url}…`)
  const res = await fetch(source.url)
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`)

  const writer = createWriteStream(cachePath)
  await pipeline(res.body, writer)
  log(`  Downloaded ${key}.zip (${Math.round(fs.statSync(cachePath).size / 1024)} KB)`)
  return cachePath
}

// ─── Overpass API ─────────────────────────────────────────────────────────────

// Overpass servers tried in order — if one fails, the next is attempted
const OVERPASS_SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
]

async function queryOverpass(query, attempt = 0) {
  if (attempt >= OVERPASS_SERVERS.length) {
    throw new Error('All Overpass servers failed. Try again in a few minutes.')
  }

  const server = OVERPASS_SERVERS[attempt]
  log(`  Trying server: ${server}`)

  let res
  try {
    res = await fetch(server, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'HikingLog/1.0 (hikinglog.com; transit-trailhead-finder)',
        'Accept': 'application/json',
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(90_000), // 90 second timeout
    })
  } catch (e) {
    log(`  ✗ Server unreachable: ${e.message}`)
    log(`  Waiting 3 seconds before trying next server…`)
    await sleep(3000)
    return queryOverpass(query, attempt + 1)
  }

  if (res.status === 429) {
    log(`  ✗ Rate limited (429) — waiting 15 seconds before trying next server…`)
    await sleep(15000)
    return queryOverpass(query, attempt + 1)
  }

  if (res.status === 504 || res.status === 502) {
    log(`  ✗ Server overloaded (${res.status}) — waiting 10 seconds before trying next server…`)
    await sleep(10000)
    return queryOverpass(query, attempt + 1)
  }

  if (!res.ok) {
    log(`  ✗ HTTP ${res.status} — trying next server…`)
    await sleep(3000)
    return queryOverpass(query, attempt + 1)
  }

  return res.json()
}

// Deduplicate trailheads by proximity — OSM sometimes has multiple nodes
// for the same physical location (e.g. separate nodes for parking + trail start)
function deduplicateByProximity(items, thresholdMiles = 0.15) {
  const kept = []
  for (const item of items) {
    const isDupe = kept.some(k => {
      const d = Math.sqrt(
        Math.pow((k.lat - item.lat) * 69, 2) +
        Math.pow((k.lng - item.lng) * 53, 2)
      )
      return d < thresholdMiles
    })
    if (!isDupe) kept.push(item)
  }
  return kept
}

// Filter out noisy names that are clearly trail color blazes, not destinations
const NOISE_NAMES = /^(red|blue|green|orange|yellow|white|black|purple|pink|brown)\s+(trail(head)?|blaze|marker|loop|connector)$/i

async function fetchTrailheads() {
  const bbox = `${MIN_TRAILHEAD_LAT},${MIN_TRAILHEAD_LNG},${MAX_TRAILHEAD_LAT},${MAX_TRAILHEAD_LNG}`
  log(`\nQuerying OpenStreetMap for trailheads and hiking routes…`)
  log(`  (Covers NY, NJ, CT — two queries, 30-90 seconds total)`)

  // ── Query 1: Explicit trailhead nodes/ways ─────────────────────────────────
  log(`\n  Query 1/2: trailhead nodes…`)
  const q1 = `
    [out:json][timeout:90][maxsize:268435456];
    (
      node["tourism"="trailhead"](${bbox});
      node["highway"="trailhead"](${bbox});
      way["tourism"="trailhead"](${bbox});
      way["highway"="trailhead"](${bbox});
    );
    out center 2000;
  `
  const d1 = await queryOverpass(q1)
  const trailheadNodes = (d1.elements || [])
    .filter(el => (el.lat ?? el.center?.lat) && el.tags?.name)
    .map(el => ({
      osmId:  el.id,
      name:   el.tags.name,
      lat:    round7(el.lat ?? el.center.lat),
      lng:    round7(el.lon ?? el.center.lon),
      source: 'trailhead-tag',
    }))
  log(`  → ${trailheadNodes.length} trailhead-tagged nodes found`)

  await sleep(3000)

  // ── Query 2: Named hiking route relations ──────────────────────────────────
  log(`\n  Query 2/2: named hiking route relations…`)
  const q2 = `
    [out:json][timeout:120][maxsize:268435456];
    relation["route"="hiking"]["name"](${bbox});
    out center 2000;
  `
  const d2 = await queryOverpass(q2)
  const routeNodes = (d2.elements || [])
    .filter(el => el.center?.lat && el.tags?.name)
    .map(el => ({
      osmId:    el.id,
      name:     el.tags.name,
      lat:      round7(el.center.lat),
      lng:      round7(el.center.lon),
      source:   'hiking-relation',
      distance: el.tags.distance || el.tags['route:length'] || null,
      network:  el.tags.network || null,
    }))
  log(`  → ${routeNodes.length} named hiking route relations found`)

  // ── Merge, filter noise, deduplicate ──────────────────────────────────────
  const all = [...trailheadNodes, ...routeNodes]
  const filtered = all.filter(t => !NOISE_NAMES.test(t.name.trim()))
  log(`  → ${all.length - filtered.length} noisy color-blaze names removed`)
  const deduped = deduplicateByProximity(filtered)
  log(`  → ${filtered.length - deduped.length} near-duplicate locations merged`)
  log(`  ✓ ${deduped.length} unique named trailheads/routes after cleanup`)
  return deduped
}


// ─── Transit time estimator ───────────────────────────────────────────────────

function estimateTransitTime(stationName, stationCoords, operator) {
  // Check known lookup table first
  const known = KNOWN_TRANSIT_TIMES[stationName]
  if (known) return known

  // Fallback: rough estimate based on distance from origin terminal
  // ~1 mile = ~1.5 minutes on a commuter train (including stops and waiting)
  const origin = (operator === 'LIRR' || operator === 'NJ Transit') ? PENN : GCT
  const dist = distanceMiles(origin, stationCoords)
  return Math.round(20 + dist * 1.8) // 20 min base (walk to terminal + wait) + 1.8 min/mile
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log('\n🥾 HikingLog — Trailhead Discovery Script')
  log('══════════════════════════════════════════\n')
  log('This script finds trailheads near transit stops across NY/NJ/CT.')
  log('It contacts OpenStreetMap (free) and MTA GTFS feeds (free).\n')

  // ── Step 1: Load transit stops ──────────────────────────────────────────────
  log('STEP 1 — Loading transit stops')
  log('────────────────────────────────')

  const allStops = []

  // MTA feeds (no login required)
  for (const [key, source] of Object.entries(GTFS_SOURCES)) {
    try {
      const zipPath = await downloadGtfs(key, source)
      const stops = await extractStopsFromZip(zipPath)
      const routes = await extractRoutesFromZip(zipPath)
      const stopLineMap = await buildStopLineMap(zipPath, routes)
      const tagged = stops.map(s => ({
        ...s,
        operator: source.operator,
        operatorKey: key,
        lineName: stopLineMap[s.id] || source.operator,
      }))
      allStops.push(...tagged)
      log(`  ✓ ${source.operator}: ${stops.length} stops, ${Object.keys(routes).length} routes loaded`)
    } catch (e) {
      log(`  ✗ ${source.operator} failed: ${e.message}`)
    }
  }

  // NJ Transit (optional — from local file)
  if (fs.existsSync(NJ_TRANSIT_LOCAL_PATH)) {
    try {
      const stops = await extractStopsFromZip(NJ_TRANSIT_LOCAL_PATH)
      const tagged = stops.map(s => ({ ...s, operator: 'NJ Transit', operatorKey: 'njtransit-rail' }))
      allStops.push(...tagged)
      log(`  ✓ NJ Transit Rail: ${stops.length} stops loaded`)
    } catch (e) {
      log(`  ✗ NJ Transit local file failed: ${e.message}`)
    }
  } else {
    log(`  ℹ NJ Transit GTFS not found at gtfs-data/njtransit-rail.zip`)
    log(`    → Register free at developer.njtransit.com to add NJ Transit coverage`)
  }

  // Filter to stops within our bounding box
  const regionalStops = allStops.filter(s =>
    s.lat >= MIN_TRAILHEAD_LAT && s.lat <= MAX_TRAILHEAD_LAT &&
    s.lng >= MIN_TRAILHEAD_LNG && s.lng <= MAX_TRAILHEAD_LNG &&
    !isNaN(s.lat) && !isNaN(s.lng)
  )

  log(`\n  Total regional stops: ${regionalStops.length}`)

  // ── Step 2: Fetch trailheads from OSM ──────────────────────────────────────
  log('\nSTEP 2 — Fetching trailheads from OpenStreetMap')
  log('─────────────────────────────────────────────────')

  let trailheads
  try {
    trailheads = await fetchTrailheads()
  } catch (e) {
    log('\n✗ Could not reach any Overpass server: ' + e.message)
    log('\n  All three OSM servers were tried. Options:')
    log('  1. Wait 10-15 minutes and run the script again')
    log('  2. Try at off-peak hours (early morning works best)')
    log('  3. Check https://overpass-api.de/api/status in your browser')
    process.exit(1)
  }

  // ── Step 3: Match trailheads to nearest transit stop ───────────────────────
  log('\nSTEP 3 — Matching trailheads to nearest transit stop')
  log('──────────────────────────────────────────────────────')

  const results = []
  let matched = 0
  let skipped = 0

  for (const th of trailheads) {
    const thCoords = { lat: th.lat, lng: th.lng }

    // Find the nearest stop within MAX_WALK_MILES
    let nearest = null
    let nearestDist = Infinity

    for (const stop of regionalStops) {
      const d = distanceMiles(thCoords, { lat: stop.lat, lng: stop.lng })
      if (d < nearestDist && d <= MAX_WALK_MILES) {
        nearestDist = d
        nearest = stop
      }
    }

    if (!nearest) {
      skipped++
      continue
    }

    matched++
    const walkMi    = round1(nearestDist)
    const walkMin   = Math.round((nearestDist / WALK_SPEED_MPH) * 60)
    const transitMin = estimateTransitTime(nearest.name, { lat: nearest.lat, lng: nearest.lng }, nearest.operator)

    results.push({
      id:               results.length + 1,
      name:             th.name,
      osmId:            th.osmId,
      trailheadCoords:  { lat: th.lat, lng: th.lng },
      station:          nearest.name,
      line:             nearest.lineName || nearest.operator,
      operator:         nearest.operator,
      stationCoords:    { lat: round7(nearest.lat), lng: round7(nearest.lng) },
      walkMi,
      walkMin,
      transitMin,
      totalMin:         transitMin + walkMin,
      // Placeholders for manual enrichment later
      difficulty:       null,
      lengthMi:         null,
      elevFt:           null,
      desc:             null,
      tips:             null,
      alltrails:        null,
      seasonal:         false,
      seasonNote:       null,
    })
  }

  // Sort by total travel time
  results.sort((a, b) => a.totalMin - b.totalMin)

  log(`\n  Trailheads matched to transit: ${matched}`)
  log(`  Trailheads too far from any stop: ${skipped}`)

  // ── Step 4: Write output ───────────────────────────────────────────────────
  log('\nSTEP 4 — Writing output files')
  log('──────────────────────────────')

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true })
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2))

  // Write a human-readable summary report
  const report = {
    generatedAt:    new Date().toISOString(),
    totalTrailheads: trailheads.length,
    matched,
    skipped,
    maxWalkMiles:   MAX_WALK_MILES,
    byOperator:     {},
    results: results.map(r => ({
      name:       r.name,
      station:    r.station,
      operator:   r.operator,
      walkMi:     r.walkMi,
      walkMin:    r.walkMin,
      transitMin: r.transitMin,
      totalMin:   r.totalMin,
      coords:     r.trailheadCoords,
    }))
  }

  // Count by operator
  results.forEach(r => {
    report.byOperator[r.operator] = (report.byOperator[r.operator] || 0) + 1
  })

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2))

  // ── Summary ────────────────────────────────────────────────────────────────
  log('\n══════════════════════════════════════════')
  log('DONE')
  log('══════════════════════════════════════════')
  log(`\nFound ${results.length} transit-accessible trailheads:\n`)

  Object.entries(report.byOperator)
    .sort((a, b) => b[1] - a[1])
    .forEach(([op, count]) => log(`  ${op}: ${count} trailheads`))

  log('\nClosest 10 to Manhattan:')
  results.slice(0, 10).forEach((r, i) => {
    log(`  ${i+1}. ${r.name} — ${r.totalMin} min total (${r.walkMi} mi walk from ${r.station})`)
  })

  log('\n📁 Output files:')
  log('  data/discovered-trailheads.json  ← full dataset for your website')
  log('  data/discovery-report.json       ← human-readable summary')
  log('\nNext steps:')
  log('  1. Review data/discovered-trailheads.json')
  log('  2. For trails you want to feature, fill in: difficulty, lengthMi, elevFt, desc, tips, alltrails')
  log('  3. Rename the file to data/trails.json and upload to GitHub\n')
}

main().catch(err => {
  log(`\n✗ Fatal error: ${err.message}`)
  log(err.stack)
  process.exit(1)
})
