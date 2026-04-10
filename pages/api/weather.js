// Uses Open-Meteo — completely free, no API key required
// https://open-meteo.com/

const WMO_CODES = {
  0: { desc: 'Clear sky', icon: '☀️' },
  1: { desc: 'Mainly clear', icon: '🌤️' },
  2: { desc: 'Partly cloudy', icon: '⛅' },
  3: { desc: 'Overcast', icon: '☁️' },
  45: { desc: 'Foggy', icon: '🌫️' },
  48: { desc: 'Icy fog', icon: '🌫️' },
  51: { desc: 'Light drizzle', icon: '🌦️' },
  53: { desc: 'Drizzle', icon: '🌦️' },
  55: { desc: 'Heavy drizzle', icon: '🌧️' },
  61: { desc: 'Light rain', icon: '🌧️' },
  63: { desc: 'Rain', icon: '🌧️' },
  65: { desc: 'Heavy rain', icon: '🌧️' },
  71: { desc: 'Light snow', icon: '🌨️' },
  73: { desc: 'Snow', icon: '❄️' },
  75: { desc: 'Heavy snow', icon: '❄️' },
  80: { desc: 'Rain showers', icon: '🌦️' },
  81: { desc: 'Heavy showers', icon: '🌧️' },
  95: { desc: 'Thunderstorm', icon: '⛈️' },
  99: { desc: 'Thunderstorm with hail', icon: '⛈️' },
}

export default async function handler(req, res) {
  const { lat, lng, date } = req.query
  if (!lat || !lng || !date) return res.status(400).json({ error: 'Missing params' })

  try {
    const url = `https://api.open-meteo.com/v1/forecast?` + new URLSearchParams({
      latitude: lat,
      longitude: lng,
      daily: 'temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_probability_max,windspeed_10m_max,weathercode',
      temperature_unit: 'fahrenheit',
      windspeed_unit: 'mph',
      timezone: 'America/New_York',
      start_date: date,
      end_date: date,
    })

    const response = await fetch(url)
    if (!response.ok) throw new Error('Weather API error')
    const data = await response.json()

    const d = data.daily
    if (!d || !d.time || d.time.length === 0) {
      return res.status(404).json({ error: 'No forecast available for this date' })
    }

    const code = d.weathercode[0]
    const wmo = WMO_CODES[code] || { desc: 'Unknown', icon: '🌡️' }

    // Build a hiking-specific alert if conditions are bad
    let alert = null
    const maxTemp = d.temperature_2m_max[0]
    const minTemp = d.temperature_2m_min[0]
    const precip = d.precipitation_probability_max[0]
    const wind = d.windspeed_10m_max[0]

    if (code >= 71 && code <= 75) alert = 'Snow expected — check trail accessibility and bring traction devices.'
    else if (code >= 95) alert = 'Thunderstorm forecast — consider rescheduling.'
    else if (precip > 70) alert = `High rain probability (${precip}%) — pack waterproof gear.`
    else if (wind > 30) alert = `Strong winds expected (${wind} mph) — use caution on exposed ridges.`
    else if (maxTemp > 90) alert = 'Very hot day — bring extra water and start early.'
    else if (minTemp < 20) alert = 'Very cold — dress in layers and check for ice on trail.'

    res.json({
      date,
      temp: Math.round(maxTemp),
      tempMin: Math.round(minTemp),
      feelsLike: Math.round(d.apparent_temperature_max[0]),
      precipitation: precip,
      wind: Math.round(wind),
      description: wmo.desc,
      icon: wmo.icon,
      alert,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
