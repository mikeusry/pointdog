/**
 * Generate the default OG image (public/og-default.png).
 * 1200x630 — point.dog brand teal gradient + tagline.
 *
 *   node scripts/generate-og.mjs
 */

import sharp from 'sharp'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#005d5d"/>
      <stop offset="100%" stop-color="#003939"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>

  <circle cx="1100" cy="100" r="6" fill="#ffd800" opacity="0.7"/>
  <circle cx="1130" cy="135" r="4" fill="#ffd800" opacity="0.5"/>
  <circle cx="1080" cy="155" r="3" fill="#ffd800" opacity="0.4"/>

  <text x="80" y="170" font-family="Comfortaa, system-ui, sans-serif" font-size="84" font-weight="700" fill="#ffffff">point.dog</text>
  <text x="80" y="220" font-family="Ubuntu, Helvetica, sans-serif" font-size="24" font-weight="500" fill="#ffd800" letter-spacing="2">DIGITAL · ATHENS, GA</text>

  <text x="80" y="380" font-family="Comfortaa, system-ui, sans-serif" font-size="56" font-weight="700" fill="#ffffff">The agency that</text>
  <text x="80" y="450" font-family="Comfortaa, system-ui, sans-serif" font-size="56" font-weight="700" fill="#ffffff">actually builds</text>
  <text x="80" y="520" font-family="Comfortaa, system-ui, sans-serif" font-size="56" font-weight="700" fill="#ffd800">the backend.</text>
</svg>`

const out = resolve(root, 'public/og-default.png')
await sharp(Buffer.from(svg)).png().toFile(out)
console.log(`Wrote ${out}`)
