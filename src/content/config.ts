/**
 * Astro content collections schema for point.dog.
 * Only one collection: case studies. Everything else is a hand-written page.
 */

import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

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
  }),
})

export const collections = { caseStudies }
