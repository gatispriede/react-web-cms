/**
 * all-pages-module-composed (Marketing batch) — register the
 * `marketing-landing` system page on the `SystemPageRegistry`.
 *
 * `/welcome` (and `/` on a fresh install) was a hand-coded
 * `<LandingPage>` feature-component tree with copy hard-wired in
 * `ui/client/features/Marketing/copy.ts`. It is now a module-composed
 * system page:
 *
 *   1. Hero             — registered CMS Hero module (HERO copy)
 *   2. FeatureGrid      — "why teams move" comparison cards
 *   3. FeatureGrid      — the agency feature grid
 *   4. LogoCloud        — empty by default; an operator-fillable slot
 *   5. TestimonialWall  — empty by default; an operator-fillable slot
 *   6. PricingTable     — Solo / Agency tiers + feature matrix
 *
 * The legacy `FinalCta` section has no dedicated module yet and is
 * dropped here — operators can compose a Hero / RichText CTA in its
 * place. Copy is ported verbatim from `copy.ts`; the hard-coded
 * feature-component tree can be retired once this is verified.
 *
 * Registered as a module-load side-effect — `MarketingServiceLoader`
 * imports this file; the Pages feature's `bootstrapAll()` upserts the
 * Navigation row at boot.
 */
import guid from '@utils/guid';
import {systemPageRegistry} from '@services/features/Pages/SystemPageRegistry';
import {EItemType} from '@enums/EItemType';
import type {ISection} from '@interfaces/ISection';

function section(moduleType: EItemType, lockReason: string, content: object): ISection {
    return {
        id: guid(),
        type: 1,
        content: [{type: moduleType, content: JSON.stringify(content)}],
        locked: true,
        lockReason,
    };
}

const HERO_CONTENT = {
    eyebrow: 'Built for agencies and multi-tenant hosts',
    headline: 'Your team writes the brief. The CMS builds the pages.',
    subtitle: 'An MCP-native CMS. Describe a page in plain English; modules, themes and copy land ready to publish. No ticket queue, no developer bottleneck.',
    tagline: '',
    bgImage: {src: ''},
    accent: '',
    ctaPrimary: {url: '/account/signup?plan=solo', label: 'Start free trial', primary: true},
    ctaSecondary: {url: '#pricing', label: 'See pricing'},
};

const COMPARISON_CONTENT = {
    columns: 3,
    features: [
        {key: 'mcp-native', title: 'MCP-native authoring', description: 'Describe pages in English. The CMS picks modules, fills copy, applies the active theme. Contentful and Builder still hand you an empty canvas.'},
        {key: 'multi-tenant', title: 'Multi-tenant by default', description: 'Per-feature, per-page, per-locale grants. Your agency clients log into the same admin and never see each other content.'},
        {key: 'no-dev-cost', title: 'No developer cost', description: 'Stop paying $5k/mo for a developer to update copy. Authoring is the deploy.'},
    ],
};

const FEATURES_CONTENT = {
    columns: 3,
    features: [
        {key: 'mcp-authoring', title: 'MCP-native authoring', description: 'Connect any MCP-aware client (Claude Code, Cursor, Zed). Authoring is a chat, not a ticket.'},
        {key: 'scoped-grants', title: 'Scoped multi-tenant grants', description: 'Roles per feature, per page, per locale. Agencies onboard clients in minutes, not weeks.'},
        {key: 'theme-registry', title: 'Theme registry + live preview', description: 'Editorial, Studio, Industrial, Paper, High-Contrast presets. Swap, fork, preview before publish.'},
        {key: 'image-pipeline', title: 'Image pipeline that respects you', description: 'Sharp re-encoding, EXIF strip, bulk upload, URL import. No third-party CDN to wire up.'},
        {key: 'caching', title: 'Production caching baked in', description: 'Per-feature versions, ISR, SWR, DataLoader. Sub-100ms TTFB on the public site without tuning.'},
        {key: 'admin-shell', title: 'Six-area admin shell', description: 'Build, Content, Configure, Release, Insights, Platform. Editors do not see ops controls.'},
    ],
};

const PRICING_CONTENT = {
    initialBilling: 'monthly',
    mostPopularLabel: 'Most popular',
    tiers: [
        {
            key: 'solo',
            name: 'Solo',
            monthlyPriceFormatted: '$129 / mo',
            annualPriceFormatted: '$129 / mo',
            description: 'For a single brand or product site.',
            ctaLabel: 'Start Solo trial',
            ctaHref: '/account/signup?plan=solo',
        },
        {
            key: 'agency',
            name: 'Agency',
            monthlyPriceFormatted: '$749 / mo',
            annualPriceFormatted: '$749 / mo',
            description: 'For agencies and multi-tenant hosts.',
            ctaLabel: 'Start Agency trial',
            ctaHref: '/account/signup?plan=agency',
            highlighted: true,
        },
    ],
    features: [
        {key: 'sites', label: 'Client sites', perTier: {solo: '1 site', agency: 'Up to 25'}},
        {key: 'pages', label: 'Unlimited pages', perTier: {solo: true, agency: true}},
        {key: 'modules', label: 'All modules + themes', perTier: {solo: true, agency: true}},
        {key: 'mcp', label: 'MCP authoring + admin', perTier: {solo: true, agency: true}},
        {key: 'caching', label: 'Image pipeline + ISR caching', perTier: {solo: true, agency: true}},
        {key: 'tenant', label: 'Scoped multi-tenant grants', perTier: {solo: false, agency: true}},
        {key: 'roles', label: 'Per-locale + per-feature roles', perTier: {solo: false, agency: true}},
        {key: 'bundle', label: 'Bundle import / export', perTier: {solo: false, agency: true}},
        {key: 'whitelabel', label: 'White-label admin shell', perTier: {solo: false, agency: true}},
        {key: 'support', label: 'Support', perTier: {solo: 'Email', agency: 'Priority Slack'}},
    ],
};

systemPageRegistry.register({
    systemKey: 'marketing-landing',
    slug: '/welcome',
    titleI18nKey: 'marketing.landing.title',
    accessGate: 'open',
    seo: {indexable: true},
    defaultSections: () => [
        section(EItemType.Hero, 'section.locked.marketing-hero', HERO_CONTENT),
        section(EItemType.FeatureGrid, 'section.locked.marketing-comparison', COMPARISON_CONTENT),
        section(EItemType.FeatureGrid, 'section.locked.marketing-features', FEATURES_CONTENT),
        section(EItemType.LogoCloud, 'section.locked.marketing-logos', {headline: 'Trusted by teams at', logos: []}),
        section(EItemType.TestimonialWall, 'section.locked.marketing-testimonials', {items: [], desktopColumns: 3}),
        section(EItemType.PricingTable, 'section.locked.marketing-pricing', PRICING_CONTENT),
    ],
});
