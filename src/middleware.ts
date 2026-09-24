import { defineMiddleware } from 'astro:middleware'

/**
 * 301s for URLs from the old Webflow site (video-production era) so the
 * impressions they still earn in Search Console land somewhere instead of 404.
 * Order matters: first matching prefix wins.
 */
const legacyRedirects: [prefix: string, destination: string][] = [
  ['/blog', '/guides'],
  ['/team/', '/about'],
  ['/video', '/work'],
  ['/videos', '/work'],
  ['/client', '/work'],
  ['/client-list', '/work'],
  ['/case-study/', '/work'],
  ['/web-project/', '/work'],
  ['/industry/', '/work'],
  ['/tags/', '/work'],
  ['/splost-marketing', '/work'],
  ['/free-local-seo-report', '/contact'],
  ['/search', '/'],
  ['/style-guide', '/'],
  ['/base-page', '/'],
]

export const onRequest = defineMiddleware((context, next) => {
  const path = context.url.pathname.toLowerCase()
  for (const [prefix, destination] of legacyRedirects) {
    if (path === prefix || path.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`)) {
      return context.redirect(destination, 301)
    }
  }
  return next()
})
