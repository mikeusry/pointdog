// @ts-check
import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'
import sitemap from '@astrojs/sitemap'
import mdx from '@astrojs/mdx'
import vercel from '@astrojs/vercel'

// https://astro.build/config
export default defineConfig({
  site: 'https://www.point.dog',
  output: 'server',
  adapter: vercel(),
  trailingSlash: 'never',
  build: { inlineStylesheets: 'auto' },
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !['/api/', '/thank-you'].some((p) => page.includes(p)),
      customPages: [
        'https://www.point.dog/about',
        'https://www.point.dog/contact',
        'https://www.point.dog/work',
        'https://www.point.dog/work/hamilton-agency',
        'https://www.point.dog/work/banyan-tree',
        'https://www.point.dog/work/cprc-enough',
        'https://www.point.dog/work/heiser-group',
        'https://www.point.dog/privacy',
      ],
    }),
  ],
  vite: {
    plugins: [/** @type {any} */ (tailwindcss())],
  },
})
