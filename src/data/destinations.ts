/**
 * Where bridged data lands. Referenced by integration pages (frontmatter
 * `destinations`) so every "Shopify → Google Ads" style mention links to the
 * guide that explains the mechanics.
 */

export const destinationSlugs = [
  'google-ads',
  'meta',
  'microsoft-ads',
  'ga4',
  'email-sms',
  'website',
] as const

export type DestinationSlug = (typeof destinationSlugs)[number]

export type Destination = {
  name: string
  /** What we send there, in one line. */
  sends: string
  /** Guide that explains the mechanics. */
  guide?: string
}

export const destinations: Record<DestinationSlug, Destination> = {
  'google-ads': {
    name: 'Google Ads',
    sends: 'Offline conversions with revenue, enhanced conversions, Customer Match lists',
    guide: 'google-ads-data-manager-api',
  },
  meta: {
    name: 'Meta (Facebook + Instagram)',
    sends: 'Conversions API events with revenue, custom audiences, lookalike seeds',
    guide: 'meta-conversions-api',
  },
  'microsoft-ads': {
    name: 'Microsoft Ads',
    sends: 'Offline conversions keyed on msclkid or hashed email and phone',
    guide: 'click-ids-gclid-fbclid-msclkid',
  },
  ga4: {
    name: 'Google Analytics 4',
    sends: 'Server-side events and revenue through the Measurement Protocol',
    guide: 'server-side-tracking',
  },
  'email-sms': {
    name: 'Email + SMS',
    sends: 'Segments built from purchase, job, and lifetime-value history',
    guide: 'first-party-data',
  },
  website: {
    name: 'Your website',
    sends: 'Pages generated from real records: listings, services, locations, proof',
  },
}
