// POST /api/generate  { "brief": "A cheeky Gen Z snack brand with weird flavours" }
// Picks one of the 12 Branding Saga archetypes for the brief and returns a tailored brand kit.
//
// Two steps: a careful, low-temperature archetype pick, then the kit written for that pick.
// Keeping the decision separate from the creative writing makes the pick consistent across runs.
import { archetypes, type Archetype } from '../src/data.js'

const MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b'
const MAX_BRIEF = 500
const NAMES = archetypes.map((a) => a.name)

// Strategy grounding for the pick, from the same data the site renders.
const PICK_GROUNDING = archetypes
  .map(
    (a) =>
      `${a.name} (${a.group}). Promise: ${a.promise}. Desire: ${a.desire}. Fear: ${a.fear}. ` +
      `Mantra: ${a.mantra}. Example: ${a.example}, ${a.exampleNote}`,
  )
  .join('\n')

const PICK_SYSTEM = `You are Branding Saga, a brand strategist who works from the 12 classic brand archetypes:
${PICK_GROUNDING}

Choose the single archetype that best fits the brand brief.
How to decide:
1. Name what the product or service fundamentally gives its customer: the core promise the brand sells.
2. Match that core promise to the archetype whose Promise and Desire it fulfils, using the real world examples as anchors.
3. Ignore secondary traits when deciding. Tone, values (such as sustainability or safety), price level and who the audience is shape how the brand speaks, not which archetype it is.
4. Compare your top two candidates on step 1 alone, and pick the stronger.
Reply with JSON only: {"archetype": "one of ${NAMES.join(', ')}", "runnerUp": "", "rationale": "one or two sentences naming the core promise and why it fits"}`

const KIT_SHAPE = `{
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

function kitSystem(a: Archetype) {
  return `You are Branding Saga, a brand strategist. This brand's archetype is ${a.name}.
Branding Saga's ${a.name} playbook:
Mantra: ${a.mantra}. Promise: ${a.promise}. Voice: ${a.voice}
Adjectives: ${a.adjectives.join(', ')}. Word bank: ${a.words.join(', ')}.
Fonts: ${a.display} (display) / ${a.body} (body). Palette: ${a.colors.map(([n, hex, role]) => `${role} ${n} ${hex}`).join(', ')}.
Shapes: ${a.shapes.join(', ')}. Textures: ${a.textures.join(', ')}. Motion: ${a.motion}
Visual do: ${a.visualDo} Copy do: ${a.copyDo}

Create a ${a.name} brand kit tailored to the brief.
Rules:
- Fonts must be real families available on Google Fonts. Start from the playbook fonts, and swap them only when the brand's audience or category clearly needs it (for example children, luxury or technical buyers).
- The palette has exactly 5 colours, each a 6 digit hex code like #1A2B3C, with roles Canvas, Primary, Secondary, Accent, Highlight. Adapt the playbook palette to suit the category and audience.
- Write copy for this specific brand, not generic archetype copy.
Reply with JSON only, in this exact shape:
${KIT_SHAPE}`
}

async function groq(apiKey: string, system: string, user: string, temperature: number) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      temperature,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
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

export async function pickArchetype(brief: string, apiKey: string) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const pick = await groq(apiKey, PICK_SYSTEM, `Brand brief: ${brief}`, 0)
    const archetype = archetypes.find((a) => a.name.toLowerCase() === String(pick.archetype).trim().toLowerCase())
    if (archetype) return { archetype, runnerUp: String(pick.runnerUp || ''), rationale: String(pick.rationale || '') }
  }
  throw new Error('Model did not return one of the 12 archetypes')
}

export async function generateKit(brief: string, apiKey: string) {
  const pick = await pickArchetype(brief, apiKey)
  const kit = await groq(apiKey, kitSystem(pick.archetype), `Brand brief: ${brief}`, 0.7)
  return {
    archetype: pick.archetype.name,
    runnerUp: pick.runnerUp,
    rationale: pick.rationale,
    ...kit,
  }
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
