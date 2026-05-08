import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'lveneziani83@gmail.com'

const SOURCES = {
  alltrails: { label: 'AllTrails', color: '#1c7c3c', bg: '#f0faf0' },
  garmin:    { label: 'Garmin',    color: '#0099d6', bg: '#f0f8ff' },
  avenza:    { label: 'Avenza',    color: '#e63946', bg: '#fff0f0' },
  other:     { label: 'Other',     color: '#666',    bg: '#f5f5f5' },
}

function detectSource(url) {
  if (url.includes('alltrails.com')) return 'alltrails'
  if (url.includes('garmin.com'))    return 'garmin'
  if (url.includes('avenza.com'))    return 'avenza'
  return 'other'
}

function SourceBadge({ source }) {
  const s = SOURCES[source] || SOURCES.other
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}40` }}
      className="text-xs px-2 py-0.5 rounded-full font-semibold">{s.label}</span>
  )
}

// ── Trail Links section ───────────────────────────────────────────────────────
function TrailLinksSection() {
  const [trailSearch, setTrailSearch] = useState('')
  const [trailResults, setTrailResults] = useState([])
  const [selectedTrail, setSelectedTrail] = useState(null)
  const [links, setLinks] = useState([])
  const [url, setUrl] = useState('')
  const [fetchingTitle, setFetchingTitle] = useState(false)
  const [fetchedTitle, setFetchedTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function searchTrails(q) {
    if (!q.trim()) { setTrailResults([]); return }
    const { data } = await supabase.from('trailheads').select('id,name,station,operator')
      .ilike('name', `%${q}%`).eq('approved', true).limit(10)
    setTrailResults(data || [])
  }

  async function loadLinks(trailId) {
    const { data } = await supabase.from('trail_links')
      .select('*').eq('trail_id', trailId).eq('type', 'suggested').order('created_at')
    setLinks(data || [])
  }

  async function fetchTitle() {
    if (!url.trim()) return
    setFetchingTitle(true); setFetchedTitle('')
    try {
      const res = await fetch(`/api/fetch-title?url=${encodeURIComponent(url)}`)
      const data = await res.json()
      setFetchedTitle(data.title || url)
    } catch { setFetchedTitle(url) }
    setFetchingTitle(false)
  }

  async function addLink() {
    if (!selectedTrail || !url.trim() || !fetchedTitle) return
    setSaving(true)
    const { error } = await supabase.from('trail_links').insert({
      trail_id: String(selectedTrail.id),
      type: 'suggested',
      url: url.trim(),
      title: fetchedTitle,
      source: detectSource(url),
      approved: true,
    })
    if (!error) {
      setUrl(''); setFetchedTitle(''); setMsg('Link added ✓')
      await loadLinks(selectedTrail.id)
      setTimeout(() => setMsg(''), 3000)
    }
    setSaving(false)
  }

  async function deleteLink(id) {
    if (!confirm('Delete this link?')) return
    await supabase.from('trail_links').delete().eq('id', id)
    setLinks(prev => prev.filter(l => l.id !== id))
  }

  return (
    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
        <h2 className="font-bold text-gray-800">Trail Links</h2>
        <p className="text-xs text-gray-500 mt-0.5">Add suggested AllTrails, Garmin, and Avenza links per trailhead</p>
      </div>
      <div className="p-6">
        {/* Step 1: find trailhead */}
        <div className="mb-5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">1. Find trailhead</label>
          <input value={trailSearch} onChange={e => { setTrailSearch(e.target.value); searchTrails(e.target.value) }}
            placeholder="Search by trailhead name…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
          {trailResults.length > 0 && (
            <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              {trailResults.map(t => (
                <button key={t.id} onClick={() => { setSelectedTrail(t); setTrailResults([]); setTrailSearch(t.name); loadLinks(t.id) }}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0 text-sm">
                  <span className="font-medium text-gray-900">{t.name}</span>
                  <span className="text-gray-400 ml-2 text-xs">{t.station} · {t.operator}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedTrail && (
          <>
            {/* Step 2: add link */}
            <div className="mb-5 p-4 bg-green-50 border border-green-200 rounded-xl">
              <div className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-3">2. Add link for: {selectedTrail.name}</div>
              <div className="flex gap-2 mb-3">
                <input value={url} onChange={e => { setUrl(e.target.value); setFetchedTitle('') }}
                  onBlur={fetchTitle}
                  placeholder="Paste AllTrails, Garmin, or Avenza URL…"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                <button onClick={fetchTitle} disabled={!url || fetchingTitle}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-white disabled:opacity-40">
                  {fetchingTitle ? '…' : 'Fetch title'}
                </button>
              </div>
              {fetchedTitle && (
                <div className="flex items-center gap-3 mb-3 p-3 bg-white rounded-lg border border-gray-200">
                  <SourceBadge source={detectSource(url)} />
                  <span className="text-sm font-medium text-gray-800 flex-1">{fetchedTitle}</span>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={addLink} disabled={saving || !fetchedTitle}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40" style={{ background: '#2d7a2d' }}>
                  {saving ? 'Saving…' : 'Add link'}
                </button>
                {msg && <span className="text-sm text-green-700 self-center">{msg}</span>}
              </div>
            </div>

            {/* Existing links */}
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Existing suggested links ({links.length})</div>
              {links.length === 0 ? (
                <p className="text-sm text-gray-400">No suggested links yet for this trailhead.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {links.map(link => (
                    <div key={link.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                      <SourceBadge source={link.source} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">{link.title}</div>
                        <div className="text-xs text-gray-400 truncate">{link.url}</div>
                      </div>
                      <button onClick={() => deleteLink(link.id)} className="text-gray-300 hover:text-red-500 text-lg leading-none px-1">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  )
}

// ── Trailhead editor section ──────────────────────────────────────────────────
function TrailheadEditorSection() {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function searchTrailheads(q) {
    if (!q.trim()) { setResults([]); return }
    const { data } = await supabase.from('trailheads')
      .select('id,name,station,operator,approved')
      .ilike('name', `%${q}%`).limit(15)
    setResults(data || [])
  }

  function selectTrailhead(t) {
    setSelected(t)
    setResults([])
    setSearch(t.name)
    // Load full row
    supabase.from('trailheads').select('*').eq('id', t.id).single().then(({ data }) => {
      if (data) setForm({
        name:          data.name || '',
        difficulty:    data.difficulty || '',
        description:   data.description || '',
        tips:          data.tips || '',
        lat:           data.lat || '',
        lng:           data.lng || '',
        station_lat:   data.station_lat || '',
        station_lng:   data.station_lng || '',
        alltrails_url: data.alltrails_url || '',
        length_mi:     data.length_mi || '',
        elev_ft:       data.elev_ft || '',
        seasonal:      data.seasonal || false,
        season_note:   data.season_note || '',
        approved:      data.approved || false,
        suspect_match: data.suspect_match || false,
        suspect_note:  data.suspect_note || '',
      })
    })
  }

  const sf = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function save() {
    if (!selected) return
    setSaving(true)
    const { error } = await supabase.from('trailheads').update({
      name:          form.name,
      difficulty:    form.difficulty || null,
      description:   form.description || null,
      tips:          form.tips || null,
      lat:           parseFloat(form.lat) || null,
      lng:           parseFloat(form.lng) || null,
      station_lat:   parseFloat(form.station_lat) || null,
      station_lng:   parseFloat(form.station_lng) || null,
      alltrails_url: form.alltrails_url || null,
      length_mi:     parseFloat(form.length_mi) || null,
      elev_ft:       parseInt(form.elev_ft) || null,
      seasonal:      form.seasonal,
      season_note:   form.season_note || null,
      approved:      form.approved,
      suspect_match: form.suspect_match,
      suspect_note:  form.suspect_note || null,
      updated_at:    new Date().toISOString(),
    }).eq('id', selected.id)
    setSaving(false)
    if (!error) { setMsg('Saved ✓'); setTimeout(() => setMsg(''), 3000) }
    else setMsg('Error: ' + error.message)
  }

  const Field = ({ label, k, type = 'text', placeholder = '' }) => (
    <div>
      <label className="text-xs font-semibold text-gray-500 block mb-1">{label}</label>
      <input type={type} value={form[k] ?? ''} onChange={e => sf(k, e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
    </div>
  )

  const TextArea = ({ label, k, rows = 3 }) => (
    <div>
      <label className="text-xs font-semibold text-gray-500 block mb-1">{label}</label>
      <textarea value={form[k] ?? ''} onChange={e => sf(k, e.target.value)} rows={rows}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 resize-none" />
    </div>
  )

  const Toggle = ({ label, k }) => (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-700">{label}</span>
      <button onClick={() => sf(k, !form[k])}
        className={`w-10 h-5 rounded-full relative transition-colors ${form[k] ? 'bg-green-600' : 'bg-gray-300'}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${form[k] ? 'left-5' : 'left-0.5'}`} />
      </button>
    </div>
  )

  return (
    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
        <h2 className="font-bold text-gray-800">Trailhead Editor</h2>
        <p className="text-xs text-gray-500 mt-0.5">Edit metadata for any trailhead. Changes go live immediately.</p>
      </div>
      <div className="p-6">
        {/* Search */}
        <div className="mb-5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Find trailhead</label>
          <input value={search} onChange={e => { setSearch(e.target.value); searchTrailheads(e.target.value) }}
            placeholder="Search by name…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
          {results.length > 0 && (
            <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden shadow-sm max-h-60 overflow-y-auto">
              {results.map(t => (
                <button key={t.id} onClick={() => selectTrailhead(t)}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0 text-sm flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.approved ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className="font-medium text-gray-900">{t.name}</span>
                  <span className="text-gray-400 text-xs ml-1">{t.station} · {t.operator}</span>
                  {!t.approved && <span className="ml-auto text-[10px] text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">unapproved</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {selected && Object.keys(form).length > 0 && (
          <div className="border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-gray-800">Editing: {selected.name}</h3>
              <div className="flex items-center gap-3">
                {msg && <span className={`text-sm font-medium ${msg.startsWith('Error') ? 'text-red-600' : 'text-green-700'}`}>{msg}</span>}
                <button onClick={save} disabled={saving}
                  className="px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background: '#2d7a2d' }}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="col-span-2"><Field label="Name" k="name" /></div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Difficulty</label>
                <select value={form.difficulty || ''} onChange={e => sf('difficulty', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600">
                  <option value="">Not set</option>
                  <option>Easy</option><option>Moderate</option><option>Hard</option>
                </select>
              </div>
              <Field label="Length (mi)" k="length_mi" type="number" placeholder="e.g. 5.2" />
              <Field label="Elevation gain (ft)" k="elev_ft" type="number" placeholder="e.g. 1200" />
              <Field label="AllTrails URL" k="alltrails_url" placeholder="https://alltrails.com/…" />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <TextArea label="Description" k="description" />
              <TextArea label="Tips & getting there" k="tips" />
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-1 mb-4 p-4 bg-gray-50 rounded-xl">
              <div className="col-span-2 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Coordinates</div>
              <Field label="Trailhead lat" k="lat" type="number" placeholder="e.g. 41.44382" />
              <Field label="Trailhead lng" k="lng" type="number" placeholder="e.g. -73.97809" />
              <Field label="Station lat" k="station_lat" type="number" placeholder="e.g. 41.45056" />
              <Field label="Station lng" k="station_lng" type="number" placeholder="e.g. -73.98108" />
            </div>

            <div className="p-4 bg-gray-50 rounded-xl mb-4">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Status</div>
              <Toggle label="Approved (visible on site)" k="approved" />
              <Toggle label="Seasonal route" k="seasonal" />
              {form.seasonal && <Field label="Season note" k="season_note" placeholder="e.g. Trail closed Nov–Apr" />}
              <Toggle label="⚠ Suspect match (cross-river or unreliable)" k="suspect_match" />
              {form.suspect_match && <TextArea label="Suspect note" k="suspect_note" rows={2} />}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}


// ── Default Templates section (admin only) ────────────────────────────────────
function DefaultTemplatesSection() {
  const [templates, setTemplates]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [renaming, setRenaming]     = useState(null)
  const [renameVal, setRenameVal]   = useState('')
  const [newName, setNewName]       = useState('')
  const [newDesc, setNewDesc]       = useState('')
  const [adding, setAdding]         = useState(false)
  const [newItemCat, setNewItemCat] = useState('')
  const [newItemDesc, setNewItemDesc] = useState('')
  const [msg, setMsg]               = useState('')

  function flash(m) { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('checklist_templates')
        .select('id,name,description,is_default,checklist_template_items(id,category,description,is_custom)')
        .eq('is_default', true).order('name')
      setTemplates(data || [])
      setLoading(false)
    }
    load()
  }, [])

  async function addTemplate() {
    if (!newName.trim()) return
    const { data } = await supabase.from('checklist_templates')
      .insert({ name: newName.trim(), description: newDesc.trim() || null, is_default: true })
      .select('id,name,description,is_default,checklist_template_items(id,category,description,is_custom)').single()
    if (data) { setTemplates(prev => [...prev, data]); setNewName(''); setNewDesc(''); setAdding(false); flash('Template added ✓') }
  }

  async function renameTemplate(id) {
    if (!renameVal.trim()) return
    await supabase.from('checklist_templates').update({ name: renameVal.trim() }).eq('id', id)
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, name: renameVal.trim() } : t))
    setRenaming(null); flash('Renamed ✓')
  }

  async function deleteTemplate(id) {
    if (!confirm('Delete this default template? All users will lose access to it.')) return
    await supabase.from('checklist_templates').delete().eq('id', id)
    setTemplates(prev => prev.filter(t => t.id !== id))
    if (expandedId === id) setExpandedId(null)
    flash('Deleted ✓')
  }

  async function addItem(tplId) {
    if (!newItemDesc.trim()) return
    const cat = newItemCat.trim() || 'Other'
    const isCustom = !['Clothing','Food&Water','Gear','Navigation','Personal Items','Safety'].includes(cat)
    const { data } = await supabase.from('checklist_template_items')
      .insert({ template_id: tplId, category: cat, description: newItemDesc.trim(), is_custom: isCustom })
      .select().single()
    if (data) {
      setTemplates(prev => prev.map(t => t.id === tplId
        ? { ...t, checklist_template_items: [...(t.checklist_template_items || []), data] }
        : t))
      setNewItemCat(''); setNewItemDesc(''); flash('Item added ✓')
    }
  }

  async function removeItem(tplId, itemId) {
    await supabase.from('checklist_template_items').delete().eq('id', itemId)
    setTemplates(prev => prev.map(t => t.id === tplId
      ? { ...t, checklist_template_items: (t.checklist_template_items || []).filter(i => i.id !== itemId) }
      : t))
  }

  return (
    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-gray-800">Default Checklist Templates</h2>
          <p className="text-xs text-gray-500 mt-0.5">Visible to all users in the checklist template dropdown</p>
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className="text-sm text-green-700 font-medium">{msg}</span>}
          <button onClick={() => setAdding(p => !p)}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: '#2d7a2d' }}>
            {adding ? '✕ Cancel' : '＋ New template'}
          </button>
        </div>
      </div>

      {adding && (
        <div className="p-4 border-b border-gray-100 bg-green-50 flex flex-col gap-2">
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Template name (e.g. Fall Hike)"
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
          <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description (optional)"
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
          <button onClick={addTemplate}
            className="self-start px-5 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: '#2d7a2d' }}>
            Create
          </button>
        </div>
      )}

      {loading ? (
        <div className="p-6 text-sm text-gray-400">Loading…</div>
      ) : templates.map(tpl => (
        <div key={tpl.id} className="border-b border-gray-100 last:border-0">
          <div className="flex items-center gap-3 px-6 py-3">
            {renaming === tpl.id ? (
              <>
                <input value={renameVal} onChange={e => setRenameVal(e.target.value)} autoFocus
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                  onKeyDown={e => { if (e.key === 'Enter') renameTemplate(tpl.id); if (e.key === 'Escape') setRenaming(null) }} />
                <button onClick={() => renameTemplate(tpl.id)} className="px-3 py-1.5 rounded-lg text-sm text-white" style={{ background: '#2d7a2d' }}>Save</button>
                <button onClick={() => setRenaming(null)} className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-500">✕</button>
              </>
            ) : (
              <>
                <button onClick={() => setExpandedId(p => p === tpl.id ? null : tpl.id)} className="flex-1 text-left">
                  <span className="text-sm font-semibold text-gray-900">{tpl.name}</span>
                  {tpl.description && <span className="text-xs text-gray-400 ml-2">{tpl.description}</span>}
                  <span className="text-xs text-gray-400 ml-2">· {(tpl.checklist_template_items||[]).length} items</span>
                </button>
                <button onClick={() => { setRenaming(tpl.id); setRenameVal(tpl.name) }} className="text-gray-400 hover:text-gray-700 px-2 text-sm">✏️ Rename</button>
                <button onClick={() => deleteTemplate(tpl.id)} className="text-red-400 hover:text-red-600 px-2 text-sm">🗑 Delete</button>
                <span className={`text-gray-300 text-xs ${expandedId === tpl.id ? 'rotate-180 inline-block' : ''}`}>▾</span>
              </>
            )}
          </div>

          {expandedId === tpl.id && (
            <div className="px-6 pb-4">
              <div className="border border-gray-100 rounded-xl overflow-hidden mb-3">
                {(tpl.checklist_template_items || []).length === 0 ? (
                  <div className="p-3 text-xs text-gray-400 text-center">No items yet — add below</div>
                ) : (tpl.checklist_template_items || []).map(item => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-2 border-b border-gray-50 last:border-0">
                    <span className="text-xs text-gray-400 w-28 flex-shrink-0">{item.category}</span>
                    <span className="text-sm text-gray-800 flex-1">{item.description}
                      {item.is_custom && <span className="text-[10px] text-gray-400 ml-1">(custom)</span>}
                    </span>
                    <button onClick={() => removeItem(tpl.id, item.id)} className="text-gray-300 hover:text-red-500 text-lg leading-none">×</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={newItemCat} onChange={e => setNewItemCat(e.target.value)} placeholder="Category"
                  className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 flex-shrink-0" />
                <input value={newItemDesc} onChange={e => setNewItemDesc(e.target.value)} placeholder="Item name…"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                  onKeyDown={e => { if (e.key === 'Enter') addItem(tpl.id) }} />
                <button onClick={() => addItem(tpl.id)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex-shrink-0" style={{ background: '#2d7a2d' }}>+ Add item</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </section>
  )
}

// ── Main admin page ───────────────────────────────────────────────────────────
export default function AdminPage() {
  const { user, loading } = useAuth()
  const [activeSection, setActiveSection] = useState('links')

  const isAdmin = user?.email === ADMIN_EMAIL

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>
  )

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">🔒</div>
        <div className="font-semibold text-gray-700 mb-2">Sign in required</div>
        <div className="text-sm text-gray-500">This page requires authentication.</div>
      </div>
    </div>
  )

  if (!isAdmin) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">⛔</div>
        <div className="font-semibold text-gray-700 mb-2">Access denied</div>
        <div className="text-sm text-gray-500">You don't have admin access.</div>
      </div>
    </div>
  )

  return (
    <>
      <Head><title>HikingLog Admin</title></Head>
      <div className="min-h-screen bg-[#f0f0ec]">
        {/* Header */}
        <div className="bg-[#1a1a1a] text-white px-6 py-4 flex items-center justify-between">
          <div>
            <div className="font-bold text-lg">🥾 HikingLog Admin</div>
            <div className="text-xs text-gray-400 mt-0.5">Signed in as {user.email}</div>
          </div>
          <a href="/" className="text-xs text-gray-400 hover:text-white border border-gray-600 px-3 py-1.5 rounded-lg">← Back to site</a>
        </div>

        {/* Tab bar */}
        <div className="bg-white border-b border-gray-200 px-6 flex gap-0">
          {[
            { id: 'links', label: '🔗 Trail Links' },
            { id: 'trailheads', label: '🗺️ Trailhead Editor' },
            { id: 'templates',  label: '📋 Checklist Templates' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveSection(tab.id)}
              className={`px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${activeSection === tab.id ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto px-6 py-8">
          {activeSection === 'links'      && <TrailLinksSection />}
          {activeSection === 'trailheads' && <TrailheadEditorSection />}
          {activeSection === 'templates'   && <DefaultTemplatesSection />}
        </div>
      </div>
    </>
  )
}
