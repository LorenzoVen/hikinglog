import { useState, useMemo, useRef, useCallback } from 'react'
import Head from 'next/head'
import dynamic from 'next/dynamic'
import trails from '../data/trails.json'
import TrailCard from '../components/TrailCard'
import Filters from '../components/Filters'

const TrailMap = dynamic(() => import('../components/TrailMap'), { ssr: false })

export default function Home() {
  const [filters, setFilters] = useState({
    transit: 'all',
    difficulty: 'all',
    maxTotalMin: 150,
    maxWalkMin: 60,
    minLengthMi: 0,
  })
  const [selectedTrail, setSelectedTrail] = useState(null)
  const cardRefs = useRef({})

  // Called when a map marker is clicked — selects trail AND scrolls card into view
  const handleMapSelect = useCallback((trail) => {
    setSelectedTrail(prev => {
      const next = prev?.id === trail?.id ? null : trail
      if (next) {
        setTimeout(() => {
          cardRefs.current[next.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 50)
      }
      return next
    })
  }, [])

  const filtered = useMemo(() => {
    return trails.filter(t => {
      const total = (t.transitMin || 0) + (t.walkMin || 0)
      const lineStr = t.line || t.operator || ''
      const operatorStr = t.transitType || t.operator || ''
      if (filters.transit !== 'all') {
        const isBus = ['Bus', 'Coach', 'Transbridge', 'Short Line', 'Trailways', 'Red & Tan']
          .some(k => lineStr.includes(k))
        if (filters.transit === 'Bus' && !isBus) return false
        if (filters.transit !== 'Bus' && !operatorStr.includes(filters.transit)) return false
      }
      if (filters.difficulty !== 'all' && t.difficulty !== filters.difficulty) return false
      if (total > filters.maxTotalMin) return false
      if ((t.walkMin || 0) > filters.maxWalkMin) return false
      if (t.lengthMi != null && t.lengthMi < filters.minLengthMi) return false
      return true
    })
  }, [filters])

  return (
    <>
      <Head>
        <title>HikingLog — Hikes from NYC by Transit</title>
        <meta name="description" content="Find trailheads reachable from Manhattan by Metro-North, NJ Transit, LIRR, or bus. No car needed." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-[#f8f7f4]">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🥾</span>
              <div>
                <h1 className="text-lg font-semibold text-gray-900 leading-none">HikingLog</h1>
                <p className="text-xs text-gray-500">Hikes from NYC — no car needed</p>
              </div>
            </div>
            <div className="text-sm text-gray-500 hidden sm:block">
              Starting from Manhattan · {filtered.length} trail{filtered.length !== 1 ? 's' : ''} found
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">

            {/* Left panel: filters + cards */}
            <div className="flex flex-col gap-4">
              <Filters filters={filters} onChange={setFilters} count={filtered.length} />

              <div className="flex flex-col gap-3">
                {filtered.length === 0 && (
                  <div className="text-center py-10 text-gray-500 text-sm bg-white rounded-xl border border-gray-100">
                    No trails match your filters. Try relaxing the walk time or travel time.
                  </div>
                )}
                {filtered.map(trail => (
                  <TrailCard
                    key={trail.id}
                    trail={trail}
                    isSelected={selectedTrail?.id === trail.id}
                    onClick={() => setSelectedTrail(selectedTrail?.id === trail.id ? null : trail)}
                    cardRef={el => cardRefs.current[trail.id] = el}
                  />
                ))}
              </div>

              <p className="text-xs text-gray-400 pb-4">
                Trail data sourced from OpenStreetMap contributors and community knowledge.
                Transit times are estimates from Penn Station / Port Authority. Always check
                schedules before you go.
              </p>
            </div>

            {/* Right panel: map */}
            <div className="sticky top-[65px] h-[calc(100vh-90px)]">
              <TrailMap
                trails={filtered}
                selectedTrail={selectedTrail}
                onSelectTrail={handleMapSelect}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
