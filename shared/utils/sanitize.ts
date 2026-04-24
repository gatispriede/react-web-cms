import DOMPurify from 'isomorphic-dompurify';

/**
 * HTML sanitizer — strips script/style/iframe/etc., event handlers, and
 * javascript:/data:/vbscript: URLs. Runs on both server and client via
 * isomorphic-dompurify. Called before innerHTML in RichText and anywhere
 * authored HTML reaches the DOM.
 */
const ALLOWED_URL_SCHEMES = /^(?:https?:|mailto:|tel:|#|\/)/i;

export function sanitizeHtml(raw: string): string {
    if (typeof raw !== 'string' || !raw) return '';
    return DOMPurify.sanitize(raw, {
        FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'form'],
        FORBID_ATTR: ['srcdoc', 'formaction'],
        ALLOWED_URI_REGEXP: ALLOWED_URL_SCHEMES,
        USE_PROFILES: {html: true},
    });
}
