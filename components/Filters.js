import { useUnits } from '../context/UnitsContext'

export default function Filters({ filters, onChange, count }) {
  const { metric, toggle, miToUnit, distUnit } = useUnits()
  const set = (key, val) => onChange(prev => ({ ...prev, [key]: val }))

  // Display values in current unit
  const displayMaxTotal = filters.maxTotalMin
  const displayMaxWalk = miToUnit(filters.maxWalkMin / 3 * 3) // keep as minutes — walk time stays minutes

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col gap-4">
      {/* Top row: transit + units toggle */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="text-xs text-gray-500 block mb-1">Transit line</label>
          <select
            value={filters.transit}
            onChange={e => set('transit', e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-green-600"
          >
            <option value="all">All lines</option>
            <option value="Metro-North">Metro-North</option>
            <option value="LIRR">LIRR</option>
            <option value="NJ Transit">NJ Transit</option>
          </select>
        </div>

        {/* Metric/Imperial toggle */}
        <button
          onClick={toggle}
          className="shrink-0 text-xs px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium transition-colors"
          title="Toggle metric/imperial"
        >
          {metric ? 'km / m' : 'mi / ft'}
        </button>
      </div>

      {/* Max total travel */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">
          Max total travel: <span className="font-medium text-gray-700">{filters.maxTotalMin} min</span>
        </label>
        <input
          type="range" min={30} max={150} step={5}
          value={filters.maxTotalMin}
          onChange={e => set('maxTotalMin', +e.target.value)}
          className="w-full accent-green-700"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
          <span>30 min</span><span>150 min</span>
        </div>
      </div>

      {/* Max walk to trailhead */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">
          Max walk to trailhead: <span className="font-medium text-gray-700">{filters.maxWalkMin} min</span>
        </label>
        <input
          type="range" min={5} max={60} step={5}
          value={filters.maxWalkMin}
          onChange={e => set('maxWalkMin', +e.target.value)}
          className="w-full accent-green-700"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
          <span>5 min</span><span>60 min</span>
        </div>
      </div>

      <div className="text-xs text-gray-400 pt-1 border-t border-gray-100">
        {count} trailhead{count !== 1 ? 's' : ''} found
      </div>
    </div>
  )
}
