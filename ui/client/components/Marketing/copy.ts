/**
 * Landing-page copy constants.
 *
 * Source-of-truth markdown lives at `docs/marketing/landing-page-copy.md`.
 * Keep the two in sync when iterating wording — the TSX never inlines copy
 * so a copy change is a one-file diff here.
 */

export const HERO = {
    eyebrow: 'Built for agencies and multi-tenant hosts',
    headline: 'Your team writes the brief. The CMS builds the pages.',
    subhead:
        'An MCP-native CMS. Describe a page in plain English; modules, themes and copy land ready to publish. No ticket queue, no developer bottleneck.',
    primaryCta: {label: 'Start free trial', href: '/account/signup?plan=solo'},
    secondaryCta: {label: 'See how it compares to Contentful', href: '#comparison'},
    demoPrompts: [
        'Create a pricing page with three tiers and a comparison strip.',
        'Add a hero, testimonials grid, and a contact form to /about.',
        'Translate the homepage to German and Latvian.',
    ],
} as const;

export const COMPARISON = {
    headline: 'Why teams move from Contentful and Builder.io',
    items: [
        {
            title: 'MCP-native authoring',
            body: 'Describe pages in English. The CMS picks modules, fills copy, applies the active theme. Contentful and Builder still hand you an empty canvas.',
        },
        {
            title: 'Multi-tenant by default',
            body: 'Per-feature, per-page, per-locale grants. Your agency clients log into the same admin and never see each other content.',
        },
        {
            title: 'No developer cost',
            body: 'Stop paying $5k/mo for a developer to update copy. Authoring is the deploy.',
        },
    ],
} as const;

export const FEATURES = {
    headline: 'Everything an agency needs, none of the busywork',
    items: [
        {
            title: 'MCP-native authoring',
            body: 'Connect any MCP-aware client (Claude Code, Cursor, Zed). Authoring is a chat, not a ticket.',
        },
        {
            title: 'Scoped multi-tenant grants',
            body: 'Roles per feature, per page, per locale. Agencies onboard clients in minutes, not weeks.',
        },
        {
            title: 'Theme registry + live preview',
            body: 'Editorial, Studio, Industrial, Paper, High-Contrast presets. Swap, fork, preview before publish.',
        },
        {
            title: 'Image pipeline that respects you',
            body: 'Sharp re-encoding, EXIF strip, bulk upload, URL import. No third-party CDN to wire up.',
        },
        {
            title: 'Production caching baked in',
            body: 'Per-feature versions, ISR, SWR, DataLoader. Sub-100ms TTFB on the public site without tuning.',
        },
        {
            title: 'Six-area admin shell',
            body: 'Build, Content, Configure, Release, Insights, Platform. Editors do not see ops controls.',
        },
    ],
} as const;

export const PRICING = {
    headline: 'Pricing that replaces a developer, not augments one',
    tiers: [
        {
            id: 'solo',
            name: 'Solo',
            price: '$129',
            cadence: '/ month',
            tagline: 'For a single brand or product site.',
            popular: false,
            cta: {label: 'Start Solo trial', href: '/account/signup?plan=solo'},
            features: [
                'Single site, unlimited pages',
                'All modules, all themes',
                'MCP authoring + admin',
                'Image pipeline + ISR caching',
                'Email support',
            ],
        },
        {
            id: 'agency',
            name: 'Agency',
            price: '$749',
            cadence: '/ month',
            tagline: 'For agencies and multi-tenant hosts.',
            popular: true,
            cta: {label: 'Start Agency trial', href: '/account/signup?plan=agency'},
            features: [
                'Up to 25 client sites',
                'Scoped multi-tenant grants',
                'Per-locale + per-feature roles',
                'Priority Slack support',
                'Bundle import / export',
                'White-label admin shell',
            ],
        },
    ],
    footnote: 'Need more than 25 sites? Talk to us about volume tiers.',
} as const;

export const FINAL_CTA = {
    headline: 'Ship the next page in the time it took to file the ticket.',
    body: 'Free 14-day trial. No credit card. Bring your own MCP client or use the built-in admin.',
    cta: {label: 'Start your trial', href: '/account/signup?plan=solo'},
} as const;

export const FOOTER = {
    links: [
        {label: 'Product', href: '/welcome'},
        {label: 'Docs', href: '/docs'},
        {label: 'Pricing', href: '/welcome#pricing'},
        {label: 'Contact', href: '/contact'},
    ],
    copyright: (year: number) => `(c) ${year} CMS. All rights reserved.`,
} as const;
