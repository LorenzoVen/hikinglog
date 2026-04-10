import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import Head from 'next/head'
import dynamic from 'next/dynamic'
import trails from '../data/trails.json'
import TrailCard from '../components/TrailCard'
import Filters from '../components/Filters'
import PlanModal from '../components/PlanModal'
import AuthModal from '../components/AuthModal'
import { useAuth } from '../context/AuthContext'

const TrailMap = dynamic(() => import('../components/TrailMap'), { ssr: false })

export default function Home() {
  const { user, signOut } = useAuth()
  const [filters, setFilters] = useState({
    transit: 'all',
    maxTotalMin: 150,
    maxWalkMin: 60,
  })
  const [selectedTrail, setSelectedTrail] = useState(null)
  const [planTrail, setPlanTrail] = useState(null)
  const [showAuth, setShowAuth] = useState(false)
  const [showMap, setShowMap] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [view, setView] = useState('list') // 'list' | 'map' — mobile only
  const cardRefs = useRef({})

  const filtered = useMemo(() => {
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
      return true
    })
  }, [filters])

  const handleMapSelect = useCallback((trail) => {
    setSelectedTrail(prev => {
      const next = prev?.id === trail?.id ? null : trail
      if (next) {
        setView('list')
        setTimeout(() => {
          cardRefs.current[next.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 100)
      }
      return next
    })
  }, [])

  const userInitial = user?.email?.[0]?.toUpperCase()

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

      <div className="min-h-screen bg-[#f8f7f4]">
        {/* ── Header ── */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🥾</span>
              <div>
                <h1 className="text-base font-semibold text-gray-900 leading-none">HikingLog</h1>
                <p className="text-[11px] text-gray-500 hidden sm:block">NYC hikes by transit</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Mobile: map/list toggle */}
              <div className="flex sm:hidden border border-gray-200 rounded-lg overflow-hidden text-xs">
                <button
                  onClick={() => setView('list')}
                  className={`px-3 py-1.5 font-medium transition-colors ${view === 'list' ? 'bg-green-700 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  List
                </button>
                <button
                  onClick={() => setView('map')}
                  className={`px-3 py-1.5 font-medium transition-colors ${view === 'map' ? 'bg-green-700 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  Map
                </button>
              </div>

              {/* Result count — desktop */}
              <span className="text-xs text-gray-500 hidden md:block">
                {filtered.length} trailhead{filtered.length !== 1 ? 's' : ''}
              </span>

              {/* Auth button */}
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
                <button
                  onClick={() => setShowAuth(true)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 font-medium"
                >
                  Sign in
                </button>
              )}
            </div>
          </div>
        </header>

        {/* ── Main layout ── */}
        <div className="max-w-7xl mx-auto px-4 py-4">

          {/* Desktop: side-by-side */}
          <div className="hidden sm:grid sm:grid-cols-[340px_1fr] gap-6">
            <div className="flex flex-col gap-4">
              <Filters filters={filters} onChange={setFilters} count={filtered.length} />
              <TrailList
                trails={filtered}
                selectedTrail={selectedTrail}
                cardRefs={cardRefs}
                setSelectedTrail={setSelectedTrail}
                setPlanTrail={setPlanTrail}
              />
              <Footer />
            </div>
            <div className="sticky top-[61px] h-[calc(100vh-80px)]">
              <TrailMap trails={filtered} selectedTrail={selectedTrail} onSelectTrail={handleMapSelect} />
            </div>
          </div>

          {/* Mobile: list or map view */}
          <div className="sm:hidden">
            {/* Mobile filters - collapsible */}
            <div className="mb-3">
              <button
                onClick={() => setShowFilters(f => !f)}
                className="w-full flex items-center justify-between bg-white rounded-xl border border-gray-100 px-4 py-3 text-sm"
              >
                <span className="font-medium text-gray-700">Filters</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{filtered.length} results</span>
                  <span className={`text-gray-400 transition-transform ${showFilters ? 'rotate-180' : ''}`}>▾</span>
                </div>
              </button>
              {showFilters && (
                <div className="mt-2">
                  <Filters filters={filters} onChange={setFilters} count={filtered.length} />
                </div>
              )}
            </div>

            {view === 'list' ? (
              <div className="flex flex-col gap-3">
                <TrailList
                  trails={filtered}
                  selectedTrail={selectedTrail}
                  cardRefs={cardRefs}
                  setSelectedTrail={setSelectedTrail}
                  setPlanTrail={setPlanTrail}
                />
                <Footer />
              </div>
            ) : (
              <div style={{ height: 'calc(100vh - 160px)' }}>
                <TrailMap trails={filtered} selectedTrail={selectedTrail} onSelectTrail={handleMapSelect} />
              </div>
            )}
          </div>
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

function TrailList({ trails, selectedTrail, cardRefs, setSelectedTrail, setPlanTrail }) {
  if (trails.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500 text-sm bg-white rounded-xl border border-gray-100">
        No trailheads match your filters. Try relaxing the travel time or walk distance.
      </div>
    )
  }
  return (
    <>
      {trails.map(trail => (
        <TrailCard
          key={trail.id}
          trail={trail}
          isSelected={selectedTrail?.id === trail.id}
          onClick={() => setSelectedTrail(p => p?.id === trail.id ? null : trail)}
          cardRef={el => cardRefs.current[trail.id] = el}
          onPlan={() => setPlanTrail(trail)}
        />
      ))}
    </>
  )
}

function Footer() {
  return (
    <p className="text-xs text-gray-400 pb-6 leading-relaxed">
      Trailhead locations from OpenStreetMap contributors. Transit times are estimates
      from Grand Central (Metro-North) or Penn Station (LIRR / NJ Transit).
      Always check schedules before you go.
    </p>
  )
}
