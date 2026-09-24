import { getEntries, type CollectionEntry } from 'astro:content'

/** Resolve frontmatter cross-links; a typo'd slug fails the build instead of rendering a dead card. */
export async function resolveGuides(ids: string[], from: string): Promise<CollectionEntry<'guides'>[]> {
  const entries = await getEntries(ids.map((id) => ({ collection: 'guides' as const, id })))
  return assertAll(entries, ids, 'guide', from)
}

export async function resolveIntegrations(
  ids: string[],
  from: string,
): Promise<CollectionEntry<'integrations'>[]> {
  const entries = await getEntries(ids.map((id) => ({ collection: 'integrations' as const, id })))
  return assertAll(entries, ids, 'integration', from)
}

function assertAll<T>(entries: (T | undefined)[], ids: string[], kind: string, from: string): T[] {
  const missing = ids.filter((_, i) => !entries[i])
  if (missing.length > 0) {
    throw new Error(`${from} links to missing ${kind}(s): ${missing.join(', ')}`)
  }
  return entries as T[]
}
