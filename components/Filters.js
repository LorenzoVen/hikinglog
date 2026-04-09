export default function Filters({ filters, onChange, count }) {
  const set = (key, val) => onChange(prev => ({ ...prev, [key]: val }))

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Transit line</label>
          <select
            value={filters.transit}
            onChange={e => set('transit', e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-forest-600"
          >
            <option value="all">All lines</option>
            <option value="Metro-North">Metro-North</option>
            <option value="NJ Transit">NJ Transit</option>
            <option value="LIRR">LIRR</option>
            <option value="Bus">Bus / Coach</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Difficulty</label>
          <select
            value={filters.difficulty}
            onChange={e => set('difficulty', e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-forest-600"
          >
            <option value="all">Any difficulty</option>
            <option value="Easy">Easy</option>
            <option value="Moderate">Moderate</option>
            <option value="Hard">Hard</option>
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 block mb-1">
          Max total travel: <span className="font-medium text-gray-700">{filters.maxTotalMin} min</span>
        </label>
        <input
          type="range" min={30} max={150} step={5}
          value={filters.maxTotalMin}
          onChange={e => set('maxTotalMin', +e.target.value)}
          className="w-full accent-forest-600"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
          <span>30 min</span><span>150 min</span>
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 block mb-1">
          Max walk to trailhead: <span className="font-medium text-gray-700">{filters.maxWalkMin} min</span>
        </label>
        <input
          type="range" min={5} max={60} step={5}
          value={filters.maxWalkMin}
          onChange={e => set('maxWalkMin', +e.target.value)}
          className="w-full accent-forest-600"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
          <span>5 min</span><span>60 min</span>
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 block mb-1">
          Min trail length: <span className="font-medium text-gray-700">{filters.minLengthMi} mi</span>
        </label>
        <input
          type="range" min={0} max={15} step={1}
          value={filters.minLengthMi}
          onChange={e => set('minLengthMi', +e.target.value)}
          className="w-full accent-forest-600"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
          <span>0 mi</span><span>15 mi</span>
        </div>
      </div>

      <div className="text-xs text-gray-400 pt-1 border-t border-gray-100">
        {count} trail{count !== 1 ? 's' : ''} match your filters
      </div>
    </div>
  )
}
