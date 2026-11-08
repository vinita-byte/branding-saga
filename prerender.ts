import type { Plugin } from 'vite'
import {
  GROUPS,
  SITE_URL,
  archetypes,
  groupDescription,
  pageMeta,
  type Archetype,
  type PageKind,
} from './src/data'

/*
 * The app renders on the client, so AI fetchers and crawlers would see an empty #root.
 * At build time this writes one HTML file per route with the right head tags and the
 * page's full text inside #root (React replaces it on mount), plus llms-full.txt.
 */

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const list = (items: string[]) => `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`

const nav = () =>
  `<nav aria-label="Archetypes"><a href="/">All archetypes</a> · <a href="/about">About</a> · ${archetypes
    .map((a) => `<a href="/${a.slug}">${esc(a.name)}</a>`)
    .join(' · ')}</nav>`

function homeBody() {
  const groups = GROUPS.map((g) => {
    const items = archetypes
      .filter((a) => a.group === g)
      .map(
        (a) =>
          `<li><a href="/${a.slug}">${esc(a.name)}</a>: ${esc(a.mantra)}. Desire: ${esc(a.desire)}.</li>`,
      )
      .join('')
    return `<section><h2>${esc(g)}</h2><p>${esc(groupDescription[g])}</p><ul>${items}</ul></section>`
  }).join('')
  return `<h1>Branding Saga: the 12 brand archetypes</h1><p>The visual and verbal playbook for all 12 brand archetypes, with practical guidance for color, typography, imagery, voice, taglines, hooks, and content.</p>${groups}`
}

function aboutBody() {
  return `<h1>Strategy is easier when it has a character.</h1>
<p>Branding Saga is a field guide for building brands that feel coherent, memorable and deeply human.</p>
<h2>Archetypes are familiar patterns of human motivation.</h2>
<p>We recognise the Hero's courage, the Caregiver's warmth and the Outlaw's defiance before anyone explains them. In branding, these patterns give teams a shared creative compass, not a costume.</p>
<h2>How to use this site</h2>
<ol><li><strong>Find the motivation.</strong> Start with what your audience wants to feel, not which page looks coolest.</li>
<li><strong>Study both halves.</strong> Visual identity sets the scene. Verbal identity gives the character a voice.</li>
<li><strong>Make it your own.</strong> Borrow principles, never a personality wholesale. Your story should still be unmistakably yours.</li></ol>
<p><a href="/">Explore all 12 archetypes</a></p>`
}

function archetypeBody(a: Archetype) {
  return `<article>
<p>${esc(a.group)} · Archetype ${esc(a.number)}</p>
<h1>The ${esc(a.name)} brand archetype</h1>
<p><strong>Mantra:</strong> ${esc(a.mantra)}</p>
<section><h2>Visual identity</h2>
<p><strong>Key visual:</strong> ${esc(a.keyVisual)}</p>
<p><strong>Super graphic:</strong> ${esc(a.superGraphic)}</p>
<h3>Colour palette</h3><ul>${a.colors.map(([n, hex, role]) => `<li>${esc(role)}: ${esc(n)} ${esc(hex)}</li>`).join('')}</ul>
<h3>Typography</h3><p>Display: ${esc(a.display)}. Body: ${esc(a.body)}.</p>
<h3>Shapes and motifs</h3>${list(a.shapes)}
<h3>Textures</h3>${list(a.textures)}
<h3>Motion</h3><p>${esc(a.motion)}</p>
<p><strong>Do:</strong> ${esc(a.visualDo)} <strong>Don't:</strong> ${esc(a.visualDont)}</p>
</section>
<section><h2>Verbal identity</h2>
<p><strong>Desire:</strong> ${esc(a.desire)}. <strong>Fear:</strong> ${esc(a.fear)}. <strong>Promise:</strong> ${esc(a.promise)}.</p>
<h3>Adjectives</h3><p>${esc(a.adjectives.join(', '))}</p>
<h3>Voice</h3><p>${esc(a.voice)}</p>
<h3>Say</h3>${list(a.say)}
<h3>Never say</h3>${list(a.never)}
<h3>Word bank</h3><p>${esc(a.words.join(', '))}</p>
<h3>Taglines</h3>${list(a.taglines)}
<h3>Hooks</h3>${list(a.hooks)}
<h3>Post ideas</h3>${list(a.posts)}
<h3>Humour</h3><p>${esc(a.humour)}</p><p>${esc(a.joke)}</p>
<h3>Real world example: ${esc(a.example)}</h3><p>${esc(a.exampleNote)}</p>
<p><strong>Do:</strong> ${esc(a.copyDo)} <strong>Don't:</strong> ${esc(a.copyDont)}</p>
</section>
</article>`
}

function renderPage(template: string, archetype: Archetype | undefined, page: PageKind) {
  const { title, description, canonical } = pageMeta(archetype, page)
  const body =
    page === 'archetype' && archetype ? archetypeBody(archetype) : page === 'about' ? aboutBody() : homeBody()

  const head = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}">`,
    `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">`,
    `<link rel="canonical" href="${canonical}">`,
    `<link rel="alternate" type="text/plain" title="LLM summary" href="${SITE_URL}/llms.txt">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:url" content="${canonical}">`,
    `<meta property="og:type" content="${archetype ? 'article' : 'website'}">`,
    `<meta property="og:site_name" content="Branding Saga">`,
    `<meta name="twitter:card" content="summary">`,
    // Hide the static copy until React replaces it, but keep it readable without JS.
    `<style>.prerender{opacity:0}</style><noscript><style>.prerender{opacity:1;max-width:760px;margin:0 auto;padding:24px;font-family:system-ui,sans-serif;line-height:1.6}</style></noscript>`,
  ].join('\n    ')

  return template
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/<meta name="description"[^>]*>/, '')
    .replace(/<meta name="robots"[^>]*>/, '')
    .replace(/<meta property="og:(title|description)"[^>]*>/g, '')
    .replace('</head>', `    ${head}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root"><div class="prerender">${nav()}<main>${body}</main></div></div>`)
}

function llmsFull() {
  const out: string[] = [
    '# Branding Saga: full content',
    '',
    `> The visual and verbal playbook for the 12 classic brand archetypes. Site: ${SITE_URL}/`,
    '',
    'This file contains every value shown on the site in plain text.',
    '',
  ]
  for (const g of GROUPS) {
    out.push(`## Group: ${g}`, '', groupDescription[g], '')
    for (const a of archetypes.filter((x) => x.group === g)) {
      out.push(
        `### ${a.number}. ${a.name}`,
        '',
        `URL: ${SITE_URL}/${a.slug}`,
        `Mantra: ${a.mantra}`,
        '',
        '#### Visual identity',
        `Key visual: ${a.keyVisual}`,
        `Super graphic: ${a.superGraphic}`,
        'Colour palette:',
        ...a.colors.map(([n, hex, role]) => `- ${role}: ${n} ${hex}`),
        `Display typeface: ${a.display}`,
        `Body typeface: ${a.body}`,
        `Shapes and motifs: ${a.shapes.join(', ')}`,
        `Textures: ${a.textures.join(', ')}`,
        `Motion: ${a.motion}`,
        `Visual do: ${a.visualDo}`,
        `Visual don't: ${a.visualDont}`,
        '',
        '#### Verbal identity',
        `Desire: ${a.desire}`,
        `Fear: ${a.fear}`,
        `Promise: ${a.promise}`,
        `Adjectives: ${a.adjectives.join(', ')}`,
        `Voice: ${a.voice}`,
        `Say: ${a.say.join('; ')}`,
        `Never say: ${a.never.join('; ')}`,
        `Word bank: ${a.words.join(', ')}`,
        'Taglines:',
        ...a.taglines.map((t) => `- ${t}`),
        'Hooks:',
        ...a.hooks.map((t) => `- ${t}`),
        'Post ideas:',
        ...a.posts.map((t) => `- ${t}`),
        `Humour: ${a.humour}`,
        `Joke: ${a.joke}`,
        `Real world example: ${a.example}. ${a.exampleNote}`,
        `Copy do: ${a.copyDo}`,
        `Copy don't: ${a.copyDont}`,
        '',
      )
    }
  }
  return out.join('\n')
}

export function prerenderPlugin(): Plugin {
  return {
    name: 'branding-saga-prerender',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const index = bundle['index.html']
      if (!index || index.type !== 'asset') return
      const template = String(index.source)

      index.source = renderPage(template, undefined, 'home')
      this.emitFile({ type: 'asset', fileName: 'about/index.html', source: renderPage(template, undefined, 'about') })
      for (const a of archetypes) {
        this.emitFile({ type: 'asset', fileName: `${a.slug}/index.html`, source: renderPage(template, a, 'archetype') })
      }
      this.emitFile({ type: 'asset', fileName: 'llms-full.txt', source: llmsFull() })
    },
  }
}
