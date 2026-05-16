/**
 * Sample content fixtures used by the admin modules-preview page (C10).
 *
 * One entry per `EItemType`, keyed by the enum value. Policy: **exactly
 * two samples per module** —
 *   - `minimal` — required fields only, smallest valid content blob.
 *   - `full`    — every optional field populated, exercises the whole
 *                 renderer surface (every theme regression that only
 *                 shows when all slots are filled surfaces here).
 *
 * The preview page renders every sample × every declared style variant
 * from the registry. When you add a new `EItemType`, the companion test
 * (`samples.test.ts`) fails until you add its two fixtures here —
 * intentional guard-rail so the preview page can't silently drift.
 */
import {EItemType} from '@enums/EItemType';

export interface PreviewSample {
    /** Short human label shown above the rendered module. */
    label: string;
    /** Item.content JSON string — matches what the editor would save. */
    content: string;
}

const s = (v: object): string => JSON.stringify(v);

/**
 * Full coverage map. Every enum value except `Empty` has exactly two
 * samples — one minimal, one full.
 */
export const sampleContent: Record<string, PreviewSample[]> = {
    [EItemType.Text]: [
        {label: 'minimal', content: s({value: 'The quick brown fox jumps over the lazy dog.'})},
        {label: 'full', content: s({value: 'A longer paragraph of sample body copy used to exercise line-height, kerning, and paragraph spacing across every theme preset in the style matrix.'})},
    ],
    [EItemType.RichText]: [
        {label: 'minimal', content: s({value: '<p>Plain body copy with no inline runs.</p>'})},
        {label: 'full', content: s({value: '<h3>Heading</h3><p>Body copy with <em>italic</em>, <strong>bold</strong>, and an <a href="#">inline link</a>.</p><ul><li>First point</li><li>Second point</li></ul>'})},
    ],
    [EItemType.Image]: [
        {label: 'minimal', content: s({src: 'preview:cosmos1080p', useAsBackground: false})},
        {
            label: 'full',
            content: s({
                src: 'preview:deepblue1080p',
                useAsBackground: true,
                imageFixed: true,
                useGradiant: true,
                imgWidth: '480px',
                imgHeight: '320px',
                offsetX: 24,
                description: '<p>Background image with explicit width/height, gradient overlay, fixed positioning and an editorial caption.</p>',
            }),
        },
    ],
    [EItemType.Carousel]: [
        {label: 'minimal', content: s({items: [{src: 'preview:cosmos1080p', alt: 'Slide 1', text: ''}]})},
        {
            label: 'full',
            content: s({
                autoplay: true,
                autoplaySpeed: 4000,
                infinity: true,
                dots: true,
                arrows: true,
                items: [
                    {src: 'preview:cosmos1080p', alt: 'Auto 1', text: 'Auto-advance every 4s', textPosition: 'bottom'},
                    {src: 'preview:nanocyte1080p', alt: 'Auto 2', text: 'Loops infinitely', textPosition: 'bottom'},
                    {src: 'preview:maya21080p', alt: 'Auto 3', text: 'Dots + arrows on', textPosition: 'top'},
                ],
            }),
        },
    ],
    [EItemType.Gallery]: [
        {
            label: 'minimal',
            content: s({
                aspectRatio: '1:1',
                items: [
                    {src: 'preview:cosmos1080p', alt: 'Tile 1', text: ''},
                    {src: 'preview:coalescence1080p', alt: 'Tile 2', text: ''},
                ],
            }),
        },
        {
            label: 'full',
            content: s({
                aspectRatio: '4:3',
                // `showCaptions` on: every tile's `alt` renders as the primary
                // caption line, `text` as the optional secondary line.
                showCaptions: true,
                items: [
                    {src: 'preview:cosmos1080p', alt: 'Cosmos', text: 'First light, 2024', href: '#work/cosmos', textPosition: 'bottom'},
                    {src: 'preview:nanocyte1080p', alt: 'Nanocyte', text: 'Microstructure', href: '', textPosition: 'bottom'},
                    {src: '', alt: '', text: 'A full-bleed pull quote that replaces one tile with editorial copy.', textPosition: 'center'},
                    {src: 'preview:deepblue1080p', alt: 'Deep Blue', text: '', href: '#work/deep'},
                    {src: 'preview:maya21080p', alt: 'Maya', text: 'Field study', href: '', textPosition: 'top'},
                    {src: 'preview:coalescence1080p', alt: 'Coalescence', text: '', href: ''},
                ],
            }),
        },
    ],
    [EItemType.Hero]: [
        {
            label: 'minimal',
            content: s({
                headline: 'Built to *last.*',
                subtitle: 'Cloud and on-prem systems designed to outlast their authors.',
                tagline: 'Four practices, one studio.',
                bgImage: '',
                accent: '',
            }),
        },
        {
            label: 'full',
            content: s({
                eyebrow: 'RŪPNIECISKAIS ALPĪNISMS · LATVIJA · KOPŠ 2012',
                headline: 'Strādājam augstumos —',
                headlineSoft: 'kur citi nespēj sasniegt.',
                titles: ['DROŠI', 'PROFESIONĀLI', 'TĪRI'],
                subtitle: 'Specializēti alpīnisma pakalpojumi visā Latvijā — precīzi, droši, bez liekiem sastatņiem vai pacēlājiem.',
                tagline: 'High where it counts.',
                taglineAttribution: '— personal motto',
                bgImage: 'preview:deepblue1080p',
                bgOpacity: 30,
                accent: '#c74333',
                portraitImage: 'preview:coalescence1080p',
                portraitLabel: 'GP',
                portraitOpacity: 0,
                meta: [
                    {label: 'BASED', value: 'Sigulda, LV'},
                    {label: 'YEARS', value: '12+'},
                    {label: 'MODE', value: 'Rope access'},
                    {label: 'STACK', value: 'IRATA · EN 12841'},
                ],
                coords: [
                    {label: 'LAT', value: '57.1539° N'},
                    {label: 'LON', value: '24.8595° E'},
                    {label: 'ELEV', value: '92 m'},
                    {label: 'LOCAL', value: '', liveTime: true},
                    {label: 'UPDATED', value: '2026-04-24'},
                ],
                ctaPrimary: {label: 'Skatīt pakalpojumus', href: '#services', primary: true},
                ctaSecondary: {label: 'Sazināties', href: '#contact'},
            }),
        },
    ],
    [EItemType.ProjectCard]: [
        {
            label: 'minimal',
            content: s({
                title: 'Sample project',
                description: 'Short editorial blurb describing the engagement + outcomes.',
                image: 'preview:cosmos1080p',
                tags: ['AWS', 'Terraform'],
            }),
        },
        {
            label: 'full',
            content: s({
                title: 'redis-node-js-cloud CMS',
                description: 'A multi-tenant Node/Mongo CMS with live translation editing, drag-drop image pipeline, optimistic-concurrency conflict resolution, and a theme registry that presets four editorial looks.',
                image: 'preview:nanocyte1080p',
                tags: ['Node.js', 'MongoDB', 'Next.js', 'GraphQL', 'Caddy', 'Docker'],
                primaryLink: {label: 'Live site', url: 'https://example.com'},
                secondaryLink: {label: 'Repo →', url: 'https://github.com/example/project'},
            }),
        },
    ],
    [EItemType.SkillPills]: [
        {label: 'minimal', content: s({category: 'Cloud', items: [{label: 'AWS'}]})},
        {
            label: 'full',
            content: s({
                category: 'Cloud',
                items: [
                    {label: 'AWS', score: 9, featured: true},
                    {label: 'GCP', score: 7},
                    {label: 'Azure', score: 6},
                    {label: 'Terraform', score: 8, featured: true},
                ],
            }),
        },
    ],
    [EItemType.Timeline]: [
        {label: 'minimal', content: s({entries: [{start: '2021', end: 'present', company: 'Studio', role: 'Founder'}]})},
        {
            label: 'full',
            content: s({
                entries: [
                    {start: '2021', end: 'present', company: 'Studio', role: 'Founder', location: 'Riga', achievements: ['Thing one', 'Thing two']},
                    {start: '2018', end: '2021', company: 'Acme', role: 'Lead', location: 'Remote', achievements: ['Shipped X']},
                    {start: '2015', end: '2018', company: 'Beta', role: 'Engineer', location: 'Vilnius', achievements: ['Built Y']},
                ],
            }),
        },
    ],
    [EItemType.SocialLinks]: [
        {label: 'minimal', content: s({links: [{platform: 'github', url: 'https://github.com/example', label: 'GitHub'}]})},
        {
            label: 'full',
            content: s({
                links: [
                    {platform: 'github', url: 'https://github.com/example', label: 'GitHub'},
                    {platform: 'linkedin', url: 'https://linkedin.com/in/example', label: 'LinkedIn'},
                    {platform: 'twitter', url: 'https://x.com/example', label: 'Twitter'},
                ],
            }),
        },
    ],
    [EItemType.BlogFeed]: [
        {label: 'minimal', content: s({limit: 3, tag: '', heading: ''})},
        {label: 'full', content: s({limit: 6, tag: 'engineering', heading: 'Latest posts'})},
    ],
    [EItemType.List]: [
        {label: 'minimal', content: s({title: '', items: [{label: 'Cloud architecture'}]})},
        {
            label: 'full',
            content: s({
                title: 'What I do',
                items: [
                    {label: 'Cloud architecture', value: '10 yrs', href: '#cloud'},
                    {label: 'Platform engineering', value: '8 yrs', href: '#platform'},
                    {label: 'Developer experience', value: '6 yrs', href: '#dx'},
                ],
            }),
        },
    ],
    [EItemType.Services]: [
        {
            label: 'minimal',
            content: s({
                sectionTitle: 'What I *do.*',
                rows: [{number: '01', title: 'Solutions *architecture*', description: 'Cloud and on-prem systems designed to last.'}],
            }),
        },
        {
            label: 'full',
            content: s({
                sectionNumber: '§ 04',
                sectionTitle: 'Four *practices.*',
                sectionSubtitle: 'Every engagement routes through one of these lanes.',
                rows: [
                    {number: '01', title: 'Solutions *architecture*', description: 'System design for teams who need to last past the founding crew.', iconGlyph: '▲', tags: ['AWS', 'Azure'], ctaLabel: 'Find out more', ctaHref: '#services/architecture'},
                    {number: '02', title: 'Platform *engineering*', description: 'Golden paths, self-serve deploys, paved roads.', iconGlyph: '▣', tags: ['K8s', 'Terraform'], ctaLabel: 'See case studies', ctaHref: '#services/platform'},
                    {number: '03', title: 'Developer *experience*', description: 'Short feedback loops, human tooling.', iconGlyph: '◉', tags: ['DX'], ctaLabel: 'Get in touch', ctaHref: '#contact'},
                ],
            }),
        },
    ],
    [EItemType.Testimonials]: [
        {label: 'minimal', content: s({items: [{quote: 'Delivered on every promise.', name: 'A. Client', avatarInitial: 'A'}]})},
        {
            label: 'full',
            content: s({
                sectionTitle: 'What people say',
                sectionSubtitle: 'A decade of shipped engagements.',
                items: [
                    {quote: 'Delivered on every promise.', name: 'A. Client', role: 'CTO, Example Co', avatarInitial: 'A'},
                    {quote: 'Made our platform 10× easier to use.', name: 'B. Client', role: 'VP Eng, Sample Inc', avatarInitial: 'B'},
                ],
            }),
        },
    ],
    [EItemType.StatsCard]: [
        {label: 'minimal', content: s({title: 'Numbers, roughly', stats: [{value: '12+', label: 'Years shipping'}]})},
        {
            label: 'full',
            content: s({
                tag: 'TRACK RECORD',
                title: 'Numbers, roughly',
                stats: [
                    {value: '12+', label: 'Years shipping'},
                    {value: '40+', label: 'Clients'},
                    {value: '99.9%', label: 'Uptime'},
                ],
                features: [
                    {text: 'Cloud-native since 2014'},
                    {text: 'Remote-first for a decade'},
                ],
            }),
        },
    ],
    [EItemType.ProjectGrid]: [
        {
            label: 'minimal',
            content: s({
                sectionTitle: 'Selected *work.*',
                items: [{title: 'Project A', stack: 'AWS, Terraform', kind: 'Platform', year: '2025', coverArt: '', coverColor: '#1677ff'}],
            }),
        },
        {
            label: 'full',
            content: s({
                sectionNumber: '§ 04',
                sectionTitle: 'Selected *work.*',
                sectionSubtitle: 'A sample of recent engagements.',
                items: [
                    {title: 'Project A', stack: 'AWS, Terraform', kind: 'Platform', year: '2025', coverArt: '', coverColor: '#1677ff', moreLabel: 'View engagement ↗', href: '#a'},
                    {title: 'Project B', stack: 'K8s, Go', kind: 'SaaS', year: '2024', coverArt: '', coverColor: '#ff6b35', moreLabel: 'View engagement ↗', href: '#b'},
                    {title: 'Project C', stack: 'Node, MongoDB', kind: 'CMS', year: '2023', coverArt: '', coverColor: '#2ec4b6', moreLabel: 'View engagement ↗', href: '#c'},
                ],
            }),
        },
    ],
    [EItemType.Manifesto]: [
        {label: 'minimal', content: s({body: 'We build systems that outlast the people who first wrote them.'})},
        {
            label: 'full',
            content: s({
                body: 'We build systems that outlast the people who first wrote them. Boring tech, clear edges, documented intent.',
                addendum: 'If it’s weird, it’s documented. If it’s clever, it’s tested.',
                chips: [
                    {key: 'BORING', thumb: '', color: ''},
                    {key: 'CLEAR', thumb: '', color: ''},
                    {key: 'DOCUMENTED', thumb: '', color: ''},
                ],
            }),
        },
    ],
    [EItemType.InquiryForm]: [
        {
            label: 'minimal',
            content: s({
                title: 'Start a conversation',
                topics: [{value: 'project', label: 'Project'}],
                fields: [{name: 'email', label: 'Email', placeholder: 'you@studio.com', kind: 'email', required: true}],
            }),
        },
        {
            label: 'full',
            content: s({
                eyebrow: 'INQUIRY · 002',
                title: 'Start a conversation',
                subtitle: 'Tell me what you’re building. Replies in 1–3 working days.',
                topicsLabel: 'WHAT’S THIS ABOUT',
                topics: [
                    {value: 'project', label: 'Project'},
                    {value: 'role', label: 'Role / hire'},
                    {value: 'advisory', label: 'Advisory'},
                    {value: 'other', label: 'Other'},
                ],
                fields: [
                    {name: 'name', label: 'Name', placeholder: 'Your full name', kind: 'text', required: true},
                    {name: 'email', label: 'Email', placeholder: 'you@studio.com', kind: 'email', required: true},
                    {name: 'company', label: 'Company / studio', placeholder: 'Optional', kind: 'text'},
                    {name: 'message', label: 'Message', placeholder: 'A few lines on context, scope, timing.', kind: 'textarea', required: true},
                ],
                submitLabel: 'Send inquiry',
                successMessage: 'Thanks — noted. I’ll be in touch.',
                sideNote: 'No NDAs at first contact — happy to sign once scope is clear.',
            }),
        },
    ],
    [EItemType.DataModel]: [
        {
            label: 'minimal',
            content: s({
                title: 'Section fields',
                fields: [{name: '_id', type: 'ObjectId', nullable: 'no', notes: 'Mongo PK'}],
            }),
        },
        {
            label: 'full',
            content: s({
                eyebrow: '§ 04 · DATA MODEL',
                title: 'Sections, items, navigation',
                subtitle: 'Three collections cover every piece of content in the CMS.',
                tableTitle: 'Section fields',
                fields: [
                    {name: '_id', type: 'ObjectId', nullable: 'no', notes: 'Mongo PK'},
                    {name: 'page', type: 'string', nullable: 'no', notes: 'slug, indexed'},
                    {name: 'type', type: 'number', nullable: 'no', notes: 'column count 1–10'},
                    {name: 'content', type: 'IItem[]', nullable: 'no', notes: 'rendered modules'},
                    {name: 'parent', type: 'ObjectId', nullable: 'fk', notes: 'self-ref nesting'},
                ],
                collectionsTitle: 'Collections',
                collections: [
                    {name: 'Sections', count: '~120 docs'},
                    {name: 'Navigation', count: '8 pages'},
                    {name: 'Languages', count: '3 active'},
                ],
                asideNote: 'Inquiries collection is provisioned but not yet wired to the public form.',
                audits: [
                    {tag: 'AUDIT · ACCESS', title: 'Public read', body: 'Anonymous resolvers strip drafts + restricted fields before responding.'},
                    {tag: 'AUDIT · WRITES', title: 'Admin only', body: 'Mutations gated by NextAuth role; CSRF cookie + same-site lax.'},
                ],
            }),
        },
    ],
    [EItemType.InfraTopology]: [
        {
            label: 'minimal',
            content: s({
                title: 'Two droplets, one cache',
                droplets: [{name: 'web-prod-01', role: 'WEB · API', accent: '#b8431d', specs: ['2 vCPU', '4 GB RAM'], services: ['next.js', 'graphql']}],
            }),
        },
        {
            label: 'full',
            content: s({
                eyebrow: '§ 05 · INFRASTRUCTURE',
                title: 'Two droplets, one cache',
                subtitle: 'Boring infra. Predictable bills. No region surprises.',
                dropletsLabel: 'DROPLETS',
                droplets: [
                    {name: 'web-prod-01', role: 'WEB · API', accent: '#b8431d', specs: ['2 vCPU', '4 GB RAM', '80 GB SSD', 'Frankfurt'], services: ['next.js', 'graphql', 'nginx']},
                    {name: 'data-prod-01', role: 'DATA', accent: '#1f5d8a', specs: ['2 vCPU', '8 GB RAM', '160 GB SSD', 'Frankfurt'], services: ['mongodb', 'redis', 'restic']},
                ],
                topologyLabel: 'TOPOLOGY',
                topologySvg: '<svg viewBox="0 0 360 120" xmlns="http://www.w3.org/2000/svg" role="img"><rect x="20" y="30" width="100" height="60" fill="none" stroke="currentColor" stroke-opacity=".4"/><text x="70" y="65" text-anchor="middle" font-family="monospace" font-size="11">web-prod-01</text><rect x="240" y="30" width="100" height="60" fill="none" stroke="currentColor" stroke-opacity=".4"/><text x="290" y="65" text-anchor="middle" font-family="monospace" font-size="11">data-prod-01</text><line x1="120" y1="60" x2="240" y2="60" stroke="currentColor" stroke-opacity=".6"/></svg>',
                topologyCaption: 'Private VPC; only the web droplet is exposed publicly.',
            }),
        },
    ],
    [EItemType.PipelineFlow]: [
        {
            label: 'minimal',
            content: s({
                title: 'Push to deploy',
                steps: [{label: 'test', status: 'ok', meta: '1:14', notes: 'vitest run'}],
            }),
        },
        {
            label: 'full',
            content: s({
                eyebrow: '§ 06 · CI/CD',
                title: 'Push to deploy',
                subtitle: 'Five stages, all green or no merge.',
                steps: [
                    {label: 'lint', status: 'ok', meta: '0:08', notes: 'eslint + tsc --noEmit'},
                    {label: 'test', status: 'ok', meta: '1:14', notes: 'vitest run + jsdom; 312 tests'},
                    {label: 'build', status: 'ok', meta: '2:42', notes: 'next build, output trace, sitemap'},
                    {label: 'image', status: 'warn', meta: '0:55', notes: 'docker buildx, sbom; warns on unpinned base'},
                    {label: 'deploy', status: 'ok', meta: '0:22', notes: 'compose pull + up -d, smoke endpoint'},
                ],
                sideNotesLabel: 'NOTES',
                sideNotes: [
                    'Branch protection requires green pipeline + 1 review.',
                    'Rollback: redeploy previous tag, ~30 s.',
                ],
            }),
        },
    ],
    [EItemType.RepoTree]: [
        {
            label: 'minimal',
            content: s({
                title: 'Where things live',
                nodes: [{path: 'ui', kind: 'dir', summary: 'public site + admin shell'}],
            }),
        },
        {
            label: 'full',
            content: s({
                eyebrow: '§ 07 · REPOSITORY',
                title: 'Where things live',
                subtitle: 'Click a node — the right pane explains it.',
                treeLabel: 'TREE',
                nodes: [
                    {path: 'ui', kind: 'dir', tag: 'FRONTEND', summary: 'public site + admin shell', body: 'React 19 + Next.js 16. Public site under `client/`, admin under `admin/`.'},
                    {path: 'ui/client', kind: 'dir', summary: 'public-facing modules', body: 'Pages, sections, modules, themes, locales.'},
                    {path: 'ui/client/modules/Hero', kind: 'file', summary: 'Hero.tsx', body: 'Editorial hero with portrait + meta + coords.'},
                    {path: 'services', kind: 'dir', tag: 'BACKEND', summary: 'graphql + mongo'},
                    {path: 'shared', kind: 'dir', summary: 'shared types + enums'},
                ],
            }),
        },
    ],
    [EItemType.ArchitectureTiers]: [
        {
            label: 'minimal',
            content: s({
                title: 'Three tiers, one delivery loop',
                tiers: [{ord: '01', concern: 'EDGE', role: 'public surface', title: 'Next.js SSR + ISR', description: 'Renders pages, hydrates modules.', pills: ['Next.js'], modules: [{name: 'pages/', note: 'route handlers'}]}],
            }),
        },
        {
            label: 'full',
            content: s({
                eyebrow: '§ ARCHITECTURE',
                title: 'Three tiers, one delivery loop',
                subtitle: 'Edge · Service · Storage',
                intro: 'Each tier owns a single concern; the boundaries are JSON over HTTP.',
                tiers: [
                    {ord: '01', concern: 'EDGE', role: 'public surface', title: 'Next.js SSR + ISR', description: 'Renders pages, hydrates modules, owns auth cookies.', pills: ['Next.js', 'ISR'], modules: [{name: 'pages/', note: 'route handlers'}]},
                    {ord: '02', concern: 'SERVICE', role: 'business logic', title: 'Express + Apollo', description: 'GraphQL schema, mutations, validators.', pills: ['Apollo Server', 'Express'], modules: [{name: 'services/api', note: 'graphql resolvers'}]},
                    {ord: '03', concern: 'STORAGE', role: 'state', title: 'Mongo + Redis', description: 'Documents in Mongo, ephemeral cache in Redis.', pills: ['MongoDB', 'Redis'], modules: [{name: 'services/db', note: 'collections + indexes'}]},
                ],
                sharedTitle: 'Cross-cutting',
                sharedDescription: 'Logging, metrics, feature flags wired through every tier.',
                sharedPills: ['OpenTelemetry', 'pino'],
                lifecycleSteps: ['author', 'lint', 'test', 'build', 'deploy', 'verify', 'observe'],
                lifecycleHighlight: [3, 4],
            }),
        },
    ],
    [EItemType.StatsStrip]: [
        {label: 'minimal', content: s({cells: [{value: '15+', unit: 'yrs', label: 'shipped'}]})},
        {
            label: 'full',
            content: s({
                cells: [
                    {value: '15+', unit: 'yrs', label: 'shipped', highlight: true},
                    {value: '11', label: 'countries'},
                    {value: '100', unit: '%', label: 'on time'},
                    {value: '24/7', label: 'remote'},
                ],
            }),
        },
    ],
    [EItemType.KeyValueDossier]: [
        // Matches the live cv-sec-home-vitals shape on funisimo.pro — the
        // exact RichText dl/dt/dd this module is replacing.
        {label: 'minimal', content: s({items: [{label: 'Based', value: 'Sigulda, Latvia (EU)'}]})},
        {
            label: 'full',
            content: s({
                title: 'Hero vitals',
                items: [
                    {label: 'Based', value: 'Sigulda, Latvia (EU)'},
                    {label: 'Years', value: '15+ in digital'},
                    {label: 'Mode',  value: 'Remote-first · Contract or permanent'},
                    {label: 'Stack', value: 'TypeScript · React · Next.js · .NET · gRPC · Claude Code'},
                    {label: 'Contact', value: 'support@funisimo.pro', href: 'mailto:support@funisimo.pro'},
                ],
            }),
        },
    ],
    [EItemType.Product]: [
        {label: 'minimal', content: s({mode: 'grid', products: {source: 'manual', ids: [], limit: 6}})},
        {
            label: 'full',
            content: s({
                mode: 'grid',
                products: {source: 'manual', ids: [], limit: 6},
                showBuyCta: true,
                showPrice: true,
                grid: {columns: 3, density: 'standard'},
            }),
        },
    ],
    [EItemType.ProductDetailHero]: [
        {label: 'minimal', content: s({productId: ''})},
        {label: 'full', content: s({productId: '', showBuyCta: true, showVatBadge: true})},
    ],
    [EItemType.ProductSpecTable]: [
        {label: 'minimal', content: s({productId: ''})},
        {label: 'full', content: s({productId: '', autoFromAttributes: true})},
    ],
    [EItemType.ProductDescription]: [
        {label: 'minimal', content: s({productId: ''})},
        {label: 'full', content: s({productId: '', autoBindTo: 'product.description'})},
    ],
    [EItemType.Pagination]: [
        {label: 'minimal', content: s({variant: 'load-more'})},
        {label: 'full', content: s({variant: 'infinite-scroll', pageSize: 24})},
    ],
    [EItemType.Breadcrumb]: [
        {label: 'minimal', content: s({autoFromParentChain: true})},
        {label: 'full', content: s({autoFromParentChain: true, separator: '›'})},
    ],
    // AccountSettingsHero / Nav / Form are locked structural modules on the
    // /account/settings system page — no operator-editable content blob.
    [EItemType.AccountSettingsHero]: [
        {label: 'minimal', content: s({})},
        {label: 'full', content: s({})},
    ],
    [EItemType.AccountSettingsNav]: [
        {label: 'minimal', content: s({})},
        {label: 'full', content: s({})},
    ],
    [EItemType.AccountSettingsForm]: [
        {label: 'minimal', content: s({})},
        {label: 'full', content: s({})},
    ],
    [EItemType.LargeGallery]: [
        {label: 'minimal', content: s({title: '', images: ['preview:cosmos1080p']})},
        {
            label: 'full',
            content: s({
                title: 'Lookbook',
                images: ['preview:cosmos1080p', 'preview:nanocyte1080p', 'preview:deepblue1080p', 'preview:coalescence1080p'],
            }),
        },
    ],
    [EItemType.SubProductsGrid]: [
        {label: 'minimal', content: s({title: 'Bundle contents'})},
        {label: 'full', content: s({title: 'Bundle contents', limit: 8})},
    ],
    [EItemType.DownloadablePdf]: [
        {label: 'minimal', content: s({})},
        {label: 'full', content: s({label: 'Download spec sheet (PDF)'})},
    ],
    [EItemType.WarrantyInfo]: [
        {label: 'minimal', content: s({})},
        {label: 'full', content: s({title: 'Warranty', body: '3-year manufacturer warranty covering parts and labour.'})},
    ],
    [EItemType.CartLineItems]: [
        {label: 'minimal', content: s({})},
        {label: 'full', content: s({title: 'Cart line items', body: 'Adjust quantities or remove items below.'})},
    ],
    [EItemType.CartSummary]: [
        {label: 'minimal', content: s({})},
        {label: 'full', content: s({title: 'Order summary', body: 'Taxes and shipping calculated at checkout.'})},
    ],
    [EItemType.CartActions]: [
        {label: 'minimal', content: s({})},
        {label: 'full', content: s({title: 'Ready when you are', clearLabel: 'Clear cart', proceedLabel: 'Proceed to checkout'})},
    ],
    [EItemType.CheckoutProgressBar]: [
        {label: 'minimal', content: s({})},
        {label: 'full', content: s({title: 'Address → Shipping → Payment'})},
    ],
    [EItemType.CheckoutAddressForm]: [
        {label: 'minimal', content: s({})},
        {label: 'full', content: s({title: 'Shipping address'})},
    ],
    [EItemType.CheckoutShippingMethod]: [
        {label: 'minimal', content: s({})},
        {label: 'full', content: s({title: 'Shipping method'})},
    ],
    [EItemType.CheckoutPaymentForm]: [
        {label: 'minimal', content: s({})},
        {label: 'full', content: s({title: 'Payment'})},
    ],
    [EItemType.CheckoutCartSummary]: [
        {label: 'minimal', content: s({})},
        {label: 'full', content: s({title: 'Your order'})},
    ],
    [EItemType.PlaceOrderButton]: [
        {label: 'minimal', content: s({})},
        {label: 'full', content: s({label: 'Place order'})},
    ],
    [EItemType.OrderSummary]: [
        {label: 'minimal', content: s({})},
        {label: 'full', content: s({title: 'Order summary'})},
    ],
    [EItemType.MagicLinkAccountUpgrade]: [
        {label: 'minimal', content: s({})},
        {
            label: 'full',
            content: s({
                title: 'Save your details for next time',
                body: 'Pick a password and we will attach this order to your account.',
                ctaLabel: 'Create an account',
            }),
        },
    ],
    [EItemType.AccountWelcome]: [
        {label: 'minimal', content: s({})},
        {label: 'full', content: s({title: 'Welcome back'})},
    ],
    [EItemType.TrustBadges]: [
        {label: 'minimal', content: s({})},
        {label: 'full', content: s({title: 'Trusted by buyers', badges: ['visa', 'mastercard', 'stripe', 'ssl']})},
    ],
    [EItemType.MoneyBackGuarantee]: [
        {label: 'minimal', content: s({})},
        {
            label: 'full',
            content: s({
                title: '30-day money-back guarantee',
                body: 'Return any item within 30 days for a full refund. No questions asked.',
            }),
        },
    ],
    [EItemType.ShippingCalculator]: [
        {label: 'minimal', content: s({})},
        {label: 'full', content: s({title: 'Estimate shipping'})},
    ],
    [EItemType.DownloadInvoiceButton]: [
        {label: 'minimal', content: s({})},
        {label: 'full', content: s({label: 'Download VAT invoice (PDF)'})},
    ],
    [EItemType.ReferAFriendCta]: [
        {label: 'minimal', content: s({})},
        {
            label: 'full',
            content: s({
                title: 'Refer a friend, get 10%',
                body: 'Share your link — both of you get a discount.',
                ctaLabel: 'Get your link',
                ctaHref: '/account/referrals',
            }),
        },
    ],
    [EItemType.SocialShareButtons]: [
        {label: 'minimal', content: s({})},
        {label: 'full', content: s({title: 'Tell your friends', url: 'https://your-site.example/orders/123'})},
    ],
    [EItemType.OrdersList]: [
        {label: 'minimal', content: s({})},
        {
            label: 'full',
            content: s({
                title: 'My orders',
                emptyTitle: 'No orders yet',
                emptyDescription: 'When you place an order it will show up here.',
            }),
        },
    ],
    [EItemType.OrderDetail]: [
        {label: 'minimal', content: s({})},
        {label: 'full', content: s({supportHref: '/account/inbox'})},
    ],
    [EItemType.AddressList]: [
        {label: 'minimal', content: s({})},
        {
            label: 'full',
            content: s({
                title: 'Shipping addresses',
                emptyTitle: 'No saved addresses',
                emptyDescription: 'Add an address to speed up checkout.',
            }),
        },
    ],
    [EItemType.NotificationInbox]: [
        {label: 'minimal', content: s({})},
        {
            label: 'full',
            content: s({
                emptyTitle: 'Your inbox is empty',
                emptyDescription: 'Order updates and messages will appear here.',
            }),
        },
    ],
    [EItemType.SigninForm]: [
        {label: 'minimal', content: s({})},
        {
            label: 'full',
            content: s({
                headline: 'Sign in',
                submitLabel: 'Sign in',
                forgotHref: '/account/magic-link',
                signupHref: '/account/signup',
            }),
        },
    ],
    [EItemType.SignupForm]: [
        {label: 'minimal', content: s({})},
        {
            label: 'full',
            content: s({
                headline: 'Create your account',
                submitLabel: 'Create account',
                signinHref: '/account/signin',
            }),
        },
    ],
    [EItemType.MagicLinkRequestForm]: [
        {label: 'minimal', content: s({})},
        {
            label: 'full',
            content: s({
                headline: 'Sign in with a magic link',
                body: 'We’ll email you a one-click sign-in link.',
                placeholder: 'you@example.com',
                submitLabel: 'Email me a link',
                successHeadline: 'Check your inbox',
                successBody: 'If we have an account for that email, a sign-in link is on its way.',
            }),
        },
    ],
    // BlogPost / CarDetail are route-driven (read [slug] / [id] and fetch) —
    // no operator-editable content blob.
    [EItemType.BlogPost]: [
        {label: 'minimal', content: s({})},
        {label: 'full', content: s({})},
    ],
    [EItemType.FeatureGrid]: [
        {label: 'minimal', content: s({features: [{key: 'fast', title: 'Fast', description: 'Sub-100ms TTFB out of the box.'}]})},
        {
            label: 'full',
            content: s({
                columns: 3,
                features: [
                    {key: 'mcp', title: 'MCP-native authoring', description: 'Describe pages in English; modules + copy land ready to publish.'},
                    {key: 'tenant', title: 'Multi-tenant by default', description: 'Per-feature, per-page, per-locale grants.'},
                    {key: 'themes', title: 'Theme registry', description: 'Swap, fork and preview presets before publish.'},
                ],
            }),
        },
    ],
    [EItemType.LogoCloud]: [
        {label: 'minimal', content: s({logos: [{key: 'acme', name: 'Acme', logoUrl: 'preview:cosmos1080p'}]})},
        {
            label: 'full',
            content: s({
                headline: 'Trusted by teams at',
                logos: [
                    {key: 'acme', name: 'Acme', logoUrl: 'preview:cosmos1080p', href: 'https://acme.example'},
                    {key: 'globex', name: 'Globex', logoUrl: 'preview:nanocyte1080p', href: 'https://globex.example'},
                    {key: 'initech', name: 'Initech', logoUrl: 'preview:deepblue1080p', href: 'https://initech.example'},
                ],
            }),
        },
    ],
    [EItemType.PricingTable]: [
        {
            label: 'minimal',
            content: s({
                tiers: [{key: 'solo', name: 'Solo', monthlyPriceFormatted: '$129 / mo', annualPriceFormatted: '$129 / mo', ctaLabel: 'Start trial', ctaHref: '/account/signup'}],
                features: [{key: 'pages', label: 'Unlimited pages', perTier: {solo: true}}],
            }),
        },
        {
            label: 'full',
            content: s({
                initialBilling: 'monthly',
                monthlyLabel: 'Monthly',
                annualLabel: 'Annual',
                mostPopularLabel: 'Most popular',
                tiers: [
                    {key: 'solo', name: 'Solo', monthlyPriceFormatted: '$129 / mo', annualPriceFormatted: '$1290 / yr', annualSavingsLabel: '2 months free', description: 'For a single brand site.', ctaLabel: 'Start Solo trial', ctaHref: '/account/signup?plan=solo'},
                    {key: 'agency', name: 'Agency', monthlyPriceFormatted: '$749 / mo', annualPriceFormatted: '$7490 / yr', annualSavingsLabel: '2 months free', description: 'For agencies + hosts.', ctaLabel: 'Start Agency trial', ctaHref: '/account/signup?plan=agency', highlighted: true},
                ],
                features: [
                    {key: 'sites', label: 'Client sites', perTier: {solo: '1 site', agency: 'Up to 25'}},
                    {key: 'pages', label: 'Unlimited pages', perTier: {solo: true, agency: true}},
                    {key: 'tenant', label: 'Scoped multi-tenant grants', perTier: {solo: false, agency: true}},
                ],
            }),
        },
    ],
    [EItemType.TestimonialWall]: [
        {label: 'minimal', content: s({items: [{key: 'a', quote: 'Shipped on time, every time.', name: 'A. Client'}]})},
        {
            label: 'full',
            content: s({
                desktopColumns: 3,
                items: [
                    {key: 'a', quote: 'Shipped on time, every time.', name: 'A. Client', role: 'CTO', company: 'Example Co', photoUrl: 'preview:cosmos1080p'},
                    {key: 'b', quote: 'Made our platform 10× easier to use.', name: 'B. Client', role: 'VP Eng', company: 'Sample Inc', photoUrl: 'preview:nanocyte1080p'},
                    {key: 'c', quote: 'The theme system alone paid for itself.', name: 'C. Client', role: 'Founder', company: 'Studio LV', photoUrl: 'preview:deepblue1080p'},
                ],
            }),
        },
    ],
    [EItemType.CarsList]: [
        {label: 'minimal', content: s({})},
        {
            label: 'full',
            content: s({
                emptyTitle: 'No cars match your filters',
                emptyDescription: 'Try widening the year or price range.',
            }),
        },
    ],
    [EItemType.CarDetail]: [
        {label: 'minimal', content: s({})},
        {label: 'full', content: s({})},
    ],
    // Empty is a placeholder type (render-nothing); skipped intentionally.
    [EItemType.Empty]: [],
};

/** Enum members that legitimately have no Display to preview. */
const PREVIEW_EXEMPT = new Set<string>([EItemType.Empty]);

/**
 * Test-facing helper: list every enum value that *should* have a sample but
 * doesn't. Empty array = full coverage. Keeps the `samples.test.ts` assertion
 * trivial + gives `/admin/modules-preview` a reliable coverage source.
 */
export function missingSampleTypes(): string[] {
    return Object.values(EItemType)
        .filter((v) => !PREVIEW_EXEMPT.has(v))
        .filter((v) => !Array.isArray(sampleContent[v]) || sampleContent[v].length === 0);
}
