import { useEffect, useRef, useState } from 'react'

export default function TrailMap({ trails, selectedTrail, onSelectTrail }) {
  const mapContainer = useRef(null)
  const map = useRef(null)
  const markers = useRef({})
  const [mapLoaded, setMapLoaded] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token) {
      setError(true)
      return
    }

    let mapboxgl
    try {
      mapboxgl = require('mapbox-gl')
    } catch (e) {
      setError(true)
      return
    }

    mapboxgl.accessToken = token

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/outdoors-v12',
      center: [-74.006, 40.7128],
      zoom: 8,
    })

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')

    map.current.on('load', () => {
      setMapLoaded(true)
    })

    return () => map.current?.remove()
  }, [])

  // Add/update markers when trails or map change
  useEffect(() => {
    if (!mapLoaded || !map.current) return

    const mapboxgl = require('mapbox-gl')

    // Remove old markers
    Object.values(markers.current).forEach(m => m.remove())
    markers.current = {}

    trails.forEach(trail => {
      const isSelected = selectedTrail?.id === trail.id

      const el = document.createElement('div')
      el.style.cssText = `
        width: ${isSelected ? '32px' : '24px'};
        height: ${isSelected ? '32px' : '24px'};
        border-radius: 50%;
        background: ${isSelected ? '#2d7a2d' : '#fff'};
        border: 2.5px solid ${isSelected ? '#1a4f1a' : '#2d7a2d'};
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${isSelected ? '14px' : '12px'};
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        transition: all 0.15s;
      `
      el.innerHTML = '🥾'

      el.addEventListener('click', () => {
        onSelectTrail(selectedTrail?.id === trail.id ? null : trail)
      })

      const popup = new mapboxgl.Popup({ offset: 20, closeButton: false })
        .setHTML(`
          <div style="font-family:system-ui,sans-serif;padding:4px 0">
            <div style="font-weight:600;font-size:13px;margin-bottom:2px">${trail.name}</div>
            <div style="font-size:11px;color:#666">${trail.transitMin + trail.walkMin} min total · ${trail.difficulty}</div>
            <div style="font-size:11px;color:#666">${trail.lengthMi} mi trail</div>
          </div>
        `)

      const marker = new mapboxgl.Marker(el)
        .setLngLat([trail.trailheadCoords.lng, trail.trailheadCoords.lat])
        .setPopup(popup)
        .addTo(map.current)

      markers.current[trail.id] = marker
    })
  }, [trails, mapLoaded, selectedTrail])

  // Fly to selected trail
  useEffect(() => {
    if (!mapLoaded || !map.current || !selectedTrail) return
    map.current.flyTo({
      center: [selectedTrail.trailheadCoords.lng, selectedTrail.trailheadCoords.lat],
      zoom: 12,
      duration: 1200,
    })
  }, [selectedTrail, mapLoaded])

  if (error) {
    return (
      <div className="w-full h-full rounded-xl bg-gray-100 flex items-center justify-center">
        <div className="text-center text-gray-500 text-sm p-6">
          <div className="text-3xl mb-3">🗺️</div>
          <p className="font-medium mb-1">Map unavailable</p>
          <p className="text-xs">Add your Mapbox token to <code>.env.local</code> to enable the map.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full rounded-xl overflow-hidden border border-gray-200 relative">
      <div ref={mapContainer} className="w-full h-full" />
      {!mapLoaded && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <div className="text-gray-400 text-sm">Loading map…</div>
        </div>
      )}
    </div>
  )
}
