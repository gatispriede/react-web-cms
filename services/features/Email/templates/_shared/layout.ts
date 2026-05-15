/**
 * W6a — Mobile-first, table-based email layout primitives.
 *
 * Email clients are universally hostile:
 *   - Gmail strips `<style>` in some clipping cases.
 *   - Outlook ignores flexbox, grid, padding on `<div>`, vmin units.
 *   - iOS Mail re-rasterises font sizes below 13 px ("font boosting").
 *
 * Rules baked into this file:
 *   - Outer wrapper is a `<table role="presentation">`. No `<div>` for
 *     structural rows.
 *   - 600 px max content width; collapses to 100 % below 600 px via the
 *     one inline `<style>` block we ship (Outlook ignores it; mobile
 *     Webkit honours it; desktop falls back to the 600 px column).
 *   - All decorative styling is inline. The `<style>` block is for media
 *     queries and pseudo-classes only (which can't be inlined).
 *   - No external assets except the operator-supplied logo URL.
 */

import {IEmailTheme} from './theme';

export interface ShellInput {
    title: string;
    theme: IEmailTheme;
    body: string;
    /** Optional preheader text — shown in the inbox preview pane. */
    preheader?: string;
}

/** HTML-escape an interpolated value. */
export function escape(s: string | number | undefined | null): string {
    if (s === undefined || s === null) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Inline CSS reset + the responsive media query. Kept minimal:
 * Outlook's `mso-`-prefixed properties are not needed because the entire
 * layout is `<table>`-based already.
 */
function emailCss(t: IEmailTheme): string {
    return `
        body {margin:0;padding:0;background:${t.colorBgLayout};font-family:${t.fontFamilyBody};color:${t.colorInk};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
        table {border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0;}
        img {border:0;outline:none;text-decoration:none;display:block;max-width:100%;height:auto;}
        a {color:${t.colorAccent};}
        .email-card {background:${t.colorBgCard};border-radius:12px;}
        .email-pad {padding:32px 32px 24px 32px;}
        .preheader {display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;}
        @media only screen and (max-width:620px) {
            .email-container {width:100%!important;}
            .email-pad {padding:24px 18px!important;}
            .stack-mobile {display:block!important;width:100%!important;}
            .step-label {font-size:12px!important;}
        }
    `.replace(/\n\s+/g, '\n').trim();
}

/**
 * Full document shell. Body is HTML markup that goes inside the inner
 * `<table>` — typically one or more `<tr><td>` blocks.
 */
export function emailShell({title, theme, body, preheader}: ShellInput): string {
    return `<!doctype html>
<html lang="${escape(theme.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${escape(title)}</title>
<style>${emailCss(theme)}</style>
</head>
<body>
${preheader ? `<span class="preheader">${escape(preheader)}</span>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${theme.colorBgLayout};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="email-container" style="max-width:600px;width:100%;">
<tr><td>
${headerBlock(theme)}
</td></tr>
<tr><td>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-card" style="background:${theme.colorBgCard};border-radius:12px;border:1px solid ${theme.colorBorder};">
${body}
</table>
</td></tr>
<tr><td>
${footerBlock(theme)}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/** Site-name / logo strip above the card. */
function headerBlock(t: IEmailTheme): string {
    const logo = t.logoUrl
        ? `<img src="${escape(t.logoUrl)}" alt="${escape(t.siteName)}" width="120" style="max-width:120px;margin:0 auto;">`
        : `<span style="font-family:${t.fontFamilyDisplay};font-size:18px;font-weight:600;color:${t.colorInk};">${escape(t.siteName)}</span>`;
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td align="center" style="padding:16px 0 20px 0;">${logo}</td></tr>
</table>`;
}

/**
 * Footer with the unsubscribe URL hook. The actual URL is stamped on by
 * `sendWithPreference.ts` (W8f) — here we render a placeholder slot when
 * the caller passes one in.
 */
export interface FooterOptions {
    unsubscribeUrl?: string;
    addressLine?: string;
}

function footerBlock(t: IEmailTheme, opts?: FooterOptions): string {
    const unsub = opts?.unsubscribeUrl
        ? `<a href="${escape(opts.unsubscribeUrl)}" style="color:${t.colorInkMuted};text-decoration:underline;">Unsubscribe</a>`
        : '';
    const addr = opts?.addressLine ? `<br>${escape(opts.addressLine)}` : '';
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td align="center" style="padding:20px 16px 32px 16px;font-family:${t.fontFamilyBody};font-size:12px;line-height:18px;color:${t.colorInkMuted};">
&copy; ${new Date().getUTCFullYear()} ${escape(t.siteName)}.${addr}
${unsub ? `<br>${unsub}` : ''}
</td></tr>
</table>`;
}

/**
 * Standalone footer override hook — components can re-call this if a
 * template needs to render its own footer (e.g. operator-targeted alerts
 * skip the unsubscribe block since they're transactional-mandatory).
 */
export function renderFooter(theme: IEmailTheme, opts?: FooterOptions): string {
    return footerBlock(theme, opts);
}
