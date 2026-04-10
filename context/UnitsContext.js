import { createContext, useContext, useState, useEffect } from 'react'

const UnitsContext = createContext()

export function UnitsProvider({ children }) {
  const [metric, setMetric] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('hikinglog-units')
    if (stored === 'metric') setMetric(true)
  }, [])

  const toggle = () => {
    setMetric(prev => {
      const next = !prev
      localStorage.setItem('hikinglog-units', next ? 'metric' : 'imperial')
      return next
    })
  }

  // Conversion helpers
  const fmtDist = (miles) => {
    if (miles == null) return null
    if (metric) return `${(miles * 1.60934).toFixed(1)} km`
    return `${miles} mi`
  }

  const fmtElev = (feet) => {
    if (feet == null) return null
    if (metric) return `${Math.round(feet * 0.3048)} m`
    return `${feet.toLocaleString()} ft`
  }

  const fmtDistVal = (miles) => {
    if (miles == null) return null
    if (metric) return parseFloat((miles * 1.60934).toFixed(1))
    return miles
  }

  const distUnit = metric ? 'km' : 'mi'
  const elevUnit = metric ? 'm' : 'ft'

  // Convert a miles threshold to current unit for display
  const miToUnit = (miles) => metric ? parseFloat((miles * 1.60934).toFixed(1)) : miles
  const unitToMi = (val) => metric ? val / 1.60934 : val

  return (
    <UnitsContext.Provider value={{ metric, toggle, fmtDist, fmtElev, fmtDistVal, distUnit, elevUnit, miToUnit, unitToMi }}>
      {children}
    </UnitsContext.Provider>
  )
}

export function useUnits() {
  return useContext(UnitsContext)
}
