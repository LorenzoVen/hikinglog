import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { trail, messages } = req.body
  if (!trail || !messages) return res.status(400).json({ error: 'Missing trail or messages' })

  const system = `You are a knowledgeable hiking guide helping someone plan a specific hike from Manhattan, NYC using public transit. You give practical, friendly, and concise advice.

Here is the trail they are planning:
- Name: ${trail.name}
- Location: ${trail.location}
- Transit: ${trail.line} to ${trail.station}
- Transit time from Manhattan: ~${trail.transitMin} minutes
- Walk from station to trailhead: ${trail.walkMin} min (${trail.walkMi} miles) — ${trail.walkNote}
- Total travel time: ~${trail.transitMin + trail.walkMin} minutes
- Trail length: ${trail.lengthMi} miles
- Elevation gain: ${trail.elevFt} ft
- Difficulty: ${trail.difficulty}
- Seasonal notes: ${trail.seasonNote || 'No seasonal restrictions'}
- Description: ${trail.desc}
- Getting there tips: ${trail.tips}

Keep answers focused and practical. When discussing transit, remind them to check current schedules on the transit provider's website. Give gear advice appropriate to the difficulty and season. Be encouraging but honest about difficulty levels.`

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      system,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    })

    res.json({ reply: response.content[0].text })
  } catch (err) {
    console.error('Anthropic error:', err)
    res.status(500).json({ error: 'AI error', reply: 'Sorry, I couldn\'t generate a response. Please try again.' })
  }
}
