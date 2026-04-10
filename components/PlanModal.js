import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const TABS = ['Transit', 'Map', 'Weather', 'Checklist', 'Trail Report']

const DEFAULT_CHECKLIST = [
  { id: 'water', label: 'Water (at least 2L)', checked: false },
  { id: 'snacks', label: 'Snacks / food', checked: false },
  { id: 'layers', label: 'Extra layers / rain jacket', checked: false },
  { id: 'boots', label: 'Hiking boots or trail shoes', checked: false },
  { id: 'socks', label: 'Moisture-wicking socks', checked: false },
  { id: 'sunscreen', label: 'Sunscreen', checked: false },
  { id: 'map', label: 'Downloaded offline map', checked: false },
  { id: 'firstaid', label: 'Basic first aid kit', checked: false },
  { id: 'phone', label: 'Fully charged phone', checked: false },
  { id: 'cash', label: 'Cash / transit card', checked: false },
  { id: 'ticket', label: 'Train ticket booked', checked: false },
]

function getMtaScheduleUrl(station, operator) {
  const enc = encodeURIComponent(station.replace(/\s*\(.*?\)/g, '').trim())
  if (operator === 'Metro-North' || operator === 'MNR') {
    return `https://new.mta.info/schedules/metro-north-railroad?origin=${enc}`
  }
  if (operator === 'LIRR') {
    return `https://new.mta.info/schedules/long-island-rail-road?origin=${enc}`
  }
  return `https://new.mta.info/schedules`
}

function getGoogleMapsUrl(trail) {
  const origin = trail.operator === 'LIRR'
    ? 'Penn+Station,+New+York,+NY'
    : trail.line?.toLowerCase().includes('port jervis') || trail.line?.toLowerCase().includes('pascack')
      ? 'Penn+Station,+New+York,+NY'
      : 'Grand+Central+Terminal,+New+York,+NY'

  const stationName = encodeURIComponent(trail.station.replace(/\s*\(.*?\)/g, '').trim())
  const dest = `${trail.trailheadCoords.lat},${trail.trailheadCoords.lng}`
  return `https://www.google.com/maps/dir/${origin}/${stationName}/${dest}/`
}

// ── Tab: Transit ──────────────────────────────────────────────────────────────
function TransitTab({ trail }) {
  const scheduleUrl = getMtaScheduleUrl(trail.station, trail.operator)
  const stationClean = trail.station.replace(/\s*\(.*?\)/g, '').trim()

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-blue-50 rounded-xl p-4">
        <div className="text-[10px] text-blue-400 uppercase tracking-wide font-medium mb-2">Station</div>
        <div className="font-semibold text-blue-900 text-base">{stationClean}</div>
        <div className="text-sm text-blue-700">{trail.line || trail.operator}</div>
        <div className="text-xs text-blue-600 mt-1">~{trail.transitMin} min from {
          trail.operator === 'LIRR' || trail.line?.toLowerCase().includes('port jervis')
            ? 'Penn Station'
            : 'Grand Central'
        }</div>
      </div>

      <a
        href={scheduleUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between w-full border border-gray-200 rounded-xl px-4 py-3.5 hover:bg-gray-50 transition-colors"
      >
        <div>
          <div className="text-sm font-medium text-gray-800">View full schedule</div>
          <div className="text-xs text-gray-500 mt-0.5">Opens MTA timetable for {stationClean}</div>
        </div>
        <span className="text-gray-400 text-lg">→</span>
      </a>

      <div className="bg-amber-50 rounded-xl p-4 text-xs text-amber-800">
        <span className="font-medium">Tip:</span> Buy your ticket before boarding — on-board purchases cost more on Metro-North and LIRR. Use the MTA TrainTime app or ticket machines at the station.
      </div>

      {trail.seasonal && trail.seasonNote && (
        <div className="bg-orange-50 rounded-xl p-4 text-xs text-orange-800">
          ⚠ <span className="font-medium">Seasonal stop:</span> {trail.seasonNote}
        </div>
      )}
    </div>
  )
}

// ── Tab: Map ──────────────────────────────────────────────────────────────────
function MapTab({ trail }) {
  const mapsUrl = getGoogleMapsUrl(trail)
  const origin = trail.operator === 'LIRR' || trail.line?.toLowerCase().includes('port jervis')
    ? 'Penn Station, NYC'
    : 'Grand Central Terminal, NYC'

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-gray-100 rounded-xl overflow-hidden" style={{ height: 200 }}>
        <img
          src={`https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/static/pin-s+2d7a2d(${trail.trailheadCoords.lng},${trail.trailheadCoords.lat}),pin-s+1a56c4(${trail.stationCoords?.lng || trail.trailheadCoords.lng},${trail.stationCoords?.lat || trail.trailheadCoords.lat})/${trail.trailheadCoords.lng},${trail.trailheadCoords.lat},11,0/600x300@2x?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`}
          alt="Trail map preview"
          className="w-full h-full object-cover"
          onError={e => { e.target.style.display = 'none' }}
        />
      </div>

      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between w-full border border-gray-200 rounded-xl px-4 py-3.5 hover:bg-gray-50 transition-colors"
      >
        <div>
          <div className="text-sm font-medium text-gray-800">Open in Google Maps</div>
          <div className="text-xs text-gray-500 mt-0.5">{origin} → {trail.station.replace(/\s*\(.*?\)/g, '').trim()} → trailhead</div>
        </div>
        <span className="text-gray-400 text-lg">→</span>
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

// ── Tab: Weather ──────────────────────────────────────────────────────────────
function WeatherTab({ trail }) {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [weather, setWeather] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function fetchWeather() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/weather?lat=${trail.trailheadCoords.lat}&lng=${trail.trailheadCoords.lng}&date=${date}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setWeather(data)
    } catch (e) {
      setError('Could not load weather. Try again.')
    }
    setLoading(false)
  }

  useEffect(() => { fetchWeather() }, [date])

  const today = new Date().toISOString().split('T')[0]
  const maxDate = new Date(Date.now() + 7 * 864e5).toISOString().split('T')[0]
  const isForecast = date > today

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-xs text-gray-500 block mb-1.5">Hike date</label>
        <input
          type="date" value={date} min={today} max={maxDate}
          onChange={e => setDate(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
        />
        <p className="text-[11px] text-gray-400 mt-1">Forecasts available up to 7 days ahead</p>
      </div>

      {loading && (
        <div className="bg-gray-50 rounded-xl p-6 text-center text-sm text-gray-400">Loading weather…</div>
      )}

      {error && (
        <div className="bg-red-50 rounded-xl p-4 text-sm text-red-700">{error}</div>
      )}

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
              <div className="text-sky-400">Rain chance</div>
              <div className="font-medium text-sky-900 mt-0.5">{weather.precipitation}%</div>
            </div>
            <div className="bg-white/60 rounded-lg p-2">
              <div className="text-sky-400">Wind</div>
              <div className="font-medium text-sky-900 mt-0.5">{weather.wind} mph</div>
            </div>
          </div>
          {weather.alert && (
            <div className="mt-3 text-xs text-orange-800 bg-orange-50 rounded-lg p-2">
              ⚠ {weather.alert}
            </div>
          )}
        </div>
      )}

      {isForecast && (
        <p className="text-[11px] text-gray-400 text-center">
          Forecast accuracy decreases beyond 3 days. Always check again closer to your hike.
        </p>
      )}
    </div>
  )
}

// ── Tab: Checklist ────────────────────────────────────────────────────────────
function ChecklistTab({ trail, user, onLoginRequired }) {
  const [items, setItems] = useState(DEFAULT_CHECKLIST)
  const [saving, setSaving] = useState(false)
  const storageKey = `checklist-${trail.id || trail.osmId}`

  useEffect(() => {
    // Load from localStorage first (works without login)
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      try { setItems(JSON.parse(stored)) } catch {}
    }
  }, [storageKey])

  function toggle(id) {
    setItems(prev => {
      const next = prev.map(i => i.id === id ? { ...i, checked: !i.checked } : i)
      localStorage.setItem(storageKey, JSON.stringify(next))
      return next
    })
  }

  function reset() {
    const fresh = DEFAULT_CHECKLIST
    setItems(fresh)
    localStorage.removeItem(storageKey)
  }

  const done = items.filter(i => i.checked).length

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-gray-800">Pre-hike checklist</div>
          <div className="text-xs text-gray-500">{done}/{items.length} items ready</div>
        </div>
        <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600">Reset</button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${(done / items.length) * 100}%`, background: '#2d7a2d' }}
        />
      </div>

      <div className="flex flex-col gap-1">
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => toggle(item.id)}
            className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 text-left transition-colors"
          >
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${item.checked ? 'border-green-600 bg-green-600' : 'border-gray-300'}`}>
              {item.checked && <span className="text-white text-xs font-bold">✓</span>}
            </div>
            <span className={`text-sm ${item.checked ? 'line-through text-gray-400' : 'text-gray-700'}`}>
              {item.label}
            </span>
          </button>
        ))}
      </div>

      {!user && (
        <div className="bg-gray-50 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-500 mb-2">Sign in to save your checklist across devices</p>
          <button
            onClick={onLoginRequired}
            className="text-xs font-medium px-4 py-2 rounded-xl border border-gray-200 hover:bg-white transition-colors text-gray-700"
          >
            Sign in
          </button>
        </div>
      )}
    </div>
  )
}

// ── Tab: Trail Report ─────────────────────────────────────────────────────────
function TrailReportTab({ trail, user, onLoginRequired }) {
  const trailId = String(trail.id || trail.osmId)
  const [reports, setReports] = useState([])
  const [loadingReports, setLoadingReports] = useState(true)
  const [form, setForm] = useState({
    visited_on: new Date().toISOString().split('T')[0],
    crowdedness: '',
    parking: '',
    water_available: '',
    trail_condition: '',
    notes: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    async function load() {
      if (!supabase) { setLoadingReports(false); return }
      const { data } = await supabase
        .from('trail_reports')
        .select('*')
        .eq('trail_id', trailId)
        .order('visited_on', { ascending: false })
        .limit(10)
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
      trail_id: trailId,
      user_id: user.id,
      username: user.email?.split('@')[0] || 'hiker',
      ...form,
    })
    setSubmitting(false)
    setSubmitted(true)
    setForm({ visited_on: new Date().toISOString().split('T')[0], crowdedness: '', parking: '', water_available: '', trail_condition: '', notes: '' })
    setTimeout(() => setSubmitted(false), 3000)
  }

  const CROWD = ['Empty', 'Quiet', 'Moderate', 'Busy', 'Very busy']
  const PARKING = ['Easy', 'Limited', 'Full', 'No parking']
  const WATER = ['Yes', 'Seasonal', 'No', 'Unknown']
  const CONDITION = ['Excellent', 'Good', 'Muddy', 'Icy', 'Overgrown']

  return (
    <div className="flex flex-col gap-4">
      {/* Existing reports */}
      {loadingReports ? (
        <div className="text-sm text-gray-400 text-center py-4">Loading reports…</div>
      ) : reports.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Recent reports</div>
          {reports.map((r, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-3 text-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-700">@{r.username}</span>
                <span className="text-gray-400">{r.visited_on}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {r.crowdedness && <span className="bg-white border border-gray-200 px-2 py-0.5 rounded-full text-gray-600">👥 {r.crowdedness}</span>}
                {r.parking && <span className="bg-white border border-gray-200 px-2 py-0.5 rounded-full text-gray-600">🅿 {r.parking}</span>}
                {r.water_available && <span className="bg-white border border-gray-200 px-2 py-0.5 rounded-full text-gray-600">💧 Water: {r.water_available}</span>}
                {r.trail_condition && <span className="bg-white border border-gray-200 px-2 py-0.5 rounded-full text-gray-600">🥾 {r.trail_condition}</span>}
              </div>
              {r.notes && <p className="text-gray-500 mt-2">{r.notes}</p>}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-xl">
          No trail reports yet — be the first!
        </div>
      )}

      {/* Submit form */}
      <div className="border-t border-gray-100 pt-4">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Add your report</div>
        {submitted ? (
          <div className="bg-green-50 rounded-xl p-4 text-sm text-green-700 text-center">Thanks for your report! 🥾</div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Date visited</label>
              <input
                type="date" value={form.visited_on}
                onChange={e => setForm(f => ({ ...f, visited_on: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>

            {[
              { key: 'crowdedness', label: 'Crowdedness', options: CROWD },
              { key: 'parking', label: 'Parking', options: PARKING },
              { key: 'water_available', label: 'Water available', options: WATER },
              { key: 'trail_condition', label: 'Trail condition', options: CONDITION },
            ].map(({ key, label, options }) => (
              <div key={key}>
                <label className="text-xs text-gray-500 block mb-1">{label}</label>
                <div className="flex flex-wrap gap-1.5">
                  {options.map(opt => (
                    <button
                      key={opt} type="button"
                      onClick={() => setForm(f => ({ ...f, [key]: f[key] === opt ? '' : opt }))}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${form[key] === opt ? 'border-green-600 bg-green-50 text-green-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div>
              <label className="text-xs text-gray-500 block mb-1">Notes (optional)</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Anything else worth knowing…"
                rows={2}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 resize-none"
              />
            </div>

            <button
              type="submit" disabled={submitting}
              onClick={!user ? onLoginRequired : undefined}
              className="w-full py-3 rounded-xl text-white text-sm font-medium disabled:opacity-50"
              style={{ background: '#2d7a2d' }}
            >
              {!user ? 'Sign in to submit' : submitting ? 'Submitting…' : 'Submit report'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Main PlanModal ────────────────────────────────────────────────────────────
export default function PlanModal({ trail, onClose, onLoginRequired }) {
  const [activeTab, setActiveTab] = useState(0)
  const { user } = useAuth()

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Prevent background scroll on mobile
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl flex flex-col"
        style={{ maxHeight: '92vh' }}>

        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900 text-base leading-snug">{trail.name}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{trail.station} · {trail.transitMin} min transit</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 text-lg shrink-0 ml-2">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 overflow-x-auto shrink-0 scrollbar-hide">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`px-4 py-3 text-sm whitespace-nowrap font-medium transition-colors shrink-0 border-b-2 ${activeTab === i ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 0 && <TransitTab trail={trail} />}
          {activeTab === 1 && <MapTab trail={trail} />}
          {activeTab === 2 && <WeatherTab trail={trail} />}
          {activeTab === 3 && <ChecklistTab trail={trail} user={user} onLoginRequired={onLoginRequired} />}
          {activeTab === 4 && <TrailReportTab trail={trail} user={user} onLoginRequired={onLoginRequired} />}
        </div>
      </div>
    </div>
  )
}
