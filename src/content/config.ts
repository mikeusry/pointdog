/**
 * Astro content collections schema for point.dog.
 *
 * - caseStudies: client work (/work)
 * - guides: explainers on ad-platform data plumbing (/guides)
 * - integrations: one page per source system we bridge to ad platforms (/integrations)
 */

import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'
import { destinationSlugs } from '../data/destinations'

const faq = z.object({ q: z.string(), a: z.string() })

const caseStudies = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/case-studies' }),
  schema: z.object({
    client: z.string(),
    /** Headline that runs on the case-study page hero. */
    headline: z.string(),
    /** One-line summary used on the /work index card. */
    summary: z.string(),
    /** Marketing payoff — "what this delivered" — used on cards + intro. */
    marketingPayoff: z.string(),
    /** Tech stack badges. */
    stack: z.array(z.string()).default([]),
    /** Industry slug for filtering. */
    industry: z.string().optional(),
    /** Order in /work listing (lower = earlier). */
    order: z.number().default(99),
    /** Hero / OG image. */
    coverImage: z.string().optional(),
    /** External link to live site, if public. */
    liveUrl: z.string().url().optional(),
    /** SEO-optimized <title> for the case-study page (overrides default). */
    seoTitle: z.string().optional(),
    /** SEO-optimized meta description (overrides marketingPayoff). */
    seoDescription: z.string().optional(),
  }),
})

const guides = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/guides' }),
  schema: z.object({
    /** H1 on the page. */
    title: z.string(),
    /** <title> tag. */
    seoTitle: z.string(),
    /** Meta description. */
    description: z.string(),
    /** One-line card summary on /guides. */
    summary: z.string(),
    /** Primary search term the page is written for. */
    keyword: z.string(),
    published: z.coerce.date(),
    updated: z.coerce.date(),
    order: z.number().default(99),
    /** Guide slugs to cross-link at the bottom. */
    relatedGuides: z.array(z.string()).default([]),
    /** Integration slugs to cross-link at the bottom. */
    relatedIntegrations: z.array(z.string()).default([]),
    faqs: z.array(faq).default([]),
  }),
})

const integrations = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/integrations' }),
  schema: z.object({
    /** Source system name as buyers search it, e.g. "Shopify". */
    system: z.string(),
    /** Grouping on /integrations, e.g. "Ecommerce", "CRM". */
    category: z.string(),
    /** H1 on the page. */
    headline: z.string(),
    seoTitle: z.string(),
    description: z.string(),
    /** One-line card summary on /integrations. */
    summary: z.string(),
    /** What we read out of the source system. */
    dataPulled: z.array(z.string()),
    /** Where it goes. */
    destinations: z.array(z.enum(destinationSlugs)),
    /** Proof: case study slug under /work. */
    caseStudy: z.string().optional(),
    order: z.number().default(99),
    relatedGuides: z.array(z.string()).default([]),
    faqs: z.array(faq).default([]),
  }),
})

export const collections = { caseStudies, guides, integrations }
