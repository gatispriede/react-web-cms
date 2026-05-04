/**
 * F7 — single source of truth for slug *comparison* (match-side).
 *
 * Canonical slug normalisation used by every consumer that needs to
 * compare an incoming URL segment against a stored / generated slug.
 * Idempotent: `normalizeSlugForMatch(normalizeSlugForMatch(x)) === normalizeSlugForMatch(x)`.
 *
 * Used by:
 *   - server-side `findPageBySlugChain` (resolver)
 *   - SSR `resolveSlugChain` (build-time)
 *   - public `findIdForActiveTab` (active page lookup, fallback path)
 *   - footer URL builder / sitemap (when comparing legacy URLs)
 *
 * Rules (applied to BOTH sides of a comparison):
 *   - decodeURIComponent (URL-encoded diacritics → raw)
 *   - lowercase
 *   - NFKD + strip combining marks (`ā` → `a`)
 *   - whitespace → `-`
 *   - collapse repeated `-`
 *   - strip leading/trailing `-`
 *
 * The output is for COMPARISON only — never stored or rendered.
 *
 * NOTE: This is *separate* from `slugifyAnchor` in `stringFunctions.ts`,
 * which is the *generation* helper. Generation produces clean canonical
 * URLs; match is tolerant of legacy URLs that don't match the current
 * generation rules. Don't merge them.
 */
export function normalizeSlugForMatch(input: string): string {
    let s: string;
    try {
        s = decodeURIComponent(input);
    } catch {
        s = input;
    }
    return s
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}
