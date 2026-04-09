const diffColors = {
  Easy:     'bg-green-50 text-green-800',
  Moderate: 'bg-amber-50 text-amber-800',
  Hard:     'bg-red-50 text-red-800',
}

const transitColors = {
  'Metro-North': 'bg-blue-50 text-blue-800',
  'NJ Transit':  'bg-blue-50 text-blue-800',
  'LIRR':        'bg-blue-50 text-blue-800',
  'Bus':         'bg-purple-50 text-purple-800',
}

function transitColor(t) {
  return transitColors[t] || 'bg-blue-50 text-blue-800'
}

export default function TrailCard({ trail, isSelected, onClick, onPlan }) {
  const total = trail.transitMin + trail.walkMin
  const isBus = ['Bus', 'Coach', 'Transbridge', 'Short Line', 'Trailways', 'Red & Tan'].some(k => trail.line.includes(k))
  const transitLabel = isBus ? 'Bus' : trail.transitType

  return (
    <div
      className={`trail-card bg-white rounded-xl border cursor-pointer ${isSelected ? 'selected border-forest-600' : 'border-gray-100'}`}
      onClick={onClick}
    >
      <div className="p-4">
        {/* Top row */}
        <div className="flex justify-between items-start gap-2 mb-2">
          <div>
            <h3 className="font-medium text-gray-900 text-sm leading-snug">{trail.name}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{trail.location}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-sm font-semibold text-gray-800">{total} min</div>
            <div className="text-xs text-gray-400">total</div>
          </div>
        </div>

        {/* Travel breakdown bar */}
        <div className="flex rounded-lg overflow-hidden border border-gray-100 mb-3 text-xs">
          <div className="bg-blue-50 px-3 py-2 flex-1 border-r border-blue-100">
            <div className="text-blue-400 uppercase tracking-wide text-[10px] font-medium mb-0.5">Transit</div>
            <div className="font-semibold text-blue-900">{trail.transitMin} min</div>
            <div className="text-blue-600 truncate">{trail.line}</div>
          </div>
          <div className="bg-gray-50 px-3 py-2 flex-1">
            <div className="text-gray-400 uppercase tracking-wide text-[10px] font-medium mb-0.5">Walk to trail</div>
            <div className="font-semibold text-gray-800">{trail.walkMin} min</div>
            <div className="text-gray-500">{trail.walkMi} mi from station</div>
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${transitColor(transitLabel)}`}>
            {transitLabel}
          </span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${diffColors[trail.difficulty]}`}>
            {trail.difficulty}
          </span>
          {trail.seasonal && (
            <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-orange-50 text-orange-700">
              Seasonal
            </span>
          )}
        </div>

        {/* Trail stats */}
        <div className="flex gap-4 text-xs text-gray-500">
          <span>↕ {trail.elevFt.toLocaleString()} ft gain</span>
          <span>↔ {trail.lengthMi} mi trail</span>
        </div>
      </div>

      {/* Expanded detail */}
      {isSelected && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 rounded-b-xl">
          <p className="text-sm text-gray-600 mb-2 leading-relaxed">{trail.desc}</p>

          <div className="mb-2">
            <span className="text-xs font-medium text-gray-700">Walk to trailhead: </span>
            <span className="text-xs text-gray-500">{trail.walkNote}</span>
          </div>

          <div className="mb-3">
            <span className="text-xs font-medium text-gray-700">Getting there: </span>
            <span className="text-xs text-gray-500">{trail.tips}</span>
          </div>

          {trail.seasonal && trail.seasonNote && (
            <div className="mb-3 text-xs text-orange-700 bg-orange-50 rounded-lg px-3 py-2">
              ⚠ {trail.seasonNote}
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={e => { e.stopPropagation(); onPlan() }}
              className="text-xs bg-forest-600 text-white px-3 py-1.5 rounded-lg hover:bg-forest-800 transition-colors font-medium"
              style={{ background: '#2d7a2d' }}
            >
              Plan this trip with AI
            </button>
            <a
              href={trail.alltrails}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-white transition-colors text-gray-600"
            >
              View on AllTrails ↗
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
