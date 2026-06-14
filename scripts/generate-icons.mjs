// Generates PWA icons (PNG) from an inline SVG mark using sharp.
// Run: npm run icons
import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const outDir = path.resolve('public/icons')
await mkdir(outDir, { recursive: true })

function svg(padded) {
  // Four-point spark on a violet gradient squircle.
  const pad = padded ? 96 : 0 // extra safe zone for maskable
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${512 + pad * 2} ${512 + pad * 2}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8b5cf6"/>
      <stop offset="1" stop-color="#6d28d9"/>
    </linearGradient>
  </defs>
  <rect x="${-pad}" y="${-pad}" width="${512 + pad * 2}" height="${512 + pad * 2}" fill="${padded ? '#6d28d9' : 'none'}"/>
  <rect x="0" y="0" width="512" height="512" rx="118" fill="url(#g)"/>
  <path fill="#ffffff" d="M256 96c14 62 42 90 104 104-62 14-90 42-104 104-14-62-42-90-104-104 62-14 90-42 104-104z"/>
  <path fill="#ffffff" opacity="0.85" d="M352 288c7 31 21 45 52 52-31 7-45 21-52 52-7-31-21-45-52-52 31-7 45-21 52-52z"/>
</svg>`
}

const base = Buffer.from(svg(false))
const maskable = Buffer.from(svg(true))

await writeFile(path.join(outDir, 'icon.svg'), svg(false).trim())
await sharp(base).resize(192, 192).png().toFile(path.join(outDir, 'icon-192.png'))
await sharp(base).resize(512, 512).png().toFile(path.join(outDir, 'icon-512.png'))
await sharp(base).resize(180, 180).png().toFile(path.join(outDir, 'apple-touch-icon.png'))
await sharp(maskable).resize(512, 512).png().toFile(path.join(outDir, 'icon-maskable-512.png'))

console.log('Icons written to public/icons/')
