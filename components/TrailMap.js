import { useEffect, useRef, useState } from 'react'

export default function TrailMap({ trails, selectedTrail, onSelectTrail }) {
  const mapContainer = useRef(null)
  const map = useRef(null)
  const trailMarkers = useRef({})
  const stationMarkers = useRef({})
  const [mapLoaded, setMapLoaded] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token) { setError(true); return }

    let mapboxgl
    try { mapboxgl = require('mapbox-gl') } catch (e) { setError(true); return }

    mapboxgl.accessToken = token
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/outdoors-v12',
      center: [-74.006, 40.7128],
      zoom: 8,
    })
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')
    map.current.on('load', () => setMapLoaded(true))
    return () => map.current?.remove()
  }, [])

  // Rebuild all markers when trails/selection changes
  useEffect(() => {
    if (!mapLoaded || !map.current) return
    const mapboxgl = require('mapbox-gl')

    // Clear existing markers
    Object.values(trailMarkers.current).forEach(m => m.remove())
    Object.values(stationMarkers.current).forEach(m => m.remove())
    trailMarkers.current = {}
    stationMarkers.current = {}

    trails.forEach(trail => {
      const isSelected = selectedTrail?.id === trail.id

      // ── Trailhead marker (boot icon) ──
      const el = document.createElement('div')
      el.style.cssText = `
        width: ${isSelected ? '34px' : '26px'};
        height: ${isSelected ? '34px' : '26px'};
        border-radius: 50%;
        background: ${isSelected ? '#2d7a2d' : '#fff'};
        border: 2.5px solid ${isSelected ? '#1a4f1a' : '#2d7a2d'};
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${isSelected ? '16px' : '13px'};
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        transition: all 0.15s;
        z-index: ${isSelected ? 2 : 1};
      `
      el.innerHTML = '🥾'
      el.addEventListener('click', () => {
        onSelectTrail(selectedTrail?.id === trail.id ? null : trail)
      })

      const trailPopup = new mapboxgl.Popup({ offset: 20, closeButton: false })
        .setHTML(`
          <div style="font-family:system-ui,sans-serif;padding:4px 0;min-width:180px">
            <div style="font-weight:600;font-size:13px;margin-bottom:4px">${trail.name}</div>
            <div style="font-size:11px;color:#555;margin-bottom:2px">${trail.transitMin + trail.walkMin} min total · ${trail.difficulty} · ${trail.lengthMi} mi</div>
            <div style="margin-top:6px;padding-top:6px;border-top:1px solid #eee">
              <div style="font-size:10px;text-transform:uppercase;color:#888;letter-spacing:.05em;margin-bottom:2px">Nearest station</div>
              <div style="font-size:12px;font-weight:600;color:#1a56c4">${trail.station}</div>
              <div style="font-size:11px;color:#555">${trail.line}</div>
              <div style="font-size:11px;color:#777;margin-top:2px">${trail.walkMin} min walk (${trail.walkMi} mi)</div>
            </div>
          </div>
        `)

      trailMarkers.current[trail.id] = new mapboxgl.Marker(el)
        .setLngLat([trail.trailheadCoords.lng, trail.trailheadCoords.lat])
        .setPopup(trailPopup)
        .addTo(map.current)

      // ── Station marker (train icon) — only show when trail is selected ──
      if (isSelected && trail.stationCoords) {
        const stEl = document.createElement('div')
        stEl.style.cssText = `
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #1a56c4;
          border: 2px solid #0c3d8a;
          cursor: default;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        `
        stEl.innerHTML = '🚉'
        stEl.title = trail.station

        const stPopup = new mapboxgl.Popup({ offset: 18, closeButton: false })
          .setHTML(`
            <div style="font-family:system-ui,sans-serif;padding:4px 0;min-width:160px">
              <div style="font-size:10px;text-transform:uppercase;color:#888;letter-spacing:.05em;margin-bottom:3px">Station / stop</div>
              <div style="font-weight:600;font-size:13px;color:#1a56c4;margin-bottom:2px">${trail.station}</div>
              <div style="font-size:11px;color:#555">${trail.line}</div>
              <div style="font-size:11px;color:#777;margin-top:4px">${trail.walkMin} min walk to trailhead</div>
            </div>
          `)

        stationMarkers.current[trail.id] = new mapboxgl.Marker(stEl)
          .setLngLat([trail.stationCoords.lng, trail.stationCoords.lat])
          .setPopup(stPopup)
          .addTo(map.current)
      }
    })
  }, [trails, mapLoaded, selectedTrail])

  // Fly to selected trail, framing both trailhead and station
  useEffect(() => {
    if (!mapLoaded || !map.current) return
    if (!selectedTrail) {
      map.current.flyTo({ center: [-74.006, 40.7128], zoom: 8, duration: 1000 })
      return
    }
    const mapboxgl = require('mapbox-gl')
    if (selectedTrail.stationCoords) {
      const bounds = new mapboxgl.LngLatBounds()
      bounds.extend([selectedTrail.trailheadCoords.lng, selectedTrail.trailheadCoords.lat])
      bounds.extend([selectedTrail.stationCoords.lng, selectedTrail.stationCoords.lat])
      map.current.fitBounds(bounds, { padding: 80, maxZoom: 13, duration: 1200 })
    } else {
      map.current.flyTo({
        center: [selectedTrail.trailheadCoords.lng, selectedTrail.trailheadCoords.lat],
        zoom: 12, duration: 1200,
      })
    }
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
      {selectedTrail && (
        <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-gray-600 border border-gray-200 flex gap-3">
          <span>🥾 Trailhead</span>
          <span>🚉 Station</span>
        </div>
      )}
    </div>
  )
}
