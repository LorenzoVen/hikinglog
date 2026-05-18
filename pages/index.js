import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import Head from 'next/head'
import dynamic from 'next/dynamic'
import TrailCard from '../components/TrailCard'
import Filters from '../components/Filters'
import PlanModal from '../components/PlanModal'
import AuthModal from '../components/AuthModal'
import { useAuth } from '../context/AuthContext'
import { useUnits } from '../context/UnitsContext'
import { supabase } from '../lib/supabase'

const TrailMap = dynamic(() => import('../components/TrailMap'), { ssr: false })

// ── Status icon helpers ──────────────────────────────────────────────────────
function TrailStatusIcons({ trail, isFavorite, isPlanned, isDone, onToggleFavorite }) {
  return (
    <div className="flex items-center gap-1">
      {isPlanned && !isDone && <span title="Planned" style={{ fontSize: 14, color: '#1a56c4' }}>📅</span>}
      {isDone && <span title="Completed" style={{ fontSize: 14, color: '#2d7a2d' }}>🥾</span>}
      <button
        onClick={onToggleFavorite}
        style={{ fontSize: 17, color: isFavorite ? '#e53935' : '#ccc', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}
        title={isFavorite ? 'Remove favorite' : 'Add to favorites'}
      >{isFavorite ? '♥' : '♡'}</button>
    </div>
  )
}

export default function Home() {
  const { user, signOut } = useAuth()
  const { metric, toggle: toggleUnits } = useUnits()

  // ── Data ────────────────────────────────────────────────────────────────────
  const [trails, setTrails] = useState([])
  const [loadingTrails, setLoadingTrails] = useState(true)
  const [favorites, setFavorites] = useState(new Set())
  const [reviewCounts, setReviewCounts] = useState({})
  const [plannedIds, setPlannedIds] = useState(new Set())
  const [doneIds, setDoneIds] = useState(new Set())

  // ── UI state ────────────────────────────────────────────────────────────────
  const [page, setPage] = useState('trails') // dashboard | trails | planned | past | settings
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [filters, setFilters] = useState({ transit: 'all', maxTotalMin: 150, maxWalkMin: 60 })
  const [search, setSearch] = useState('')
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [selectedTrail, setSelectedTrail] = useState(null)
  const [detailTab, setDetailTab] = useState('transit')
  const [planTrail, setPlanTrail] = useState(null)
  const [showAuth, setShowAuth] = useState(false)
  const [privacy, setPrivacy] = useState({
    share_favorites: true,
    share_planned: false,
    share_reviews: true,
    share_completed: true,
  })
  const [privacyLoading, setPrivacyLoading] = useState(false)
  const [downloadingData, setDownloadingData] = useState(false)
  const [mobileView, setMobileView] = useState('list')

  const listRef = useRef(null)
  const cardRefs = useRef({})

  // ── Load trailheads ──────────────────────────────────────────────────────────
  // When admin selects River Crossing filter, also fetches suspect entries
  useEffect(() => {
    async function load() {
      setLoadingTrails(true)
      try {
        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'lveneziani83@gmail.com'
        const userIsAdmin = user?.email === adminEmail
        // Always fetch approved trailheads
        const res = await fetch('/api/trailheads')
        if (!res.ok) throw new Error('Failed to load trailheads')
        const approved = await res.json()
        // If admin, also fetch suspect (approved=false, suspect_match=true) and merge
        if (userIsAdmin) {
          const suspectRes = await fetch('/api/trailheads?suspect=1')
          const suspect = suspectRes.ok ? await suspectRes.json() : []
          // Merge: approved first, then suspect (no duplicates)
          const approvedIds = new Set(approved.map(t => t.id))
          const merged = [...approved, ...suspect.filter(t => !approvedIds.has(t.id))]
          setTrails(merged)
        } else {
          setTrails(approved)
        }
      } catch (e) {
        console.error('Trailheads load error:', e)
        setTrails([])
      }
      setLoadingTrails(false)
    }
    load()
  }, [user])



  // ── Load user data ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !supabase) { setFavorites(new Set()); setPlannedIds(new Set()); setDoneIds(new Set()); return }
    // Load privacy preferences from profiles table
    async function loadProfile() {
      const { data } = await supabase.from('profiles').select('share_favorites,share_planned,share_reviews,share_completed').eq('id', user.id).single()
      if (data) setPrivacy({
        share_favorites: data.share_favorites ?? true,
        share_planned:   data.share_planned   ?? false,
        share_reviews:   data.share_reviews   ?? true,
        share_completed: data.share_completed ?? true,
      })
    }
    loadProfile()
    async function loadUserData() {
      const [favRes, planRes] = await Promise.all([
        supabase.from('favorites').select('trail_id').eq('user_id', user.id),
        supabase.from('planned_trips').select('trail_id, status').eq('user_id', user.id),
      ])
      setFavorites(new Set((favRes.data || []).map(r => String(r.trail_id))))
      const planned = new Set()
      const done = new Set()
      ;(planRes.data || []).forEach(r => {
        if (r.status === 'done') done.add(String(r.trail_id))
        else planned.add(String(r.trail_id))
      })
      setPlannedIds(planned)
      setDoneIds(done)
    }
    loadUserData()
  }, [user])

  useEffect(() => {
    if (!supabase) return
    async function loadCounts() {
      const { data } = await supabase.from('trail_reports').select('trail_id')
      if (!data) return
      const counts = {}
      data.forEach(r => { counts[r.trail_id] = (counts[r.trail_id] || 0) + 1 })
      setReviewCounts(counts)
    }
    loadCounts()
  }, [])

  // ── Favorites toggle ─────────────────────────────────────────────────────────
  async function toggleFavorite(trailId, e) {
    e?.stopPropagation()
    if (!user) { setShowAuth(true); return }
    if (!supabase) return
    const id = String(trailId)
    if (favorites.has(id)) {
      setFavorites(prev => { const n = new Set(prev); n.delete(id); return n })
      await supabase.from('favorites').delete().eq('user_id', user.id).eq('trail_id', id)
    } else {
      setFavorites(prev => new Set([...prev, id]))
      await supabase.from('favorites').insert({ user_id: user.id, trail_id: id })
    }
  }

  // ── Plan this hike ───────────────────────────────────────────────────────────
  async function saveAsPlanned(trailId, date) {
    if (!user) { setShowAuth(true); return false }
    if (!supabase) return false
    const id = String(trailId)
    await supabase.from('planned_trips').upsert(
      { user_id: user.id, trail_id: id, trip_date: date, status: 'planned' },
      { onConflict: 'user_id,trail_id,trip_date' }
    )
    setPlannedIds(prev => new Set([...prev, id]))
    return true
  }

  // ── Filtered trails ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {

    const q = search.trim().toLowerCase()
    return trails.filter(t => {
      const total = (t.transitMin || 0) + (t.walkMin || 0)
      const lineStr = t.line || t.operator || ''
      const operatorStr = t.operator || ''
      if (filters.transit !== 'all') {
        const isBus = ['Bus', 'Coach', 'Trans-Bridge', 'Lakeland', 'Academy', 'Broadway'].some(k => lineStr.includes(k) || operatorStr.includes(k))
        if (filters.transit === 'Bus' && !isBus) return false
        if (filters.transit !== 'Bus' && !operatorStr.includes(filters.transit) && !lineStr.includes(filters.transit)) return false
      }
      if (total > filters.maxTotalMin) return false
      if ((t.walkMin || 0) > filters.maxWalkMin) return false
      if (showFavoritesOnly && !favorites.has(String(t.id))) return false
      if (filters.transit === 'suspect' && !t.suspectMatch) return false

      if (q) {
        if (!(t.name || '').toLowerCase().includes(q) && !(t.station || '').toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [trails, filters, search, showFavoritesOnly, favorites])

  // ── Scroll selected card into view ──────────────────────────────────────────
  function scrollToCard(id) {
    setTimeout(() => {
      cardRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 100)
  }

  function selectTrail(trail) {
    setSelectedTrail(trail)
    setDetailTab('transit')
    if (trail) scrollToCard(trail.id)
  }

  function handleMapSelect(trail) {
    setMobileView('list')
    selectTrail(selectedTrail?.id === trail.id ? null : trail)
  }

  // ── Page / nav helpers ───────────────────────────────────────────────────────
  async function togglePrivacy(key) {
    if (!user || !supabase) return
    const next = { ...privacy, [key]: !privacy[key] }
    setPrivacy(next)
    await supabase.from('profiles').upsert({ id: user.id, [key]: next[key] }, { onConflict: 'id' })
  }

  async function downloadMyData() {
    if (!user || !supabase) return
    setDownloadingData(true)
    const [favRes, planRes, repRes, clRes] = await Promise.all([
      supabase.from('favorites').select('*').eq('user_id', user.id),
      supabase.from('planned_trips').select('*').eq('user_id', user.id),
      supabase.from('trail_reports').select('*').eq('user_id', user.id),
      supabase.from('checklist_trips').select('*, checklist_items(*)').eq('user_id', user.id),
    ])
    const exportData = {
      exported_at: new Date().toISOString(),
      user_email: user.email,
      favorites: favRes.data || [],
      planned_trips: planRes.data || [],
      trail_reports: repRes.data || [],
      checklists: clRes.data || [],
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'hikinglog-my-data.json'
    a.click()
    URL.revokeObjectURL(url)
    setDownloadingData(false)
  }

  async function deleteMyAccount() {
    if (!user || !supabase) return
    const confirmed = window.confirm('This will permanently delete all your data — favorites, reviews, checklists, and planned hikes. This cannot be undone.\n\nAre you sure?')
    if (!confirmed) return
    // Delete all user data in order (RLS cascades handle most)
    await Promise.all([
      supabase.from('favorites').delete().eq('user_id', user.id),
      supabase.from('planned_trips').delete().eq('user_id', user.id),
      supabase.from('trail_reports').delete().eq('user_id', user.id),
      supabase.from('checklist_trips').delete().eq('user_id', user.id),
      supabase.from('profiles').delete().eq('id', user.id),
    ])
    await signOut()
  }

  function navTo(p) {
    setPage(p)
    if (p === 'trails') setShowFavoritesOnly(false)
  }

  const userInitial = user?.email?.[0]?.toUpperCase() || '?'
  const isAdmin = user?.email === (process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'lveneziani83@gmail.com')
  const plannedTrails = trails.filter(t => plannedIds.has(String(t.id)) && !doneIds.has(String(t.id)))
  const pastTrails    = trails.filter(t => doneIds.has(String(t.id)))
  const nudgeTrails   = pastTrails.filter(t => !reviewCounts[String(t.id)])

  // ── Sidebar nav items ────────────────────────────────────────────────────────
  const NAV = [
    { id: 'dashboard', icon: '🏠', label: 'Dashboard' },
    { id: 'trails',    icon: '🗺️', label: 'Find a trailhead' },
    { id: 'planned',   icon: '📅', label: 'Planned', badge: plannedTrails.length || null },
    { id: 'past',      icon: '✅', label: 'Past hikes' },
    { id: 'settings',  icon: '⚙️', label: 'Settings' },
  ]

  return (
    <>
      <Head>
        <title>HikingLog — NYC Transit Hikes</title>
        <meta name="description" content="Find trailheads reachable from Manhattan by transit. No car needed." />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#2d7a2d" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="HikingLog" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* ── Desktop shell ── */}
      <div className="hidden sm:flex h-screen overflow-hidden bg-[#f0f0ec]">

        {/* Sidebar */}
        <div className={`flex flex-col bg-[#1a1a1a] flex-shrink-0 transition-all duration-300 overflow-hidden ${sidebarCollapsed ? 'w-14' : 'w-60'}`}>
          {/* Logo row */}
          <div className={`flex items-center border-b border-[#2a2a2a] flex-shrink-0 ${sidebarCollapsed ? 'justify-center p-3' : 'justify-between px-4 py-4'}`}>
            {!sidebarCollapsed && (
              <div>
                <div className="text-white font-bold text-base leading-none">🥾 HikingLog</div>
                <div className="text-[11px] text-[#666] mt-1">NYC hikes by transit</div>
              </div>
            )}
            <button
              onClick={() => setSidebarCollapsed(p => !p)}
              className="w-8 h-8 rounded-md flex items-center justify-center text-[#888] hover:text-white hover:bg-[#3a3a3a] transition-colors text-sm flex-shrink-0"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >{sidebarCollapsed ? '▶' : '◀'}</button>
          </div>

          {/* Nav */}
          <nav className="flex-1 py-3 overflow-y-auto">
            {NAV.map(item => (
              <button key={item.id} onClick={() => navTo(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors border-l-[3px] ${page === item.id ? 'text-white bg-[#222] border-l-[#2d7a2d]' : 'text-[#aaa] hover:text-white hover:bg-[#222] border-transparent'} ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
              >
                <span className="text-base flex-shrink-0 w-5 text-center" style={{ lineHeight: 1 }}>{item.icon}</span>
                {!sidebarCollapsed && <span className="flex-1 text-left">{item.label}</span>}
                {!sidebarCollapsed && item.badge ? (
                  <span className="bg-[#e65100] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{item.badge}</span>
                ) : null}
              </button>
            ))}
          </nav>

          {/* User */}
          <button onClick={() => navTo('settings')}
            className={`flex items-center gap-3 border-t border-[#2a2a2a] p-4 hover:bg-[#222] transition-colors ${sidebarCollapsed ? 'justify-center p-3' : ''}`}
          >
            <div className="w-8 h-8 rounded-full bg-[#2d7a2d] text-white text-sm font-bold flex items-center justify-center flex-shrink-0">{userInitial}</div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0 text-left">
                <div className="text-white text-sm font-semibold truncate">{user?.email?.split('@')[0] || 'Guest'}</div>
                <div className="text-[#555] text-xs truncate">{user?.email || 'Not signed in'}</div>
              </div>
            )}
          </button>
        </div>

        {/* Main */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Topbar */}
          <div className="h-14 bg-white border-b border-gray-200 flex items-center px-6 gap-4 flex-shrink-0">
            <div className="flex-1 font-bold text-gray-900 text-base">
              {NAV.find(n => n.id === page)?.label || 'HikingLog'}
            </div>
            {page === 'trails' && (
              <>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">🔍</span>
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search trail or station…"
                    className="w-72 pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-600 focus:bg-white focus:w-80 transition-all" />
                  {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">✕</button>}
                </div>
                {user && (
                  <button onClick={() => setShowFavoritesOnly(p => !p)}
                    className={`px-3 py-2 rounded-xl text-sm border transition-colors ${showFavoritesOnly ? 'bg-red-500 text-white border-red-500' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                    {showFavoritesOnly ? '♥ Favorites on' : '♥ Favorites only'}
                  </button>
                )}
                <span className="text-xs text-gray-400">{filtered.length} of {trails.length} trailheads</span>
              </>
            )}
            {!user ? (
              <button onClick={() => setShowAuth(true)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50">Sign in</button>
            ) : (
              <button onClick={signOut} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Sign out</button>
            )}
          </div>

          {/* Page content */}
          <div className="flex-1 overflow-hidden">

            {/* ── DASHBOARD ── */}
            {page === 'dashboard' && (
              <div className="h-full overflow-y-auto p-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-1">
                  Good morning{user ? `, ${user.email?.split('@')[0]}` : ''} 👋
                </h1>
                <p className="text-sm text-gray-500 mb-6">
                  {plannedTrails.length > 0 ? `${plannedTrails.length} planned hike${plannedTrails.length !== 1 ? 's' : ''}` : 'No upcoming hikes planned yet.'}
                  {nudgeTrails.length > 0 ? ` · ${nudgeTrails.length} hike${nudgeTrails.length !== 1 ? 's' : ''} waiting for review` : ''}
                </p>

                {nudgeTrails.length > 0 && (
                  <div className="bg-[#fff8f0] border border-[#ffd0a0] rounded-xl p-4 mb-6 flex gap-3">
                    <span className="text-xl">📝</span>
                    <div>
                      <div className="font-semibold text-[#bf360c] text-sm mb-1">{nudgeTrails[0].name} needs your post-hike review</div>
                      <div className="text-xs text-[#c04000]">Complete both the Review and Post-hike checklist to mark this trip as done.</div>
                      <button onClick={() => navTo('past')} className="mt-2 text-xs px-3 py-1.5 bg-[#e65100] text-white rounded-lg">Go to Past hikes →</button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4 mb-6">
                  {[
                    { icon: '🗺️', val: trails.length, label: 'Trailheads available', page: 'trails', green: true },
                    { icon: '📅', val: plannedTrails.length, label: 'Planned hikes', page: 'planned' },
                    { icon: '✅', val: pastTrails.length, label: 'Completed hikes', page: 'past' },
                  ].map(s => (
                    <button key={s.page} onClick={() => navTo(s.page)}
                      className={`rounded-xl p-5 text-left border transition-all hover:shadow-md ${s.green ? 'bg-[#2d7a2d] border-[#1a4f1a]' : 'bg-white border-gray-200 hover:border-green-600'}`}>
                      <div className="text-2xl mb-2">{s.icon}</div>
                      <div className={`text-3xl font-bold ${s.green ? 'text-white' : 'text-gray-900'}`}>{s.val}</div>
                      <div className={`text-sm mt-1 ${s.green ? 'text-green-200' : 'text-gray-500'}`}>{s.label}</div>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <div className="flex justify-between items-center mb-4">
                      <div className="font-bold text-sm text-gray-900">Upcoming</div>
                      <button onClick={() => navTo('planned')} className="text-xs text-green-700 font-medium">See all →</button>
                    </div>
                    {plannedTrails.length === 0 ? (
                      <p className="text-sm text-gray-400">No planned hikes yet.</p>
                    ) : plannedTrails.slice(0, 3).map(t => (
                      <div key={t.id} className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0 cursor-pointer hover:opacity-80" onClick={() => { navTo('trails'); selectTrail(t) }}>
                        <span className="text-lg">📅</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-900 truncate">{t.name}</div>
                          <div className="text-xs text-gray-500">{t.line || t.operator}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <div className="flex justify-between items-center mb-4">
                      <div className="font-bold text-sm text-gray-900">Recent</div>
                      <button onClick={() => navTo('past')} className="text-xs text-green-700 font-medium">See all →</button>
                    </div>
                    {pastTrails.length === 0 ? (
                      <p className="text-sm text-gray-400">No completed hikes yet.</p>
                    ) : pastTrails.slice(0, 3).map(t => (
                      <div key={t.id} className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0 cursor-pointer hover:opacity-80" onClick={() => navTo('past')}>
                        <span className="text-lg">{reviewCounts[String(t.id)] ? '✅' : '⚠️'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-900 truncate">{t.name}</div>
                          <div className="text-xs text-gray-500">{reviewCounts[String(t.id)] ? 'Done' : 'Needs review'}</div>
                        </div>
                        <span className={`text-[10px] px-2 py-1 rounded-full font-semibold ${reviewCounts[String(t.id)] ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
                          {reviewCounts[String(t.id)] ? 'Done ✓' : 'Review'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── TRAILS (3-column) ── */}
            {page === 'trails' && (
              <div className="h-full" style={{ display: 'grid', gridTemplateColumns: '340px 1fr 480px', gap: 12, padding: 12 }}>
                {/* List */}
                <div className="flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden min-h-0">
                  <div className="p-3 border-b border-gray-100 flex-shrink-0">
                    <Filters filters={filters} onChange={setFilters} count={filtered.length} isAdmin={isAdmin} />
                  </div>
                  <div ref={listRef} className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
                    {loadingTrails ? (
                      <div className="text-center py-10 text-gray-400 text-sm">Loading trailheads…</div>
                    ) : filtered.length === 0 ? (
                      <div className="text-center py-10 text-gray-400 text-sm">No trailheads match your filters.</div>
                    ) : filtered.map(trail => (
                      <TrailCard key={trail.id} trail={trail}
                        isSelected={selectedTrail?.id === trail.id}
                        isFavorite={favorites.has(String(trail.id))}
                        reviewCount={reviewCounts[String(trail.id)] || 0}
                        isPlanned={plannedIds.has(String(trail.id))}
                        isDone={doneIds.has(String(trail.id))}
                        onClick={() => selectTrail(selectedTrail?.id === trail.id ? null : trail)}
                        cardRef={el => cardRefs.current[trail.id] = el}
                        onPlan={() => setPlanTrail(trail)}
                        onToggleFavorite={e => toggleFavorite(trail.id, e)}
                      />
                    ))}
                    <Footer />
                  </div>
                </div>

                {/* Map */}
                <div className="rounded-xl overflow-hidden border border-gray-200 min-h-0">
                  <TrailMap trails={filtered} selectedTrail={selectedTrail} onSelectTrail={handleMapSelect} />
                </div>

                {/* Detail panel */}
                <div className="bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden min-h-0">
                  {selectedTrail ? (
                    <>
                      <div className="px-5 pt-5 pb-0 border-b border-gray-100 flex-shrink-0">
                        <div className="flex justify-between items-start mb-1">
                          <h2 className="text-lg font-bold text-gray-900 leading-tight pr-2">{selectedTrail.name}</h2>
                          <TrailStatusIcons
                            trail={selectedTrail}
                            isFavorite={favorites.has(String(selectedTrail.id))}
                            isPlanned={plannedIds.has(String(selectedTrail.id))}
                            isDone={doneIds.has(String(selectedTrail.id))}
                            onToggleFavorite={e => toggleFavorite(selectedTrail.id, e)}
                          />
                        </div>
                        <p className="text-sm text-gray-500 mb-3">{selectedTrail.station}</p>
                        <div className="flex overflow-x-auto gap-0 scrollbar-hide">
                          {['transit','weather','checklist','review','trails','past'].map(tab => (
                            <button key={tab} onClick={() => setDetailTab(tab)}
                              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 flex-shrink-0 transition-colors capitalize ${detailTab === tab ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                              {tab === 'trails' ? 'Trail links' : tab}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto p-5">
                        <PlanModal
                          trail={selectedTrail}
                          inlineTab={detailTab}
                          onLoginRequired={() => setShowAuth(true)}
                          onSaveForLater={saveAsPlanned}
                          embedded
                        />
                      </div>
                      <div className="border-t border-gray-100 p-4 flex gap-3 flex-shrink-0">
                        <input type="date" defaultValue={new Date().toISOString().split('T')[0]}
                          id="detail-date"
                          className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-600" />
                        <button onClick={async () => {
                          const date = document.getElementById('detail-date')?.value
                          const ok = await saveAsPlanned(selectedTrail.id, date)
                          if (!ok) setShowAuth(true)
                        }}
                          className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors" style={{ background: '#2d7a2d' }}>
                          📅 Plan this hike
                        </button>
                        <span className="text-xs text-gray-400 self-center ml-auto">Done = review + checklist complete</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-center p-6">
                      <div>
                        <div className="text-4xl mb-3">👈</div>
                        <div className="text-sm font-medium text-gray-700 mb-1">Select a trailhead</div>
                        <div className="text-xs text-gray-400">Click a card or map marker to see details, plan a hike, and more.</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── PLANNED ── */}
            {page === 'planned' && (
              <div className="h-full overflow-y-auto p-6">
                <div className="flex justify-between items-center mb-5">
                  <h2 className="font-bold text-gray-900">Planned hikes ({plannedTrails.length})</h2>
                  <button onClick={() => navTo('trails')} className="px-3 py-2 rounded-lg text-sm font-medium bg-[#2d7a2d] text-white">+ Plan a new hike</button>
                </div>
                {plannedTrails.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <div className="text-4xl mb-3">📅</div>
                    <div className="font-medium text-gray-600 mb-1">No planned hikes yet</div>
                    <div className="text-sm">Find a trailhead and click "Plan this hike" to add one.</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {plannedTrails.map(t => (
                      <ListCard key={t.id} trail={t} status="planned"
                        reviewCount={reviewCounts[String(t.id)] || 0}
                        onOpen={() => { navTo('trails'); selectTrail(t) }} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── PAST ── */}
            {page === 'past' && (
              <div className="h-full overflow-y-auto p-6">
                <div className="flex justify-between items-center mb-5">
                  <h2 className="font-bold text-gray-900">Past hikes ({pastTrails.length})</h2>
                </div>
                {pastTrails.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <div className="text-4xl mb-3">🥾</div>
                    <div className="font-medium text-gray-600 mb-1">No completed hikes yet</div>
                    <div className="text-sm">After a hike, submit a review and complete the checklist to mark it done.</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {pastTrails.map(t => (
                      <ListCard key={t.id} trail={t} status="done"
                        reviewCount={reviewCounts[String(t.id)] || 0}
                        onOpen={() => { navTo('trails'); selectTrail(t) }} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── SETTINGS ── */}
            {page === 'settings' && (
              <div className="h-full overflow-y-auto p-6">
                <div className="max-w-2xl">
                  <SettingsSection title="Preferences">
                    <SettingsRow label="Distance & elevation" sub="Applied across the app">
                      <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                        <button onClick={() => !metric && toggleUnits()}
                          className={`px-4 py-2 text-sm font-medium transition-colors ${!metric ? 'bg-[#2d7a2d] text-white' : 'text-gray-600 hover:bg-gray-50'}`}>mi / ft</button>
                        <button onClick={() => metric && toggleUnits()}
                          className={`px-4 py-2 text-sm font-medium transition-colors ${metric ? 'bg-[#2d7a2d] text-white' : 'text-gray-600 hover:bg-gray-50'}`}>km / m</button>
                      </div>
                    </SettingsRow>
                  </SettingsSection>

                  {user && (
                    <SettingsSection title="Privacy">
                      <SettingsRow label="Share favorites" sub="Your favorited trailheads appear anonymously in the community heat map">
                        <Toggle on={privacy.share_favorites} onToggle={() => togglePrivacy('share_favorites')} />
                      </SettingsRow>
                      <SettingsRow label="Share planned hikes" sub="Planned trailheads shown anonymously in heat map">
                        <Toggle on={privacy.share_planned} onToggle={() => togglePrivacy('share_planned')} />
                      </SettingsRow>
                      <SettingsRow label="Share reviews" sub={`Trail reviews attributed to your username (${user.email?.split('@')[0] || 'you'})`}>
                        <Toggle on={privacy.share_reviews} onToggle={() => togglePrivacy('share_reviews')} />
                      </SettingsRow>
                      <SettingsRow label="Share completed hikes" sub="Completed trailheads shown anonymously in heat map">
                        <Toggle on={privacy.share_completed} onToggle={() => togglePrivacy('share_completed')} />
                      </SettingsRow>
                    </SettingsSection>
                  )}

                  <SettingsSection title="Account">
                    <SettingsRow label="Email" sub="Used for login only — never shown publicly">
                      <span className="text-sm text-gray-500">{user ? user.email.replace(/^(.).*(@.*)$/, '$1***$2') : 'Not signed in'}</span>
                    </SettingsRow>
                    {user && (
                      <SettingsRow label="Connected accounts" sub="">
                        <span className="text-sm text-green-700 font-medium">Google ✓</span>
                      </SettingsRow>
                    )}
                    {!user ? (
                      <SettingsRow label="Sign in" sub="Required to save favorites, checklists and reviews">
                        <button onClick={() => setShowAuth(true)} className="px-4 py-2 rounded-lg text-sm font-medium bg-[#2d7a2d] text-white">Sign in</button>
                      </SettingsRow>
                    ) : (
                      <SettingsRow label="Sign out" sub="">
                        <button onClick={signOut} className="px-4 py-2 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50">Sign out</button>
                      </SettingsRow>
                    )}
                  </SettingsSection>

                  {user && <TemplateManager user={user} />}

                  {user && (
                    <SettingsSection title="Data & account" danger>
                      <SettingsRow label="Download my data" sub="Export all your hikes, reviews, and checklists as JSON">
                        <button onClick={downloadMyData} disabled={downloadingData}
                          className="px-4 py-2 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                          {downloadingData ? 'Preparing…' : 'Download'}
                        </button>
                      </SettingsRow>
                      <SettingsRow label="Delete my account" sub="Permanently removes all your data. This cannot be undone.">
                        <button onClick={deleteMyAccount}
                          className="px-4 py-2 rounded-lg text-sm border border-red-300 text-red-600 hover:bg-red-50 font-medium">
                          Delete account
                        </button>
                      </SettingsRow>
                    </SettingsSection>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ── Mobile layout ── */}
      <div className="sm:hidden min-h-screen bg-[#f8f7f4] flex flex-col">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-20 flex-shrink-0">
          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="text-base font-bold text-gray-900">🥾 HikingLog</div>
            <div className="flex items-center gap-2">
              <div className="flex border border-gray-200 rounded-lg overflow-hidden text-xs">
                <button onClick={() => setMobileView('list')}
                  className={`px-3 py-1.5 font-medium ${mobileView === 'list' ? 'bg-green-700 text-white' : 'text-gray-600'}`}>List</button>
                <button onClick={() => setMobileView('map')}
                  className={`px-3 py-1.5 font-medium ${mobileView === 'map' ? 'bg-green-700 text-white' : 'text-gray-600'}`}>Map</button>
              </div>
              {!user ? (
                <button onClick={() => setShowAuth(true)} className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-700">Sign in</button>
              ) : (
                <div className="w-8 h-8 rounded-full bg-green-700 text-white text-sm font-bold flex items-center justify-center">{userInitial}</div>
              )}
            </div>
          </div>
        </header>
        <div className="flex-1 flex flex-col px-4 py-3 gap-3 overflow-hidden">
          <Filters filters={filters} onChange={setFilters} count={filtered.length} isAdmin={isAdmin} />
          {mobileView === 'list' ? (
            <div ref={listRef} className="flex-1 overflow-y-auto flex flex-col gap-3 pb-4">
              {loadingTrails ? <div className="text-center py-8 text-gray-400 text-sm">Loading…</div>
                : filtered.map(trail => (
                  <TrailCard key={trail.id} trail={trail}
                    isSelected={selectedTrail?.id === trail.id}
                    isFavorite={favorites.has(String(trail.id))}
                    reviewCount={reviewCounts[String(trail.id)] || 0}
                    isPlanned={plannedIds.has(String(trail.id))}
                    isDone={doneIds.has(String(trail.id))}
                    onClick={() => { selectTrail(selectedTrail?.id === trail.id ? null : trail); if (selectedTrail?.id !== trail.id) setPlanTrail(trail) }}
                    cardRef={el => cardRefs.current[trail.id] = el}
                    onPlan={() => setPlanTrail(trail)}
                    onToggleFavorite={e => toggleFavorite(trail.id, e)}
                  />
                ))}
              <Footer />
            </div>
          ) : (
            <div className="flex-1 min-h-0">
              <TrailMap trails={filtered} selectedTrail={selectedTrail} onSelectTrail={handleMapSelect} />
            </div>
          )}
        </div>
        {/* Mobile bottom nav */}
        <div className="flex border-t border-gray-200 bg-white flex-shrink-0">
          {NAV.map(item => (
            <button key={item.id} onClick={() => navTo(item.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${page === item.id ? 'text-green-700' : 'text-gray-500'}`}>
              <span className="text-lg" style={{ lineHeight: 1 }}>{item.icon}</span>
              <span>{item.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Modals */}
      {planTrail && (
        <PlanModal trail={planTrail} onClose={() => setPlanTrail(null)}
          onLoginRequired={() => { setPlanTrail(null); setShowAuth(true) }}
          onSaveForLater={saveAsPlanned} />
      )}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  )
}

function ListCard({ trail, status, reviewCount, onOpen }) {
  const [expanded, setExpanded] = useState(false)
  const needsReview = status === 'done' && !reviewCount

  return (
    <div className={`bg-white border rounded-xl p-5 cursor-pointer transition-all hover:shadow-sm ${expanded ? 'border-green-600' : 'border-gray-200 hover:border-green-300'}`}
      onClick={() => setExpanded(p => !p)}>
      <div className="flex justify-between items-start gap-3 mb-3">
        <div className="min-w-0">
          <div className="font-bold text-gray-900 text-sm leading-snug">{trail.name}</div>
          <div className="text-xs text-gray-500 mt-1">{trail.line || trail.operator} · {trail.station}</div>
        </div>
        <span className={`text-[10px] px-2 py-1 rounded-full font-semibold flex-shrink-0 ${status === 'planned' ? 'bg-blue-50 text-blue-700' : needsReview ? 'bg-orange-50 text-orange-700' : 'bg-green-50 text-green-700'}`}>
          {status === 'planned' ? 'Planned' : needsReview ? 'Needs review' : 'Done ✓'}
        </span>
      </div>
      {needsReview && (
        <div className="text-xs text-orange-700 bg-orange-50 rounded-lg px-3 py-2 mb-3">⚠ Post-hike review and checklist pending</div>
      )}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex gap-3 mb-3 text-xs">
            <div className="flex-1 bg-blue-50 rounded-lg p-3">
              <div className="text-blue-400 uppercase font-bold text-[9px] mb-1">Transit</div>
              <div className="font-bold text-blue-900">{trail.transitMin} min</div>
              <div className="text-blue-700">{trail.line || trail.operator}</div>
            </div>
            <div className="flex-1 bg-gray-50 rounded-lg p-3">
              <div className="text-gray-400 uppercase font-bold text-[9px] mb-1">Walk to trail</div>
              <div className="font-bold text-gray-900">{trail.walkMin} min</div>
              <div className="text-gray-500">{trail.walkMi} mi from station</div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={e => { e.stopPropagation(); onOpen() }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: '#2d7a2d' }}>
              Open full detail →
            </button>
            {status === 'planned' && (
              <button onClick={e => { e.stopPropagation(); onOpen() }}
                className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 text-gray-600">
                ☁ Weather
              </button>
            )}
            <button onClick={e => { e.stopPropagation(); onOpen() }}
              className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 text-gray-600">
              📋 Checklist
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Toggle({ on, onToggle }) {
  return (
    <button onClick={onToggle}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${on ? 'bg-[#2d7a2d]' : 'bg-gray-300'}`}
      style={{ flexShrink: 0 }}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-5' : 'left-0.5'}`} />
    </button>
  )
}


function TemplateManager({ user }) {
  const [templates, setTemplates]     = useState([])
  const [loading, setLoading]         = useState(true)
  const [expandedId, setExpandedId]   = useState(null)
  const [renaming, setRenaming]       = useState(null)   // template id
  const [renameVal, setRenameVal]     = useState('')
  const [newTplName, setNewTplName]   = useState('')
  const [adding, setAdding]           = useState(false)
  const [newItemCat, setNewItemCat]   = useState('')
  const [newItemDesc, setNewItemDesc] = useState('')

  useEffect(() => {
    if (!user || !supabase) { setLoading(false); return }
    async function load() {
      const { data } = await supabase
        .from('checklist_templates')
        .select('id,name,is_default,checklist_template_items(id,category,description,is_custom)')
        .eq('created_by', user.id)
        .order('name')
      setTemplates(data || [])
      setLoading(false)
    }
    load()
  }, [user])

  async function addTemplate() {
    if (!newTplName.trim() || !supabase) return
    const { data } = await supabase.from('checklist_templates')
      .insert({ name: newTplName.trim(), is_default: false, created_by: user.id })
      .select('id,name,is_default,checklist_template_items(id,category,description,is_custom)').single()
    if (data) { setTemplates(prev => [...prev, data]); setNewTplName('') }
  }

  async function renameTemplate(id) {
    if (!renameVal.trim() || !supabase) return
    await supabase.from('checklist_templates').update({ name: renameVal.trim() }).eq('id', id)
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, name: renameVal.trim() } : t))
    setRenaming(null)
  }

  async function deleteTemplate(id) {
    if (!confirm('Delete this template? This cannot be undone.') || !supabase) return
    await supabase.from('checklist_templates').delete().eq('id', id)
    setTemplates(prev => prev.filter(t => t.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  async function addItem(tplId) {
    if (!newItemDesc.trim() || !supabase) return
    const cat = newItemCat.trim() || 'Other'
    const { data } = await supabase.from('checklist_template_items')
      .insert({ template_id: tplId, category: cat, description: newItemDesc.trim(), is_custom: true })
      .select().single()
    if (data) {
      setTemplates(prev => prev.map(t => t.id === tplId
        ? { ...t, checklist_template_items: [...(t.checklist_template_items || []), data] }
        : t))
      setNewItemCat(''); setNewItemDesc('')
    }
  }

  async function removeItem(tplId, itemId) {
    if (!supabase) return
    await supabase.from('checklist_template_items').delete().eq('id', itemId)
    setTemplates(prev => prev.map(t => t.id === tplId
      ? { ...t, checklist_template_items: (t.checklist_template_items || []).filter(i => i.id !== itemId) }
      : t))
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-5">
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center justify-between">
        <span>My Checklist Templates</span>
        <button onClick={() => setAdding(p => !p)}
          className="text-green-700 font-semibold hover:text-green-800">
          {adding ? '✕ Cancel' : '＋ New template'}
        </button>
      </div>

      {adding && (
        <div className="flex gap-2 px-5 py-3 border-b border-gray-100 bg-green-50">
          <input value={newTplName} onChange={e => setNewTplName(e.target.value)}
            placeholder="Template name…"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            onKeyDown={e => { if (e.key === 'Enter') { addTemplate(); setAdding(false) } }} />
          <button onClick={() => { addTemplate(); setAdding(false) }}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: '#2d7a2d' }}>
            Create
          </button>
        </div>
      )}

      {loading ? (
        <div className="px-5 py-4 text-sm text-gray-400">Loading…</div>
      ) : templates.length === 0 ? (
        <div className="px-5 py-4 text-sm text-gray-400">No custom templates yet. Create one above, or save a trip checklist as a template.</div>
      ) : templates.map(tpl => (
        <div key={tpl.id} className="border-b border-gray-100 last:border-0">
          {/* Template row */}
          <div className="flex items-center gap-3 px-5 py-3">
            {renaming === tpl.id ? (
              <>
                <input value={renameVal} onChange={e => setRenameVal(e.target.value)} autoFocus
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                  onKeyDown={e => { if (e.key === 'Enter') renameTemplate(tpl.id); if (e.key === 'Escape') setRenaming(null) }} />
                <button onClick={() => renameTemplate(tpl.id)} className="text-xs px-3 py-1.5 rounded-lg text-white" style={{ background: '#2d7a2d' }}>Save</button>
                <button onClick={() => setRenaming(null)} className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 text-gray-500">✕</button>
              </>
            ) : (
              <>
                <button onClick={() => setExpandedId(p => p === tpl.id ? null : tpl.id)}
                  className="flex-1 text-left">
                  <span className="text-sm font-medium text-gray-800">{tpl.name}</span>
                  <span className="text-xs text-gray-400 ml-2">{(tpl.checklist_template_items || []).length} items</span>
                </button>
                <button onClick={() => { setRenaming(tpl.id); setRenameVal(tpl.name) }}
                  className="text-xs text-gray-400 hover:text-gray-700 px-2">✏️</button>
                <button onClick={() => deleteTemplate(tpl.id)}
                  className="text-xs text-red-300 hover:text-red-600 px-2">🗑</button>
                <span className={`text-xs text-gray-300 transition-transform ${expandedId === tpl.id ? 'rotate-180' : ''}`}>▾</span>
              </>
            )}
          </div>

          {/* Expanded: items + add */}
          {expandedId === tpl.id && (
            <div className="px-5 pb-3">
              <div className="flex flex-col gap-1 mb-3">
                {(tpl.checklist_template_items || []).map(item => (
                  <div key={item.id} className="flex items-center gap-2 py-1 border-b border-gray-50 last:border-0">
                    <span className="text-xs text-gray-500 w-24 flex-shrink-0">{item.category}</span>
                    <span className="text-sm text-gray-800 flex-1">{item.description}
                      {item.is_custom && <span className="text-[10px] text-gray-400 ml-1">(custom)</span>}
                    </span>
                    <button onClick={() => removeItem(tpl.id, item.id)}
                      className="text-gray-300 hover:text-red-500 text-base leading-none">×</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <input value={newItemCat} onChange={e => setNewItemCat(e.target.value)} placeholder="Category"
                  className="w-28 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-600 flex-shrink-0" />
                <input value={newItemDesc} onChange={e => setNewItemDesc(e.target.value)} placeholder="Item name…"
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-600"
                  onKeyDown={e => { if (e.key === 'Enter') addItem(tpl.id) }} />
                <button onClick={() => addItem(tpl.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-white flex-shrink-0" style={{ background: '#2d7a2d' }}>+</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function SettingsSection({ title, children, danger }) {
  return (
    <div className={`border rounded-xl overflow-hidden mb-5 ${danger ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
      <div className={`px-5 py-3 border-b text-xs font-bold uppercase tracking-wider ${danger ? 'bg-red-100 border-red-200 text-red-500' : 'bg-gray-50 border-gray-100 text-gray-500'}`}>{title}</div>
      <div className="divide-y divide-gray-100">{children}</div>
    </div>
  )
}

function SettingsRow({ label, sub, children }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 gap-4">
      <div>
        <div className="text-sm font-medium text-gray-900">{label}</div>
        {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
      </div>
      {children}
    </div>
  )
}

function Footer() {
  return (
    <p className="text-xs text-gray-400 leading-relaxed flex-shrink-0 pt-2">
      Trailhead data from OpenStreetMap. Transit times estimated from Grand Central (Metro-North) or Penn Station (LIRR / NJ Transit). Always check schedules.
    </p>
  )
}
