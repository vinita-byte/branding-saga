# Branding Saga

A visual and verbal playbook for the 12 timeless brand archetypes.

Live: https://branding-saga.vercel.app

Each archetype page covers visual identity (key visual, palette, typography, shapes, textures, motion) and verbal identity (desire, fear, voice, word bank, taglines, hooks, post ideas).

## Stack

Vite, React 19, Tailwind CSS v4. Originally built in Figma Make.

## Run locally

```bash
pnpm install
pnpm dev
```

## Build

```bash
pnpm build
```

The build also writes a static HTML file for every route with the page text inside it, plus `llms-full.txt`, so search engines and AI tools can read the content without running JavaScript. See `prerender.ts`. Archetype data lives in `src/data.ts`.
