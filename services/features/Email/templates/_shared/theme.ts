/**
 * W6a — Email theme tokens.
 *
 * A small, email-safe subset of the site theme tokens. All values resolve
 * to literal hex / font-stack strings before the HTML hits the wire (no
 * `var(--*)` — email clients don't honour CSS custom properties reliably,
 * Gmail strips `<style>` blocks in some contexts, and Outlook is Outlook).
 *
 * Default token bag lives here. Once W5 first-class-themes ships, the
 * active theme can override these via `getActiveTheme().emailTokens` —
 * for now we read site logo + brand colour off SiteFlags where present.
 *
 * Conflict awareness: this file is part of W6a only (templates +
 * preview). It does not touch `EmailService.ts` directly — the resolver
 * is called from the wire-up site (OrderService mailer closure, MCP
 * `email.preview` tool, admin preview pane).
 */

export interface IEmailTheme {
    /** Two-letter language tag for the email's <html lang>. */
    lang: string;
    /** Background colour for the page (outer table). */
    colorBgLayout: string;
    /** Background colour for the email card. */
    colorBgCard: string;
    /** Primary ink colour for body copy. */
    colorInk: string;
    /** Secondary / muted text. */
    colorInkMuted: string;
    /** Accent / CTA background. */
    colorAccent: string;
    /** Foreground on accent (text inside the CTA). */
    colorAccentOn: string;
    /** Divider / border. */
    colorBorder: string;
    /** Body font stack — every value must be email-safe (no @font-face). */
    fontFamilyBody: string;
    /** Display / heading font stack. */
    fontFamilyDisplay: string;
    /** Logo URL (absolute) — empty string when unset. */
    logoUrl: string;
    /** Site display name — shown in headers & footer. */
    siteName: string;
    /** Public site origin (no trailing slash) — used for absolute links. */
    siteUrl: string;
}

export const DEFAULT_EMAIL_THEME: IEmailTheme = {
    lang: 'en',
    colorBgLayout: '#f5f5f4',
    colorBgCard: '#ffffff',
    colorInk: '#1f1f1f',
    colorInkMuted: '#6b7280',
    colorAccent: '#c65a2a',
    colorAccentOn: '#ffffff',
    colorBorder: '#e5e7eb',
    fontFamilyBody:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    fontFamilyDisplay:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    logoUrl: '',
    siteName: 'Funisimo',
    siteUrl: '',
};

/**
 * Resolve the active email theme. v1: merges site-flags-derived overrides
 * into the default bag — once W5 themes ship, the `themeOverrides` arg
 * carries `getActiveTheme().emailTokens` and we deep-merge over that.
 *
 * Pure / synchronous so it's trivially callable from anywhere (templates
 * + preview + MCP). Async resolution happens at the call site, before
 * the template runs.
 */
export function resolveEmailTheme(overrides?: Partial<IEmailTheme>): IEmailTheme {
    if (!overrides) return DEFAULT_EMAIL_THEME;
    return {...DEFAULT_EMAIL_THEME, ...overrides};
}
