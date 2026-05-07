// Fetches the <title> tag from a URL server-side (avoids CORS)
// and strips review counts / source suffixes for clean display
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { url } = req.query
  if (!url) return res.status(400).json({ error: 'Missing url parameter' })

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'HikingLog/1.0 (hikinglog.com)' },
      signal: AbortSignal.timeout(8000),
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const html = await response.text()
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const rawTitle = match ? match[1].trim() : url

    // Detect source and clean title
    let source = 'other'
    let cleanTitle = rawTitle

    if (url.includes('alltrails.com')) {
      source = 'alltrails'
      // "Vista Loop Trail, New Jersey - 4,623 Reviews, Map | AllTrails"
      // → "Vista Loop Trail, New Jersey"
      cleanTitle = rawTitle.replace(/\s*-\s*[\d,]+\s*Reviews.*$/i, '').trim()
    } else if (url.includes('garmin.com')) {
      source = 'garmin'
      cleanTitle = rawTitle.replace(/\s*\|\s*Garmin.*$/i, '').trim()
    } else if (url.includes('avenza.com')) {
      source = 'avenza'
      cleanTitle = rawTitle.replace(/\s*\|\s*Avenza.*$/i, '').trim()
    }

    // Cache for 1 hour — titles don't change often
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
    res.status(200).json({ title: cleanTitle, rawTitle, source })
  } catch (e) {
    res.status(200).json({ title: url, rawTitle: url, source: 'other', error: e.message })
  }
}
