import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) return res.status(200).json([])

  try {
    const sb = createClient(url, key)
    // suspect=1 → return unapproved suspect entries (admin use)
    // default  → return approved entries only
    const suspect = req.query?.suspect === '1'
    let query = sb.from('trailheads').select('*').order('total_min', { ascending: true })
    if (suspect) {
      query = query.eq('approved', false).eq('suspect_match', true)
    } else {
      query = query.eq('approved', true)
    }
    const { data, error } = await query

    if (error) throw error

    const mapped = (data || []).map(r => ({
      id:              r.id,
      name:            r.name,
      osmId:           r.osm_id,
      trailheadCoords: { lat: r.lat, lng: r.lng },
      station:         r.station || '',
      line:            r.line || r.operator || '',
      operator:        r.operator || '',
      routeType:       r.route_type || 'Transit',
      stationCoords:   r.station_lat ? { lat: r.station_lat, lng: r.station_lng } : null,
      walkMi:          r.walk_mi,
      walkMin:         r.walk_min,
      transitMin:      r.transit_min,
      totalMin:        r.total_min,
      difficulty:      r.difficulty,
      lengthMi:        r.length_mi,
      elevFt:          r.elev_ft,
      desc:            r.description,
      tips:            r.tips,
      alltrails:       r.alltrails_url,
      seasonal:        r.seasonal || false,
      seasonNote:      r.season_note,
      suspectMatch:    r.suspect_match || false,
      suspectNote:     r.suspect_note,
    }))

    if (!suspect) res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    res.status(200).json(mapped)
  } catch (e) {
    console.error('Trailheads API error:', e)
    res.status(500).json({ error: e.message })
  }
}
