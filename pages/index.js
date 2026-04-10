import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import Head from 'next/head'
import dynamic from 'next/dynamic'
import trails from '../data/trails.json'
import TrailCard from '../components/TrailCard'
import Filters from '../components/Filters'
import PlanModal from '../components/PlanModal'
import AuthModal from '../components/AuthModal'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const TrailMap = dynamic(() => import('../components/TrailMap'), { ssr: false })

export default function Home() {
  const { user, signOut } = useAuth()
  const [filters, setFilters] = useState({ transit: 'all', maxTotalMin: 150, maxWalkMin: 60 })
  const [search, setSearch] = useState('')
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [favorites, setFavorites] = useState(new Set())
  const [reviewCounts, setReviewCounts] = useState({})
  const [selectedTrail, setSelectedTrail] = useState(null)
  const [planTrail, setPlanTrail] = useState(null)
  const [showAuth, setShowAuth] = useState(false)
  const [view, setView] = useState('list')
  const [filtersOpen, setFiltersOpen] = useState(false)
  // Separate scroll containers for desktop and mobile
  const desktopListRef = useRef(null)
  const mobileListRef = useRef(null)
  const cardRefs = useRef({})

  useEffect(() => {
    async function loadFavorites() {
      if (!user || !supabase) { setFavorites(new Set()); return }
      const { data } = await supabase.from('favorites').select('trail_id').eq('user_id', user.id)
      setFavorites(new Set((data || []).map(r => String(r.trail_id))))
    }
    loadFavorites()
  }, [user])

  useEffect(() => {
    async function loadCounts() {
      if (!supabase) return
      const { data } = await supabase.from('trail_reports').select('trail_id')
      if (!data) return
      const counts = {}
      data.forEach(r => { counts[r.trail_id] = (counts[r.trail_id] || 0) + 1 })
      setReviewCounts(counts)
    }
    loadCounts()
  }, [])

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return trails.filter(t => {
      const total = (t.transitMin || 0) + (t.walkMin || 0)
      const lineStr = t.line || t.operator || ''
      const operatorStr = t.transitType || t.operator || ''
      if (filters.transit !== 'all') {
        const isBus = ['Bus', 'Coach', 'Transbridge', 'Short Line', 'Trailways'].some(k => lineStr.includes(k))
        if (filters.transit === 'Bus' && !isBus) return false
        if (filters.transit !== 'Bus' && !operatorStr.includes(filters.transit)) return false
      }
      if (total > filters.maxTotalMin) return false
      if ((t.walkMin || 0) > filters.maxWalkMin) return false
      if (showFavoritesOnly && !favorites.has(String(t.id))) return false
      if (q) {
        const name = (t.name || '').toLowerCase()
        const station = (t.station || '').toLowerCase()
        if (!name.includes(q) && !station.includes(q)) return false
      }
      return true
    })
  }, [filters, search, showFavoritesOnly, favorites])

  // Scroll selected card into view within its container
  function scrollToCard(trailId, containerRef) {
    requestAnimationFrame(() => {
      const card = cardRefs.current[trailId]
      const container = containerRef.current
      if (!card || !container) return
      const containerTop = container.getBoundingClientRect().top
      const cardTop = card.getBoundingClientRect().top
      const offset = cardTop - containerTop - (container.clientHeight / 2) + (card.clientHeight / 2)
      container.scrollBy({ top: offset, behavior: 'smooth' })
    })
  }

  const handleMapSelect = useCallback((trail) => {
    setSelectedTrail(prev => {
      const next = prev?.id === trail?.id ? null : trail
      if (next) {
        setView('list')
        // Small delay to ensure list view is rendered before scrolling
        setTimeout(() => {
          scrollToCard(next.id, desktopListRef)
          scrollToCard(next.id, mobileListRef)
        }, 150)
      }
      return next
    })
  }, [])

  // Also scroll when a card is selected from the list (so it stays centred after expand)
  function handleCardClick(trail) {
    const next = selectedTrail?.id === trail.id ? null : trail
    setSelectedTrail(next)
    if (next) {
      setTimeout(() => {
        scrollToCard(next.id, desktopListRef)
        scrollToCard(next.id, mobileListRef)
      }, 50)
    }
  }

  const userInitial = user?.email?.[0]?.toUpperCase()

  const FilterPanel = (
    <div className="flex flex-col gap-2">
      {/* Search */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">🔍</span>
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search trail or station…"
          className="w-full pl-9 pr-9 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-green-600"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">✕</button>
        )}
      </div>

      {/* Favorites toggle — only when logged in */}
      {user && (
        <button
          onClick={() => setShowFavoritesOnly(p => !p)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-colors ${showFavoritesOnly ? 'border-red-300 bg-red-50 text-red-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          <span className="text-sm">{showFavoritesOnly ? '♥' : '♡'}</span>
          {showFavoritesOnly ? 'Showing favorites only' : 'Show favorites only'}
        </button>
      )}

      {/* Filters — collapsible on mobile, always open on desktop */}
      <div className="sm:hidden">
        <button
          onClick={() => setFiltersOpen(p => !p)}
          className="w-full flex items-center justify-between bg-white rounded-xl border border-gray-100 px-4 py-2.5 text-sm"
        >
          <span className="font-medium text-gray-700">Filters</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{filtered.length} results</span>
            <span className={`text-gray-400 text-xs transition-transform ${filtersOpen ? 'rotate-180' : ''}`}>▾</span>
          </div>
        </button>
        {filtersOpen && <div className="mt-2"><Filters filters={filters} onChange={setFilters} count={filtered.length} /></div>}
      </div>
      <div className="hidden sm:block">
        <Filters filters={filters} onChange={setFilters} count={filtered.length} />
      </div>
    </div>
  )

  const CardList = ({ containerRef }) => (
    <div ref={containerRef} className="flex flex-col gap-3 overflow-y-auto flex-1 min-h-0 pb-4">
      {filtered.length === 0 ? (
        <div className="text-center py-10 text-gray-500 text-sm bg-white rounded-xl border border-gray-100">
          No trailheads match. Try relaxing your filters or clearing the search.
        </div>
      ) : filtered.map(trail => (
        <TrailCard
          key={trail.id}
          trail={trail}
          isSelected={selectedTrail?.id === trail.id}
          isFavorite={favorites.has(String(trail.id))}
          reviewCount={reviewCounts[String(trail.id)] || 0}
          onClick={() => handleCardClick(trail)}
          cardRef={el => cardRefs.current[trail.id] = el}
          onPlan={() => setPlanTrail(trail)}
          onToggleFavorite={e => toggleFavorite(trail.id, e)}
        />
      ))}
      <Footer />
    </div>
  )

  return (
    <>
      <Head>
        <title>HikingLog — NYC Transit Hikes</title>
        <meta name="description" content="Find trailheads reachable from Manhattan by Metro-North, NJ Transit, or LIRR. No car needed." />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#2d7a2d" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="HikingLog" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-[#f8f7f4] flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-20 flex-shrink-0">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🥾</span>
              <div>
                <h1 className="text-base font-semibold text-gray-900 leading-none">HikingLog</h1>
                <p className="text-[11px] text-gray-500 hidden sm:block">NYC hikes by transit</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Mobile list/map toggle */}
              <div className="flex sm:hidden border border-gray-200 rounded-lg overflow-hidden text-xs">
                <button onClick={() => setView('list')}
                  className={`px-3 py-1.5 font-medium transition-colors ${view === 'list' ? 'bg-green-700 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                  List
                </button>
                <button onClick={() => setView('map')}
                  className={`px-3 py-1.5 font-medium transition-colors ${view === 'map' ? 'bg-green-700 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                  Map
                </button>
              </div>

              <span className="text-xs text-gray-500 hidden md:block">{filtered.length} of {trails.length} trailheads</span>

              {user ? (
                <div className="relative group">
                  <button className="w-8 h-8 rounded-full text-white text-sm font-semibold flex items-center justify-center" style={{ background: '#2d7a2d' }}>
                    {userInitial}
                  </button>
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-1 hidden group-hover:block z-10 min-w-[140px]">
                    <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-100 truncate">{user.email}</div>
                    <button onClick={signOut} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">Sign out</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowAuth(true)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 font-medium">
                  Sign in
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Desktop layout — fills remaining viewport height */}
        <div className="hidden sm:flex flex-1 min-h-0 max-w-7xl w-full mx-auto px-4 py-4 gap-6">
          {/* Left: filters + scrollable list */}
          <div className="w-[340px] flex-shrink-0 flex flex-col gap-3 min-h-0">
            <div className="flex-shrink-0">{FilterPanel}</div>
            <CardList containerRef={desktopListRef} />
          </div>
          {/* Right: sticky map */}
          <div className="flex-1 min-h-0">
            <TrailMap trails={filtered} selectedTrail={selectedTrail} onSelectTrail={handleMapSelect} />
          </div>
        </div>

        {/* Mobile layout */}
        <div className="sm:hidden flex flex-col flex-1 min-h-0 px-4 py-3 gap-3">
          <div className="flex-shrink-0">{FilterPanel}</div>
          {view === 'list' ? (
            <CardList containerRef={mobileListRef} />
          ) : (
            <div className="flex-1 min-h-0">
              <TrailMap trails={filtered} selectedTrail={selectedTrail} onSelectTrail={handleMapSelect} />
            </div>
          )}
        </div>
      </div>

      {planTrail && (
        <PlanModal
          trail={planTrail}
          onClose={() => setPlanTrail(null)}
          onLoginRequired={() => { setPlanTrail(null); setShowAuth(true) }}
        />
      )}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  )
}

function Footer() {
  return (
    <p className="text-xs text-gray-400 leading-relaxed flex-shrink-0">
      Trailhead locations from OpenStreetMap contributors. Transit times are estimates
      from Grand Central (Metro-North) or Penn Station (LIRR / NJ Transit).
      Always check schedules before you go.
    </p>
  )
}
