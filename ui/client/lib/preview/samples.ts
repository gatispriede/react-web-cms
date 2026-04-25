/**
 * Sample content fixtures used by the admin modules-preview page (C10).
 *
 * One entry per `EItemType`, keyed by the enum value. Each entry is a short
 * list of sample JSON strings — the preview page renders every sample × every
 * declared style variant from the registry, so keep these small (1–3 per type).
 *
 * When you add a new `EItemType`, the companion test
 * (`samples.test.ts`) fails if you forget to add a fixture here — intentional
 * guard-rail so the preview page can't silently drift out of date.
 */
import {EItemType} from '@enums/EItemType';

export interface PreviewSample {
    /** Short human label shown above the rendered module. */
    label: string;
    /** Item.content JSON string — matches what the editor would save. */
    content: string;
}

/**
 * Full coverage map. Every enum value except `Empty` has at least one sample;
 * `Empty` is a placeholder type and intentionally skipped (no Display to test).
 */
export const sampleContent: Record<string, PreviewSample[]> = {
    [EItemType.Text]: [
        {label: 'short', content: JSON.stringify({value: 'The quick brown fox jumps over the lazy dog.'})},
        {label: 'paragraph', content: JSON.stringify({value: 'A longer paragraph of sample body copy used to exercise line-height, kerning, and paragraph spacing across every theme preset in the style matrix.'})},
    ],
    [EItemType.RichText]: [
        {label: 'basic', content: JSON.stringify({value: '<h3>Heading</h3><p>Body copy with <em>italic</em> and <strong>bold</strong> runs.</p>'})},
    ],
    [EItemType.Image]: [
        {label: 'placeholder', content: JSON.stringify({src: 'preview:cosmos1080p', useAsBackground: false})},
    ],
    [EItemType.Gallery]: [
        {
            label: '4 tiles · 1:1',
            content: JSON.stringify({
                aspectRatio: '1:1',
                items: [
                    {src: 'preview:cosmos1080p', alt: 'Tile 1', text: ''},
                    {src: 'preview:coalescence1080p', alt: 'Tile 2', text: ''},
                    {src: 'preview:maya21080p', alt: 'Tile 3', text: ''},
                    {src: 'preview:deepblue1080p', alt: 'Tile 4', text: ''},
                ],
            }),
        },
        {
            // Mixed tiles — exercises per-tile text captions + hrefs + a
            // text-only tile (no `src`). The production galleries tend to
            // mix real shots with editorial pull-quotes; if the text tile's
            // typography breaks on a theme, this reproduces it.
            label: 'mixed media + text',
            content: JSON.stringify({
                aspectRatio: '4:3',
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
        {
            // Wide aspect to surface letterboxing + cropping behaviour.
            label: '3 tiles · 16:9 wide',
            content: JSON.stringify({
                aspectRatio: '16:9',
                items: [
                    {src: 'preview:nanocyte1080p', alt: 'Wide 1', text: ''},
                    {src: 'preview:deepblue1080p', alt: 'Wide 2', text: ''},
                    {src: 'preview:coalescence1080p', alt: 'Wide 3', text: ''},
                ],
            }),
        },
    ],
    [EItemType.Carousel]: [
        {
            // Editorial-flavoured captions — exercises the Editorial
            // side-card (needs text to render), Cinematic centered
            // card, Polaroid serif caption, Ribbon mono strip and
            // Default gradient overlay all from the same fixture.
            label: '3 slides · editorial',
            content: JSON.stringify({
                items: [
                    {src: 'preview:nanocyte1080p', alt: 'Slide 1', text: 'Microstructure — field study, winter 2024', textPosition: 'bottom'},
                    {src: 'preview:deepblue1080p', alt: 'Slide 2', text: 'Depth profile at 400m', textPosition: 'bottom'},
                    {src: 'preview:coalescence1080p', alt: 'Slide 3', text: 'Coalescence, Plate III', textPosition: 'bottom'},
                ],
            }),
        },
        {
            // More slides + longer captions — tests arrow-affordance overlap
            // + caption overflow behaviour when text is more than one line,
            // and crucially includes an empty-text slide so the conditional
            // `.text` render path is covered across every style variant.
            label: '5 slides · long captions',
            content: JSON.stringify({
                items: [
                    {src: 'preview:cosmos1080p', alt: 'Cosmos', text: 'First light — 2024 field study', textPosition: 'bottom'},
                    {src: 'preview:coalescence1080p', alt: 'Coalescence', text: 'Two-year longitudinal project documenting structural coalescence across seasons.', textPosition: 'bottom'},
                    {src: 'preview:maya21080p', alt: 'Maya', text: 'Quick note', textPosition: 'top'},
                    {src: 'preview:nanocyte1080p', alt: 'Nanocyte', text: '', textPosition: 'bottom'},
                    {src: 'preview:deepblue1080p', alt: 'Deep Blue', text: 'Final plate', textPosition: 'bottom'},
                ],
            }),
        },
    ],
    [EItemType.Hero]: [
        {
            label: 'text only',
            content: JSON.stringify({
                eyebrow: 'DOSSIER № 001',
                headline: 'Solutions *architecture*',
                subtitle: 'Cloud and on-prem systems designed to last.',
                tagline: 'Four practices, one studio.',
                bgImage: '',
                accent: '',
            }),
        },
        {
            label: 'with background',
            content: JSON.stringify({
                eyebrow: 'SINCE 2009',
                headline: 'Built to *last.*',
                subtitle: 'Full-bleed hero sample with scrim + text-shadow legibility layer.',
                bgImage: 'preview:nanocyte1080p',
                bgOpacity: 40,
                accent: '',
            }),
        },
        {
            // Real-world shape — mirrors what the client-flagged homepage hero
            // actually sends: long multi-line headline with soft italic tail,
            // portrait tile, meta strip, coordinates, both CTAs, titles
            // separator row, tagline with attribution. Keeps the matrix
            // honest — any theme regression that only surfaces when every
            // optional slot is populated now shows up here instead of on
            // production.
            label: 'full dossier',
            content: JSON.stringify({
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
        {
            // Portrait-only — exercises the `.hero--has-portrait` two-column
            // grid path without a bg image, so portrait positioning + label
            // fallback (no image) can be eyeballed against every theme.
            label: 'portrait placeholder',
            content: JSON.stringify({
                eyebrow: 'PROFILE',
                headline: 'Human at the *edges.*',
                subtitle: 'Portrait placeholder tile exercising corner marks + centered label fallback.',
                bgImage: '',
                portraitLabel: 'GP',
                ctaPrimary: {label: 'Read more', href: '#', primary: true},
            }),
        },
    ],
    [EItemType.ProjectCard]: [
        {
            label: 'minimal',
            content: JSON.stringify({
                title: 'Sample project',
                description: 'Short editorial blurb describing the engagement + outcomes.',
                image: 'preview:cosmos1080p',
                tags: ['AWS', 'Terraform', 'K8s'],
            }),
        },
        {
            // Full shape — both CTAs, every optional field populated, long
            // multi-sentence description. Matches the shape a real project
            // card ships with when the editor fills in everything available.
            label: 'full',
            content: JSON.stringify({
                title: 'redis-node-js-cloud CMS',
                description: 'A multi-tenant Node/Mongo CMS with live translation editing, drag-drop image pipeline, optimistic-concurrency conflict resolution, and a theme registry that presets four editorial looks. Runs on a $5 droplet with Caddy SSL, DigitalOcean bind-mount uploads, and a bootstrap script that stands up an empty host end-to-end.',
                image: 'preview:nanocyte1080p',
                tags: ['Node.js', 'MongoDB', 'Next.js', 'GraphQL', 'Caddy', 'DigitalOcean', 'Docker'],
                primaryLink: {label: 'Live site', url: 'https://example.com'},
                secondaryLink: {label: 'Repo →', url: 'https://github.com/example/project'},
            }),
        },
        {
            // No image — surfaces the fallback styling when cover is missing.
            label: 'no image',
            content: JSON.stringify({
                title: 'Consulting engagement',
                description: 'Editorial-only card — no cover image. Exercises the theme\u2019s text-only project fallback.',
                image: '',
                tags: ['Advisory', 'Architecture'],
            }),
        },
    ],
    [EItemType.SkillPills]: [
        {
            label: 'matrix',
            content: JSON.stringify({
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
        {
            label: '3 entries',
            content: JSON.stringify({
                entries: [
                    {start: '2021', end: 'present', company: 'Studio', role: 'Founder', location: 'Riga', achievements: ['Thing one', 'Thing two']},
                    {start: '2018', end: '2021', company: 'Acme', role: 'Lead', location: 'Remote', achievements: ['Shipped X']},
                    {start: '2015', end: '2018', company: 'Beta', role: 'Engineer', location: 'Vilnius', achievements: ['Built Y']},
                ],
            }),
        },
    ],
    [EItemType.SocialLinks]: [
        {
            label: 'row',
            content: JSON.stringify({
                links: [
                    {platform: 'github', url: 'https://github.com/example', label: 'GitHub'},
                    {platform: 'linkedin', url: 'https://linkedin.com/in/example', label: 'LinkedIn'},
                    {platform: 'twitter', url: 'https://x.com/example', label: 'Twitter'},
                ],
            }),
        },
    ],
    [EItemType.BlogFeed]: [
        {label: 'default', content: JSON.stringify({limit: 6, tag: '', heading: 'Latest posts'})},
    ],
    [EItemType.List]: [
        {
            label: 'bullets',
            content: JSON.stringify({
                title: 'What I do',
                items: [
                    {label: 'Cloud architecture'},
                    {label: 'Platform engineering'},
                    {label: 'Developer experience'},
                ],
            }),
        },
    ],
    [EItemType.Services]: [
        {
            label: '3 rows',
            content: JSON.stringify({
                sectionNumber: '§ 03',
                sectionTitle: 'What I *do.*',
                sectionSubtitle: 'Four practices, one studio.',
                rows: [
                    {number: '01', title: 'Solutions *architecture*', description: 'Cloud and on-prem systems designed to last.', tags: ['AWS', 'Azure']},
                    {number: '02', title: 'Platform *engineering*', description: 'Golden paths, self-serve deploys, paved roads.', tags: ['K8s', 'Terraform']},
                    {number: '03', title: 'Developer *experience*', description: 'Short feedback loops, human tooling.', tags: ['DX']},
                ],
            }),
        },
        {
            // Grid-style fixture — icon glyphs + CTAs + longer descriptions
            // populate every field the Industrial "grid" style renders. Any
            // layout regression when icon + CTA land on the same card shows
            // up here without touching production content.
            label: '4 rows · icons + CTAs',
            content: JSON.stringify({
                sectionNumber: '§ 04',
                sectionTitle: 'Four *practices.*',
                sectionSubtitle: 'Every engagement routes through one of these lanes.',
                rows: [
                    {
                        number: '01',
                        title: 'Solutions *architecture*',
                        description: 'System design for teams who need to last past the founding crew. Trade-offs documented, migrations planned, failure modes tabled.',
                        iconGlyph: '▲',
                        tags: ['AWS', 'Azure', 'Multi-cloud'],
                        ctaLabel: 'Find out more',
                        ctaHref: '#services/architecture',
                    },
                    {
                        number: '02',
                        title: 'Platform *engineering*',
                        description: 'Golden paths, self-serve deploys, paved roads — the things that stop your senior engineers from spending half their week on tickets.',
                        iconGlyph: '▣',
                        tags: ['K8s', 'Terraform', 'Pulumi'],
                        ctaLabel: 'See case studies',
                        ctaHref: '#services/platform',
                    },
                    {
                        number: '03',
                        title: 'Developer *experience*',
                        description: 'Short feedback loops, human tooling, documentation that matches reality.',
                        iconGlyph: '◉',
                        tags: ['DX', 'Tooling'],
                        ctaLabel: 'Get in touch',
                        ctaHref: '#contact',
                    },
                    {
                        number: '04',
                        title: '~Technical~ *advisory*',
                        description: 'Second-opinion architecture reviews + pre-mortems for hiring, migrations, and vendor selection.',
                        iconGlyph: '✱',
                        tags: ['Review', 'Strategy', 'Due diligence'],
                        ctaLabel: 'Book a call',
                        ctaHref: '#advisory',
                    },
                ],
            }),
        },
        {
            // Latvian locale sample — matches the production homepage's
            // real shape so diacritics + longer words exercise line-wrap /
            // letter-spacing the same way they do for real visitors.
            label: 'LV · real copy',
            content: JSON.stringify({
                sectionNumber: '§ 02',
                sectionTitle: 'Pakalpojumi *augstumos.*',
                sectionSubtitle: 'Rūpnieciskais alpīnisms Latvijā kopš 2012.',
                rows: [
                    {number: '01', title: 'Ēku *fasādes*', description: 'Augstu ēku fasāžu apkope, mazgāšana un sīki remontdarbi bez sastatnēm.', iconGlyph: '⛰', tags: ['Tīrīšana', 'Remonts']},
                    {number: '02', title: 'Rūpnieciskie *darbi*', description: 'Krāsošana, metināšana, grunts sagatavošana grūti pieejamās vietās.', iconGlyph: '⚙', tags: ['Metināšana', 'Krāsošana']},
                    {number: '03', title: 'Avārijas *reaģēšana*', description: 'Diennakts izsaukumi — koku krišana, bojāti jumti, ledus demontāža.', iconGlyph: '⚠', tags: ['24/7']},
                ],
            }),
        },
    ],
    [EItemType.Testimonials]: [
        {
            label: '2 quotes',
            content: JSON.stringify({
                sectionTitle: 'What people say',
                sectionSubtitle: '',
                items: [
                    {quote: 'Delivered on every promise.', name: 'A. Client', role: 'CTO, Example Co', avatarInitial: 'A'},
                    {quote: 'Made our platform 10× easier to use.', name: 'B. Client', role: 'VP Eng, Sample Inc', avatarInitial: 'B'},
                ],
            }),
        },
    ],
    [EItemType.StatsCard]: [
        {
            label: 'metrics',
            content: JSON.stringify({
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
            label: '3 items',
            content: JSON.stringify({
                sectionNumber: '§ 04',
                sectionTitle: 'Selected *work.*',
                sectionSubtitle: '',
                items: [
                    {title: 'Project A', stack: 'AWS, Terraform', kind: 'Platform', year: '2025', coverArt: '', coverColor: '#1677ff'},
                    {title: 'Project B', stack: 'K8s, Go', kind: 'SaaS', year: '2024', coverArt: '', coverColor: '#ff6b35'},
                    {title: 'Project C', stack: 'Node, MongoDB', kind: 'CMS', year: '2023', coverArt: '', coverColor: '#2ec4b6'},
                ],
            }),
        },
    ],
    [EItemType.Manifesto]: [
        {
            label: 'essay',
            content: JSON.stringify({
                body: 'We build systems that outlast the people who first wrote them. Boring tech, clear edges, documented intent.',
                addendum: 'If it\u2019s weird, it\u2019s documented. If it\u2019s clever, it\u2019s tested.',
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
            label: 'CV contact',
            content: JSON.stringify({
                eyebrow: 'INQUIRY · 002',
                title: 'Start a conversation',
                subtitle: 'Tell me what you\u2019re building. Replies in 1\u20133 working days.',
                topicsLabel: 'WHAT\u2019S THIS ABOUT',
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
                    {name: 'budget', label: 'Budget range', placeholder: 'Ballpark or N/A', kind: 'text'},
                    {name: 'message', label: 'Message', placeholder: 'A few lines on context, scope, timing.', kind: 'textarea', required: true},
                ],
                submitLabel: 'Send inquiry',
                successMessage: 'Thanks \u2014 noted. I\u2019ll be in touch.',
                sideNote: 'No NDAs at first contact \u2014 happy to sign once scope is clear.',
            }),
        },
    ],
    [EItemType.DataModel]: [
        {
            label: 'CMS schema',
            content: JSON.stringify({
                eyebrow: '\u00a7 04 \u00b7 DATA MODEL',
                title: 'Sections, items, navigation',
                subtitle: 'Three collections cover every piece of content in the CMS.',
                tableTitle: 'Section fields',
                fields: [
                    {name: '_id', type: 'ObjectId', nullable: 'no', notes: 'Mongo PK'},
                    {name: 'page', type: 'string', nullable: 'no', notes: 'slug, indexed'},
                    {name: 'type', type: 'number', nullable: 'no', notes: 'column count 1\u201310'},
                    {name: 'content', type: 'IItem[]', nullable: 'no', notes: 'rendered modules'},
                    {name: 'overlay', type: 'boolean', nullable: 'yes', notes: 'absolute layer'},
                    {name: 'parent', type: 'ObjectId', nullable: 'fk', notes: 'self-ref nesting'},
                ],
                collectionsTitle: 'Collections',
                collections: [
                    {name: 'Sections', count: '~120 docs'},
                    {name: 'Navigation', count: '8 pages'},
                    {name: 'Languages', count: '3 active'},
                    {name: 'Users', count: 'admin only'},
                ],
                asideNote: 'Inquiries collection is provisioned but not yet wired to the public form.',
                audits: [
                    {tag: 'AUDIT \u00b7 ACCESS', title: 'Public read', body: 'Anonymous resolvers strip drafts + restricted fields before responding.'},
                    {tag: 'AUDIT \u00b7 WRITES', title: 'Admin only', body: 'Mutations gated by NextAuth role; CSRF cookie + same-site lax.'},
                    {tag: 'AUDIT \u00b7 BACKUP', title: 'Daily snapshot', body: 'Mongo dump to off-site bucket; 30 day retention, restore drill quarterly.'},
                ],
            }),
        },
    ],
    [EItemType.InfraTopology]: [
        {
            label: 'two-droplet stack',
            content: JSON.stringify({
                eyebrow: '\u00a7 05 \u00b7 INFRASTRUCTURE',
                title: 'Two droplets, one cache',
                subtitle: 'Boring infra. Predictable bills. No region surprises.',
                dropletsLabel: 'DROPLETS',
                droplets: [
                    {
                        name: 'web-prod-01',
                        role: 'WEB \u00b7 API',
                        accent: '#b8431d',
                        specs: ['2 vCPU', '4 GB RAM', '80 GB SSD', 'Frankfurt'],
                        services: ['next.js', 'graphql', 'nginx'],
                    },
                    {
                        name: 'data-prod-01',
                        role: 'DATA',
                        accent: '#1f5d8a',
                        specs: ['2 vCPU', '8 GB RAM', '160 GB SSD', 'Frankfurt'],
                        services: ['mongodb', 'redis', 'restic'],
                    },
                ],
                topologyLabel: 'TOPOLOGY',
                topologySvg: '<svg viewBox="0 0 360 120" xmlns="http://www.w3.org/2000/svg" role="img"><rect x="20" y="30" width="100" height="60" fill="none" stroke="currentColor" stroke-opacity=".4"/><text x="70" y="65" text-anchor="middle" font-family="monospace" font-size="11">web-prod-01</text><rect x="240" y="30" width="100" height="60" fill="none" stroke="currentColor" stroke-opacity=".4"/><text x="290" y="65" text-anchor="middle" font-family="monospace" font-size="11">data-prod-01</text><line x1="120" y1="60" x2="240" y2="60" stroke="currentColor" stroke-opacity=".6"/><text x="180" y="55" text-anchor="middle" font-family="monospace" font-size="9">TLS</text></svg>',
                topologyCaption: 'Private VPC; only the web droplet is exposed publicly.',
            }),
        },
    ],
    [EItemType.PipelineFlow]: [
        {
            label: 'CI/CD',
            content: JSON.stringify({
                eyebrow: '\u00a7 06 \u00b7 CI/CD',
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
                    'Smoke test hits /api/healthz; failures abort.',
                ],
            }),
        },
    ],
    [EItemType.RepoTree]: [
        {
            label: 'monorepo layout',
            content: JSON.stringify({
                eyebrow: '\u00a7 07 \u00b7 REPOSITORY',
                title: 'Where things live',
                subtitle: 'Click a node \u2014 the right pane explains it.',
                treeLabel: 'TREE',
                nodes: [
                    {path: 'ui', kind: 'dir', tag: 'FRONTEND', summary: 'public site + admin shell', body: 'React 19 + Next.js 16. Public site under `client/`, admin under `admin/`. Sibling trees enforce render/edit concern split.'},
                    {path: 'ui/client', kind: 'dir', summary: 'public-facing modules', body: 'Pages, sections, modules, themes, locales. Hot-reloaded by `npm run dev`.'},
                    {path: 'ui/client/modules', kind: 'dir', summary: 'CMS module renderers'},
                    {path: 'ui/client/modules/Hero', kind: 'file', summary: 'Hero.tsx', body: 'Editorial hero with portrait + meta + coords. Drives `/` and CV pages.'},
                    {path: 'ui/admin/modules', kind: 'dir', summary: 'sibling editors'},
                    {path: 'services', kind: 'dir', tag: 'BACKEND', summary: 'graphql + mongo'},
                    {path: 'services/api', kind: 'file', summary: 'apollo server', body: 'Schema-first GraphQL on Apollo Server v5; bounded cache, depth-limited queries.'},
                    {path: 'shared', kind: 'dir', summary: 'shared types + enums'},
                    {path: 'docs', kind: 'dir', summary: 'roadmap + architecture notes'},
                ],
            }),
        },
    ],
    [EItemType.ArchitectureTiers]: [
        {
            label: 'three-tier system',
            content: JSON.stringify({
                eyebrow: '\u00a7 ARCHITECTURE',
                title: 'Three tiers, one delivery loop',
                subtitle: 'Edge \u00b7 Service \u00b7 Storage',
                intro: 'Each tier owns a single concern; the boundaries are JSON over HTTP.',
                tiers: [
                    {ord: '01', concern: 'EDGE', role: 'public surface', title: 'Next.js SSR + ISR', description: 'Renders pages, hydrates modules, owns auth cookies.', pills: ['Next.js', 'Vercel-style ISR'], modules: [{name: 'pages/', note: 'route handlers'}]},
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
        {
            label: 'four cells',
            content: JSON.stringify({
                cells: [
                    {value: '15+', unit: 'yrs', label: 'shipped', highlight: true},
                    {value: '11', label: 'countries'},
                    {value: '100', unit: '%', label: 'on time'},
                    {value: '24/7', label: 'remote'},
                ],
            }),
        },
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
