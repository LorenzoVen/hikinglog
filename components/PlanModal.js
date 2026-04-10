import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { CHECKLIST_ITEMS, CHECKLIST_CATEGORIES } from '../lib/checklistItems'

const TABS = ['Transit', 'Map', 'Weather', 'Checklist', 'Trail Report']

// ── Helpers ───────────────────────────────────────────────────────────────────

function getOrigin(trail) {
  const line = (trail.line || '').toLowerCase()
  const op = (trail.operator || trail.transitType || '')
  if (op === 'LIRR') return { label: 'Penn Station', maps: 'Penn+Station,+New+York,+NY' }
  if (line.includes('port jervis') || line.includes('pascack')) return { label: 'Penn Station', maps: 'Penn+Station,+New+York,+NY' }
  if (op === 'NJ Transit' || line.includes('nj transit')) return { label: 'Port Authority Bus Terminal', maps: 'Port+Authority+Bus+Terminal,+New+York,+NY' }
  return { label: 'Grand Central Terminal', maps: 'Grand+Central+Terminal,+New+York,+NY' }
}

function getGoogleMapsUrl(trail) {
  const origin = getOrigin(trail)
  const dest = `${trail.trailheadCoords.lat},${trail.trailheadCoords.lng}`
  return `https://www.google.com/maps/dir/?api=1&origin=${origin.maps}&destination=${dest}&travelmode=transit`
}

function getMtaScheduleUrl(station, operator) {
  const enc = encodeURIComponent(station.replace(/\s*\(.*?\)/g, '').trim())
  if (operator === 'Metro-North' || operator === 'MNR')
    return `https://new.mta.info/schedules/metro-north-railroad?origin=${enc}`
  if (operator === 'LIRR')
    return `https://new.mta.info/schedules/long-island-rail-road?origin=${enc}`
  return 'https://new.mta.info/schedules'
}

function today() { return new Date().toISOString().split('T')[0] }

// ── Transit tab ───────────────────────────────────────────────────────────────
function TransitTab({ trail, tripDate }) {
  const stationClean = trail.station.replace(/\s*\(.*?\)/g, '').trim()
  const origin = getOrigin(trail)
  const scheduleUrl = getMtaScheduleUrl(trail.station, trail.operator || trail.transitType)

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-blue-50 rounded-xl p-4">
        <div className="text-[10px] text-blue-400 uppercase tracking-wide font-medium mb-2">Station</div>
        <div className="font-semibold text-blue-900 text-base">{stationClean}</div>
        <div className="text-sm text-blue-700">{trail.line || trail.operator}</div>
        <div className="text-xs text-blue-600 mt-1">~{trail.transitMin} min from {origin.label}</div>
        {tripDate && <div className="text-xs text-blue-500 mt-0.5">Selected date: {tripDate}</div>}
      </div>

      <a href={scheduleUrl} target="_blank" rel="noopener noreferrer"
        className="flex items-center justify-between w-full border border-gray-200 rounded-xl px-4 py-3.5 hover:bg-gray-50 transition-colors">
        <div>
          <div className="text-sm font-medium text-gray-800">View full schedule</div>
          <div className="text-xs text-gray-500 mt-0.5">Opens MTA timetable for {stationClean}</div>
        </div>
        <span className="text-gray-400">→</span>
      </a>

      <div className="bg-amber-50 rounded-xl p-4 text-xs text-amber-800">
        <span className="font-medium">Tip:</span> Buy your ticket before boarding — on-board purchases cost more on Metro-North and LIRR. Use the MTA TrainTime app or ticket machines at the station.
      </div>

      {trail.seasonal && trail.seasonNote && (
        <div className="bg-orange-50 rounded-xl p-4 text-xs text-orange-800">
          ⚠ <span className="font-medium">Seasonal:</span> {trail.seasonNote}
        </div>
      )}
    </div>
  )
}

// ── Map tab ───────────────────────────────────────────────────────────────────
function MapTab({ trail }) {
  const mapsUrl = getGoogleMapsUrl(trail)
  const origin = getOrigin(trail)
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  return (
    <div className="flex flex-col gap-4">
      {token && (
        <div className="rounded-xl overflow-hidden border border-gray-100" style={{ height: 200 }}>
          <img
            src={`https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/static/pin-s+2d7a2d(${trail.trailheadCoords.lng},${trail.trailheadCoords.lat}),pin-s+1a56c4(${trail.stationCoords?.lng || trail.trailheadCoords.lng},${trail.stationCoords?.lat || trail.trailheadCoords.lat})/${trail.trailheadCoords.lng},${trail.trailheadCoords.lat},11,0/600x300@2x?access_token=${token}`}
            alt="Trail map preview" className="w-full h-full object-cover"
            onError={e => { e.target.parentElement.style.display = 'none' }}
          />
        </div>
      )}

      <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
        className="flex items-center justify-between w-full border border-gray-200 rounded-xl px-4 py-3.5 hover:bg-gray-50 transition-colors">
        <div>
          <div className="text-sm font-medium text-gray-800">Open in Google Maps</div>
          <div className="text-xs text-gray-500 mt-0.5">{origin.label} → trailhead · Transit directions</div>
        </div>
        <span className="text-gray-400">→</span>
      </a>

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
        <p className="text-[11px] text-gray-400 mt-1">Forecasts available up to 7 days ahead. Changing date updates the date across all tabs.</p>
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
            <div className="bg-white/60 rounded-lg p-2">
              <div className="text-sky-400">Feels like</div>
              <div className="font-medium text-sky-900 mt-0.5">{weather.feelsLike}°F</div>
            </div>
            <div className="bg-white/60 rounded-lg p-2">
              <div className="text-sky-400">Rain</div>
              <div className="font-medium text-sky-900 mt-0.5">{weather.precipitation}%</div>
            </div>
            <div className="bg-white/60 rounded-lg p-2">
              <div className="text-sky-400">Wind</div>
              <div className="font-medium text-sky-900 mt-0.5">{weather.wind} mph</div>
            </div>
          </div>
          {weather.alert && (
            <div className="mt-3 text-xs text-orange-800 bg-orange-50 rounded-lg p-2">⚠ {weather.alert}</div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Checklist tab ─────────────────────────────────────────────────────────────
function ChecklistTab({ trail, user, tripDate, onLoginRequired }) {
  const trailId = String(trail.id || trail.osmId)
  const [tripId, setTripId] = useState(null)
  const [items, setItems] = useState([]) // {id, category, description, planned, packed, review}
  const [stage, setStage] = useState('planning') // 'planning' | 'packing' | 'review'
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [openCats, setOpenCats] = useState({})

  // Load or create trip + items when user/date changes
  useEffect(() => {
    if (!user || !tripDate || !supabase) { setLoading(false); return }
    async function load() {
      setLoading(true)
      // Upsert the trip record
      const { data: trip, error: tripErr } = await supabase
        .from('checklist_trips')
        .upsert({ user_id: user.id, trail_id: trailId, trip_date: tripDate }, { onConflict: 'user_id,trail_id,trip_date' })
        .select().single()
      if (tripErr || !trip) { setLoading(false); return }
      setTripId(trip.id)

      // Load existing items
      const { data: existing } = await supabase
        .from('checklist_items')
        .select('*')
        .eq('trip_id', trip.id)

      if (existing && existing.length > 0) {
        setItems(existing)
      } else {
        // Seed from master list — all items start unplanned
        const seed = CHECKLIST_ITEMS.map(i => ({
          trip_id: trip.id,
          user_id: user.id,
          category: i.category,
          description: i.description,
          planned: false,
          packed: false,
          review: null,
        }))
        const { data: inserted } = await supabase.from('checklist_items').insert(seed).select()
        setItems(inserted || seed)
      }
      setLoading(false)
    }
    load()
  }, [user, tripDate, trailId])

  async function updateItem(itemId, patch) {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, ...patch } : i))
    if (supabase && itemId && !itemId.startsWith('temp')) {
      await supabase.from('checklist_items').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', itemId)
    }
  }

  function toggleCat(cat) {
    setOpenCats(p => ({ ...p, [cat]: !p[cat] }))
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="text-4xl">📋</div>
        <div className="text-center">
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

  const plannedItems = items.filter(i => i.planned)
  const packedItems = items.filter(i => i.packed)
  const reviewedItems = items.filter(i => i.review)

  const STAGES = [
    { key: 'planning', label: 'Planning', count: plannedItems.length, total: items.length },
    { key: 'packing', label: 'Packing', count: packedItems.length, total: plannedItems.length },
    { key: 'review', label: 'Post-hike', count: reviewedItems.length, total: packedItems.length },
  ]

  const REVIEW_OPTIONS = ['needed more', 'had enough', 'too much']

  // Items shown depend on stage
  const visibleItems = stage === 'planning' ? items
    : stage === 'packing' ? items.filter(i => i.planned)
    : items.filter(i => i.packed)

  const grouped = CHECKLIST_CATEGORIES.reduce((acc, cat) => {
    const catItems = visibleItems.filter(i => i.category === cat)
    if (catItems.length > 0) acc[cat] = catItems
    return acc
  }, {})

  return (
    <div className="flex flex-col gap-4">
      {/* Stage selector */}
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
        {STAGES.map(s => (
          <button key={s.key} onClick={() => setStage(s.key)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${stage === s.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}>
            {s.label}
            <span className={`ml-1 ${stage === s.key ? 'text-green-700' : 'text-gray-400'}`}>
              {s.count}/{s.total}
            </span>
          </button>
        ))}
      </div>

      {/* Stage description */}
      <p className="text-xs text-gray-500">
        {stage === 'planning' && 'Select items you plan to bring on this hike.'}
        {stage === 'packing' && 'Confirm each item as you pack your bag.'}
        {stage === 'review' && 'After your hike — how was each item?'}
      </p>

      {/* Progress bar */}
      {stage !== 'review' && (
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-300"
            style={{ width: `${STAGES.find(s=>s.key===stage).total > 0 ? (STAGES.find(s=>s.key===stage).count / STAGES.find(s=>s.key===stage).total * 100) : 0}%`, background: '#2d7a2d' }} />
        </div>
      )}

      {/* Items by category */}
      {Object.entries(grouped).map(([cat, catItems]) => (
        <div key={cat} className="border border-gray-100 rounded-xl overflow-hidden">
          <button onClick={() => toggleCat(cat)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700">
            <span>{cat}</span>
            <span className="text-xs text-gray-400">
              {catItems.filter(i => stage === 'planning' ? i.planned : stage === 'packing' ? i.packed : i.review).length}/{catItems.length}
              <span className="ml-2">{openCats[cat] ? '▴' : '▾'}</span>
            </span>
          </button>

          {!openCats[cat] && catItems.map(item => (
            <div key={item.id || item.description} className="flex items-center gap-3 px-4 py-2.5 border-t border-gray-50">
              {stage === 'planning' && (
                <button onClick={() => updateItem(item.id, { planned: !item.planned })}
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${item.planned ? 'border-green-600 bg-green-600' : 'border-gray-300'}`}>
                  {item.planned && <span className="text-white text-xs font-bold">✓</span>}
                </button>
              )}
              {stage === 'packing' && (
                <button onClick={() => updateItem(item.id, { packed: !item.packed })}
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${item.packed ? 'border-blue-600 bg-blue-600' : 'border-gray-300'}`}>
                  {item.packed && <span className="text-white text-xs font-bold">✓</span>}
                </button>
              )}
              {stage === 'review' && <div className="w-5 shrink-0" />}

              <span className={`text-sm flex-1 ${
                stage === 'planning' && item.planned ? 'text-gray-800' :
                stage === 'packing' && item.packed ? 'text-gray-800' :
                'text-gray-600'}`}>
                {item.description}
              </span>

              {stage === 'review' && (
                <div className="flex gap-1">
                  {REVIEW_OPTIONS.map(opt => (
                    <button key={opt} onClick={() => updateItem(item.id, { review: item.review === opt ? null : opt })}
                      className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${item.review === opt
                        ? opt === 'needed more' ? 'border-orange-400 bg-orange-50 text-orange-700'
                          : opt === 'had enough' ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-blue-400 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-500'}`}>
                      {opt === 'needed more' ? '↑' : opt === 'had enough' ? '✓' : '↓'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}

      {Object.keys(grouped).length === 0 && (
        <div className="text-sm text-gray-400 text-center py-6">
          {stage === 'packing' ? 'No items planned yet — go to Planning first.' :
           stage === 'review' ? 'No items packed yet — complete the Packing stage first.' :
           'No items available.'}
        </div>
      )}
    </div>
  )
}

// ── Trail Report tab ──────────────────────────────────────────────────────────
function TrailReportTab({ trail, user, tripDate, onLoginRequired }) {
  const trailId = String(trail.id || trail.osmId)
  const [reports, setReports] = useState([])
  const [loadingReports, setLoadingReports] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const [form, setForm] = useState({
    visited_on: tripDate || today(),
    distance_mi: '', duration_min: '', elevation_gain_ft: '',
    what_happened: '', rating: 0, liked: 0,
    trail_type: '', hike_type: '', difficulty: '', grade: '',
    public_transport: null,
    parking: [], weather: '', temperature: '', wind: '',
    path: [], fauna: [], landscape: [], facilities: [],
    crowdedness: '',
    alltrails_link: '', garmin_link: '', avenza_link: '',
  })

  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggleArr = (k, v) => setForm(f => ({
    ...f, [k]: f[k].includes(v) ? f[k].filter(x => x !== v) : [...f[k], v]
  }))

  useEffect(() => { if (tripDate) sf('visited_on', tripDate) }, [tripDate])

  useEffect(() => {
    async function load() {
      if (!supabase) { setLoadingReports(false); return }
      const { data } = await supabase.from('trail_reports').select('*')
        .eq('trail_id', trailId).order('visited_on', { ascending: false }).limit(10)
      setReports(data || [])
      setLoadingReports(false)
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
    setSubmitting(false); setSubmitted(true); setShowForm(false)
    setTimeout(() => setSubmitted(false), 4000)
  }

  const SingleSelect = ({ k, options }) => (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => (
        <button key={o} type="button" onClick={() => sf(k, form[k] === o ? '' : o)}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${form[k] === o ? 'border-green-600 bg-green-50 text-green-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{o}</button>
      ))}
    </div>
  )
  const MultiSelect = ({ k, options }) => (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => (
        <button key={o} type="button" onClick={() => toggleArr(k, o)}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${form[k].includes(o) ? 'border-green-600 bg-green-50 text-green-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{o}</button>
      ))}
    </div>
  )
  const Stars = ({ k }) => (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(n => (
        <button key={n} type="button" onClick={() => sf(k, form[k] === n ? 0 : n)}
          className={`text-xl transition-colors ${form[k] >= n ? 'text-amber-400' : 'text-gray-200'}`}>★</button>
      ))}
    </div>
  )
  const Label = ({ children }) => <label className="text-xs text-gray-500 block mb-1.5">{children}</label>
  const Section = ({ title }) => <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2 border-t border-gray-100">{title}</div>

  return (
    <div className="flex flex-col gap-4">
      {loadingReports ? (
        <div className="text-sm text-gray-400 text-center py-4">Loading reports…</div>
      ) : reports.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            {reports.length} report{reports.length !== 1 ? 's' : ''}
          </div>
          {reports.map((r, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-3 text-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-700">@{r.username}</span>
                <span className="text-gray-400">{r.visited_on}</span>
              </div>
              {r.rating > 0 && <div className="text-amber-400 mb-1">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</div>}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {r.crowdedness && <span className="bg-white border border-gray-200 px-2 py-0.5 rounded-full text-gray-600">👥 {r.crowdedness}</span>}
                {r.weather && <span className="bg-white border border-gray-200 px-2 py-0.5 rounded-full text-gray-600">☁ {r.weather}</span>}
                {r.trail_condition && <span className="bg-white border border-gray-200 px-2 py-0.5 rounded-full text-gray-600">🥾 {r.trail_condition}</span>}
                {r.difficulty && <span className="bg-white border border-gray-200 px-2 py-0.5 rounded-full text-gray-600">{r.difficulty}</span>}
              </div>
              {r.what_happened && <p className="text-gray-500 leading-relaxed">{r.what_happened}</p>}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-400 text-center py-6 bg-gray-50 rounded-xl">
          No trail reports yet — be the first!
        </div>
      )}

      {submitted && (
        <div className="bg-green-50 rounded-xl p-4 text-sm text-green-700 text-center">Thanks for your report! 🥾</div>
      )}

      {!showForm ? (
        <button onClick={() => user ? setShowForm(true) : onLoginRequired()}
          className="w-full py-3 rounded-xl text-white text-sm font-medium" style={{ background: '#2d7a2d' }}>
          {user ? '+ Add your report' : 'Sign in to add a report'}
        </button>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4 border-t border-gray-100 pt-4">
          <Section title="Description" />
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Date visited</Label>
              <input type="date" value={form.visited_on} onChange={e => sf('visited_on', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" /></div>
            <div><Label>Distance (mi)</Label>
              <input type="number" step="0.1" value={form.distance_mi} onChange={e => sf('distance_mi', e.target.value)} placeholder="e.g. 5.2"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" /></div>
            <div><Label>Duration (min)</Label>
              <input type="number" value={form.duration_min} onChange={e => sf('duration_min', e.target.value)} placeholder="e.g. 180"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" /></div>
            <div><Label>Elevation gain (ft)</Label>
              <input type="number" value={form.elevation_gain_ft} onChange={e => sf('elevation_gain_ft', e.target.value)} placeholder="e.g. 1200"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" /></div>
          </div>
          <div><Label>Overall rating</Label><Stars k="rating" /></div>
          <div><Label>What happened</Label>
            <textarea value={form.what_happened} onChange={e => sf('what_happened', e.target.value)}
              placeholder="Describe your hike…" rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 resize-none" /></div>

          <Section title="Info" />
          <div><Label>Trail type</Label><SingleSelect k="trail_type" options={['out and back','point to point','loop','lollipop']} /></div>
          <div><Label>Type of hike</Label><SingleSelect k="hike_type" options={['New','Return','Again']} /></div>
          <div><Label>Difficulty</Label><SingleSelect k="difficulty" options={['Easy','Moderate','Hard']} /></div>
          <div><Label>Grade</Label><SingleSelect k="grade" options={['Beginners','Intermediate','Advanced']} /></div>
          <div><Label>Liked</Label><Stars k="liked" /></div>
          <div><Label>Used public transport?</Label>
            <div className="flex gap-2">
              {['Yes','No'].map(o => (
                <button key={o} type="button" onClick={() => sf('public_transport', o === 'Yes')}
                  className={`text-xs px-4 py-1.5 rounded-full border transition-colors ${form.public_transport === (o==='Yes') && form.public_transport !== null ? 'border-green-600 bg-green-50 text-green-800' : 'border-gray-200 text-gray-600'}`}>{o}</button>
              ))}
            </div>
          </div>
          <div><Label>Parking</Label><MultiSelect k="parking" options={['none','lot','roadside']} /></div>
          <div><Label>Weather</Label><SingleSelect k="weather" options={['Blizzard','Snow','Thunderstorm','Rain','Overcast','Cloudy','Sun']} /></div>
          <div><Label>Temperature</Label><SingleSelect k="temperature" options={['Freezing','Cold','Mild','Warm','Hot']} /></div>
          <div><Label>Wind</Label><SingleSelect k="wind" options={['None','Light','Mild','Strong']} /></div>
          <div><Label>Path</Label><MultiSelect k="path" options={['Paved','Rocks','Natural','Road','Sand','Mud','Ice','Overgrown']} /></div>
          <div><Label>Fauna</Label><MultiSelect k="fauna" options={['none','Birds','Rodents','Snakes','Bugs','Dogs','Cats','Bears']} /></div>
          <div><Label>Landscape</Label><MultiSelect k="landscape" options={['none','Waterfall','Bridge','Viewpoint','Tower']} /></div>
          <div><Label>Facilities</Label><MultiSelect k="facilities" options={['none','Info Point','Food','Bathrooms','Maps','Water']} /></div>
          <div><Label>Crowdedness</Label><SingleSelect k="crowdedness" options={['Empty','Quiet','Moderate','Busy','Very busy']} /></div>

          <Section title="Links (optional)" />
          {[['alltrails_link','AllTrails URL'],['garmin_link','Garmin URL'],['avenza_link','Avenza URL']].map(([k,p]) => (
            <div key={k}><Label>{p}</Label>
              <input type="url" value={form[k]} onChange={e => sf(k, e.target.value)} placeholder="https://…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" /></div>
          ))}

          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={submitting}
              className="flex-1 py-3 rounded-xl text-white text-sm font-medium disabled:opacity-50" style={{ background: '#2d7a2d' }}>
              {submitting ? 'Submitting…' : 'Submit report'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-600">Cancel</button>
          </div>
        </form>
      )}
    </div>
  )
}

// ── Main PlanModal ────────────────────────────────────────────────────────────
export default function PlanModal({ trail, onClose, onLoginRequired }) {
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

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl flex flex-col" style={{ maxHeight: '92vh' }}>

        {/* Header with date picker */}
        <div className="flex items-start justify-between p-4 border-b border-gray-100 shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-gray-900 text-base leading-snug truncate">{trail.name}</h2>
            <div className="flex items-center gap-2 mt-1.5">
              <input type="date" value={tripDate} min={today()}
                onChange={e => setTripDate(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-600 text-gray-700" />
              <span className="text-xs text-gray-400">{trail.station} · {trail.transitMin} min</span>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 text-lg shrink-0 ml-2">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 overflow-x-auto shrink-0">
          {TABS.map((tab, i) => (
            <button key={tab} onClick={() => setActiveTab(i)}
              className={`px-4 py-3 text-sm whitespace-nowrap font-medium transition-colors shrink-0 border-b-2 ${activeTab === i ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 0 && <TransitTab trail={trail} tripDate={tripDate} />}
          {activeTab === 1 && <MapTab trail={trail} />}
          {activeTab === 2 && <WeatherTab trail={trail} tripDate={tripDate} onDateChange={setTripDate} />}
          {activeTab === 3 && <ChecklistTab trail={trail} user={user} tripDate={tripDate} onLoginRequired={onLoginRequired} />}
          {activeTab === 4 && <TrailReportTab trail={trail} user={user} tripDate={tripDate} onLoginRequired={onLoginRequired} />}
        </div>
      </div>
    </div>
  )
}
