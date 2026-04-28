/**
 * Site-wide configuration for point.dog Digital.
 *
 * Pattern: mirrors Drain+Tree / SpraySquad siteConfig.
 */

export type NavItem = {
  label: string
  href: string
  children?: { label: string; href: string }[]
}

export const siteConfig = {
  // Company info
  company: {
    name: 'point.dog',
    longName: 'point.dog Digital',
    tagline: 'The agency that actually builds the backend.',
    phone: '',
    phoneRaw: '',
    email: 'mike@point.dog',
    address: {
      city: 'Athens',
      state: 'GA',
      region: 'Northeast Georgia',
      full: 'Athens, GA',
    },
  },

  // Social
  social: {
    linkedin: 'https://www.linkedin.com/company/point-dog-digital',
  },

  cta: {
    contact: '/contact',
    work: '/work',
  },

  primaryNav: [
    { label: 'Work', href: '/work' },
    { label: 'How', href: '/#why-we-build' },
    { label: 'About', href: '/about' },
  ] as NavItem[],

  // Brand colors — extracted from Webflow pointdogs.webflow.css :root vars
  colors: {
    primary: '#005d5d', // deep teal — main brand
    primaryDark: '#003939',
    secondary: '#518c6a', // sea green
    accent: '#ffd800', // gold
    accentWarm: '#ff9f1c', // sunset
    surface: '#f1f1f1', // light gray
    surfaceMuted: '#bfc1c2', // silver sand
    ink: '#212121', // body text
    inkMuted: '#333333', // charcoal
    border: '#e5e5e5',
  },

  // Operating entities — for the trust-signal section at bottom of home
  operatingEntities: [
    {
      name: 'Southland Organics',
      url: 'https://southlandorganics.com',
      blurb: 'Distribution + manufacturing of biostimulants and HOCl.',
    },
    {
      name: "Soul Miner's Eden",
      url: 'https://soulminerseden.com',
      blurb: 'Solar grazing, livestock, and regenerative agriculture.',
    },
    {
      name: 'Spray Squad',
      url: 'https://www.spraysquad.com',
      blurb: 'Athens-area mosquito control + organic lawn care.',
    },
    {
      name: 'Porchlight Construction',
      url: 'https://porchlightbuild.com',
      blurb: 'Residential construction.',
    },
    {
      name: 'Drain + Tree',
      url: 'https://www.draintree.com',
      blurb: 'Landscape drainage, grading, and tree service.',
    },
  ],

  geo: {
    latitude: 33.9519,
    longitude: -83.3576,
  },
}

export type ServiceArea = string
