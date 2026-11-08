// POST /api/generate  { "brief": "A cheeky Gen Z snack brand with weird flavours" }
// Picks one of the 12 Branding Saga archetypes for the brief and returns a tailored brand kit.
import { archetypes } from '../src/data.js'

const MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b'
const MAX_BRIEF = 500

// Compact grounding: one block per archetype, built from the same data the site renders.
const GROUNDING = archetypes
  .map(
    (a) =>
      `${a.name} (${a.group}). Mantra: ${a.mantra}. Desire: ${a.desire}. Fear: ${a.fear}. Voice: ${a.voice} ` +
      `Fonts: ${a.display} / ${a.body}. Palette: ${a.colors.map(([n, hex]) => `${n} ${hex}`).join(', ')}.`,
  )
  .join('\n')

const SYSTEM = `You are Branding Saga, a brand strategist who works from the 12 classic brand archetypes.
Reference for each archetype:
${GROUNDING}

Given a brand brief, choose the single best fitting archetype from the list above and create a brand kit tailored to the brief.
Rules:
- "archetype" must be exactly one of: ${archetypes.map((a) => a.name).join(', ')}.
- Fonts must be real families available on Google Fonts. Start from the archetype's fonts and change them only if the brief clearly needs it.
- The palette has exactly 5 colours, each a 6 digit hex code like #1A2B3C, with roles Canvas, Primary, Secondary, Accent, Highlight.
- Write copy for this specific brand, not generic archetype copy.
Reply with JSON only, in this exact shape:
{
  "archetype": "",
  "rationale": "one or two sentences on why this archetype fits the brief",
  "mantra": "",
  "visual": {
    "keyVisual": "",
    "palette": [{ "name": "", "hex": "#000000", "role": "Canvas" }],
    "fonts": { "display": "", "body": "" },
    "shapes": ["", "", ""],
    "textures": ["", ""],
    "motion": ""
  },
  "verbal": {
    "voice": "",
    "adjectives": ["", "", "", ""],
    "say": ["", "", ""],
    "never": ["", "", ""],
    "taglines": ["", "", ""],
    "hooks": ["", "", ""]
  }
}`

export async function generateKit(brief: string, apiKey: string) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `Brand brief: ${brief}` },
      ],
    }),
  })
  if (!res.ok) {
    const err = new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 300)}`) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  const data = await res.json()
  return JSON.parse(data.choices[0].message.content)
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Use POST with { "brief": "..." }' })
  }
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY is not set' })

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  const brief = String(body.brief || '').trim()
  if (!brief) return res.status(400).json({ error: 'Missing "brief"' })
  if (brief.length > MAX_BRIEF) return res.status(400).json({ error: `Brief must be under ${MAX_BRIEF} characters` })

  try {
    const kit = await generateKit(brief, apiKey)
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json(kit)
  } catch (e: any) {
    // Pass rate limits through so callers can back off.
    const status = e?.status === 429 ? 429 : 502
    return res.status(status).json({ error: String(e?.message || e) })
  }
}
