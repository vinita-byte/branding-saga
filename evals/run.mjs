#!/usr/bin/env node
// Branding Saga evals.
// Sends each brief in cases.json to /api/generate several times, runs hard checks on the
// brand kit, then asks an AI judge (Groq) to score the fit from 1 to 5.
// A run passes when every check passes and the judge's overall score is 4 or more.
//
//   pnpm eval                                 # against the live site, 3 runs per case
//   pnpm eval --base http://localhost:3000    # against `vercel dev`
//   pnpm eval --runs 1 --only 1,4             # quick subset

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
)
const BASE = (args.base || process.env.EVAL_BASE_URL || 'https://branding-saga.vercel.app').replace(/\/$/, '')
const RUNS = Number(args.runs || 3)
const ONLY = args.only ? new Set(args.only.split(',').map(Number)) : null
const PASS_SCORE = 4
const JUDGE_MODEL = process.env.JUDGE_MODEL || 'llama-3.3-70b-versatile'
const GROQ_API_KEY = process.env.GROQ_API_KEY

if (!GROQ_API_KEY) {
  console.error('GROQ_API_KEY is missing. Add it to .env.local (the judge needs it).')
  process.exit(1)
}

const ARCHETYPES = [
  'Innocent', 'Sage', 'Explorer', 'Hero', 'Outlaw', 'Magician',
  'Everyman', 'Lover', 'Jester', 'Caregiver', 'Ruler', 'Creator',
]
const cases = JSON.parse(fs.readFileSync(path.join(here, 'cases.json'), 'utf8')).filter((c) => !ONLY || ONLY.has(c.id))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Retries rate limits and server errors with backoff. Honours Retry-After when present.
async function withRetry(label, fn, tries = 6) {
  let wait = 5000
  for (let attempt = 1; ; attempt++) {
    const res = await fn()
    if (res.ok) return res.json()
    const body = await res.text()
    const retryable = res.status === 429 || res.status >= 500
    if (!retryable || attempt >= tries) throw new Error(`${label} failed (${res.status}): ${body.slice(0, 200)}`)
    const after = Number(res.headers.get('retry-after'))
    const delay = after > 0 ? after * 1000 + 500 : wait
    process.stdout.write(`    ${label}: ${res.status}, retrying in ${Math.round(delay / 1000)}s\n`)
    await sleep(delay)
    wait = Math.min(wait * 2, 60000)
  }
}

const generate = (brief) =>
  withRetry('generate', () =>
    fetch(`${BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brief }),
    }),
  )

// ---------- Hard checks ----------

const REQUIRED = [
  ['archetype', 'string'],
  ['rationale', 'string'],
  ['mantra', 'string'],
  ['visual.keyVisual', 'string'],
  ['visual.palette', 'array'],
  ['visual.fonts.display', 'string'],
  ['visual.fonts.body', 'string'],
  ['visual.shapes', 'array'],
  ['visual.textures', 'array'],
  ['visual.motion', 'string'],
  ['verbal.voice', 'string'],
  ['verbal.adjectives', 'array'],
  ['verbal.say', 'array'],
  ['verbal.never', 'array'],
  ['verbal.taglines', 'array'],
  ['verbal.hooks', 'array'],
]
const get = (obj, p) => p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
const filled = (v) => (typeof v === 'string' ? v.trim().length > 0 : v != null)

function checkSections(kit) {
  const problems = []
  for (const [p, type] of REQUIRED) {
    const v = get(kit, p)
    if (type === 'string' && !(typeof v === 'string' && v.trim())) problems.push(`${p} is empty`)
    if (type === 'array') {
      if (!Array.isArray(v) || v.length === 0) problems.push(`${p} is empty`)
      else if (p !== 'visual.palette' && v.some((x) => !filled(x))) problems.push(`${p} has blank items`)
    }
  }
  const palette = get(kit, 'visual.palette')
  if (Array.isArray(palette)) {
    if (palette.length !== 5) problems.push(`palette has ${palette.length} colours, expected 5`)
    palette.forEach((c, i) => {
      if (!filled(c?.name) || !filled(c?.role)) problems.push(`palette[${i}] is missing a name or role`)
    })
  }
  return problems
}

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
function checkHex(kit) {
  const palette = get(kit, 'visual.palette') || []
  return palette.filter((c) => !HEX.test(String(c?.hex || '').trim())).map((c) => `invalid hex "${c?.hex}" (${c?.name})`)
}

// Checked against the official Google Fonts catalogue. (The CSS API is not reliable for this:
// it serves some non-catalogue families such as Helvetica Neue.)
let googleFamilies
async function isGoogleFont(family) {
  const name = String(family || '').trim()
  if (!name) return false
  googleFamilies ??= fetch('https://fonts.google.com/metadata/fonts')
    .then((r) => r.json())
    .then((d) => new Set(d.familyMetadataList.map((f) => f.family.toLowerCase())))
  return (await googleFamilies).has(name.toLowerCase())
}
async function checkFonts(kit) {
  const problems = []
  for (const role of ['display', 'body']) {
    const family = get(kit, `visual.fonts.${role}`)
    if (family && !(await isGoogleFont(family))) problems.push(`${role} font "${family}" is not on Google Fonts`)
  }
  return problems
}

function checkArchetype(kit, expected) {
  const got = String(kit.archetype || '').trim()
  if (!ARCHETYPES.includes(got)) return [`archetype "${got}" is not one of the 12`]
  if (got !== expected) return [`archetype was ${got}, expected ${expected}`]
  return []
}

// ---------- AI judge ----------

const JUDGE_SYSTEM = `You are a strict senior brand strategist reviewing a brand kit made from a short brief.
Score each criterion from 1 (poor) to 5 (excellent) for how well it fits the BRIEF:
- archetype: is the chosen brand archetype the right one for this brand?
- fonts: do the display and body typefaces suit this brand and archetype?
- colours: does the palette suit this brand and archetype?
- voice: do the voice, taglines and hooks sound like this specific brand?
Then give "overall" from 1 to 5 for the kit as a whole. Do not give 5 unless it is genuinely excellent.
Reply with JSON only: {"archetype":n,"fonts":n,"colours":n,"voice":n,"overall":n,"reason":"one or two sentences"}`

async function judge(brief, kit) {
  const data = await withRetry('judge', () =>
    fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: JUDGE_MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: JUDGE_SYSTEM },
          { role: 'user', content: `BRIEF: ${brief}\n\nBRAND KIT:\n${JSON.stringify(kit, null, 2)}` },
        ],
      }),
    }),
  )
  const s = JSON.parse(data.choices[0].message.content)
  for (const k of ['archetype', 'fonts', 'colours', 'voice', 'overall']) s[k] = Number(s[k])
  return s
}

// ---------- Run ----------

const results = []
console.log(`Branding Saga evals: ${cases.length} cases x ${RUNS} runs against ${BASE}\n`)

for (const c of cases) {
  console.log(`#${c.id} ${c.prompt}  (expect ${c.expected})`)
  for (let run = 1; run <= RUNS; run++) {
    const r = { id: c.id, prompt: c.prompt, expected: c.expected, run, reasons: [] }
    try {
      r.kit = await generate(c.prompt)
      r.reasons.push(
        ...checkSections(r.kit),
        ...checkArchetype(r.kit, c.expected),
        ...checkHex(r.kit),
        ...(await checkFonts(r.kit)),
      )
      r.judge = await judge(c.prompt, r.kit)
      if (!(r.judge.overall >= PASS_SCORE)) {
        r.reasons.push(`judge scored ${r.judge.overall}/5: ${r.judge.reason}`)
      }
    } catch (e) {
      r.reasons.push(String(e.message || e))
    }
    r.pass = r.reasons.length === 0
    results.push(r)
    const j = r.judge
    const scores = j ? `judge ${j.overall} (arch ${j.archetype}, fonts ${j.fonts}, colours ${j.colours}, voice ${j.voice})` : 'no judge score'
    console.log(`  run ${run}: ${r.pass ? 'PASS' : 'FAIL'}  ${r.kit?.archetype ?? '?'}  ${r.kit?.visual?.fonts?.display ?? '?'} / ${r.kit?.visual?.fonts?.body ?? '?'}  ${scores}`)
  }
}

const passed = results.filter((r) => r.pass).length
const failures = results.filter((r) => !r.pass)

console.log(`\nPass rate: ${passed}/${results.length} (${((passed / results.length) * 100).toFixed(1)}%)`)
const byCase = cases.map((c) => {
  const rs = results.filter((r) => r.id === c.id)
  return `  #${c.id} ${c.expected.padEnd(9)} ${rs.filter((r) => r.pass).length}/${rs.length}`
})
console.log(byCase.join('\n'))

if (failures.length) {
  console.log('\nFailures:')
  for (const f of failures) {
    console.log(`  #${f.id} run ${f.run} "${f.prompt}"`)
    for (const reason of f.reasons) console.log(`    - ${reason}`)
  }
}

const outDir = path.join(here, 'results')
fs.mkdirSync(outDir, { recursive: true })
const outFile = path.join(outDir, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
fs.writeFileSync(outFile, JSON.stringify({ base: BASE, runs: RUNS, passed, total: results.length, results }, null, 2))
console.log(`\nFull results: ${path.relative(process.cwd(), outFile)}`)
process.exit(failures.length ? 1 : 0)
