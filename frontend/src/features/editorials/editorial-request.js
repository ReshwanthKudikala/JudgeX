/**
 * Slug for the published-editorial request, or null when the page should not ask.
 * `hasEditorial === false` means the problem payload already says nothing is published,
 * so the client must not GET an endpoint whose contract is 404 for that state.
 * A missing flag still requests, for cached payloads from before the flag existed.
 * @param {{ slug?: string, hasEditorial?: boolean } | null | undefined} problem
 * @returns {string | null}
 */
export function editorialRequestSlug(problem) {
  if (!problem || typeof problem.slug !== 'string' || problem.slug.length === 0) {
    return null;
  }
  if (problem.hasEditorial === false) return null;
  return problem.slug;
}
