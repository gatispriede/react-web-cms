/**
 * Conservative HTML sanitizer — enough to defang the obvious XSS vectors
 * before setting innerHTML. Swap for DOMPurify once the dep is added.
 *
 * Strips:
 *  - <script>, <style>, <iframe>, <object>, <embed>, <link>, <meta> elements
 *  - inline event handlers (on*="…")
 *  - javascript:/data:/vbscript: URLs in href/src/xlink:href
 */
export function sanitizeHtml(raw: string): string {
    if (typeof raw !== 'string' || !raw) return '';

    const DANGEROUS_TAGS = /<\/?(script|style|iframe|object|embed|link|meta|svg|math|base|form)\b[^>]*>/gi;
    const EVENT_HANDLERS = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
    const DANGEROUS_URLS = /\s+(href|src|xlink:href|action|formaction)\s*=\s*(?:"\s*(?:javascript|data|vbscript):[^"]*"|'\s*(?:javascript|data|vbscript):[^']*'|(?:javascript|data|vbscript):[^\s>]+)/gi;

    return raw
        .replace(DANGEROUS_TAGS, '')
        .replace(EVENT_HANDLERS, '')
        .replace(DANGEROUS_URLS, '');
}
