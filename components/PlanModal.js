import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { CHECKLIST_ITEMS, CHECKLIST_CATEGORIES } from '../lib/checklistItems'

const TABS = ['Transit', 'Weather', 'Checklist', 'Review', 'Past']

function today() { return new Date().toISOString().split('T')[0] }

// ── Origin helper ─────────────────────────────────────────────────────────────
function getOrigin(trail) {
  const line = (trail.line || '').toLowerCase()
  const op = trail.operator || trail.transitType || ''
  if (op === 'LIRR') return { label: 'Penn Station', maps: 'Penn+Station,+New+York,+NY' }
  if (line.includes('port jervis') || line.includes('pascack'))
    return { label: 'Penn Station', maps: 'Penn+Station,+New+York,+NY' }
  if (op === 'NJ Transit' || line.includes('nj transit'))
    return { label: 'Port Authority Bus Terminal', maps: 'Port+Authority+Bus+Terminal,+New+York,+NY' }
  return { label: 'Grand Central Terminal', maps: 'Grand+Central+Terminal,+New+York,+NY' }
}

function getMtaScheduleUrl(station, operator) {
  const enc = encodeURIComponent(station.replace(/\s*\(.*?\)/g, '').trim())
  if (operator === 'Metro-North' || operator === 'MNR')
    return `https://new.mta.info/schedules/metro-north-railroad?origin=${enc}`
  if (operator === 'LIRR')
    return `https://new.mta.info/schedules/long-island-rail-road?origin=${enc}`
  return 'https://new.mta.info/schedules'
}

function getGoogleMapsUrl(trail) {
  const origin = getOrigin(trail)
  const dest = `${trail.trailheadCoords.lat},${trail.trailheadCoords.lng}`
  return `https://www.google.com/maps/dir/?api=1&origin=${origin.maps}&destination=${dest}&travelmode=transit`
}

// ── Transit + Map tab ─────────────────────────────────────────────────────────
function TransitTab({ trail, tripDate }) {
  const stationClean = trail.station.replace(/\s*\(.*?\)/g, '').trim()
  const origin = getOrigin(trail)
  const scheduleUrl = getMtaScheduleUrl(trail.station, trail.operator || trail.transitType)
  const mapsUrl = getGoogleMapsUrl(trail)
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  return (
    <div className="flex flex-col gap-4">
      {/* Station card */}
      <div className="bg-blue-50 rounded-xl p-4">
        <div className="text-[10px] text-blue-400 uppercase tracking-wide font-medium mb-2">Station</div>
        <div className="font-semibold text-blue-900 text-base">{stationClean}</div>
        <div className="text-sm text-blue-700 mt-0.5">{trail.line || trail.operator}</div>
        <div className="text-xs text-blue-600 mt-1">~{trail.transitMin} min from {origin.label}</div>
        {tripDate && <div className="text-xs text-blue-500 mt-0.5">Selected date: {tripDate}</div>}
      </div>

      {/* Schedule link */}
      <a href={scheduleUrl} target="_blank" rel="noopener noreferrer"
        className="flex items-center justify-between w-full border border-gray-200 rounded-xl px-4 py-3.5 hover:bg-gray-50 transition-colors">
        <div>
          <div className="text-sm font-medium text-gray-800">View full schedule</div>
          <div className="text-xs text-gray-500 mt-0.5">Opens MTA timetable for {stationClean}</div>
        </div>
        <span className="text-gray-400">→</span>
      </a>

      <div className="bg-amber-50 rounded-xl p-3 text-xs text-amber-800">
        <span className="font-medium">Tip:</span> Buy your ticket before boarding — on-board purchases cost more. Use the MTA TrainTime app or station ticket machines.
      </div>

      {trail.seasonal && trail.seasonNote && (
        <div className="bg-orange-50 rounded-xl p-3 text-xs text-orange-800">
          ⚠ <span className="font-medium">Seasonal:</span> {trail.seasonNote}
        </div>
      )}

      {/* Map preview */}
      {token && (
        <div className="rounded-xl overflow-hidden border border-gray-100" style={{ height: 160 }}>
          <img
            src={`https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/static/pin-s+2d7a2d(${trail.trailheadCoords.lng},${trail.trailheadCoords.lat}),pin-s+1a56c4(${trail.stationCoords?.lng || trail.trailheadCoords.lng},${trail.stationCoords?.lat || trail.trailheadCoords.lat})/${trail.trailheadCoords.lng},${trail.trailheadCoords.lat},11,0/600x300@2x?access_token=${token}`}
            alt="Trail map" className="w-full h-full object-cover"
            onError={e => { e.target.parentElement.style.display = 'none' }}
          />
        </div>
      )}

      {/* Google Maps link */}
      <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
        className="flex items-center justify-between w-full border border-gray-200 rounded-xl px-4 py-3.5 hover:bg-gray-50 transition-colors">
        <div>
          <div className="text-sm font-medium text-gray-800">Open in Google Maps</div>
          <div className="text-xs text-gray-500 mt-0.5">{origin.label} → trailhead · Transit directions</div>
        </div>
        <span className="text-gray-400">→</span>
      </a>

      {/* Coordinates */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="text-gray-400 mb-1">Trailhead</div>
          <div className="font-mono text-gray-700">{trail.trailheadCoords.lat.toFixed(5)}</div>
          <div className="font-mono text-gray-700">{trail.trailheadCoords.lng.toFixed(5)}</div>
        </div>
        <div className="bg-blue-50 rounded-xl p-3">
          <div className="text-blue-400 mb-1">Station</div>
          <div className="font-mono text-blue-700">{(trail.stationCoords?.lat || trail.trailheadCoords.lat).toFixed(5)}</div>
          <div className="font-mono text-blue-700">{(trail.stationCoords?.lng || trail.trailheadCoords.lng).toFixed(5)}</div>
        </div>
      </div>
    </div>
  )
}

// ── Weather tab ───────────────────────────────────────────────────────────────
function WeatherTab({ trail, tripDate, onDateChange }) {
  const [weather, setWeather] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const maxDate = new Date(Date.now() + 7 * 864e5).toISOString().split('T')[0]

  const fetchWeather = useCallback(async (date) => {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/weather?lat=${trail.trailheadCoords.lat}&lng=${trail.trailheadCoords.lng}&date=${date}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setWeather(data)
    } catch (e) { setError('Could not load weather. Try again.') }
    setLoading(false)
  }, [trail])

  useEffect(() => { if (tripDate) fetchWeather(tripDate) }, [tripDate, fetchWeather])

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-xs text-gray-500 block mb-1.5">Hike date</label>
        <input type="date" value={tripDate} min={today()} max={maxDate}
          onChange={e => onDateChange(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
        <p className="text-[11px] text-gray-400 mt-1">Forecasts available up to 7 days ahead. Changing date updates all tabs.</p>
      </div>
      {loading && <div className="bg-gray-50 rounded-xl p-6 text-center text-sm text-gray-400">Loading weather…</div>}
      {error && <div className="bg-red-50 rounded-xl p-4 text-sm text-red-700">{error}</div>}
      {weather && !loading && (
        <div className="bg-sky-50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-2xl font-semibold text-sky-900">{weather.temp}°F</div>
              <div className="text-sm text-sky-700">{weather.description}</div>
            </div>
            <div className="text-5xl">{weather.icon}</div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs text-center">
            <div className="bg-white/60 rounded-lg p-2"><div className="text-sky-400">Feels like</div><div className="font-medium text-sky-900 mt-0.5">{weather.feelsLike}°F</div></div>
            <div className="bg-white/60 rounded-lg p-2"><div className="text-sky-400">Rain</div><div className="font-medium text-sky-900 mt-0.5">{weather.precipitation}%</div></div>
            <div className="bg-white/60 rounded-lg p-2"><div className="text-sky-400">Wind</div><div className="font-medium text-sky-900 mt-0.5">{weather.wind} mph</div></div>
          </div>
          {weather.alert && <div className="mt-3 text-xs text-orange-800 bg-orange-50 rounded-lg p-2">⚠ {weather.alert}</div>}
        </div>
      )}
    </div>
  )
}

// ── Checklist tab ─────────────────────────────────────────────────────────────
function ChecklistTab({ trail, user, tripDate, onLoginRequired }) {
  const trailId = String(trail.id || trail.osmId)
  const [tripId, setTripId] = useState(null)
  const [itemStates, setItemStates] = useState({}) // id -> {planned, packed, removed, review}
  const [stage, setStage] = useState('planning')
  const [loading, setLoading] = useState(true)
  const [openCats, setOpenCats] = useState({})

  // Initialise local state from master list
  function initStates(existingItems) {
    const s = {}
    CHECKLIST_ITEMS.forEach(item => {
      const existing = existingItems?.find(e => e.description === item.description && e.category === item.category)
      s[item.id] = {
        planned: existing?.planned || false,
        packed:  existing?.packed || false,
        removed: false,
        review:  existing?.review || null,
        dbId:    existing?.id || null,
      }
    })
    return s
  }

  useEffect(() => {
    if (!user || !tripDate || !supabase) { setItemStates(initStates([])); setLoading(false); return }
    async function load() {
      setLoading(true)
      const { data: trip } = await supabase
        .from('checklist_trips')
        .upsert({ user_id: user.id, trail_id: trailId, trip_date: tripDate }, { onConflict: 'user_id,trail_id,trip_date' })
        .select().single()
      if (!trip) { setLoading(false); return }
      setTripId(trip.id)
      const { data: existing } = await supabase.from('checklist_items').select('*').eq('trip_id', trip.id)
      if (existing && existing.length > 0) {
        setItemStates(initStates(existing))
      } else {
        // Seed blank items
        const seed = CHECKLIST_ITEMS.map(i => ({
          trip_id: trip.id, user_id: user.id,
          category: i.category, description: i.description,
          planned: false, packed: false, review: null,
        }))
        const { data: inserted } = await supabase.from('checklist_items').insert(seed).select()
        setItemStates(initStates(inserted || []))
      }
      setLoading(false)
    }
    load()
  }, [user, tripDate, trailId])

  async function updateState(itemId, patch) {
    setItemStates(prev => ({ ...prev, [itemId]: { ...prev[itemId], ...patch } }))
    if (supabase && tripId) {
      const item = CHECKLIST_ITEMS.find(i => i.id === itemId)
      if (!item) return
      await supabase.from('checklist_items')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('trip_id', tripId).eq('description', item.description).eq('category', item.category)
    }
  }

  function togglePlan(id) {
    const cur = itemStates[id]
    if (!cur) return
    const planned = !cur.planned
    updateState(id, { planned, packed: planned ? cur.packed : false, review: planned ? cur.review : null })
  }
  function togglePack(id) {
    const cur = itemStates[id]
    if (!cur) return
    const packed = !cur.packed
    updateState(id, { packed, review: packed ? cur.review : null })
  }
  function removeItem(id) {
    updateState(id, { removed: true, packed: false, review: null })
  }
  function setReview(id, val) {
    const cur = itemStates[id]
    updateState(id, { review: cur?.review === val ? null : val })
  }
  function toggleCat(cat) {
    setOpenCats(p => ({ ...p, [cat]: p[cat] === false ? true : false }))
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
        <div className="text-4xl">📋</div>
        <div>
          <p className="font-medium text-gray-800 mb-1">Sign in to use checklists</p>
          <p className="text-xs text-gray-500">Track what to bring, what you packed,<br/>and how it went after the hike.</p>
        </div>
        <button onClick={onLoginRequired}
          className="px-5 py-2.5 rounded-xl text-white text-sm font-medium" style={{ background: '#2d7a2d' }}>
          Sign in
        </button>
      </div>
    )
  }

  if (loading) return <div className="text-sm text-gray-400 text-center py-8">Loading checklist…</div>

  const allItems = CHECKLIST_ITEMS
  const planned = allItems.filter(i => itemStates[i.id]?.planned)
  const packed   = allItems.filter(i => itemStates[i.id]?.packed)
  const reviewed = allItems.filter(i => itemStates[i.id]?.review)

  const stageTotal = stage === 'planning' ? allItems.length : stage === 'packing' ? planned.length : allItems.length
  const stageDone  = stage === 'planning' ? planned.length  : stage === 'packing' ? packed.length   : reviewed.length
  const pct = stageTotal > 0 ? Math.round(stageDone / stageTotal * 100) : 0

  const STAGE_DESC = {
    planning:      'Select the items you plan to bring. Only selected items appear in Packing.',
    packing:       'Check off items as you pack. Packed items move to the bottom. × removes an item from this trip.',
    'post-hike':   'All items shown. Rate everything — including what you didn\'t plan or pack.',
  }

  const REVIEW_BTNS = (id) => {
    const r = itemStates[id]?.review
    return (
      <div className="flex gap-1 flex-shrink-0">
        {[['more','↑','border-orange-400 bg-orange-50 text-orange-700'],
          ['ok','✓','border-green-600 bg-green-50 text-green-800'],
          ['less','↓','border-blue-500 bg-blue-50 text-blue-800']].map(([val, label, activeClass]) => (
          <button key={val} onClick={() => setReview(id, val)}
            className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${r === val ? activeClass : 'border-gray-200 text-gray-400 hover:border-gray-400'}`}>
            {label}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Stage selector */}
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
        {[
          { key: 'planning',   label: 'Planning',  count: `${planned.length}/${allItems.length}` },
          { key: 'packing',    label: 'Packing',   count: `${packed.length}/${planned.length}` },
          { key: 'post-hike',  label: 'Post-hike', count: `${reviewed.length}/${allItems.length}` },
        ].map(s => (
          <button key={s.key} onClick={() => setStage(s.key)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors leading-tight ${stage === s.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}>
            {s.label}<br/>
            <span className={`text-[10px] font-normal ${stage === s.key ? 'text-green-700' : 'text-gray-400'}`}>{s.count}</span>
          </button>
        ))}
      </div>

      {/* Progress */}
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: '#2d7a2d' }} />
      </div>

      <p className="text-xs text-gray-500">{STAGE_DESC[stage]}</p>

      {/* Items by category */}
      {CHECKLIST_CATEGORIES.map(cat => {
        const catItems = CHECKLIST_ITEMS.filter(i => i.category === cat)

        let visible
        if (stage === 'planning') {
          visible = catItems
        } else if (stage === 'packing') {
          visible = catItems.filter(i => itemStates[i.id]?.planned && !itemStates[i.id]?.removed)
          if (visible.length === 0) return null
          // unpacked first, packed at bottom
          visible = [...visible.filter(i => !itemStates[i.id]?.packed), ...visible.filter(i => itemStates[i.id]?.packed)]
        } else {
          // post-hike: ALL items — packed, planned-not-packed, not-planned
          const packedItems   = catItems.filter(i => itemStates[i.id]?.packed)
          const plannedNP     = catItems.filter(i => itemStates[i.id]?.planned && !itemStates[i.id]?.packed)
          const notPlanned    = catItems.filter(i => !itemStates[i.id]?.planned)
          visible = [...packedItems, ...plannedNP, ...notPlanned]
        }

        const isOpen = openCats[cat] !== false
        const catDone = visible.filter(i => {
          if (stage === 'planning')  return itemStates[i.id]?.planned
          if (stage === 'packing')   return itemStates[i.id]?.packed
          return itemStates[i.id]?.review
        }).length

        return (
          <div key={cat} className="border border-gray-100 rounded-xl overflow-hidden">
            <button onClick={() => toggleCat(cat)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 text-sm font-medium text-gray-700">
              <span>{cat}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{catDone}/{visible.length}</span>
                <span className={`text-xs text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
              </div>
            </button>

            {isOpen && visible.map(item => {
              const st = itemStates[item.id] || {}
              const dimmed = stage === 'packing' && st.packed

              // Post-hike labels
              let noteEl = null
              let textColor = 'text-gray-800'
              if (stage === 'post-hike') {
                if (!st.planned) { noteEl = <span className="text-[11px] text-gray-400 italic ml-1">(not planned)</span>; textColor = 'text-gray-400' }
                else if (!st.packed) { noteEl = <span className="text-[11px] text-orange-500 italic ml-1">(not packed)</span>; textColor = 'text-gray-600' }
              }

              return (
                <div key={item.id}
                  className={`flex items-center gap-3 px-4 py-2.5 border-t border-gray-50 transition-opacity ${dimmed ? 'opacity-35' : ''}`}>

                  {stage === 'planning' && (
                    <button onClick={() => togglePlan(item.id)}
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${st.planned ? 'border-green-600 bg-green-600' : 'border-gray-300'}`}>
                      {st.planned && <span className="text-white text-xs font-bold">✓</span>}
                    </button>
                  )}

                  {stage === 'packing' && (
                    <button onClick={() => togglePack(item.id)}
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${st.packed ? 'border-blue-600 bg-blue-600' : 'border-gray-300'}`}>
                      {st.packed && <span className="text-white text-xs font-bold">✓</span>}
                    </button>
                  )}

                  {stage === 'post-hike' && <div className="w-5 flex-shrink-0" />}

                  <span className={`text-sm flex-1 ${st.packed && stage === 'packing' ? 'line-through text-gray-400' : textColor}`}>
                    {item.description}{noteEl}
                  </span>

                  {stage === 'packing' && (
                    <button onClick={() => removeItem(item.id)} className="text-gray-300 hover:text-red-500 text-lg leading-none flex-shrink-0 transition-colors">×</button>
                  )}

                  {stage === 'post-hike' && REVIEW_BTNS(item.id)}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ── Review (Trail Report) tab ─────────────────────────────────────────────────
function ReviewTab({ trail, user, tripDate, onLoginRequired }) {
  const trailId = String(trail.id || trail.osmId)
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const blank = {
    visited_on: tripDate || today(), distance_mi: '', duration_min: '', elevation_gain_ft: '',
    what_happened: '', rating: 0, liked: 0,
    trail_type: '', hike_type: '', difficulty: '', grade: '',
    public_transport: null, parking: [], weather: '', temperature: '', wind: '',
    path: [], fauna: [], landscape: [], facilities: [], crowdedness: '',
    alltrails_link: '', garmin_link: '', avenza_link: '',
  }
  const [form, setForm] = useState(blank)
  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggleArr = (k, v) => setForm(f => ({ ...f, [k]: f[k].includes(v) ? f[k].filter(x => x !== v) : [...f[k], v] }))

  useEffect(() => { if (tripDate) sf('visited_on', tripDate) }, [tripDate])

  useEffect(() => {
    async function load() {
      if (!supabase) { setLoading(false); return }
      const { data } = await supabase.from('trail_reports').select('*')
        .eq('trail_id', trailId).order('visited_on', { ascending: false }).limit(20)
      setReports(data || [])
      setLoading(false)
    }
    load()
  }, [trailId, submitted])

  async function submit(e) {
    e.preventDefault()
    if (!user) { onLoginRequired(); return }
    if (!supabase) return
    setSubmitting(true)
    await supabase.from('trail_reports').insert({
      trail_id: trailId, user_id: user.id,
      username: user.email?.split('@')[0] || 'hiker',
      ...form,
      distance_mi: form.distance_mi ? +form.distance_mi : null,
      duration_min: form.duration_min ? +form.duration_min : null,
      elevation_gain_ft: form.elevation_gain_ft ? +form.elevation_gain_ft : null,
    })
    setSubmitting(false); setSubmitted(true); setShowForm(false); setForm(blank)
    setTimeout(() => setSubmitted(false), 4000)
  }

  const SS = ({ k, opts }) => (
    <div className="flex flex-wrap gap-1.5">
      {opts.map(o => (
        <button key={o} type="button" onClick={() => sf(k, form[k] === o ? '' : o)}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${form[k] === o ? 'border-green-600 bg-green-50 text-green-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{o}</button>
      ))}
    </div>
  )
  const MS = ({ k, opts }) => (
    <div className="flex flex-wrap gap-1.5">
      {opts.map(o => (
        <button key={o} type="button" onClick={() => toggleArr(k, o)}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${form[k].includes(o) ? 'border-green-600 bg-green-50 text-green-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{o}</button>
      ))}
    </div>
  )
  const Stars = ({ k }) => (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(n => (
        <button key={n} type="button" onClick={() => sf(k, form[k] === n ? 0 : n)}
          className={`text-xl ${form[k] >= n ? 'text-amber-400' : 'text-gray-200'}`}>★</button>
      ))}
    </div>
  )
  const Lbl = ({c}) => <label className="text-xs text-gray-500 block mb-1.5">{c}</label>
  const Sec = ({t}) => <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide pt-2 border-t border-gray-100 mt-2">{t}</div>

  return (
    <div className="flex flex-col gap-4">
      {loading ? (
        <div className="text-sm text-gray-400 text-center py-4">Loading reviews…</div>
      ) : reports.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{reports.length} report{reports.length !== 1 ? 's' : ''}</div>
          {reports.map((r, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-3 text-xs">
              <div className="flex justify-between mb-1.5">
                <span className="font-medium text-gray-700">@{r.username}</span>
                <span className="text-gray-400">{r.visited_on}</span>
              </div>
              {r.rating > 0 && <div className="text-amber-400 mb-1.5">{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</div>}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {r.crowdedness && <span className="bg-white border border-gray-200 px-2 py-0.5 rounded-full text-gray-600">👥 {r.crowdedness}</span>}
                {r.weather && <span className="bg-white border border-gray-200 px-2 py-0.5 rounded-full text-gray-600">☁ {r.weather}</span>}
                {r.difficulty && <span className="bg-white border border-gray-200 px-2 py-0.5 rounded-full text-gray-600">{r.difficulty}</span>}
                {(r.path||[]).map(p => <span key={p} className="bg-white border border-gray-200 px-2 py-0.5 rounded-full text-gray-600">🥾 {p}</span>)}
              </div>
              {r.what_happened && <p className="text-gray-500 leading-relaxed">{r.what_happened}</p>}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-400 text-center py-6 bg-gray-50 rounded-xl">No reviews yet — be the first!</div>
      )}

      {submitted && <div className="bg-green-50 rounded-xl p-4 text-sm text-green-700 text-center">Thanks for your review! 🥾</div>}

      {!showForm ? (
        <button onClick={() => user ? setShowForm(true) : onLoginRequired()}
          className="w-full py-3 rounded-xl text-white text-sm font-medium" style={{ background: '#2d7a2d' }}>
          {user ? '+ Add your review' : 'Sign in to add a review'}
        </button>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3 border-t border-gray-100 pt-4">
          <Sec t="Description" />
          <div className="grid grid-cols-2 gap-3">
            <div><Lbl c="Date visited" /><input type="date" value={form.visited_on} onChange={e => sf('visited_on', e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" /></div>
            <div><Lbl c="Distance (mi)" /><input type="number" step="0.1" value={form.distance_mi} onChange={e => sf('distance_mi', e.target.value)} placeholder="5.2" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" /></div>
            <div><Lbl c="Duration (min)" /><input type="number" value={form.duration_min} onChange={e => sf('duration_min', e.target.value)} placeholder="180" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" /></div>
            <div><Lbl c="Elevation (ft)" /><input type="number" value={form.elevation_gain_ft} onChange={e => sf('elevation_gain_ft', e.target.value)} placeholder="1200" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" /></div>
          </div>
          <div><Lbl c="Overall rating" /><Stars k="rating" /></div>
          <div><Lbl c="What happened" /><textarea value={form.what_happened} onChange={e => sf('what_happened', e.target.value)} placeholder="Describe your hike…" rows={3} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 resize-none" /></div>
          <Sec t="Info" />
          <div><Lbl c="Trail type" /><SS k="trail_type" opts={['out and back','point to point','loop','lollipop']} /></div>
          <div><Lbl c="Type of hike" /><SS k="hike_type" opts={['New','Return','Again']} /></div>
          <div><Lbl c="Difficulty" /><SS k="difficulty" opts={['Easy','Moderate','Hard']} /></div>
          <div><Lbl c="Grade" /><SS k="grade" opts={['Beginners','Intermediate','Advanced']} /></div>
          <div><Lbl c="Liked" /><Stars k="liked" /></div>
          <div><Lbl c="Used public transport?" />
            <div className="flex gap-2">{['Yes','No'].map(o => <button key={o} type="button" onClick={() => sf('public_transport', o==='Yes')} className={`text-xs px-4 py-1.5 rounded-full border transition-colors ${form.public_transport===(o==='Yes') && form.public_transport!==null ? 'border-green-600 bg-green-50 text-green-800' : 'border-gray-200 text-gray-600'}`}>{o}</button>)}</div>
          </div>
          <div><Lbl c="Parking" /><MS k="parking" opts={['none','lot','roadside']} /></div>
          <div><Lbl c="Weather" /><SS k="weather" opts={['Blizzard','Snow','Thunderstorm','Rain','Overcast','Cloudy','Sun']} /></div>
          <div><Lbl c="Temperature" /><SS k="temperature" opts={['Freezing','Cold','Mild','Warm','Hot']} /></div>
          <div><Lbl c="Wind" /><SS k="wind" opts={['None','Light','Mild','Strong']} /></div>
          <div><Lbl c="Path" /><MS k="path" opts={['Paved','Rocks','Natural','Road','Sand','Mud','Ice','Overgrown']} /></div>
          <div><Lbl c="Fauna" /><MS k="fauna" opts={['none','Birds','Rodents','Snakes','Bugs','Dogs','Cats','Bears']} /></div>
          <div><Lbl c="Landscape" /><MS k="landscape" opts={['none','Waterfall','Bridge','Viewpoint','Tower']} /></div>
          <div><Lbl c="Facilities" /><MS k="facilities" opts={['none','Info Point','Food','Bathrooms','Maps','Water']} /></div>
          <div><Lbl c="Crowdedness" /><SS k="crowdedness" opts={['Empty','Quiet','Moderate','Busy','Very busy']} /></div>
          <Sec t="Links (optional)" />
          {[['alltrails_link','AllTrails URL'],['garmin_link','Garmin URL'],['avenza_link','Avenza URL']].map(([k,p]) => (
            <div key={k}><Lbl c={p} /><input type="url" value={form[k]} onChange={e => sf(k, e.target.value)} placeholder="https://…" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" /></div>
          ))}
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={submitting} className="flex-1 py-3 rounded-xl text-white text-sm font-medium disabled:opacity-50" style={{ background: '#2d7a2d' }}>
              {submitting ? 'Submitting…' : 'Submit review'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-600">Cancel</button>
          </div>
        </form>
      )}
    </div>
  )
}

// ── Past tab ──────────────────────────────────────────────────────────────────
function PastTab({ trail, user }) {
  const trailId = String(trail.id || trail.osmId)
  const [reports, setReports] = useState([])
  const [trips, setTrips] = useState([])
  const [combined, setCombined] = useState([])
  const [idx, setIdx] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!user || !supabase) { setLoading(false); return }
      const [{ data: reps }, { data: tripsData }] = await Promise.all([
        supabase.from('trail_reports').select('*').eq('trail_id', trailId).eq('user_id', user.id).order('visited_on', { ascending: false }),
        supabase.from('checklist_trips').select('*, checklist_items(*)').eq('trail_id', trailId).eq('user_id', user.id).order('trip_date', { ascending: false }),
      ])
      // Merge by date
      const dates = new Set([...(reps||[]).map(r=>r.visited_on), ...(tripsData||[]).map(t=>t.trip_date)])
      const merged = [...dates].sort((a,b) => b.localeCompare(a)).map(date => ({
        date,
        report: (reps||[]).find(r => r.visited_on === date),
        trip:   (tripsData||[]).find(t => t.trip_date === date),
      }))
      setCombined(merged)
      setLoading(false)
    }
    load()
  }, [user, trailId])

  if (!user) return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
      <div className="text-4xl">📅</div>
      <p className="font-medium text-gray-800">Sign in to see your past hikes</p>
    </div>
  )
  if (loading) return <div className="text-sm text-gray-400 text-center py-8">Loading…</div>
  if (combined.length === 0) return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
      <div className="text-4xl">🥾</div>
      <p className="font-medium text-gray-800">No past hikes recorded yet</p>
      <p className="text-xs text-gray-500">Use the Checklist and Review tabs on your next hike.</p>
    </div>
  )

  const entry = combined[idx]
  const r = entry.report
  const clItems = entry.trip?.checklist_items || []
  const reviewedItems = clItems.filter(i => i.review)

  return (
    <div className="flex flex-col gap-4">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium text-gray-800 text-sm">{entry.date}</div>
          <div className="text-xs text-gray-400">{idx+1} of {combined.length} past hike{combined.length!==1?'s':''}</div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIdx(i => Math.max(0,i-1))} disabled={idx===0}
            className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 disabled:opacity-30 hover:bg-gray-50">‹</button>
          <button onClick={() => setIdx(i => Math.min(combined.length-1,i+1))} disabled={idx===combined.length-1}
            className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 disabled:opacity-30 hover:bg-gray-50">›</button>
        </div>
      </div>

      {/* Report summary */}
      {r && (
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-2">Review</div>
          {r.rating > 0 && <div className="text-amber-400 mb-2">{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</div>}
          <div className="flex flex-wrap gap-1.5 mb-3 text-xs">
            {r.weather && <span className="bg-white border border-gray-200 px-2 py-0.5 rounded-full text-gray-600">☁ {r.weather}</span>}
            {r.temperature && <span className="bg-white border border-gray-200 px-2 py-0.5 rounded-full text-gray-600">🌡 {r.temperature}</span>}
            {r.crowdedness && <span className="bg-white border border-gray-200 px-2 py-0.5 rounded-full text-gray-600">👥 {r.crowdedness}</span>}
            {r.difficulty && <span className="bg-white border border-gray-200 px-2 py-0.5 rounded-full text-gray-600">{r.difficulty}</span>}
            {(r.path||[]).map(p => <span key={p} className="bg-white border border-gray-200 px-2 py-0.5 rounded-full text-gray-600">🥾 {p}</span>)}
          </div>
          {r.what_happened && <p className="text-xs text-gray-600 leading-relaxed">{r.what_happened}</p>}
          <div className="grid grid-cols-3 gap-2 mt-3 text-xs text-center">
            {r.distance_mi && <div className="bg-white rounded-lg p-2"><div className="text-gray-400">Distance</div><div className="font-medium">{r.distance_mi} mi</div></div>}
            {r.duration_min && <div className="bg-white rounded-lg p-2"><div className="text-gray-400">Duration</div><div className="font-medium">{r.duration_min} min</div></div>}
            {r.elevation_gain_ft && <div className="bg-white rounded-lg p-2"><div className="text-gray-400">Elevation</div><div className="font-medium">{r.elevation_gain_ft} ft</div></div>}
          </div>
        </div>
      )}

      {/* Checklist review summary */}
      {reviewedItems.length > 0 && (
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-3">Checklist review</div>
          <div className="flex flex-col gap-0">
            {reviewedItems.map((item, i) => {
              const cls = item.review==='more' ? 'text-orange-600' : item.review==='ok' ? 'text-green-700' : 'text-blue-600'
              const label = item.review==='more' ? '↑ needed more' : item.review==='ok' ? '✓ had enough' : '↓ too much'
              return (
                <div key={i} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0 text-xs">
                  <span className="text-gray-700">{item.description}</span>
                  <span className={`font-medium ${cls}`}>{label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!r && reviewedItems.length === 0 && (
        <div className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-xl">No data recorded for this date.</div>
      )}
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function PlanModal({ trail, onClose, onLoginRequired, onSaveForLater, embedded = false, inlineTab = null }) {
  const [activeTab, setActiveTab] = useState(0)
  const [tripDate, setTripDate] = useState(today())
  const { user } = useAuth()

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Sync inlineTab prop (when used as embedded detail panel)
  const TAB_MAP = { transit: 0, weather: 1, checklist: 2, review: 3, 'trail links': 4, past: 5 }
  const resolvedTab = inlineTab && TAB_MAP[inlineTab] !== undefined ? TAB_MAP[inlineTab] : activeTab

  const tabContent = (
    <>
      {resolvedTab === 0 && <TransitTab trail={trail} tripDate={tripDate} />}
      {resolvedTab === 1 && <WeatherTab trail={trail} tripDate={tripDate} onDateChange={setTripDate} />}
      {resolvedTab === 2 && <ChecklistTab trail={trail} user={user} tripDate={tripDate} onLoginRequired={onLoginRequired} />}
      {resolvedTab === 3 && <ReviewTab trail={trail} user={user} tripDate={tripDate} onLoginRequired={onLoginRequired} />}
      {resolvedTab === 4 && <PastTab trail={trail} user={user} />}
    </>
  )

  // Embedded mode — just render the tab content, no modal chrome
  if (embedded) return tabContent

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl flex flex-col" style={{ maxHeight: '92vh' }}>

        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-gray-900 text-base leading-snug truncate">{trail.name}</h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <input type="date" value={tripDate} min={today()}
                onChange={e => setTripDate(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-600 text-gray-700" />
              <span className="text-xs text-gray-400">{trail.station} · {trail.transitMin} min</span>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 text-lg flex-shrink-0 ml-2">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 overflow-x-auto flex-shrink-0 scrollbar-hide">
          {TABS.map((tab, i) => (
            <button key={tab} onClick={() => setActiveTab(i)}
              className={`px-4 py-3 text-sm whitespace-nowrap font-medium transition-colors flex-shrink-0 border-b-2 ${activeTab === i ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {tabContent}
        </div>
      </div>
    </div>
  )
}
