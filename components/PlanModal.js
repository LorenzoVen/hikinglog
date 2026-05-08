import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { CHECKLIST_ITEMS, CHECKLIST_CATEGORIES } from '../lib/checklistItems'

const TABS = ['Transit', 'Weather', 'Checklist', 'Review', 'Trails', 'Past']

function today() { return new Date().toISOString().split('T')[0] }

// ── Origin helper ─────────────────────────────────────────────────────────────
function getOrigin(trail) {
  const op  = (trail.operator || trail.transitType || '').toLowerCase()
  const line = (trail.line || '').toLowerCase()
  if (op.includes('lirr'))
    return { label: 'Penn Station (LIRR)', maps: 'Penn+Station,+New+York,+NY' }
  if (op.includes('nj transit rail') || op.includes('njt rail') ||
      line.includes('port jervis') || line.includes('pascack') ||
      line.includes('montclair') || line.includes('raritan'))
    return { label: 'Penn Station (NJ Transit)', maps: 'Penn+Station,+New+York,+NY' }
  const isBus = op.includes('bus') || op.includes('coach') || op.includes('trans-bridge') ||
    op.includes('transbridge') || op.includes('academy') || op.includes('lakeland') ||
    op.includes('broadway') || op.includes('shortline') || op.includes('county') ||
    op.includes('sjta') || op.includes('warren') || op.includes('sussex') ||
    op.includes('hunterdon') || op.includes('somerset') || op.includes('cumberland') ||
    op.includes('gloucester') || op.includes('atlantic') || op.includes('burlington')
  if (isBus)
    return { label: 'Port Authority Bus Terminal', maps: 'Port+Authority+Bus+Terminal,+New+York,+NY' }
  return { label: 'Grand Central Terminal', maps: 'Grand+Central+Terminal,+New+York,+NY' }
}

function getScheduleInfo(station, operator) {
  const op  = (operator || '').toLowerCase()
  const enc = encodeURIComponent(station.replace(/\s*\(.*?\)/g, '').trim())
  if (op.includes('metro-north') || op === 'mnr')
    return { label: 'View MTA schedule', url: `https://new.mta.info/schedules/metro-north-railroad?origin=${enc}` }
  if (op.includes('lirr'))
    return { label: 'View MTA schedule', url: `https://new.mta.info/schedules/long-island-rail-road?origin=${enc}` }
  if (op.includes('nj transit rail') || op.includes('njt rail'))
    return { label: 'NJ Transit rail schedule', url: 'https://www.njtransit.com/schedules/rail-schedules' }
  if (op.includes('nj transit bus') || op.includes('njt bus'))
    return { label: 'NJ Transit bus schedule', url: 'https://www.njtransit.com/schedules/bus-schedules' }
  if (op.includes('trans-bridge') || op.includes('transbridge'))
    return { label: 'Trans-Bridge schedule', url: 'https://www.transbridgelines.com/schedules' }
  if (op.includes('academy'))
    return { label: 'Academy Bus schedule', url: 'https://www.academybus.com/schedules' }
  if (op.includes('lakeland'))
    return { label: 'Lakeland Bus schedule', url: 'https://www.lakelandbus.com' }
  if (op.includes('shortline') || op.includes('coach'))
    return { label: 'Shortline schedule', url: 'https://www.coachusa.com/shortline' }
  if (op.includes('broadway'))
    return { label: 'Broadway Bus schedule', url: 'https://www.coachusa.com/broadway' }
  return { label: 'Plan your trip', url: 'https://www.njtransit.com/plan-your-trip' }
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
  const schedule = getScheduleInfo(trail.station, trail.operator || trail.transitType)
  const mapsUrl = getGoogleMapsUrl(trail)
  const op = (trail.operator || '').toLowerCase()
  const isMta = op.includes('metro-north') || op.includes('lirr')
  const isNjRail = op.includes('nj transit rail')
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
      <a href={schedule.url} target="_blank" rel="noopener noreferrer"
        className="flex items-center justify-between w-full border border-gray-200 rounded-xl px-4 py-3.5 hover:bg-gray-50 transition-colors">
        <div>
          <div className="text-sm font-medium text-gray-800">{schedule.label}</div>
          <div className="text-xs text-gray-500 mt-0.5">{stationClean} · {trail.line || trail.operator}</div>
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

  // ── DB state ──────────────────────────────────────────────────────────────
  const [tripId, setTripId]         = useState(null)
  const [itemStates, setItemStates] = useState({})
  const [stage, setStage]           = useState('planning')
  const [loading, setLoading]       = useState(true)
  const [openCats, setOpenCats]     = useState({})

  // ── Template state ────────────────────────────────────────────────────────
  const [templates, setTemplates]           = useState([])   // [{id,name,is_default,items:[{category,description,is_custom}]}]
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [newTplName, setNewTplName]         = useState('')
  const [showNewTpl, setShowNewTpl]         = useState(false)
  const [userCustomItems, setUserCustomItems] = useState([]) // user's personal item bank

  // ── Inline add-item state ─────────────────────────────────────────────────
  const [inlineInputs, setInlineInputs] = useState({}) // cat -> value
  const [customCat, setCustomCat]       = useState('')
  const [customDesc, setCustomDesc]     = useState('')

  // ── All items = master list + user's custom items ─────────────────────────
  const allMasterItems = CHECKLIST_ITEMS
  const allCategories  = [
    ...CHECKLIST_CATEGORIES,
    ...userCustomItems.map(i => i.category).filter(c => !CHECKLIST_CATEGORIES.includes(c)),
  ].filter((v, i, a) => a.indexOf(v) === i)

  function buildAllItems() {
    const custom = userCustomItems.map(i => ({
      id:          `custom-${i.id}`,
      category:    i.category,
      description: i.description,
      isCustom:    true,
    }))
    return [...allMasterItems, ...custom]
  }

  // ── Load trip + items + templates + custom items ──────────────────────────
  useEffect(() => {
    if (!user || !tripDate || !supabase) { setItemStates(initStates([])); setLoading(false); return }

    async function load() {
      setLoading(true)

      // 1. Upsert trip
      const { data: trip } = await supabase
        .from('checklist_trips')
        .upsert({ user_id: user.id, trail_id: trailId, trip_date: tripDate },
                 { onConflict: 'user_id,trail_id,trip_date' })
        .select().single()
      if (!trip) { setLoading(false); return }
      setTripId(trip.id)

      // 2. Load or seed items
      const { data: existing } = await supabase
        .from('checklist_items').select('*').eq('trip_id', trip.id)

      // 3. Load user's custom items (personal bank)
      const { data: customBank } = await supabase
        .from('checklist_custom_items').select('*').eq('user_id', user.id)
      const bank = customBank || []
      setUserCustomItems(bank)

      if (existing && existing.length > 0) {
        setItemStates(initStates(existing, bank))
      } else {
        // Seed from master list + custom bank
        const allItems = [
          ...CHECKLIST_ITEMS.map(i => ({ trip_id: trip.id, user_id: user.id, category: i.category, description: i.description, planned: false, packed: false, review: null })),
          ...bank.map(i => ({ trip_id: trip.id, user_id: user.id, category: i.category, description: i.description, planned: false, packed: false, review: null })),
        ]
        const { data: inserted } = await supabase.from('checklist_items').insert(allItems).select()
        setItemStates(initStates(inserted || allItems, bank))
      }

      // 4. Load templates (default + user's own)
      const [{ data: defaultTpls }, { data: userTpls }] = await Promise.all([
        supabase.from('checklist_templates').select('id,name,is_default,checklist_template_items(category,description,is_custom)').eq('is_default', true).order('name'),
        supabase.from('checklist_templates').select('id,name,is_default,checklist_template_items(category,description,is_custom)').eq('created_by', user.id).order('name'),
      ])
      setTemplates([...(defaultTpls||[]), ...(userTpls||[])])

      setLoading(false)
    }
    load()
  }, [user, tripDate, trailId])

  function initStates(dbItems, customBank = []) {
    const s = {}
    const allItems = buildAllItems()
    allItems.forEach(item => {
      const existing = dbItems.find(e => e.description === item.description && e.category === item.category)
      s[item.id] = {
        planned: existing?.planned || false,
        packed:  existing?.packed  || false,
        removed: false,
        review:  existing?.review  || null,
        dbId:    existing?.id      || null,
      }
    })
    return s
  }

  // ── Apply template ─────────────────────────────────────────────────────────
  async function applyTemplate(tplId) {
    setSelectedTemplate(tplId)
    if (!tplId) return
    const tpl = templates.find(t => t.id === tplId)
    if (!tpl) return

    const tplItems = tpl.checklist_template_items || []
    const tplKeys = new Set(tplItems.map(i => `${i.category}||${i.description}`))

    // For custom items in the template not yet in the user's bank or trip — add them
    const customTplItems = tplItems.filter(i => i.is_custom)
    const newCustomItems = []
    const newDbItems = []

    for (const ci of customTplItems) {
      const existsInBank = userCustomItems.some(u => u.category === ci.category && u.description === ci.description)
      if (!existsInBank && supabase && user) {
        const { data } = await supabase.from('checklist_custom_items')
          .insert({ user_id: user.id, category: ci.category, description: ci.description })
          .select().single()
        if (data) newCustomItems.push(data)
      }
      // Add to trip checklist if not already there
      const itemId = `custom-${ci.description}`
      if (!itemStates[itemId] && supabase && tripId) {
        const { data } = await supabase.from('checklist_items')
          .insert({ trip_id: tripId, user_id: user.id, category: ci.category, description: ci.description, planned: false, packed: false })
          .select().single()
        if (data) newDbItems.push(data)
      }
    }

    if (newCustomItems.length) setUserCustomItems(prev => [...prev, ...newCustomItems])

    // Update item states — check items in template, uncheck others
    setItemStates(prev => {
      const next = { ...prev }
      buildAllItems().forEach(item => {
        if (next[item.id]) {
          const inTpl = tplKeys.has(`${item.category}||${item.description}`)
          next[item.id] = { ...next[item.id], planned: inTpl }
        }
      })
      // Add newly added custom items
      newDbItems.forEach(dbItem => {
        const id = `custom-${dbItem.description}`
        next[id] = { planned: true, packed: false, removed: false, review: null, dbId: dbItem.id }
      })
      return next
    })

    // Persist to DB
    if (supabase && tripId) {
      const allItems = buildAllItems()
      for (const item of allItems) {
        const inTpl = tplKeys.has(`${item.category}||${item.description}`)
        await supabase.from('checklist_items')
          .update({ planned: inTpl })
          .eq('trip_id', tripId).eq('description', item.description).eq('category', item.category)
      }
    }
  }

  // ── Save current selection as new template ─────────────────────────────────
  async function saveAsTemplate() {
    if (!newTplName.trim() || !user || !supabase) return
    setSavingTemplate(true)
    const { data: tpl } = await supabase.from('checklist_templates')
      .insert({ name: newTplName.trim(), is_default: false, created_by: user.id })
      .select().single()
    if (tpl) {
      const plannedItems = buildAllItems().filter(i => itemStates[i.id]?.planned)
      const itemRows = plannedItems.map(i => ({
        template_id: tpl.id, category: i.category,
        description: i.description, is_custom: i.isCustom || false,
      }))
      if (itemRows.length) await supabase.from('checklist_template_items').insert(itemRows)
      setTemplates(prev => [...prev, { ...tpl, checklist_template_items: itemRows }])
      setSelectedTemplate(tpl.id)
    }
    setNewTplName(''); setShowNewTpl(false); setSavingTemplate(false)
  }

  // ── Add item inline (per category) ────────────────────────────────────────
  async function addInlineItem(cat) {
    const desc = (inlineInputs[cat] || '').trim()
    if (!desc || !user || !supabase) return
    setInlineInputs(prev => ({ ...prev, [cat]: '' }))

    // Add to custom item bank
    const { data: bankItem } = await supabase.from('checklist_custom_items')
      .insert({ user_id: user.id, category: cat, description: desc })
      .select().single()
    if (bankItem) setUserCustomItems(prev => [...prev, bankItem])

    // Add to this trip
    const itemId = `custom-${bankItem?.id || desc}`
    if (tripId) {
      const { data: dbItem } = await supabase.from('checklist_items')
        .insert({ trip_id: tripId, user_id: user.id, category: cat, description: desc, planned: true, packed: false })
        .select().single()
      setItemStates(prev => ({
        ...prev,
        [itemId]: { planned: true, packed: false, removed: false, review: null, dbId: dbItem?.id || null }
      }))
    }
  }

  // ── Add custom item from bottom form ──────────────────────────────────────
  async function addCustomItem() {
    const cat  = customCat.trim() || 'Other'
    const desc = customDesc.trim()
    if (!desc || !user || !supabase) return
    setCustomCat(''); setCustomDesc('')

    const { data: bankItem } = await supabase.from('checklist_custom_items')
      .insert({ user_id: user.id, category: cat, description: desc })
      .select().single()
    if (bankItem) setUserCustomItems(prev => [...prev, bankItem])

    const itemId = `custom-${bankItem?.id || desc}`
    if (tripId) {
      const { data: dbItem } = await supabase.from('checklist_items')
        .insert({ trip_id: tripId, user_id: user.id, category: cat, description: desc, planned: true, packed: false })
        .select().single()
      setItemStates(prev => ({
        ...prev,
        [itemId]: { planned: true, packed: false, removed: false, review: null, dbId: dbItem?.id || null }
      }))
    }
  }

  // ── Update item state ─────────────────────────────────────────────────────
  async function updateState(itemId, patch) {
    setItemStates(prev => ({ ...prev, [itemId]: { ...prev[itemId], ...patch } }))
    if (supabase && tripId) {
      const item = buildAllItems().find(i => i.id === itemId)
      if (!item) return
      await supabase.from('checklist_items')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('trip_id', tripId).eq('description', item.description).eq('category', item.category)
    }
  }

  function togglePlan(id)    { const cur = itemStates[id]; updateState(id, { planned: !cur?.planned, packed: cur?.planned ? false : cur?.packed, review: cur?.planned ? null : cur?.review }) }
  function togglePack(id)    { const cur = itemStates[id]; updateState(id, { packed: !cur?.packed, review: cur?.packed ? null : cur?.review }) }
  function removeItem(id)    { setItemStates(prev => ({ ...prev, [id]: { ...prev[id], removed: true, packed: false, review: null } })) }
  function setReview(id,val) { updateState(id, { review: itemStates[id]?.review === val ? null : val }) }
  function toggleCat(cat)    { setOpenCats(p => ({ ...p, [cat]: p[cat] === false })) }

  // ── Render ────────────────────────────────────────────────────────────────
  if (!user) return (
    <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
      <div className="text-4xl">📋</div>
      <div><p className="font-medium text-gray-800 mb-1">Sign in to use checklists</p><p className="text-xs text-gray-500">Track what to bring, what you packed, and how it went.</p></div>
      <button onClick={onLoginRequired} className="px-5 py-2.5 rounded-xl text-white text-sm font-medium" style={{ background: '#2d7a2d' }}>Sign in</button>
    </div>
  )
  if (loading) return <div className="text-sm text-gray-400 text-center py-8">Loading checklist…</div>

  const allItems = buildAllItems()
  const planned  = allItems.filter(i => itemStates[i.id]?.planned)
  const packed   = allItems.filter(i => itemStates[i.id]?.packed)
  const reviewed = allItems.filter(i => itemStates[i.id]?.review)
  const pct      = stage === 'planning' ? Math.round(planned.length / allItems.length * 100)
                 : stage === 'packing'  ? Math.round(packed.length  / planned.length  * 100) || 0
                 :                        Math.round(reviewed.length / allItems.length * 100)

  const STAGE_DESC = {
    planning:   'Select the items you plan to bring. Only selected items appear in Packing.',
    packing:    'Check off items as you pack. Packed items move to the bottom. × removes an item from this trip.',
    'post-hike':'All items shown. Rate everything — including what you did not plan or pack.',
  }

  const REVIEW_BTNS = (id) => {
    const r = itemStates[id]?.review
    return (
      <div className="flex gap-1 flex-shrink-0">
        {[['more','↑','border-orange-400 bg-orange-50 text-orange-700'],
          ['ok','✓','border-green-600 bg-green-50 text-green-800'],
          ['less','↓','border-blue-500 bg-blue-50 text-blue-800']].map(([val,lbl,cls]) => (
          <button key={val} onClick={() => setReview(id, val)}
            className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${r === val ? cls : 'border-gray-200 text-gray-400 hover:border-gray-400'}`}>{lbl}</button>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Stage selector */}
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
        {[{key:'planning',label:'Planning',count:`${planned.length}/${allItems.length}`},
          {key:'packing', label:'Packing', count:`${packed.length}/${planned.length}`},
          {key:'post-hike',label:'Post-hike',count:`${reviewed.length}/${allItems.length}`}].map(s => (
          <button key={s.key} onClick={() => setStage(s.key)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors leading-tight ${stage === s.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}>
            {s.label}<br/>
            <span className={`text-[10px] font-normal ${stage === s.key ? 'text-green-700' : 'text-gray-400'}`}>{s.count}</span>
          </button>
        ))}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: '#2d7a2d' }} />
      </div>

      {/* Template row — Planning only */}
      {stage === 'planning' && (
        <div className="flex gap-2">
          <select value={selectedTemplate} onChange={e => applyTemplate(e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 bg-white">
            <option value="">No template — custom selection</option>
            {templates.filter(t => t.is_default).length > 0 && (
              <optgroup label="Default templates">
                {templates.filter(t => t.is_default).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </optgroup>
            )}
            {templates.filter(t => !t.is_default).length > 0 && (
              <optgroup label="My templates">
                {templates.filter(t => !t.is_default).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </optgroup>
            )}
          </select>
          <button onClick={() => setShowNewTpl(p => !p)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 flex-shrink-0">
            {showNewTpl ? '✕' : '＋ Save'}
          </button>
        </div>
      )}

      {/* Save as template form — Planning only */}
      {stage === 'planning' && showNewTpl && (
        <div className="flex gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
          <input value={newTplName} onChange={e => setNewTplName(e.target.value)}
            placeholder="Template name…"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            onKeyDown={e => { if (e.key === 'Enter') saveAsTemplate() }} />
          <button onClick={saveAsTemplate} disabled={savingTemplate || !newTplName.trim()}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40" style={{ background: '#2d7a2d' }}>
            {savingTemplate ? '…' : 'Save'}
          </button>
        </div>
      )}

      <p className="text-xs text-gray-500">{STAGE_DESC[stage]}</p>

      {/* Item categories */}
      {allCategories.map(cat => {
        const catItems = allItems.filter(i => i.category === cat)
        let visible
        if (stage === 'planning') {
          visible = catItems
        } else if (stage === 'packing') {
          visible = catItems.filter(i => itemStates[i.id]?.planned && !itemStates[i.id]?.removed)
          if (!visible.length) return null
        } else {
          const pk  = catItems.filter(i => itemStates[i.id]?.packed)
          const plnp = catItems.filter(i => itemStates[i.id]?.planned && !itemStates[i.id]?.packed)
          const np  = catItems.filter(i => !itemStates[i.id]?.planned)
          visible = [...pk, ...plnp, ...np]
        }
        if (!visible.length) return null

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

            {isOpen && (
              <>
                {visible.map(item => {
                  const st     = itemStates[item.id] || {}
                  const dimmed = stage === 'packing' && st.packed
                  let noteEl = null, textColor = 'text-gray-800'
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
                        {item.description}
                        {item.isCustom && <span className="text-[10px] text-gray-400 ml-1">(custom)</span>}
                        {noteEl}
                      </span>

                      {stage === 'packing' && (
                        <button onClick={() => removeItem(item.id)} className="text-gray-300 hover:text-red-500 text-lg leading-none flex-shrink-0 transition-colors">×</button>
                      )}
                      {stage === 'post-hike' && REVIEW_BTNS(item.id)}
                    </div>
                  )
                })}

                {/* Add item inline — Planning only */}
                {stage === 'planning' && (
                  <div className="flex gap-2 px-4 py-2 border-t border-dashed border-gray-200 bg-gray-50">
                    <input
                      value={inlineInputs[cat] || ''}
                      onChange={e => setInlineInputs(prev => ({ ...prev, [cat]: e.target.value }))}
                      placeholder={`Add item to ${cat}…`}
                      className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-600"
                      onKeyDown={e => { if (e.key === 'Enter') addInlineItem(cat) }}
                    />
                    <button onClick={() => addInlineItem(cat)}
                      className="px-2.5 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold">+</button>
                  </div>
                )}
              </>
            )}
          </div>
        )
      })}

      {/* Add custom item from scratch — Planning only */}
      {stage === 'planning' && (
        <div className="border border-dashed border-gray-200 rounded-xl p-3 bg-gray-50">
          <div className="text-xs font-medium text-gray-500 mb-2">Add to a new or existing category</div>
          <div className="flex gap-2">
            <input value={customCat} onChange={e => setCustomCat(e.target.value)} placeholder="Category…"
              className="w-32 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-600 flex-shrink-0" />
            <input value={customDesc} onChange={e => setCustomDesc(e.target.value)} placeholder="Item name…"
              className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-600"
              onKeyDown={e => { if (e.key === 'Enter') addCustomItem() }} />
            <button onClick={addCustomItem}
              className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold flex-shrink-0">Add</button>
          </div>
        </div>
      )}
    </div>
  )
}


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

// ── Trails tab ────────────────────────────────────────────────────────────────
function TrailsTab({ trail, user, onLoginRequired }) {
  const trailId = String(trail.id || trail.osmId)
  const [suggestedLinks, setSuggestedLinks] = useState([])
  const [userLinks, setUserLinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [urlInput, setUrlInput] = useState('')
  const [fetching, setFetching] = useState(false)
  const [fetchedTitle, setFetchedTitle] = useState(null)
  const [saving, setSaving] = useState(false)
  const [suggestSent, setSuggestSent] = useState(false)

  const SOURCE_STYLES = {
    alltrails: 'bg-green-600 text-white',
    garmin:    'bg-blue-600 text-white',
    avenza:    'bg-red-600 text-white',
    other:     'bg-gray-200 text-gray-700',
  }
  const SOURCE_LABELS = { alltrails: 'AllTrails', garmin: 'Garmin', avenza: 'Avenza', other: 'Web' }

  function detectSource(url) {
    if (url.includes('alltrails.com')) return 'alltrails'
    if (url.includes('garmin.com'))    return 'garmin'
    if (url.includes('avenza.com'))    return 'avenza'
    return 'other'
  }

  useEffect(() => {
    async function load() {
      if (!supabase) { setLoading(false); return }
      const { data: suggested } = await supabase
        .from('trail_links').select('*')
        .eq('trail_id', trailId).eq('type', 'suggested')
        .order('created_at', { ascending: true })
      setSuggestedLinks(suggested || [])
      if (user) {
        const { data: mine } = await supabase
          .from('trail_links').select('*')
          .eq('trail_id', trailId).eq('type', 'user').eq('user_id', user.id)
          .order('created_at', { ascending: false })
        setUserLinks(mine || [])
      }
      setLoading(false)
    }
    load()
  }, [trailId, user])

  async function doFetchTitle() {
    if (!urlInput.trim()) return
    setFetching(true); setFetchedTitle(null)
    try {
      const res = await fetch(`/api/fetch-title?url=${encodeURIComponent(urlInput)}`)
      const data = await res.json()
      setFetchedTitle(data)
    } catch { setFetchedTitle({ title: urlInput, source: 'other' }) }
    setFetching(false)
  }

  async function saveLink() {
    if (!user) { onLoginRequired(); return }
    if (!fetchedTitle || !supabase) return
    setSaving(true)
    const { data } = await supabase.from('trail_links').insert({
      trail_id: trailId, type: 'user', user_id: user.id,
      url: urlInput.trim(), title: fetchedTitle.title,
      source: detectSource(urlInput), approved: true,
    }).select().single()
    if (data) setUserLinks(prev => [data, ...prev])
    setUrlInput(''); setFetchedTitle(null)
    setSaving(false)
  }

  async function deleteUserLink(id) {
    if (!supabase) return
    await supabase.from('trail_links').delete().eq('id', id)
    setUserLinks(prev => prev.filter(l => l.id !== id))
  }

  function LinkCard({ link, onDelete }) {
    const src = link.source || 'other'
    return (
      <div className="flex items-start gap-3 p-3 border border-gray-100 rounded-xl hover:bg-gray-50">
        <span className={`text-[10px] px-2 py-1 rounded-full font-semibold flex-shrink-0 mt-0.5 ${SOURCE_STYLES[src]}`}>
          {SOURCE_LABELS[src]}
        </span>
        <div className="flex-1 min-w-0">
          <a href={link.url} target="_blank" rel="noopener noreferrer"
            className="text-sm font-medium text-gray-800 hover:text-green-700 leading-snug block truncate">
            {link.title}
          </a>
          <div className="text-xs text-gray-400 truncate mt-0.5">{link.url}</div>
        </div>
        {onDelete && (
          <button onClick={onDelete} className="text-gray-300 hover:text-red-500 text-lg leading-none flex-shrink-0">×</button>
        )}
      </div>
    )
  }

  if (loading) return <div className="text-sm text-gray-400 text-center py-6">Loading…</div>

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-gray-500">Add links to trail maps, GPX files, and route pages. The title is fetched automatically from each link.</p>

      {/* Add a link */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            value={urlInput}
            onChange={e => { setUrlInput(e.target.value); setFetchedTitle(null) }}
            onBlur={doFetchTitle}
            placeholder="Paste an AllTrails, Garmin, or Avenza URL…"
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
          />
          <button onClick={doFetchTitle} disabled={!urlInput || fetching}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 flex-shrink-0">
            {fetching ? '…' : 'Fetch'}
          </button>
        </div>
        {fetchedTitle && (
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
            <span className={`text-[10px] px-2 py-1 rounded-full font-semibold flex-shrink-0 ${SOURCE_STYLES[detectSource(urlInput)]}`}>
              {SOURCE_LABELS[detectSource(urlInput)]}
            </span>
            <span className="text-sm font-medium text-gray-800 flex-1 truncate">{fetchedTitle.title}</span>
            <button onClick={saveLink} disabled={saving}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white flex-shrink-0 disabled:opacity-50"
              style={{ background: '#2d7a2d' }}>
              {saving ? 'Saving…' : user ? 'Save' : 'Sign in to save'}
            </button>
          </div>
        )}
      </div>

      {/* Suggested links */}
      {suggestedLinks.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Suggested routes</div>
          <div className="flex flex-col gap-2">
            {suggestedLinks.map(link => <LinkCard key={link.id} link={link} />)}
          </div>
        </div>
      )}

      {/* User's own links */}
      {user && userLinks.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Your saved links</div>
          <div className="flex flex-col gap-2">
            {userLinks.map(link => (
              <LinkCard key={link.id} link={link} onDelete={() => deleteUserLink(link.id)} />
            ))}
          </div>
        </div>
      )}

      {suggestedLinks.length === 0 && (!user || userLinks.length === 0) && (
        <div className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-xl">
          No trail links yet for this trailhead.
        </div>
      )}

      {!user && (
        <button onClick={onLoginRequired}
          className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50">
          Sign in to save your own links
        </button>
      )}
    </div>
  )
}

export default function PlanModal({ trail, onClose, onLoginRequired, onSaveForLater, embedded = false, inlineTab = null }) {
  const [activeTab, setActiveTab] = useState(0)
  const [tripDate, setTripDate] = useState(today())
  const { user } = useAuth()

  // Sync inlineTab prop (for embedded detail panel mode)
  const TAB_MAP = { transit: 0, weather: 1, checklist: 2, review: 3, trails: 4, past: 5 }
  const resolvedTab = (embedded && inlineTab && TAB_MAP[inlineTab] !== undefined)
    ? TAB_MAP[inlineTab]
    : activeTab

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Embedded mode — just the tab content, no modal wrapper
  if (embedded) {
    return (
      <>
        {resolvedTab === 0 && <TransitTab trail={trail} tripDate={tripDate} />}
        {resolvedTab === 1 && <WeatherTab trail={trail} tripDate={tripDate} onDateChange={setTripDate} />}
        {resolvedTab === 2 && <ChecklistTab trail={trail} user={user} tripDate={tripDate} onLoginRequired={onLoginRequired} />}
        {resolvedTab === 3 && <ReviewTab trail={trail} user={user} tripDate={tripDate} onLoginRequired={onLoginRequired} />}
        {resolvedTab === 4 && <TrailsTab trail={trail} user={user} onLoginRequired={onLoginRequired} />}
        {resolvedTab === 5 && <PastTab trail={trail} user={user} />}
      </>
    )
  }

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
          {resolvedTab === 0 && <TransitTab trail={trail} tripDate={tripDate} />}
          {resolvedTab === 1 && <WeatherTab trail={trail} tripDate={tripDate} onDateChange={setTripDate} />}
          {resolvedTab === 2 && <ChecklistTab trail={trail} user={user} tripDate={tripDate} onLoginRequired={onLoginRequired} />}
          {resolvedTab === 3 && <ReviewTab trail={trail} user={user} tripDate={tripDate} onLoginRequired={onLoginRequired} />}
          {resolvedTab === 4 && <TrailsTab trail={trail} user={user} onLoginRequired={onLoginRequired} />}
          {resolvedTab === 5 && <PastTab trail={trail} user={user} />}
        </div>
      </div>
    </div>
  )
}
