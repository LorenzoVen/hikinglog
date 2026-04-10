import { useUnits } from '../context/UnitsContext'

const transitColors = {
  'Metro-North': 'bg-blue-50 text-blue-800',
  'NJ Transit':  'bg-blue-50 text-blue-800',
  'LIRR':        'bg-blue-50 text-blue-800',
}

export default function TrailCard({ trail, isSelected, isFavorite, reviewCount, onClick, cardRef, onPlan, onToggleFavorite }) {
  const { fmtDist, fmtElev } = useUnits()
  const total = (trail.transitMin || 0) + (trail.walkMin || 0)
  const operator = trail.transitType || trail.operator || 'Transit'
  const lineStr = trail.line || trail.operator || ''
  const isBus = ['Bus', 'Coach', 'Transbridge', 'Short Line', 'Trailways'].some(k => lineStr.includes(k))
  const transitLabel = isBus ? 'Bus' : operator
  const location = trail.location || trail.station || ''
  const hasMetadata = trail.difficulty || trail.lengthMi || trail.elevFt

  return (
    <div
      ref={cardRef}
      className={`trail-card bg-white rounded-xl border cursor-pointer ${isSelected ? 'ring-2 ring-green-600 border-transparent' : 'border-gray-100'}`}
      onClick={onClick}
    >
      <div className="p-4">
        {/* Top row */}
        <div className="flex justify-between items-start gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-gray-900 text-sm leading-snug pr-2">{trail.name}</h3>
            {location && <p className="text-xs text-gray-500 mt-0.5 truncate">{location}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Favorite heart */}
            <button
              onClick={onToggleFavorite}
              className={`text-lg leading-none transition-colors ${isFavorite ? 'text-red-500' : 'text-gray-300 hover:text-red-400'}`}
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              {isFavorite ? '♥' : '♡'}
            </button>
            <div className="text-right">
              <div className="text-sm font-semibold text-gray-800">{total} min</div>
              <div className="text-xs text-gray-400">total</div>
            </div>
          </div>
        </div>

        {/* Travel breakdown bar */}
        <div className="flex rounded-lg overflow-hidden border border-gray-100 mb-3 text-xs">
          <div className="bg-blue-50 px-3 py-2 flex-1 border-r border-blue-100 min-w-0">
            <div className="text-blue-400 uppercase tracking-wide text-[10px] font-medium mb-0.5">Transit</div>
            <div className="font-semibold text-blue-900">{trail.transitMin} min</div>
            <div className="text-blue-600 truncate">{lineStr}</div>
          </div>
          <div className="bg-gray-50 px-3 py-2 flex-1 min-w-0">
            <div className="text-gray-400 uppercase tracking-wide text-[10px] font-medium mb-0.5">Walk to trail</div>
            <div className="font-semibold text-gray-800">{trail.walkMin} min</div>
            <div className="text-gray-500">{fmtDist(trail.walkMi)} from station</div>
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${transitColors[transitLabel] || 'bg-blue-50 text-blue-800'}`}>
            {transitLabel}
          </span>
          {trail.difficulty && (
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
              trail.difficulty === 'Easy' ? 'bg-green-50 text-green-800' :
              trail.difficulty === 'Moderate' ? 'bg-amber-50 text-amber-800' :
              'bg-red-50 text-red-800'}`}>
              {trail.difficulty}
            </span>
          )}
          {trail.seasonal && (
            <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-orange-50 text-orange-700">Seasonal</span>
          )}
          {/* Review count */}
          {reviewCount > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600 ml-auto">
              {reviewCount} review{reviewCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Trail stats */}
        {hasMetadata && (
          <div className="flex gap-4 text-xs text-gray-500 mt-2">
            {trail.elevFt != null && <span>↕ {fmtElev(trail.elevFt)} gain</span>}
            {trail.lengthMi != null && <span>↔ {fmtDist(trail.lengthMi)}</span>}
          </div>
        )}
      </div>

      {/* Expanded detail */}
      {isSelected && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 rounded-b-xl">
          {trail.desc && (
            <p className="text-sm text-gray-600 mb-3 leading-relaxed">{trail.desc}</p>
          )}

          {/* Station info */}
          <div className="bg-blue-50 rounded-lg px-3 py-2.5 mb-3">
            <div className="text-[10px] text-blue-400 uppercase tracking-wide font-medium mb-1">Nearest station</div>
            <div className="text-sm font-semibold text-blue-900">{trail.station}</div>
            <div className="text-xs text-blue-700 mt-0.5">{lineStr}</div>
            <div className="text-xs text-blue-600 mt-1">
              {trail.walkMin} min walk · {fmtDist(trail.walkMi)}
              {trail.walkNote ? ` — ${trail.walkNote}` : ''}
            </div>
          </div>

          {trail.tips && (
            <div className="mb-3">
              <span className="text-xs font-medium text-gray-700">Getting there: </span>
              <span className="text-xs text-gray-500">{trail.tips}</span>
            </div>
          )}

          {trail.seasonal && trail.seasonNote && (
            <div className="mb-3 text-xs text-orange-700 bg-orange-50 rounded-lg px-3 py-2">
              ⚠ {trail.seasonNote}
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={e => { e.stopPropagation(); onPlan() }}
              className="text-xs text-white px-3 py-1.5 rounded-lg font-medium"
              style={{ background: '#2d7a2d' }}
            >
              Plan this hike →
            </button>
            {trail.alltrails && (
              <a href={trail.alltrails} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-white transition-colors text-gray-600">
                AllTrails ↗
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
