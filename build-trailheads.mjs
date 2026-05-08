/**
 * build-trailheads.mjs
 *
 * Discovers transit-accessible trailheads near NYC by:
 *   1. Auto-downloading MTA feeds (Metro-North + LIRR) — no login needed
 *   2. Loading ALL additional GTFS zip files found in gtfs-data/ folder
 *      (NJ Transit rail, NJ Transit bus, Academy Bus, Shortline/Coach USA,
 *       Transbridge, Cumberland, Warren, Sussex, etc.)
 *   3. Querying OpenStreetMap Overpass for trailheads + hiking routes
 *   4. Matching each trailhead to its nearest transit stop within MAX_WALK_MILES
 *   5. Writing:
 *        data/discovered-trailheads.json   — website-ready format
 *        data/supabase-import.json         — ready for Supabase table import
 *        data/discovery-report.json        — human-readable summary
 *
 * HOW TO RUN:
 *   node build-trailheads.mjs
 *
 * GTFS SETUP — place files in gtfs-data/ folder:
 *   gtfs-data/njtransit-rail.zip     NJ Transit Rail
 *   gtfs-data/njtransit-bus.zip      NJ Transit Bus
 *   gtfs-data/academy.zip            Academy Bus
 *   gtfs-data/shortline.zip          Shortline (Coach USA)
 *   gtfs-data/transbridge.zip        Transbridge Lines
 *   gtfs-data/cumberland.zip         Cumberland County
 *   (MTA feeds are auto-downloaded — no action needed)
 *
 * Requires Node 18+. No extra packages needed.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── Config ──────────────────────────────────────────────────────────────────

const MAX_WALK_MILES = 2.0
const WALK_SPEED_MPH = 3.0

// Bounding box: covers NY, NJ, CT + surrounding area
const BBOX = { minLat: 39.5, maxLat: 42.5, minLng: -75.5, maxLng: -71.5 }

// ── River boundary definitions ────────────────────────────────────────────────
// Each river is defined by a rough polygon of waypoints.
// We check if a trailhead and station are on OPPOSITE sides — if so, apply penalty.
// Format: { name, segments: [[lng1,lat1],[lng2,lat2],...] }
// The segments trace the river centerline N→S. We test which side each point is on
// using a simple longitude-based band check per latitude zone.

const RIVER_BANDS = [
  {
    name: 'Hudson River',
    // lat zone → [minLng of river, maxLng of river]
    // Points within this lng band but on opposite latitudes = opposite sides
    zones: [
      { minLat: 40.70, maxLat: 40.90, minLng: -74.02, maxLng: -73.95 }, // NYC/Yonkers
      { minLat: 40.90, maxLat: 41.20, minLng: -73.97, maxLng: -73.90 }, // Tarrytown area
      { minLat: 41.20, maxLat: 41.60, minLng: -73.98, maxLng: -73.93 }, // Peekskill/Cold Spring
      { minLat: 41.60, maxLat: 42.00, minLng: -73.98, maxLng: -73.92 }, // Beacon/Poughkeepsie
    ],
  },
  {
    name: 'Arthur Kill / Kill Van Kull',
    zones: [
      { minLat: 40.55, maxLat: 40.72, minLng: -74.26, maxLng: -74.06 }, // Staten Island/NJ
    ],
  },
  {
    name: 'Raritan Bay / Raritan River',
    zones: [
      { minLat: 40.43, maxLat: 40.55, minLng: -74.30, maxLng: -74.00 },
    ],
  },
]

// Returns true if point a and point b are likely on opposite sides of any river
function crossesRiver(a, b) {
  for (const river of RIVER_BANDS) {
    for (const zone of river.zones) {
      const aInLat = a.lat >= zone.minLat && a.lat <= zone.maxLat
      const bInLat = b.lat >= zone.minLat && b.lat <= zone.maxLat
      if (!aInLat && !bInLat) continue
      // Check if one point is clearly east and the other clearly west of the river band
      const aWest = a.lng < zone.minLng
      const aEast = a.lng > zone.maxLng
      const bWest = b.lng < zone.minLng
      const bEast = b.lng > zone.maxLng
      if ((aWest && bEast) || (aEast && bWest)) return { crosses: true, river: river.name }
    }
  }
  return { crosses: false }
}

const RIVER_PENALTY = 4.0  // multiply effective distance by this if crossing a river

// ── River crossing detection ───────────────────────────────────────────────────
// Approximate river boundaries as line segments [lat1,lng1,lat2,lng2]
// A match that crosses one of these gets a 3× distance penalty and a suspect flag
// Hudson River: runs roughly N-S, trailheads east of lng ~ -73.97 between
// certain latitudes, stations west, or vice versa
const RIVER_BOUNDARIES = [
  // Hudson River — from Yonkers to Newburgh
  // West bank approx lng -73.99 to -74.02, east bank -73.95 to -73.97
  { name: 'Hudson River', type: 'lng_band',
    minLat: 40.9, maxLat: 41.75,
    westLng: -74.05, eastLng: -73.93 },
  // Arthur Kill / Kill Van Kull — separates Staten Island from NJ
  { name: 'Arthur Kill', type: 'lng_band',
    minLat: 40.52, maxLat: 40.65,
    westLng: -74.25, eastLng: -74.12 },
  // Raritan River — central NJ, runs W-E
  { name: 'Raritan River', type: 'lat_band',
    minLng: -74.60, maxLng: -74.05,
    southLat: 40.49, northLat: 40.56 },
  // Delaware River — western NJ boundary
  { name: 'Delaware River', type: 'lng_band',
    minLat: 39.7, maxLat: 41.4,
    westLng: -75.25, eastLng: -74.95 },
]

// Returns {crosses: bool, riverName: string} if stop and trailhead are on opposite
// sides of a river boundary
function checkRiverCrossing(trailCoords, stopCoords) {
  for (const r of RIVER_BOUNDARIES) {
    if (r.type === 'lng_band') {
      // Check if both points are within the latitude range of this river
      const trailInRange = trailCoords.lat >= r.minLat && trailCoords.lat <= r.maxLat
      const stopInRange  = stopCoords.lat  >= r.minLat && stopCoords.lat  <= r.maxLat
      if (!trailInRange || !stopInRange) continue
      // Check if they are on opposite sides of the river band
      const trailWest = trailCoords.lng < r.westLng
      const trailEast = trailCoords.lng > r.eastLng
      const stopWest  = stopCoords.lng  < r.westLng
      const stopEast  = stopCoords.lng  > r.eastLng
      const trailInRiver = !trailWest && !trailEast
      const stopInRiver  = !stopWest  && !stopEast
      // Opposite sides: one is strictly west, other is strictly east
      if ((trailWest && stopEast) || (trailEast && stopWest)) {
        return { crosses: true, riverName: r.name }
      }
      // One is in the river band and the other is across — also suspect
      if ((trailInRiver || stopInRiver) && (trailWest !== stopWest || trailEast !== stopEast)) {
        return { crosses: true, riverName: r.name }
      }
    } else if (r.type === 'lat_band') {
      // Check if both points are within the longitude range
      const trailInRange = trailCoords.lng >= r.minLng && trailCoords.lng <= r.maxLng
      const stopInRange  = stopCoords.lng  >= r.minLng && stopCoords.lng  <= r.maxLng
      if (!trailInRange || !stopInRange) continue
      const trailSouth = trailCoords.lat < r.southLat
      const trailNorth = trailCoords.lat > r.northLat
      const stopSouth  = stopCoords.lat  < r.southLat
      const stopNorth  = stopCoords.lat  > r.northLat
      if ((trailSouth && stopNorth) || (trailNorth && stopSouth)) {
        return { crosses: true, riverName: r.name }
      }
    }
  }
  return { crosses: false }
}

const GTFS_DIR     = path.join(__dirname, 'gtfs-data')
const OUTPUT_PATH  = path.join(__dirname, 'data', 'discovered-trailheads.json')
const SUPABASE_OUT = path.join(__dirname, 'data', 'supabase-import.json')
const REPORT_PATH  = path.join(__dirname, 'data', 'discovery-report.json')

// Filename stem → friendly operator name
// Keys are lowercase filename stems (without .zip)
const OPERATOR_NAMES = {
  // MTA (auto-downloaded)
  'gtfsmnr':                    'Metro-North',
  'mnr':                        'Metro-North',
  'metro-north':                'Metro-North',
  'gtfslirr':                   'LIRR',
  'lirr':                       'LIRR',
  // NJ Transit
  'njt_rail_data':              'NJ Transit Rail',
  'njt_bus_data':               'NJ Transit Bus',
  'njtransit-rail':             'NJ Transit Rail',
  'njtransit-bus':              'NJ Transit Bus',
  // Coach / Express bus
  'academy_bus_data':           'Academy Bus',
  'coach_gtfs':                 'Coach USA (Shortline)',
  'trans-bridge_bus_data':      'Trans-Bridge Lines',
  'lakelandbuslines_bus_data':  'Lakeland Bus Lines',
  'broadway_bus_data':          'Broadway Bus',
  // County transit
  'atlanticco_bus_data':        'Atlantic County Transit',
  'burlingtonshuttles_bus_data':'Burlington County Shuttles',
  'cumberland_co_bus_data':     'Cumberland County Transit',
  'gloucester_co_bus_data':     'Gloucester County Transit',
  'hunterdon_co_bus_data':      'Hunterdon County Transit',
  'sjta_bus_data':              'South Jersey Transit (SJTA)',
  'somersetcounty_bus_data':    'Somerset County Transit',
  'sussexcounty_bus_data':      'Sussex County Transit',
  'tuckertonseaport_bus_data':  'Tuckerton Seaport Ferry',
  'wct_bus_data':               'Warren County Transit',
}

// Files to skip entirely (duplicates or irrelevant)
const SKIP_FILES = new Set([
  'google_transit',  // duplicate of NJT feeds
])

// GTFS route_type → human label
const ROUTE_TYPE_LABEL = {
  0: 'Tram', 1: 'Subway', 2: 'Rail', 3: 'Bus', 4: 'Ferry',
  100: 'Rail', 101: 'Rail', 700: 'Bus', 701: 'Bus', 702: 'Bus',
}

// MTA feeds auto-downloaded if missing or older than 7 days
// Only needed if you don't have metro-north.zip / lirr.zip already
const AUTO_DOWNLOAD = {
  'gtfsmnr':  'https://rrgtfsfeeds.s3.amazonaws.com/gtfsmnr.zip',
  'gtfslirr': 'https://rrgtfsfeeds.s3.amazonaws.com/gtfslirr.zip',
}

// Overpass mirrors tried in order
const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
]

// Known transit times from Manhattan (minutes, off-peak)
const KNOWN_TIMES = {
  'Breakneck Ridge': 90, 'Cold Spring': 88, 'Beacon': 88,
  'Garrison': 80, 'Peekskill': 68, 'Croton-Harmon': 55, 'Tarrytown': 40,
  'Towners': 80, 'Pawling': 95, 'Brewster': 75, 'Goldens Bridge': 70,
  'Katonah': 65, 'Mount Kisco': 60, 'Bedford Hills': 65,
  'Tuxedo': 65, 'Sloatsburg': 60, 'Suffern': 55,
  'Bay Shore': 55, 'Cold Spring Harbor': 70, 'Oyster Bay': 75,
  'Mahwah': 50, 'Ramsey': 55, 'Westfield': 45,
}

// Origin terminals for time estimation
const GCT  = { lat: 40.7527, lng: -73.9772 }
const PENN = { lat: 40.7506, lng: -73.9971 }
const PABT = { lat: 40.7571, lng: -73.9903 }

// ─── Utilities ────────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms))
const log   = msg => process.stdout.write(msg + '\n')
const r7    = n => Math.round(n * 1e7) / 1e7
const r1    = n => Math.round(n * 10) / 10

function haversineMiles(a, b) {
  const R = 3958.8
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const x = Math.sin(dLat/2)**2 + Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.asin(Math.sqrt(x))
}


// ── River crossing detection ─────────────────────────────────────────────────
// Each river is defined as a set of lat/lng segments.
// A trailhead-to-station line that crosses any segment is penalised.
// Longitudes are approximate but sufficient to catch the main crossings.
const RIVERS = [
  {
    name: 'Hudson River',
    // Approximate west bank longitude at key latitudes
    // Trailhead east of this + station west = cross-river (and vice versa)
    segments: [
      { minLat: 40.60, maxLat: 41.80, westLng: -74.05, eastLng: -73.88 },
    ]
  },
  {
    name: 'Raritan River',
    segments: [
      { minLat: 40.48, maxLat: 40.56, westLng: -74.60, eastLng: -74.08 },
    ]
  },
  {
    name: 'Arthur Kill / Kill van Kull',
    segments: [
      { minLat: 40.55, maxLat: 40.67, westLng: -74.26, eastLng: -74.14 },
    ]
  },
  {
    name: 'Delaware River',
    segments: [
      { minLat: 39.50, maxLat: 41.40, westLng: -75.20, eastLng: -74.68 },
    ]
  },
]

function detectRiverCrossing(fromCoords, toCoords) {
  for (const river of RIVERS) {
    for (const seg of river.segments) {
      const midLat = (fromCoords.lat + toCoords.lat) / 2
      if (midLat < seg.minLat || midLat > seg.maxLat) continue
      // Check if the two points straddle the river band
      const fromWest = fromCoords.lng < seg.westLng
      const toWest   = toCoords.lng   < seg.westLng
      const fromEast = fromCoords.lng > seg.eastLng
      const toEast   = toCoords.lng   > seg.eastLng
      // One point clearly west of river band, other clearly east
      if ((fromWest && toEast) || (fromEast && toWest)) {
        return { crosses: true, river: river.name }
      }
    }
  }
  return { crosses: false }
}

const RIVER_PENALTY = 4.0  // multiply effective distance by this if river crossing detected

function operatorFromFile(filename) {
  const stem = path.basename(filename, '.zip').toLowerCase()
  return OPERATOR_NAMES[stem] || stem.split(/[-_]/).map(w => w[0].toUpperCase()+w.slice(1)).join(' ')
}

// Detect if a stop is a local city bus stop we'd never use to hike
// (stop names that are clearly urban street intersections)
function isUrbanBusStop(stopName) {
  if (!stopName) return false
  // Street intersection patterns: "Main St & Elm Ave", "Rt 1 & Rt 9"
  if (/\d+\s*&\s*\d+/.test(stopName)) return true       // numbered intersections
  if (/\bSt\s*&\b|\bAve\s*&\b|\bRd\s*&\b/.test(stopName)) return true  // street intersections
  return false
}

// ─── ZIP reader (no npm deps) ─────────────────────────────────────────────────

async function extractFromZip(zipPath, targetFile) {
  const buf = fs.readFileSync(zipPath)
  const sig = Buffer.from([0x50,0x4b,0x03,0x04])
  let offset = 0
  while (offset < buf.length - 4) {
    const pos = buf.indexOf(sig, offset)
    if (pos === -1) break
    const compression   = buf.readUInt16LE(pos + 8)
    const compressedSz  = buf.readUInt32LE(pos + 18)
    const fnLen         = buf.readUInt16LE(pos + 26)
    const extraLen      = buf.readUInt16LE(pos + 28)
    const filename      = buf.slice(pos+30, pos+30+fnLen).toString('utf8')
    const dataStart     = pos + 30 + fnLen + extraLen
    if (filename === targetFile || filename.endsWith('/'+targetFile)) {
      // Bounds check — catches truncated/corrupted zips
      if (dataStart + compressedSz > buf.length) {
        throw new Error(`Unexpected end of file in ${filename} (file may be corrupted or incompletely downloaded)`)
      }
      const raw = buf.slice(dataStart, dataStart + compressedSz)
      if (compression === 0) return raw.toString('utf8')
      if (compression === 8) {
        const { inflateRaw } = await import('zlib')
        return new Promise((res, rej) => inflateRaw(raw, (e, r) => e ? rej(e) : res(r.toString('utf8'))))
      }
      throw new Error(`Unsupported ZIP compression method ${compression} in ${filename}`)
    }
    if (dataStart + compressedSz > buf.length) break  // stop scanning corrupted zip
    offset = dataStart + compressedSz
  }
  return null
}

// ─── CSV parser ───────────────────────────────────────────────────────────────

function parseCsv(text) {
  if (!text) return []
  const lines = text.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g,'').replace(/^\uFEFF/,''))
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g,''))
    const row = {}
    headers.forEach((h,i) => { row[h] = vals[i] || '' })
    return row
  }).filter(r => Object.values(r).some(v => v))
}

// ─── Load one GTFS zip ────────────────────────────────────────────────────────

async function loadGtfs(zipPath, operator) {
  // stops.txt
  const stopsCsv = await extractFromZip(zipPath, 'stops.txt')
  if (!stopsCsv) { log(`  ⚠ No stops.txt in ${path.basename(zipPath)}`); return [] }
  const rawStops = parseCsv(stopsCsv)
    .filter(r => r.stop_lat && r.stop_lon && r.stop_name && !isNaN(+r.stop_lat))
    .map(r => ({ id: r.stop_id, name: r.stop_name, lat: +r.stop_lat, lng: +r.stop_lon }))

  // routes.txt
  const routeMap = {}
  const routesCsv = await extractFromZip(zipPath, 'routes.txt')
  if (routesCsv) {
    parseCsv(routesCsv).forEach(r => {
      if (r.route_id) routeMap[r.route_id] = {
        name: r.route_long_name || r.route_short_name || operator,
        type: ROUTE_TYPE_LABEL[+r.route_type] || 'Transit',
      }
    })
  }

  // trips.txt
  const tripRoute = {}
  const tripsCsv = await extractFromZip(zipPath, 'trips.txt')
  if (tripsCsv) parseCsv(tripsCsv).forEach(r => { if (r.trip_id && r.route_id) tripRoute[r.trip_id] = r.route_id })

  // stop_times.txt — only first trip per stop
  const stopTrip = {}
  const stCsv = await extractFromZip(zipPath, 'stop_times.txt')
  if (stCsv) parseCsv(stCsv).forEach(r => { if (r.stop_id && r.trip_id && !stopTrip[r.stop_id]) stopTrip[r.stop_id] = r.trip_id })

  // Annotate stops with line name
  return rawStops.map(s => {
    const route = routeMap[tripRoute[stopTrip[s.id]]]
    return { ...s, operator, lineName: route?.name || operator, routeType: route?.type || 'Transit' }
  })
}

// ─── Overpass with fallback ───────────────────────────────────────────────────

async function overpass(query, attempt = 0) {
  if (attempt >= OVERPASS.length) throw new Error('All Overpass servers unavailable')
  log(`  → ${OVERPASS[attempt]}`)
  try {
    const res = await fetch(OVERPASS[attempt], {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'HikingLog/1.0 (hikinglog.com)' },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(120_000),
    })
    if (res.status === 429) { await sleep(15000); return overpass(query, attempt+1) }
    if (res.status >= 500)  { await sleep(8000);  return overpass(query, attempt+1) }
    if (!res.ok)             { await sleep(3000);  return overpass(query, attempt+1) }
    return res.json()
  } catch (e) {
    log(`  ✗ ${e.message}`)
    await sleep(3000)
    return overpass(query, attempt+1)
  }
}

// ─── Trailhead discovery ──────────────────────────────────────────────────────

const NOISE = /^(red|blue|green|orange|yellow|white|black|purple|pink|brown)\s+(trail(head)?|blaze|marker|loop|connector)$/i

function dedupe(items, mi = 0.15) {
  const kept = []
  for (const it of items) {
    if (!kept.some(k => Math.sqrt((k.lat-it.lat)**2*69**2 + (k.lng-it.lng)**2*53**2) < mi)) kept.push(it)
  }
  return kept
}

async function fetchTrailheads() {
  const bb = `${BBOX.minLat},${BBOX.minLng},${BBOX.maxLat},${BBOX.maxLng}`
  log('\n  Query 1/2: trailhead nodes…')
  const d1 = await overpass(`[out:json][timeout:90][maxsize:268435456];(node["tourism"="trailhead"](${bb});node["highway"="trailhead"](${bb});way["tourism"="trailhead"](${bb});way["highway"="trailhead"](${bb}););out center 2000;`)
  const nodes = (d1.elements||[]).filter(el => (el.lat??el.center?.lat) && el.tags?.name)
    .map(el => ({ osmId: el.id, name: el.tags.name, lat: r7(el.lat??el.center.lat), lng: r7(el.lon??el.center.lon), source: 'trailhead-tag' }))
  log(`  → ${nodes.length} trailhead nodes`)
  await sleep(3000)
  log('\n  Query 2/2: named hiking routes…')
  const d2 = await overpass(`[out:json][timeout:120][maxsize:268435456];relation["route"="hiking"]["name"](${bb});out center 2000;`)
  const routes = (d2.elements||[]).filter(el => el.center?.lat && el.tags?.name)
    .map(el => ({ osmId: el.id, name: el.tags.name, lat: r7(el.center.lat), lng: r7(el.center.lon), source: 'hiking-relation' }))
  log(`  → ${routes.length} hiking route relations`)
  const all = [...nodes, ...routes].filter(t => !NOISE.test(t.name.trim()))
  const deduped = dedupe(all)
  log(`  ✓ ${deduped.length} unique trailheads after cleanup`)
  return deduped
}

// ─── Transit time ─────────────────────────────────────────────────────────────

function transitTime(stationName, stationCoords, operator) {
  if (KNOWN_TIMES[stationName]) return KNOWN_TIMES[stationName]
  const op = operator.toLowerCase()
  const isBus  = op.includes('bus') || op.includes('coach') || op.includes('transbridge') || op.includes('academy')
  const isLIRR = op.includes('lirr')
  const isNJR  = op.includes('nj transit rail')
  const origin = isBus ? PABT : (isLIRR || isNJR) ? PENN : GCT
  const dist = haversineMiles(origin, stationCoords)
  return Math.round((isBus ? 25 : 20) + dist * (isBus ? 1.5 : 1.8))
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log('\n🥾 HikingLog — Multi-GTFS Trailhead Discovery')
  log('══════════════════════════════════════════════\n')

  // Step 1: Auto-download MTA feeds
  log('STEP 1 — MTA GTFS feeds (auto-download if needed)')
  log('───────────────────────────────────────────────────')
  fs.mkdirSync(GTFS_DIR, { recursive: true })
  const { createWriteStream } = await import('fs')
  const { pipeline } = await import('stream/promises')
  for (const [key, url] of Object.entries(AUTO_DOWNLOAD)) {
    const dest = path.join(GTFS_DIR, `${key}.zip`)
    const stale = !fs.existsSync(dest) || (Date.now() - fs.statSync(dest).mtimeMs > 7*86400000)
    if (!stale) { log(`  Using cached ${key}.zip`); continue }
    log(`  Downloading ${key}…`)
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await pipeline(res.body, createWriteStream(dest))
      log(`  ✓ ${key}.zip downloaded`)
    } catch (e) { log(`  ✗ ${key}: ${e.message}`) }
  }

  // Step 2: Load all GTFS zips
  log('\nSTEP 2 — Loading all GTFS feeds')
  log('──────────────────────────────────')
  const zips = fs.readdirSync(GTFS_DIR).filter(f => f.endsWith('.zip'))
  if (!zips.length) { log('✗ No GTFS zips found in gtfs-data/'); process.exit(1) }

  const allStops = []
  for (const zip of zips) {
    const stem = path.basename(zip, '.zip').toLowerCase()
    // Skip files explicitly listed in SKIP_FILES
    if (SKIP_FILES.has(stem)) {
      log(`\n  ⏭  ${zip} → skipped (listed in SKIP_FILES)`)
      continue
    }
    // Skip MTA auto-download files if we already have lirr/metro-north named files
    // to avoid double-counting (e.g. both gtfslirr.zip and lirr.zip)
    const op = operatorFromFile(zip)
    log(`\n  📦 ${zip} → ${op}`)
    try {
      const stops = await loadGtfs(path.join(GTFS_DIR, zip), op)
      const regional = stops.filter(s =>
        s.lat >= BBOX.minLat && s.lat <= BBOX.maxLat &&
        s.lng >= BBOX.minLng && s.lng <= BBOX.maxLng &&
        !isUrbanBusStop(s.name)
      )
      allStops.push(...regional)
      log(`  ✓ ${regional.length} regional stops`)
    } catch (e) {
      if (e.message.includes('end of file') || e.message.includes('unexpected')) {
        log(`  ✗ CORRUPTED FILE: ${e.message}`)
        log(`     → Re-download this file from the NJ Transit developer portal`)
        log(`     → Run: node check-gtfs.mjs for a full diagnostic`)
      } else {
        log(`  ✗ ${e.message}`)
      }
    }
  }

  // Deduplicate stops appearing in multiple feeds
  const seen = new Set()
  const uniqueStops = allStops.filter(s => {
    const k = `${s.name.toLowerCase().trim()}|${Math.round(s.lat*1000)}|${Math.round(s.lng*1000)}`
    if (seen.has(k)) return false
    seen.add(k); return true
  })
  log(`\n  Total: ${allStops.length} stops → ${uniqueStops.length} after deduplication`)

  // Step 3: Fetch trailheads
  log('\nSTEP 3 — OpenStreetMap trailheads')
  log('────────────────────────────────────')
  const trailheads = await fetchTrailheads()

  // Step 4: Match
  log('\nSTEP 4 — Matching trailheads to nearest stop')
  log('──────────────────────────────────────────────')
  const results = []
  let skipped = 0, flagged = 0
  for (const th of trailheads) {
    let nearest = null, nearestDist = Infinity, nearestRiver = null
    const thCoords = { lat: th.lat, lng: th.lng }

    for (const stop of uniqueStops) {
      const stopCoords = { lat: stop.lat, lng: stop.lng }
      const rawDist = haversineMiles(thCoords, stopCoords)
      // Apply river crossing penalty to effective distance used for comparison
      const crossing = detectRiverCrossing(thCoords, stopCoords)
      const effectiveDist = crossing.crosses ? rawDist * RIVER_PENALTY : rawDist
      if (effectiveDist < nearestDist && rawDist <= MAX_WALK_MILES * RIVER_PENALTY) {
        nearestDist = effectiveDist
        nearest = stop
        nearestRiver = crossing.crosses ? crossing.river : null
      }
    }

    // Still require raw distance to be within 2x MAX_WALK_MILES for any match
    if (!nearest) { skipped++; continue }
    const rawDist = haversineMiles(thCoords, { lat: nearest.lat, lng: nearest.lng })
    if (rawDist > MAX_WALK_MILES && !nearestRiver) { skipped++; continue }

    const isSuspect = nearestRiver !== null
    if (isSuspect) flagged++

    const walkMi   = r1(rawDist)
    const walkMin  = Math.round(rawDist / WALK_SPEED_MPH * 60)
    const tranMin  = transitTime(nearest.name, { lat: nearest.lat, lng: nearest.lng }, nearest.operator)
    results.push({
      id: results.length + 1,
      name: th.name,
      osmId: String(th.osmId),
      source: th.source,
      trailheadCoords: { lat: th.lat, lng: th.lng },
      station: nearest.name,
      line: nearest.lineName,
      operator: nearest.operator,
      routeType: nearest.routeType,
      stationCoords: { lat: r7(nearest.lat), lng: r7(nearest.lng) },
      walkMi, walkMin,
      transitMin: tranMin,
      totalMin: tranMin + walkMin,
      difficulty: null, lengthMi: null, elevFt: null,
      desc: null, tips: null, alltrails: null,
      seasonal: false, seasonNote: null,
      // Suspect flag — review these in Supabase/admin panel
      suspect_match: isSuspect,
      suspect_note: isSuspect ? `Possible ${nearestRiver} crossing between trailhead and ${nearest.name} — verify walk route` : null,
    })
  }
  results.sort((a,b) => a.totalMin - b.totalMin)
  log(`  ✓ ${results.length} matched, ${skipped} skipped, ${flagged} flagged for river crossing review`)

  // Step 5: Write outputs
  log('\nSTEP 5 — Writing files')
  log('────────────────────────')
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true })
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2))
  log(`  ✓ data/discovered-trailheads.json`)

  // Supabase format
  const supaRows = results.map(r => ({
    osm_id: r.osmId, name: r.name, source: r.source,
    lat: r.trailheadCoords.lat, lng: r.trailheadCoords.lng,
    station: r.station, line: r.line, operator: r.operator, route_type: r.routeType,
    station_lat: r.stationCoords.lat, station_lng: r.stationCoords.lng,
    walk_mi: r.walkMi, walk_min: r.walkMin,
    transit_min: r.transitMin, total_min: r.totalMin,
    difficulty: '', length_mi: '', elev_ft: '',
    description: '', tips: '', alltrails_url: '',
    seasonal: false, season_note: '',
    suspect_match: r.suspect_match || false,
    suspect_note: r.suspect_note || '',
    approved: false,
  }))
  fs.writeFileSync(SUPABASE_OUT, JSON.stringify(supaRows, null, 2))
  log(`  ✓ data/supabase-import.json`)

  // Also write CSV — Supabase imports CSV cleanly with empty strings for nulls
  const CSV_PATH = path.join(__dirname, 'data', 'supabase-import.csv')
  const csvHeaders = Object.keys(supaRows[0])
  const csvEscape = v => {
    if (v === null || v === undefined || v === '') return ''
    const s = String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? '"' + s.replace(/"/g, '""') + '"'
      : s
  }
  const csvLines = [
    csvHeaders.join(','),
    ...supaRows.map(row => csvHeaders.map(h => csvEscape(row[h])).join(','))
  ]
  fs.writeFileSync(CSV_PATH, csvLines.join('\n'))
  log(`  ✓ data/supabase-import.csv (use this for Supabase import — handles empty fields correctly)`)

  const byOp = {}
  results.forEach(r => { byOp[r.operator] = (byOp[r.operator]||0) + 1 })
  fs.writeFileSync(REPORT_PATH, JSON.stringify({
    generatedAt: new Date().toISOString(),
    totalTrailheads: trailheads.length, matched: results.length, skipped,
    gtfsFiles: zips, byOperator: byOp,
    closest20: results.slice(0,20).map(r => ({ name: r.name, station: r.station, operator: r.operator, walkMi: r.walkMi, totalMin: r.totalMin })),
  }, null, 2))
  log(`  ✓ data/discovery-report.json`)

  // Summary
  log('\n══════════════════════════════════════════════')
  log(`${results.length} trailheads found:\n`)
  Object.entries(byOp).sort((a,b)=>b[1]-a[1]).forEach(([op,n]) => log(`  ${op}: ${n}`))
  const suspect = results.filter(r => r.suspectMatch)
  if (suspect.length > 0) {
    log(`\n⚠ ${suspect.length} suspect cross-river matches flagged:`)
    suspect.slice(0, 10).forEach(r => log(`  • ${r.name} → ${r.station} (${r.suspectNote})`))
    log('  → These are imported with suspect_match=true in Supabase.')
    log('  → Review and fix coordinates in the Admin panel before approving.')
  }
  log('\nClosest 10:')
  results.slice(0,10).forEach((r,i) => log(`  ${i+1}. ${r.name} — ${r.totalMin} min (${r.walkMi} mi walk from ${r.station}, ${r.operator})`))
  log('\nGTFS files processed:')
  zips.forEach(z => {
    const stem = path.basename(z, '.zip').toLowerCase()
    if (SKIP_FILES.has(stem)) log(`  ⏭  ${z} (skipped)`)
    else log(`  ✓  ${z} → ${operatorFromFile(z)}`)
  })
  log('\nNext steps:')
  log('  1. Review data/discovery-report.json to check counts by operator')
  log('  2. Import data/supabase-import.json into Supabase trailheads table')
  log('  3. In Supabase Table Editor, set approved=true for entries you want live\n')
}

main().catch(e => { log(`\n✗ ${e.message}\n${e.stack}`); process.exit(1) })
