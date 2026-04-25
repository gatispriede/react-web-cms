#!/usr/bin/env node
// Build public/design-v7/cv-bundle.bundle.json from a single source-of-truth
// definition. Mirrors the v2 paper-themed mockups (public/CV/v2) — three pages
// (Home / Contact / CMS) on the Paper theme, exercising every new module
// (InquiryForm / DataModel / InfraTopology / PipelineFlow / RepoTree) plus the
// new SocialLinks.channels and Services.tiers style variants.
//
// Re-run after editing this script; the generated JSON is committed alongside
// for the bundle import endpoint to consume.

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const OUT = path.join(REPO, 'public/design-v7/cv-bundle.bundle.json');
const OUT_CV = path.join(REPO, 'public/CV/v3/cv-bundle.bundle.json');
const TREE_DATA = path.join(REPO, 'public/CV/v2/repotreedata.js');
const TREE_DATA_LSS = path.join(REPO, 'public/CV/v3/repotreedata-lss.js');

// --- Helpers ---------------------------------------------------------------
const j = (o) => JSON.stringify(o);
const item = (type, style, content, action = {}) => ({
    type,
    style,
    content: typeof content === 'string' ? content : j(content),
    action: 'none',
    actionType: 'TEXT',
    actionStyle: 'default',
    actionContent: '{}',
    ...action,
});

const sec1 = (id, page, items) => ({id, type: 1, page, content: items});
const sec3 = (id, page, slots, items) => ({id, type: 3, page, slots, content: items});

const heading = (html) => item('RICH_TEXT', 'default', {value: html});

// Vitals dl rendered as a stand-alone module under each hero. The hero
// itself stays purely about identity (eyebrow, name, lede, CTA, portrait);
// the labelled key/value pairs (CODENAME, STATUS, FOOTPRINT, etc) and the
// ALL-CAPS coords strip become their own siblings — easier to author,
// easier to re-skin without touching Hero.
function vitalsBlock(metaPairs) {
    const dl = '<dl class="hero-vitals">'
        + metaPairs.map(p => `<dt>${p.label}</dt><dd>${p.value}</dd>`).join('')
        + '</dl>';
    return heading(dl);
}
function statsStrip(coords) {
    const cells = coords.map(c => `<span><b style="color:var(--ink-3);font-family:var(--font-mono);font-size:11px;letter-spacing:0.14em;text-transform:uppercase;">${c.label}</b>&nbsp;<b>${c.value}</b></span>`).join('<span style="color:var(--rule-strong);margin:0 14px;">·</span>');
    return heading(`<div class="hero-strip" style="display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;font-family:var(--font-mono);font-size:11px;letter-spacing:0.04em;color:var(--ink-2);border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:14px 0;">${cells}</div>`);
}

// --- Repo tree -------------------------------------------------------------
// Eval the v2 mockup's data file to read window.REPO_TREE, then flatten it
// into the {path, tag, summary, body}[] shape that the RepoTree module
// consumes. Folders get tag='DIR' (or 'REPO' for the root), files get an
// extension-derived tag (TS/TSX/JSON/MD/SCSS/etc).
function loadRepoTree(file) {
    const sandbox = {window: {}};
    const code = fs.readFileSync(file || TREE_DATA, 'utf8');
    new Function('window', code)(sandbox.window);
    return sandbox.window.REPO_TREE;
}
function tagFor(node) {
    if (node.t === 'dir') return node.k === 'root' ? 'REPO' : 'DIR';
    const k = node.k || '';
    if (k === 'tsx') return 'TSX';
    if (k === 'ts' || k === 'ts-test' || k === 'ts-gen') return 'TS';
    if (k === 'json') return 'JSON';
    if (k === 'md') return 'MD';
    if (k === 'scss') return 'SCSS';
    if (k === 'graphql') return 'GQL';
    if (k === 'yml') return 'YML';
    if (k === 'sh') return 'SH';
    if (k === 'env') return 'ENV';
    if (k === 'dockerfile') return 'DOCKER';
    if (k === 'conf') return 'CONF';
    if (k === 'svg') return 'SVG';
    if (k === 'html') return 'HTML';
    if (k === 'pem' || k === 'secret') return 'KEY';
    return 'FILE';
}

// Mirrors the v3 mockup's DIR_KIND_BADGE map — small editorial label
// shown next to the folder name in the tree and at the top of the detail
// pane (e.g. "BACKEND", "FRONTEND", "FEATURES · ADMIN").
const DIR_KIND_BADGE = {
    'root':            'MONOREPO',
    'root-server':     'BACKEND',
    'root-ui':         'FRONTEND',
    'root-shared':     'CONTRACT',
    'root-infra':      'DEPLOY',
    'root-docs':       'DOCS',
    'root-tools':      'TOOLS',
    'root-ci':         'CI',
    'api':             'API',
    'api-client':      'API · CLIENT',
    'generated':       'CODEGEN',
    'features-server': 'FEATURES',
    'features-admin':  'FEATURES · ADMIN',
    'features-client': 'FEATURES · CLIENT',
    'infra-server':    'INFRA',
    'feature':         'FEATURE',
    'module':          'MODULE',
    'modules-admin':   'MODULES · ADMIN',
    'modules-client':  'MODULES · CLIENT',
    'shell':           'SHELL',
    'lib-admin':       'LIB · ADMIN',
    'lib-client':      'LIB · CLIENT',
    'i18n':            'I18N',
    'themes':          'THEMES',
    'scss':            'SCSS',
    'pages':           'PAGES',
    'api-routes':      'API ROUTES',
    'tests':           'TESTS',
    'preview':         'PREVIEW',
    'static':          'STATIC',
    'secret':          'SECRETS',
    'enums':           'ENUMS',
    'types':           'TYPES',
    'utils':           'UTILS',
    'docs':            'DOCS',
    'admin-ui':        'ADMIN',
    'client-ui':       'CLIENT',
};
function statsFor(node) {
    let subfolders = 0, files = 0, maxDepth = 0;
    function visit(n, d) {
        if (n !== node) {
            if (n.t === 'dir') subfolders++;
            else files++;
        }
        if (d > maxDepth) maxDepth = d;
        if (n.c) for (const ch of n.c) visit(ch, d + 1);
    }
    visit(node, 0);
    return {subfolders, files, maxDepth};
}
function flattenTree(root) {
    const out = [];
    const MAX_DEPTH = 12; // folders only — render the whole spine
    function walk(node, parentPath, depth) {
        // Skip anything flagged as a secret store — keystores, certs, env
        // bundles. Folder names alone can leak hosting choices, so we drop
        // the whole subtree. (Bundle still describes the runtime use of
        // env files in prose elsewhere.)
        if (node.k === 'secret') return;
        const here = parentPath ? `${parentPath}/${node.n}` : node.n;
        // Folders only — files would balloon the rail and aren't the point.
        if (node.t === 'dir') {
            const summary = node.k === 'root' ? 'Monorepo root' : 'Folder';
            const badge = DIR_KIND_BADGE[node.k] || (node.k === 'root' ? 'MONOREPO' : 'FOLDER');
            out.push({
                path: here,
                kind: 'dir',
                tag: tagFor(node),
                badge,
                summary: node.d ? node.d.split(/[.;]/)[0].trim().slice(0, 80) : summary,
                body: node.d ?? '',
                stats: statsFor(node),
            });
        }
        if (node.c && depth < MAX_DEPTH) for (const child of node.c) walk(child, here, depth + 1);
    }
    walk(root, '', 0);
    return out;
}
const repoNodes = flattenTree(loadRepoTree(TREE_DATA));
const repoNodesLss = flattenTree(loadRepoTree(TREE_DATA_LSS));

// --- Sections --------------------------------------------------------------
const sections = [];

// === Home (Dossier) ===
sections.push(sec1('cv-sec-home-hero', 'Home', [
    item('HERO', 'editorial', {
        eyebrow: 'DOSSIER № 001 / SIGULDA, LATVIA / EST. 2009',
        headline: 'Gatis',
        headlineSoft: 'Priede.',
        titles: ['Digital Solutions Architect', 'Senior JavaScript Engineer', 'Consultant'],
        subtitle: '',
        tagline: 'Everything is possible.',
        taglineAttribution: '— personal motto',
        bgImage: '',
        accent: '',
        portraitLabel: 'GP',
        portraitImage: '/images/20260415_142341.jpg',
        ctaPrimary: {label: 'View work ↘', href: '#career', primary: true},
        ctaSecondary: {label: 'Get in touch', href: '/contact'},
    }),
]));
sections.push(sec1('cv-sec-home-vitals', 'Home', [
    vitalsBlock([
        {label: 'Based', value: 'Sigulda, Latvia'},
        {label: 'Years', value: '15+ in digital'},
        {label: 'Mode', value: 'Remote / Hybrid'},
        {label: 'Stack', value: 'JS · React · Next · Node · 3D'},
    ]),
]));
sections.push(sec1('cv-sec-home-coords', 'Home', [
    item('STATS_STRIP', 'default', {
        cells: [
            {value: '57.15°N', label: 'lat'},
            {value: '24.85°E', label: 'lon'},
            {value: '102 m', label: 'elev'},
            {value: '15+', unit: 'yrs', label: 'in digital'},
            {value: '2026.04', label: 'updated'},
        ],
    }),
]));

sections.push(sec1('cv-sec-home-matrix-head', 'Home', [
    heading('<h2>§ 01 · Capability matrix</h2><p><em>Self-reported · 0–10 scale</em></p>'),
]));
// 60/30 split: Core delivery on the left (span=2), Languages dl on the
// right (span=1). Stacking a second [2,1] row right after gives the same
// visual rhythm as the two-table dossier mockup — left column carries
// the matrix bars, right column carries Languages then Own work.
sections.push(sec3('cv-sec-home-matrix-row1', 'Home', [2, 1], [
    item('SKILL_PILLS', 'matrix', {
        category: 'Core delivery',
        categoryMeta: '08 entries',
        items: [
            {label: 'JavaScript / TypeScript', score: 9.8, featured: true},
            {label: 'React · Next.js · SSR / SPA', score: 9.5, featured: true},
            {label: 'Node.js & backend architecture', score: 9.0},
            {label: 'GraphQL · REST · data layer', score: 8.5},
            {label: 'UI / UX · responsive · fluid', score: 8.8},
            {label: '3D & WebGL · SciChart · large data', score: 8.0},
            {label: 'Test-driven development', score: 8.2},
            {label: 'CI/CD · Docker · HAProxy', score: 7.8},
        ],
    }),
    heading(
        '<h4>Languages — spoken &amp; written</h4>'
        + '<dl>'
        + '<dt>Latvian</dt><dd>10 / 10 · native</dd>'
        + '<dt>English</dt><dd>9 / 10 · proficient</dd>'
        + '<dt>German</dt><dd>3 / 4 · novice</dd>'
        + '<dt>Russian</dt><dd>4 / 2 · novice</dd>'
        + '<dt>Greek</dt><dd>2 / 2 · trained</dd>'
        + '</dl>',
    ),
]));
sections.push(sec3('cv-sec-home-matrix-row2', 'Home', [2, 1], [
    item('SKILL_PILLS', 'matrix', {
        category: 'Leadership & management',
        categoryMeta: '06 entries',
        items: [
            {label: 'Agile / Scrum · team lead', score: 9.0},
            {label: 'Project & resource management', score: 8.5},
            {label: 'Stakeholder & client engagement', score: 8.8},
            {label: 'Architecture & strategic planning', score: 8.2},
            {label: 'Mentoring & BA management', score: 8.0},
            {label: 'Cross-country remote delivery (11+)', score: 7.5},
        ],
    }),
    item('LIST', 'facts', {
        title: 'Own work',
        items: [
            {label: 'JF', value: 'JS framework / library — all-in-one JS, HTML, style', href: 'https://github.com/gatispriede/jf'},
            {label: 'LegalStableSure', value: 'Mobile app — live · legalstablesure.com ↗', href: 'https://legalstablesure.com'},
            {label: 'JS-based CMS', value: 'Case study · funisimo.pro ↗', href: '/cms'},
        ],
    }),
]));
sections.push(sec1('cv-sec-home-matrix-platforms', 'Home', [
    heading(
        '<h4>Platforms · tooling · other</h4>'
        + '<dl>'
        + '<dt>Cloud</dt><dd>AWS · Azure · Docker · multi-cloud</dd>'
        + '<dt>Data</dt><dd>MongoDB · Redis · Elastic · MySQL · CouchDB</dd>'
        + '<dt>Languages</dt><dd>JS/TS · Python · PHP · Java · Go · C++ · C#</dd>'
        + '<dt>Build &amp; test</dt><dd>Webpack · Babel · Vite · Vitest · Mocha · Jasmine</dd>'
        + '<dt>Libraries</dt><dd>Material UI · D3 · Handlebars · i18next · Bootstrap</dd>'
        + '<dt>In pursuit</dt><dd>AI · quantum · VR · robotics</dd>'
        + '</dl>',
    ),
]));

sections.push(sec1('cv-sec-home-career-head', 'Home', [
    heading('<h2>§ 02 · Career record</h2><p><em>2013 — present · 05 entries</em></p>'),
]));
sections.push(sec1('cv-sec-home-career-timeline', 'Home', [
    item('TIMELINE', 'editorial', {
        entries: [
            {start: '2024', end: 'PRESENT', location: 'UK / USA · REMOTE', company: 'SciChart', domain: 'scichart.com', role: 'Consultant / Senior Software Engineer', contractType: 'Contract',
                experience: ['Customer engagement & stakeholder management', 'Architecture solutions, product ownership', '3D / 2D browser tech · large data rendering', 'Software development & consulting'],
                achievements: ['Extensive AI knowledge and production usage', 'Custom architecture — JavaScript written in C# style'],
                quote: 'Thinking out of the box while shipping stable, performant code.'},
            {start: '2019', end: '2023', location: 'LATVIA, RIGA', company: 'Sapiens', domain: 'sapiens.com', role: 'Project Manager / Senior Software Engineer', contractType: 'Permanent',
                experience: ['Customer engagement & architecture solutions', 'Technical project management · DevOps', 'Resource & BA management', 'Stakeholder and client management'],
                achievements: ['Remote delivery across 11+ countries', 'Delivered 3 projects, participated in several others']},
            {start: '2017', end: '2019', location: 'LATVIA, RIGA', company: 'SIA Booking Group', domain: 'bookinggroup.com', role: 'Senior Software Engineer', contractType: 'Permanent',
                experience: ['Application architecture · team lead', 'Sysops & DevOps'],
                achievements: ['Migration from Drupal to React', 'Built a new application from scratch']},
            {start: '2015', end: '2017', location: 'NEWCASTLE, UK', company: 'Performance Horizon', domain: 'partnerize.com', role: 'Senior Front-end Developer', contractType: 'Permanent',
                experience: ['UX / UI / Design', 'Architecture design · React migration'],
                achievements: ['Custom solution standardisation', 'Backbone → React migration', 'Best-practice introduction · team morale']},
            {start: '2013', end: '2014', location: 'RIGA, LATVIA', company: 'Accenture', domain: 'accenture.com', role: 'Analyst Web Developer', contractType: 'Permanent · Riga Delivery Center',
                experience: ['Web software development · UI / UX', 'Scrum master · team leading · agile'],
                achievements: ['Grew as a professional in web UI / UX']},
        ],
    }),
]));

sections.push(sec1('cv-sec-home-dossier-head', 'Home', [
    heading('<h2>§ 03 · Dossier appendix</h2><p><em>Education · contact · signals</em></p>'),
]));
sections.push(sec3('cv-sec-home-dossier-grid', 'Home', [1, 1, 1], [
    item('TIMELINE', 'minimal', {
        entries: [
            {start: '2014', end: '2015', company: 'University of Latvia', role: 'Programming Scientist — Quantum Computers',
                achievements: ['Paused: will return when a real-world app runs on a quantum computer.']},
            {start: '2009', end: '2013', company: 'Vidzemes augstskola · UAS', role: 'Programmer — computer & network architecture, project management, functional & OO programming'},
            {start: 'CERTIFICATE', end: '', company: 'Microsoft', role: 'Installing & configuring Windows 7 client'},
        ],
    }),
    item('LIST', 'facts', {
        title: 'Contact',
        items: [
            {label: 'E-mail', value: 'support@funisimo.pro', href: 'mailto:support@funisimo.pro'},
            {label: 'LinkedIn', value: 'in/gatis-priede ↗', href: 'https://www.linkedin.com/in/gatis-priede-11169a56/'},
            {label: 'GitHub', value: 'gatispriede ↗', href: 'https://github.com/gatispriede'},
            {label: 'Location', value: 'Sigulda, Latvia · EET'},
            {label: 'Mode', value: 'Remote / Hybrid, Full-time'},
            {label: 'Driving', value: 'B category'},
        ],
    }),
    item('LIST', 'facts', {
        title: 'Signals & interests',
        items: [
            {label: 'Traits', value: 'Accuracy · logical · intuitive · flexible · optimistic'},
            {label: 'Preferred', value: 'Clean, high-performant code · TDD · SSR · SPA'},
            {label: 'Watching', value: 'AI · quantum · VR · robotics · RPA'},
            {label: 'Interests', value: 'DIY builds · winter sports · table games · music · science · space & time'},
            {label: 'OS', value: 'Windows 11'},
        ],
    }),
]));

// === Contact ===
sections.push(sec1('cv-sec-contact-hero', 'Contact', [
    item('HERO', 'editorial', {
        eyebrow: '§ 04 / CONTACT / DOSSIER № 001',
        headline: 'Get in',
        headlineSoft: 'touch.',
        titles: ['Open to consulting', 'Open to long engagements'],
        tagline: 'Reply within 24 hours, EET working hours.',
        taglineAttribution: '— current SLA',
        portraitLabel: 'GP',
        portraitImage: '/images/20260415_142341.jpg',
        ctaPrimary: {label: 'Send a brief ↘', href: '#inquiry', primary: true},
        ctaSecondary: {label: 'Email directly', href: 'mailto:support@funisimo.pro'},
        meta: [
            {label: 'Local', value: 'Sigulda, EET'},
            {label: 'Mode', value: 'Remote / Hybrid'},
            {label: 'SLA', value: '<24h reply'},
            {label: 'Tax', value: 'LV self-employed'},
        ],
    }),
]));
sections.push(sec1('cv-sec-contact-channels-head', 'Contact', [
    heading('<h2>§ 04.1 · Channels</h2><p><em>Pick your preferred surface.</em></p>'),
]));
sections.push(sec1('cv-sec-contact-channels', 'Contact', [
    item('SOCIAL_LINKS', 'channels', {
        links: [
            {platform: 'linkedin', url: 'https://www.linkedin.com/in/gatis-priede-11169a56/', label: 'in/gatis-priede'},
            {platform: 'github', url: 'https://github.com/gatispriede', label: 'github.com/gatispriede'},
            {platform: 'email', url: 'mailto:support@funisimo.pro', label: 'support@funisimo.pro'},
        ],
    }),
]));
sections.push(sec1('cv-sec-contact-form-head', 'Contact', [
    heading('<h2>§ 04.2 · Send a brief</h2><p><em>Topic, two lines, expect a reply within one working day.</em></p>'),
]));
sections.push(sec1('cv-sec-contact-form', 'Contact', [
    item('INQUIRY_FORM', 'editorial', {
        eyebrow: '§ 04.2 / SEND A BRIEF',
        title: 'Inquiry form',
        subtitle: 'Pick a topic, leave a few lines, expect a response within one working day.',
        topicsLabel: 'Topic',
        topics: [
            {value: 'consulting', label: 'Consulting'},
            {value: 'engineering', label: 'Engineering'},
            {value: 'architecture', label: 'Architecture'},
            {value: 'other', label: 'Other'},
        ],
        fields: [
            {name: 'name', label: 'Your name', placeholder: 'Jane Doe', kind: 'text', required: true},
            {name: 'email', label: 'Email', placeholder: 'jane@company.com', kind: 'email', required: true},
            {name: 'company', label: 'Company', placeholder: 'Acme Inc.', kind: 'text'},
            {name: 'message', label: 'Brief', placeholder: 'A few lines on the project, scope, timeline.', kind: 'textarea', required: true},
        ],
        submitLabel: 'Send brief ↗',
        successMessage: "Thanks — I'll respond within one working day.",
        sideNote: 'Replies from support@funisimo.pro. EET working hours.',
    }),
]));
sections.push(sec1('cv-sec-contact-facts-head', 'Contact', [
    heading('<h2>§ 04.3 · Engagement terms</h2>'),
]));
sections.push(sec1('cv-sec-contact-facts', 'Contact', [
    item('LIST', 'facts', {
        title: 'Engagement terms',
        items: [
            {label: 'Day rate', value: 'On request · IR35 outside'},
            {label: 'Min engagement', value: '2 weeks'},
            {label: 'Notice', value: '4 weeks (current contracts)'},
            {label: 'Travel', value: 'Quarterly on-site OK'},
            {label: 'NDA', value: 'Standard mutual NDA on request'},
        ],
    }),
]));

// === CMS ===
sections.push(sec1('cv-sec-cms-hero', 'CMS', [
    item('HERO', 'editorial', {
        eyebrow: '§ 05 / CASE STUDY / DOSSIER № 002',
        headline: 'JS',
        headlineSoft: 'CMS.',
        titles: ['Next.js · MongoDB · GraphQL', 'Multi-tenant editorial CMS'],
        tagline: 'A content-composable portfolio & marketing CMS — multilingual pages, 17 reusable item types, 8 themes, versioned snapshots with rollback, all on a single $12 droplet.',
        taglineAttribution: '— delivery loop',
        portraitLabel: 'CMS',
        portraitImage: '/images/20260415_142341.jpg',
        ctaPrimary: {label: 'Tour architecture ↘', href: '#architecture', primary: true},
        ctaSecondary: {label: 'Visit GitHub ↗', href: 'https://github.com/gatispriede/redis-node-js-cloud'},
    }),
]));
sections.push(sec1('cv-sec-cms-vitals', 'CMS', [
    vitalsBlock([
        {label: 'Codename', value: 'funisimo · monorepo · TypeScript'},
        {label: 'Status', value: 'In development · live at funisimo.pro'},
        {label: 'Footprint', value: 'Two droplets · same code · isolated content'},
        {label: 'Pipeline', value: 'Push → CI → SSH deploy · ~3 min p95'},
        {label: 'Audit', value: 'Every write stamps editedBy + version'},
    ]),
]));
sections.push(sec1('cv-sec-cms-stats', 'CMS', [
    item('STATS_STRIP', 'default', {
        cells: [
            {value: '17', unit: 'types', label: 'reusable item types', highlight: true},
            {value: '10', unit: 'cols', label: 'mongo collections'},
            {value: '8', unit: 'themes', label: 'editorial · a11y'},
            {value: '~3', unit: 'min', label: 'push → live'},
            {value: '60', unit: 's', label: 'isr fallback'},
        ],
    }),
]));

sections.push(sec1('cv-sec-cms-pitch', 'CMS', [
    heading(
        '<h2>§ 0 · Built for AI to use as a CMS language</h2>'
        + '<p>A small, declarative grammar — <b>pages, sections, items, styles</b> — that an LLM can compose end-to-end. The output is a <b>beautiful, complex, fully editable</b> site, generated within minutes from a single prompt or bundle.</p>'
        + '<p>Each item type carries a strict schema, a renderer, and an editor. Hand the AI the registry, hand it a brief, and it returns a complete bundle — type-checked, theme-aware, and immediately publishable. The same admin surface a human uses to edit a page is the surface the AI writes against.</p>'
        + '<p><em>17 reusable types · 8 themes · 5 locales · one prompt → one site, in minutes.</em></p>',
    ),
]));

sections.push(sec1('cv-sec-cms-arch-head', 'CMS', [
    heading('<h2>§ A · Architecture</h2><p><em>Three concerns · one repo · zero shared imports between client and admin</em></p>'
        + '<p><b>One concern per folder.</b> "Where do I render a module?" → <code>ui/client/modules/</code>. "Edit it?" → <code>ui/admin/modules/</code>. "Add a resolver?" → <code>services/features/&lt;name&gt;/</code>. Every question has exactly one answer.</p>'
        + '<p>Client and admin never import each other\'s code — they share only the generic <code>ISection</code> / <code>IItem</code> types from <code>shared/types/</code>. Removing a module = drop two folders + unregister.</p>'),
]));
sections.push(sec1('cv-sec-cms-tiers', 'CMS', [
    item('ARCHITECTURE_TIERS', 'default', {
        eyebrow: '§ A / TIERS',
        title: 'Three concerns, one repo.',
        subtitle: 'Client · admin · services — siblings, never importing each other.',
        intro: 'Every feature lives in exactly one of three tiers. The client renders, the admin edits, services own the GraphQL contract and persistence. Removing a module = drop two folders + unregister.',
        tiers: [
            {ord: 'A.01', concern: 'CLIENT', role: 'Render the public site', title: 'ui/client/', description: 'SSR + ISR public surface. Next.js 15 / React 19 / next-i18next / 5 locales. Modules are self-contained — types, view, styles in one folder.',
                pills: ['Next.js 15', 'React 19', 'SSG · ISR 60s', 'next-i18next', '5 locales'],
                modules: [
                    {label: 'modules/Hero', tag: 'TSX'},
                    {label: 'modules/RepoTree', tag: 'TSX'},
                    {label: 'modules/InfraTopology', tag: 'TSX'},
                    {label: 'modules/PipelineFlow', tag: 'TSX'},
                    {label: 'styles/globals/global.scss', tag: 'SCSS'},
                ]},
            {ord: 'A.02', concern: 'ADMIN', role: 'Edit content', title: 'ui/admin/', description: 'Single-page React surface. AntD chrome, @dnd-kit reorder, InlineEdit (Alt+click), conflict-aware writes. Mirrors client/modules folder-for-folder.',
                pills: ['AntD', 'NextAuth + bcrypt', '@dnd-kit', 'InlineEdit', 'Conflict-aware'],
                modules: [
                    {label: 'modules/Hero/HeroEditor', tag: 'TSX'},
                    {label: 'modules/RepoTree/RepoTreeEditor', tag: 'TSX'},
                    {label: 'lib/itemTypes/registry', tag: 'TS'},
                    {label: 'lib/inlineEdit', tag: 'TS'},
                    {label: 'pages/admin/index', tag: 'TSX'},
                ]},
            {ord: 'A.03', concern: 'SERVICES', role: 'Own the contract', title: 'services/', description: 'Two GraphQL processes, one schema. Apollo Server in Next + standalone Express twin. MongoDB 7, GQty typed client, PublishService + AuditLogService.',
                pills: ['Apollo Server', 'Express twin', 'MongoDB 7', 'GQty', 'Audit triplet'],
                modules: [
                    {label: 'features/Bundle/BundleService', tag: 'TS'},
                    {label: 'features/Audit/AuditLogService', tag: 'TS'},
                    {label: 'features/Publish/PublishService', tag: 'TS'},
                    {label: 'graphql/schema.graphql', tag: 'GQL'},
                    {label: 'mongoDBConnection', tag: 'TS'},
                ]},
        ],
        sharedTitle: 'shared/',
        sharedDescription: 'The only code both client and admin (and services) import. Generic ISection / IItem / EItemType — never UI, never business logic.',
        sharedPills: ['shared/types', 'shared/enums', 'shared/utils/contentSchemas'],
        lifecycleLabel: 'A.04 · Edit lifecycle',
        lifecycleNote: 'A single edit walks all three tiers in <300 ms p95.',
        lifecycleSteps: [
            {n: '01', title: 'Click', sub: 'Alt+click in client'},
            {n: '02', title: 'Edit', sub: 'Admin inline editor'},
            {n: '03', title: 'Mutate', sub: 'GraphQL → service'},
            {n: '04', title: 'Audit', sub: 'editedBy / Δ / version', highlight: true},
            {n: '05', title: 'Persist', sub: 'Mongo write'},
            {n: '06', title: 'Re-render', sub: 'ISR revalidate'},
            {n: '07', title: 'Live', sub: '<60 s on disk'},
        ],
    }),
]));

sections.push(sec1('cv-sec-cms-stack-head', 'CMS', [
    heading('<h2>§ B · Key technologies</h2><p><em>12 entries · production-shipping</em></p>'),
]));
sections.push(sec1('cv-sec-cms-stack', 'CMS', [
    item('LIST', 'paper-grid', {
        title: '',
        items: [
            {prefix: 'B.01', label: 'Framework', value: 'Next.js 15 · getStaticProps + getStaticPaths · ISR for index/slug · SSR for blog · SPA for admin'},
            {prefix: 'B.02', label: 'UI runtime', value: 'React 19 · concurrent renderer · admin is single-page · public site hydrates islands from preloaded JSON'},
            {prefix: 'B.03', label: 'Language', value: 'TypeScript · strict end-to-end · frontend, backend, codegen all share shared/types'},
            {prefix: 'B.04', label: 'Data layer', value: 'GraphQL · Apollo Server in Next + standalone Express twin · schema.graphql is the contract · GQty client'},
            {prefix: 'B.05', label: 'Database', value: 'MongoDB 7 · 10 collections + keyed-singleton settings · singleton pool · daily mongodump'},
            {prefix: 'B.06', label: 'Auth', value: 'NextAuth · Credentials + optional Google OAuth · Bcrypt admin seed · mustChangePassword on first login'},
            {prefix: 'B.07', label: 'Reverse proxy', value: "Caddy · auto Let's Encrypt · HSTS + security headers · long-cache for /_next/static/*"},
            {prefix: 'B.08', label: 'Process', value: 'PM2 · two processes (web · gql) · systemd-bootstrapped on reboot'},
            {prefix: 'B.09', label: 'Container', value: 'Docker · compose stack ships server + Mongo + Caddy as a unit · GQL container shares Mongo volume'},
            {prefix: 'B.10', label: 'Drag-and-drop', value: '@dnd-kit · section reorder + intra-section sort · native dataTransfer for image-rail drops'},
            {prefix: 'B.11', label: 'i18n', value: 'i18next · public + decoupled admin instance · inline Alt+click translation editor · hot-reloads'},
            {prefix: 'B.12', label: 'Icons', value: 'lucide-react · sole icon library · ESLint bans the rest · IconBase normalises size + weight'},
        ],
    }),
]));

sections.push(sec1('cv-sec-cms-data-head', 'CMS', [
    heading('<h2>§ C · Data model</h2><p><em>10 collections · audit triplet on every doc</em></p>'),
]));
sections.push(sec1('cv-sec-cms-datamodel', 'CMS', [
    item('DATA_MODEL', 'default', {
        eyebrow: '§ C / SCHEMA',
        title: 'Data model',
        subtitle: 'Mongo collections backing the editorial layer.',
        fields: [
            {name: 'Navigation', type: 'collection', nullable: 'no', notes: 'One doc per page · the site map'},
            {name: 'Sections', type: 'collection', nullable: 'no', notes: 'Page chunks · column slots · overlay anchors'},
            {name: 'Images', type: 'collection', nullable: 'no', notes: 'Image metadata · binaries on disk'},
            {name: 'Logos', type: 'collection', nullable: 'no', notes: 'Single-doc — latest wins on read'},
            {name: 'Users', type: 'collection', nullable: 'no', notes: 'Bcrypt password · role · publish capability'},
            {name: 'Languages', type: 'collection', nullable: 'no', notes: '5 locales · translations mirrored to JSON'},
            {name: 'Themes', type: 'collection', nullable: 'no', notes: '8 presets · custom themes · token version'},
            {name: 'Posts', type: 'collection', nullable: 'no', notes: 'Blog · draft flag · publishedAt stamp'},
            {name: 'PublishedSnapshots', type: 'collection', nullable: 'no', notes: 'Frozen full-site cuts · rollback chain'},
            {name: 'SiteSettings', type: 'collection', nullable: 'no', notes: 'Keyed singletons — flags · SEO · footer'},
            {name: 'AuditLog', type: 'collection', nullable: 'no', notes: 'Append-only · TTL · diff payload ≤ 10 kB'},
            {name: 'Presence', type: 'collection', nullable: 'no', notes: '15 s heartbeats · 45 s TTL · stacked avatars'},
        ],
        collections: [
            {name: '17 item types', count: 'ui/client/modules'},
            {name: 'Audit triplet', count: 'editedBy · editedAt · version'},
            {name: 'Conflict on write', count: 'Take-theirs / Keep-mine dialog'},
        ],
        audits: [
            {title: 'The audit triplet', body: 'Every editable doc carries three fields stamped on every write — one for accountability, one for the "edited 2m ago" badge, one for optimistic concurrency.', tag: 'PASS'},
            {title: 'Concurrent edits', body: 'Two admins editing the same doc see a ConflictError instead of silent overwrite. The section editor pops a Take-theirs / Keep-mine dialog.', tag: 'PASS'},
            {title: 'Publishing & rollback', body: 'A publish copies live state into PublishedSnapshots. Rollback copies an old snapshot into a NEW snapshot, then writes that payload over the live collections — chain stays auditable.', tag: 'PASS'},
        ],
    }),
]));

sections.push(sec1('cv-sec-cms-infra-head', 'CMS', [
    heading('<h2>§ D · Infrastructure</h2><p><em>2 droplets · same code · isolated content</em></p>'),
]));
sections.push(sec1('cv-sec-cms-infra', 'CMS', [
    item('INFRA_TOPOLOGY', 'default', {
        eyebrow: '§ D / TOPOLOGY',
        title: 'Two droplets, same code, isolated content',
        subtitle: 'Personal droplet (funisimo.pro) + client tenant droplet (skyclimber.pro). Same image, same compose stack, only .env differs.',
        droplets: [
            {name: 'Droplet 01 · funisimo.pro', role: 'PERSONAL', specs: ['DO · NYC · 2 GB · 1 vCPU', '$12 / mo', '2 GB swap', 'UFW · 22/80/443'],
                services: ['Edge: Caddy · TLS · LE auto-renew · HSTS', 'App: PM2 → next start · ISR 60s', 'API: PM2 → standalone-graphql', 'DB: MongoDB 7 · auth on · loopback only', 'Backup: cron mongodump 04:00 · 30d retention', 'Snap: DO weekly droplet snapshot · $1.20/mo']},
            {name: 'Droplet 02 · skyclimber.pro', role: 'CLIENT TENANT', specs: ['DO · 2 GB', 'Isolated Mongo volume', '.env-only delta'],
                services: ['Code: same repo · same compose stack · /opt/cms', 'Delta: only .env differs · domain · NEXTAUTH', 'Edge: Caddy container · own LE cert · :443', 'DB: independent Mongo · zero cross-tenant', 'Hardening: fail2ban · MaxStartups 100:30:200', 'Target: CI matrix.host_secret selects droplet']},
        ],
        svg: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 200'><rect x='6' y='80' width='110' height='40' fill='none' stroke='currentColor'/><text x='61' y='105' text-anchor='middle' font-family='monospace' font-size='11'>BROWSER</text><line x1='116' y1='100' x2='180' y2='100' stroke='currentColor' marker-end='url(#a)'/><rect x='180' y='80' width='110' height='40' fill='none' stroke='currentColor' stroke-dasharray='4 4'/><text x='235' y='105' text-anchor='middle' font-family='monospace' font-size='11'>CADDY :443</text><line x1='290' y1='90' x2='370' y2='40' stroke='currentColor'/><line x1='290' y1='110' x2='370' y2='160' stroke='currentColor'/><rect x='370' y='20' width='150' height='40' fill='none' stroke='currentColor'/><text x='445' y='45' text-anchor='middle' font-family='monospace' font-size='10'>next start (PM2 web)</text><rect x='370' y='140' width='150' height='40' fill='none' stroke='currentColor'/><text x='445' y='165' text-anchor='middle' font-family='monospace' font-size='10'>standalone-graphql</text><line x1='520' y1='40' x2='560' y2='100' stroke='currentColor'/><line x1='520' y1='160' x2='560' y2='100' stroke='currentColor'/><rect x='560' y='80' width='40' height='40' fill='none' stroke='currentColor' stroke-dasharray='3 3'/><text x='580' y='105' text-anchor='middle' font-family='monospace' font-size='10'>MONGO</text></svg>",
        caption: 'Caddy terminates TLS at :443. PM2 supervises both Node processes. Mongo binds to loopback — never exposed.',
    }),
]));

sections.push(sec1('cv-sec-cms-repo-head', 'CMS', [
    heading('<h2>§ E · Repository</h2><p><em>Feature-sliced · click any node</em></p>'),
]));
sections.push(sec1('cv-sec-cms-repo', 'CMS', [
    item('REPO_TREE', 'default', {
        eyebrow: '§ E / REPO',
        title: 'Repository tree',
        subtitle: `${repoNodes.length} nodes · click to inspect`,
        nodes: repoNodes,
    }),
]));

sections.push(sec1('cv-sec-cms-pipeline-head', 'CMS', [
    heading('<h2>§ F · Continuous deployment</h2><p><em>GitHub Actions · push → master · ~3 min</em></p>'),
]));
sections.push(sec1('cv-sec-cms-pipeline', 'CMS', [
    item('PIPELINE_FLOW', 'default', {
        eyebrow: '§ F / DELIVERY',
        title: 'CI / CD pipeline',
        subtitle: 'Seven stages, ~3 min p95. Push triggers the same checks as PRs but PRs skip the deploy job.',
        steps: [
            {name: 'Push', meta: '~0s · trigger', status: 'ok', detail: 'Commit lands on master. PRs trigger the same checks but skip deploy. workflow_dispatch exposes a one-click manual re-run.'},
            {name: 'Install', meta: '~45s · cached', status: 'ok', detail: 'npm install --legacy-peer-deps --ignore-scripts on Node 20 with npm cache. --ignore-scripts skips bcrypt native compile — tests mock bcrypt-heavy paths.'},
            {name: 'Typecheck', meta: '~20s · strict', status: 'ok', detail: 'tsc --noEmit -p ui/client/tsconfig.json. Strict-mode TS across the public site; admin shares the same compiler config.'},
            {name: 'Test', meta: '~40s · vitest', status: 'ok', detail: 'npm test -- --reporter=dot. Resolver + service unit tests; conflict and audit paths are first-class citizens. 15-minute job timeout.'},
            {name: 'Deploy', meta: '~60s · SSH · push only', status: 'ok', detail: 'SSH into target droplet via appleboy/ssh-action. Idempotent bootstrap: install Docker / fail2ban / harden sshd if missing — no-ops on subsequent runs.'},
            {name: 'Compose up', meta: '~50s · 30 min cap', status: 'ok', detail: 'git pull → docker compose up -d --build. Caddy container owns 80/443 — legacy host nginx is masked on first run to avoid silent 502s.'},
            {name: 'Verify', meta: 'live · p95 ~3min', status: 'warn', detail: 'SSG hit returns hero + footer markup; admin route still SSR; /_next/static/* long-cached by Caddy. ISR catches sub-60s edits.'},
        ],
        sideNotes: [
            'Multi-droplet: DEPLOY_HOST_1 / DEPLOY_HOST_2 + matching DEPLOY_ENV_FILE_* in GitHub secrets — switch droplet = one-line edit.',
            'Tenant isolation by Mongo volume, not code. Same image runs both sides; only .env differs.',
            'Idempotent bootstrap. Docker, fail2ban, sshd hardening installed only if missing — first run sets up the box, subsequent runs no-op.',
            'SSH flood protection: MaxStartups 100:30:200 + fail2ban so scanner traffic doesn\'t evict GHA\'s handshake.',
            'Local-build fallback: Scripts/deploy.sh rsyncs .next from your laptop when CI is offline — same droplet contract.',
            'Rollback path: git revert + push, or BundleService import of last-known-good JSON.',
        ],
    }),
]));

sections.push(sec1('cv-sec-cms-closing-head', 'CMS', [
    heading('<h2>§ G · Closing notes</h2><p><em>Handoff · references · back to dossier</em></p>'),
]));
sections.push(sec3('cv-sec-cms-closing-grid', 'CMS', [1, 1, 1], [
    item('LIST', 'facts', {
        title: "What's interesting here",
        items: [
            {label: '—', value: 'One repo, three concerns. Delete-by-folder on every module.'},
            {label: '—', value: 'Optimistic concurrency end-to-end — no silent overwrites.'},
            {label: '—', value: 'Schema-first GraphQL with a generated typed client (GQty).'},
            {label: '—', value: 'Two droplets, one codebase. Tenant isolation via .env, not code branches.'},
            {label: '—', value: 'Audit triplet (editedBy/editedAt/version) on every doc. No "who changed this?" tickets.'},
        ],
    }),
    item('LIST', 'facts', {
        title: 'References',
        items: [
            {label: 'Production', value: 'funisimo.pro ↗', href: 'https://funisimo.pro'},
            {label: 'GitHub', value: 'gatispriede ↗', href: 'https://github.com/gatispriede'},
            {label: 'LinkedIn', value: 'in/gatis-priede ↗', href: 'https://www.linkedin.com/in/gatis-priede-11169a56/'},
            {label: 'E-mail', value: 'support@funisimo.pro', href: 'mailto:support@funisimo.pro'},
        ],
    }),
    item('LIST', 'facts', {
        title: 'Quick facts',
        items: [
            {label: 'Item types', value: '17 reusable'},
            {label: 'Mongo collections', value: '10'},
            {label: 'Themes', value: '8 · editorial + a11y'},
            {label: 'Single-droplet cost', value: '~$13 / mo'},
            {label: 'ISR fallback window', value: '60 s'},
        ],
    }),
]));

// === LSS (Legal Stable Sure · Peaches) ====================================
sections.push(sec1('cv-sec-lss-hero', 'LSS', [
    item('HERO', 'editorial', {
        eyebrow: '§ 06 / OWN WORK / IN MARKET / DOSSIER № 003',
        headline: 'Legal Stable',
        headlineSoft: 'Sure.',
        titles: ['Expo · Fastify · SQLite', 'Device-first legal compliance'],
        tagline: 'A device-first legal-compliance app for European freelancers and small firms. Bookings, clients, invoices, expenses and country-specific legal alerts — in 7 languages, on a single $13 droplet, with the entire data set living in SQLite on your phone.',
        taglineAttribution: '— delivery loop',
        portraitLabel: 'LSS',
        portraitImage: '/images/20260415_142341.jpg',
        ctaPrimary: {label: 'Tour architecture ↘', href: '#architecture', primary: true},
        ctaSecondary: {label: 'Visit production ↗', href: 'https://legalstablesure.com'},
    }),
]));
sections.push(sec1('cv-sec-lss-vitals', 'LSS', [
    vitalsBlock([
        {label: 'Codename', value: 'peaches · monorepo · pnpm + Turborepo'},
        {label: 'Status', value: 'v1.7 in market · legalstablesure.com · Play Store'},
        {label: 'Footprint', value: 'Android APK + AAB · Fastify API · static landing'},
        {label: 'Pipeline', value: 'Manual Android workflow · path-triggered website deploy'},
        {label: 'Audit', value: 'Crash reports, AI usage caps, Stripe-driven tier state'},
    ]),
]));
sections.push(sec1('cv-sec-lss-stats', 'LSS', [
    item('STATS_STRIP', 'default', {
        cells: [
            {value: '13', unit: 'models', label: 'prisma schema', highlight: true},
            {value: '7', unit: 'locales', label: 'hand-translated'},
            {value: '$13', unit: '/mo', label: 'all-in droplet'},
            {value: '~3', unit: 'min', label: 'push → live'},
            {value: 'EU', label: 'region · gdpr'},
        ],
    }),
]));

sections.push(sec1('cv-sec-lss-arch-head', 'LSS', [
    heading('<h2>§ A · Architecture</h2><p><em>device-first · server is a thin shim</em></p>'
        + '<p><b>The phone owns the data.</b> Every CRUD entity — bookings, clients, invoices, expenses, cases — lives in <code>expo-sqlite</code> on the device. The app is fully usable offline; the server exists only for things the phone genuinely cannot do alone.</p>'
        + '<p>The Fastify backend handles only <em>auth</em>, <em>legal-content sync</em>, the <em>AI proxy</em>, <em>Stripe webhooks</em>, and <em>crash reports</em>. Three apps share one TypeScript contract via <code>packages/shared</code> — types and constants both sides agree on.</p>'),
]));
sections.push(sec1('cv-sec-lss-tiers', 'LSS', [
    item('ARCHITECTURE_TIERS', 'default', {
        eyebrow: '§ A / TIERS',
        title: 'Device-first, server is a thin shim.',
        subtitle: 'Mobile · server · third-party — clean tiers, one shared contract.',
        intro: 'Every CRUD entity lives in expo-sqlite on the device. The server only handles auth, legal-content sync, the AI proxy, Stripe webhooks and crash reports. Three apps share one TypeScript contract via packages/shared.',
        tiers: [
            {ord: 'A.01', concern: 'DEVICE', role: 'Owns the data', title: 'apps/mobile/', description: 'Expo + React Native. SQLite via expo-sqlite; web falls back to an in-memory mock. Fully usable offline.',
                pills: ['Expo SDK 52', 'RN 0.76', 'Paper MD3', 'Zustand', '7 locales'],
                modules: [
                    {label: 'src/db/sqlite', tag: 'TS'},
                    {label: 'src/screens', tag: 'TSX'},
                    {label: 'src/state/zustand', tag: 'TS'},
                    {label: 'src/i18n', tag: 'TS'},
                    {label: 'app.config.ts', tag: 'TS'},
                ]},
            {ord: 'A.02', concern: 'SERVER', role: 'Identity + sync only', title: 'apps/api/', description: 'Fastify 4 + Prisma. Deliberately small: auth, legal-content sync, AI proxy, Stripe webhooks, crash reports. Never sees practice data.',
                pills: ['Fastify 4', 'Prisma 5', 'Argon2', 'Zod', '13 models'],
                modules: [
                    {label: 'src/routes/auth', tag: 'TS'},
                    {label: 'src/routes/ai', tag: 'TS'},
                    {label: 'src/routes/legal', tag: 'TS'},
                    {label: 'prisma/schema.prisma', tag: 'PRISMA'},
                    {label: 'src/cron/eurlex', tag: 'TS'},
                ]},
            {ord: 'A.03', concern: 'EXTERNAL', role: 'Vendors + integrations', title: '3rd-party/', description: 'Outbound HTTP only. Each integration in its own folder so a swap (or mock) is one import.',
                pills: ['OpenRouter', 'Stripe', 'Resend', 'EUR-Lex', 'AdMob'],
                modules: [
                    {label: 'src/3rd/openrouter', tag: 'TS'},
                    {label: 'src/3rd/stripe', tag: 'TS'},
                    {label: 'src/3rd/resend', tag: 'TS'},
                    {label: 'src/3rd/eurlex', tag: 'TS'},
                    {label: 'src/3rd/admob', tag: 'TS'},
                ]},
        ],
        sharedTitle: 'packages/shared/',
        sharedDescription: 'One TypeScript contract for all three apps. Types, enums, Zod schemas — both sides compile against the same source.',
        sharedPills: ['types/', 'enums/', 'zod/', 'constants/'],
        lifecycleLabel: 'A.04 · Request lifecycle',
        lifecycleNote: 'A single AI request walks every tier in <800 ms p95.',
        lifecycleSteps: [
            {n: '01', title: 'Tap', sub: 'Mobile screen'},
            {n: '02', title: 'Sign', sub: 'JWT in header'},
            {n: '03', title: 'Fastify', sub: 'Route + Zod parse'},
            {n: '04', title: 'Tier check', sub: 'AI quota + bonus', highlight: true},
            {n: '05', title: 'OpenRouter', sub: 'PII-stripped'},
            {n: '06', title: 'Persist', sub: 'AiUsage++ · SQLite'},
            {n: '07', title: 'Reply', sub: 'Mobile renders'},
        ],
    }),
]));

sections.push(sec1('cv-sec-lss-stack-head', 'LSS', [
    heading('<h2>§ B · Key technologies</h2><p><em>12 entries · production-shipping</em></p>'),
]));
sections.push(sec1('cv-sec-lss-stack', 'LSS', [
    item('LIST', 'paper-grid', {
        title: '',
        items: [
            {prefix: 'B.01', label: 'Mobile runtime', value: 'Expo 52 · bare-friendly · expo prebuild in CI generates the Android project · APK + AAB by GitHub workflow'},
            {prefix: 'B.02', label: 'UI runtime', value: 'React Native 0.76 · Hermes · new architecture opt-in · one Paper family · one navigation library'},
            {prefix: 'B.03', label: 'Component lib', value: 'RN Paper · Material Design 3 · one PaperProvider at root · dark mode (PRO) flips a single token'},
            {prefix: 'B.04', label: 'On-device DB', value: 'expo-sqlite · all CRUD entities · singleton connection + per-entity repository · web swaps in in-memory mock'},
            {prefix: 'B.05', label: 'State', value: 'Zustand · tiny stores for cross-screen UI only — auth, theme, language, ad bonuses'},
            {prefix: 'B.06', label: 'Server runtime', value: 'Fastify 4 · plugin tree mirrors route tree · Pino + central error handler maps Zod / ApiError / 500'},
            {prefix: 'B.07', label: 'ORM', value: 'Prisma 5 · SQLite in dev and prod · 13 models · single schema.prisma · dev DB checked in for shape'},
            {prefix: 'B.08', label: 'Hashing', value: 'Argon2id · sane defaults · password reset uses a Resend HTTP send — no SMTP cred on the box'},
            {prefix: 'B.09', label: 'Billing', value: 'Stripe · checkout + customer portal via expo-web-browser · webhook is truth for tier · verify-session UX only'},
            {prefix: 'B.10', label: 'AI', value: 'OpenRouter · single proxy endpoint · PII stripped before logging · tier limits + ad bonuses checked here'},
            {prefix: 'B.11', label: 'i18n', value: 'i18next · 7 hand-translated locales (EN · DE · FR · ES · NL · LV · RU) · country sets default at signup'},
            {prefix: 'B.12', label: 'Email', value: 'Resend · HTTP API only · three templates — password reset, welcome, account-deletion confirmation'},
        ],
    }),
]));

sections.push(sec1('cv-sec-lss-data-head', 'LSS', [
    heading('<h2>§ C · Data model</h2><p><em>13 Prisma models · device SQLite mirrors a subset</em></p>'),
]));
sections.push(sec1('cv-sec-lss-datamodel', 'LSS', [
    item('DATA_MODEL', 'default', {
        eyebrow: '§ C / SCHEMA',
        title: 'Data model',
        subtitle: 'Practice data on device · identity, tier, AI usage, EUR-Lex on server.',
        fields: [
            {name: 'User', type: 'server', nullable: 'no', notes: 'Email · Argon2 hash · tier · country · language · stripeCustomerId'},
            {name: 'RefreshToken', type: 'server', nullable: 'no', notes: 'Rotating JWT family · revoke on reuse'},
            {name: 'PasswordReset', type: 'server', nullable: 'no', notes: 'Single-use code · 30-min TTL'},
            {name: 'EmailChange', type: 'server', nullable: 'no', notes: 'Pending email · verification token'},
            {name: 'Booking', type: 'device', nullable: 'no', notes: 'Hearing · meeting · deadline · linkable to client + case'},
            {name: 'Client', type: 'device', nullable: 'no', notes: 'Person or company · contact · linked cases'},
            {name: 'Case', type: 'device', nullable: 'no', notes: 'Matter file · party list · jurisdiction · status'},
            {name: 'Invoice', type: 'device', nullable: 'no', notes: 'Line items · VAT · status · PDF render slot'},
            {name: 'Expense', type: 'device', nullable: 'no', notes: 'Receipt · category · linked case'},
            {name: 'TimeEntry', type: 'device', nullable: 'no', notes: 'Billable hours · client + case ref'},
            {name: 'LegalUpdate', type: 'server→device', nullable: 'no', notes: 'EUR-Lex CELLAR delta · severity · jurisdiction'},
            {name: 'AiUsage', type: 'server', nullable: 'no', notes: 'Per-user counter · resets daily · ad-bonus offset'},
            {name: 'CrashReport', type: 'server', nullable: 'no', notes: 'Sentry-lite · stack · device · build · user opt-in'},
        ],
        collections: [
            {name: '7 device entities', count: 'SQLite on phone'},
            {name: '6 server models', count: 'Prisma · SQLite WAL'},
            {name: 'Tier axes', count: 'FREE · PRO · 10 vs 200 AI/day'},
        ],
        audits: [
            {title: 'Device-owned vs. server-owned.', body: 'All practice data — bookings, clients, cases, invoices, expenses, time — lives only on the device. The server never sees it. The server owns: identity, tier, AI usage counters, EUR-Lex feed, Stripe state, opt-in crash reports.', tag: 'PRIVACY'},
            {title: 'Tier enforcement.', body: 'A Stripe webhook is the only writer of user.tier. AI / PDF / dark-mode gates check JWT-embedded tier on every call; device caches tier so PRO features stay available offline until JWT refresh.', tag: 'PASS'},
            {title: 'Capability matrix.', body: 'FREE: 10 AI / day. PRO: 200 AI / day · dark mode · PDF export · EUR-Lex digest · case linking. +5 AI per rewarded ad. Multi-device sync on roadmap.', tag: 'TIERS'},
        ],
    }),
]));

sections.push(sec1('cv-sec-lss-infra-head', 'LSS', [
    heading('<h2>§ D · Infrastructure</h2><p><em>single droplet · SQLite on disk · stores publish on tag</em></p>'),
]));
sections.push(sec1('cv-sec-lss-infra', 'LSS', [
    item('INFRA_TOPOLOGY', 'default', {
        eyebrow: '§ D / TOPOLOGY',
        title: 'One droplet, two distribution surfaces',
        subtitle: 'EU-region SQLite + Prisma. $13/mo all-in. Stores get AAB + IPA on tag; web export goes to Caddy.',
        droplets: [
            {name: 'Droplet · api.peaches.legal', role: 'SERVER', specs: ['DO · FRA · 2 GB · 1 vCPU', '$12 / mo', 'EU region (GDPR)', 'UFW · 22/80/443'],
                services: ['Edge: Caddy · TLS · LE auto-renew · HSTS', 'App: PM2 → fastify · cluster:1', 'DB: SQLite via Prisma · WAL mode · single file', 'Cron: EUR-Lex CELLAR delta · 06:00 UTC', 'Backup: cron sqlite3 .backup · 30d retention', 'Snap: DO weekly droplet snapshot · $1.20/mo']},
            {name: 'Distribution · the apps', role: 'CLIENT', specs: ['EAS-free', 'tag → store', 'OTA · web preview'],
                services: ['Android: CI builds AAB + APK · uploaded to Play Console · closed test', 'iOS: Mac runner · archive · TestFlight upload · manual review', 'Web: Expo web export → static → Caddy on droplet · /app/*', 'OTA: JS-only updates via expo-updates channel · prod · staging', 'Marketing: Next.js static → Cloudflare Pages · peaches.legal', 'Crash sink: Server /v1/crash → SQLite · admin tail script · opt-in']},
        ],
        svg: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 920 220'><defs><pattern id='hatch' width='6' height='6' patternUnits='userSpaceOnUse' patternTransform='rotate(45)'><line x1='0' y1='0' x2='0' y2='6' stroke='currentColor' stroke-width='0.6' opacity='0.18'/></pattern><marker id='arrowhead' viewBox='0 0 10 10' refX='9' refY='5' markerWidth='7' markerHeight='7' orient='auto'><path d='M0,0 L10,5 L0,10 z' fill='currentColor'/></marker></defs><g fill='none' stroke='currentColor' stroke-width='1' font-family='monospace' font-size='10'><rect x='20' y='80' width='120' height='60'/><text x='80' y='105' text-anchor='middle' stroke='none' font-size='11'>PHONE</text><text x='80' y='123' text-anchor='middle' stroke='none' opacity='0.6' font-size='9'>RN · SQLite local</text><rect x='200' y='80' width='120' height='60' fill='url(#hatch)'/><text x='260' y='105' text-anchor='middle' stroke='none' font-size='11'>CADDY</text><text x='260' y='123' text-anchor='middle' stroke='none' opacity='0.6' font-size='9'>:443 TLS · :80</text><rect x='380' y='20' width='160' height='60'/><text x='460' y='45' text-anchor='middle' stroke='none' font-size='11'>fastify (PM2)</text><text x='460' y='63' text-anchor='middle' stroke='none' opacity='0.6' font-size='9'>/v1/auth · /v1/ai · /v1/legal</text><rect x='380' y='140' width='160' height='60'/><text x='460' y='165' text-anchor='middle' stroke='none' font-size='11'>cron · eurlex sync</text><text x='460' y='183' text-anchor='middle' stroke='none' opacity='0.6' font-size='9'>CELLAR delta · 06:00 UTC</text><rect x='620' y='80' width='140' height='60' fill='url(#hatch)'/><text x='690' y='105' text-anchor='middle' stroke='none' font-size='11'>SQLite (Prisma)</text><text x='690' y='123' text-anchor='middle' stroke='none' opacity='0.6' font-size='9'>single file · WAL mode</text><rect x='800' y='80' width='100' height='60' stroke-dasharray='4 3'/><text x='850' y='105' text-anchor='middle' stroke='none' font-size='11'>.backup</text><text x='850' y='123' text-anchor='middle' stroke='none' opacity='0.6' font-size='9'>cron 04:00</text><line x1='140' y1='110' x2='200' y2='110' marker-end='url(#arrowhead)' stroke='currentColor'/><line x1='320' y1='100' x2='380' y2='55' marker-end='url(#arrowhead)'/><line x1='320' y1='120' x2='380' y2='170' marker-end='url(#arrowhead)'/><line x1='540' y1='50' x2='620' y2='100' marker-end='url(#arrowhead)'/><line x1='540' y1='170' x2='620' y2='120' marker-end='url(#arrowhead)'/><line x1='760' y1='110' x2='800' y2='110' marker-end='url(#arrowhead)' stroke-dasharray='3 3'/><rect x='180' y='0' width='600' height='220' stroke-dasharray='2 4' opacity='0.6'/><text x='190' y='14' stroke='none' opacity='0.55' font-size='9'>DROPLET · 2 GB · UBUNTU 24.04 LTS · EU</text></g></svg>",
        caption: 'Caddy terminates TLS at :443. PM2 supervises Fastify. SQLite is a single WAL-mode file backed up nightly via cron sqlite3 .backup with 30d retention.',
    }),
]));

sections.push(sec1('cv-sec-lss-repo-head', 'LSS', [
    heading('<h2>§ E · Repository</h2><p><em>~600 source files · feature-sliced · click any node</em></p>'),
]));
sections.push(sec1('cv-sec-lss-repo', 'LSS', [
    item('REPO_TREE', 'default', {
        eyebrow: '§ E / REPO',
        title: 'Repository tree',
        subtitle: `${repoNodesLss.length} nodes · click to inspect`,
        nodes: repoNodesLss,
    }),
]));

sections.push(sec1('cv-sec-lss-pipeline-head', 'LSS', [
    heading('<h2>§ F · Continuous deployment</h2><p><em>GitHub Actions · server on push · stores on tag</em></p>'),
]));
sections.push(sec1('cv-sec-lss-pipeline', 'LSS', [
    item('PIPELINE_FLOW', 'default', {
        eyebrow: '§ F / DELIVERY',
        title: 'CI / CD pipeline',
        subtitle: 'Server on push to main · mobile on tag v*.*.* · OTA channel for JS-only fixes.',
        steps: [
            {name: 'Push / tag', meta: '~0s · trigger', status: 'ok', detail: 'Commit lands on main → server pipeline. Tag v*.*.* → mobile pipeline. PRs run the shared shape-check job only.'},
            {name: 'Install', meta: '~30s · cached', status: 'ok', detail: 'pnpm install --frozen-lockfile on Node 20 with pnpm store cache. Workspace install pulls all three apps + packages/shared in one pass.'},
            {name: 'Typecheck', meta: '~25s · strict', status: 'ok', detail: 'pnpm -r typecheck across mobile + api + shared. Strict TS everywhere; shared/types is the contract both sides compile against.'},
            {name: 'Test', meta: '~50s · vitest', status: 'ok', detail: 'pnpm -r test --reporter=dot. 69 vitest specs on shared; route + service tests on api; repository tests on mobile with the in-memory SQLite shim.'},
            {name: 'Server deploy', meta: '~70s · main only', status: 'ok', detail: 'SSH into the FRA droplet via appleboy/ssh-action. git pull → pnpm i --prod → prisma migrate deploy → pm2 reload fastify. Zero-downtime reload.'},
            {name: 'Mobile build', meta: '~9 min · tag only', status: 'ok', detail: 'expo prebuild → Gradle :app:bundleRelease + :app:assembleRelease. Mac runner archives the iOS scheme. Artefacts uploaded to the run.'},
            {name: 'Store upload', meta: '~3 min · then review', status: 'warn', detail: 'AAB → Play Console (closed test track) via r0adkll/upload-google-play. IPA → TestFlight via xcrun altool. Store review remains manual.'},
        ],
        sideNotes: [
            'main → server. Every push deploys api.peaches.legal in ~3 minutes; prisma migrate deploy runs as part of the same SSH job.',
            'tag v*.*.* → mobile. Bumps Android versionCode + iOS build number from the tag, builds AAB / IPA, ships to closed test tracks.',
            'OTA channel. JS-only fixes go out via expo-updates publish --channel prod without a store round-trip.',
            'Idempotent bootstrap. Node, pnpm, Caddy, fail2ban, sshd hardening installed only if missing — first run sets up the box, subsequent runs no-op.',
            'SSH flood protection. MaxStartups 100:30:200 + fail2ban so scanner traffic doesn\'t evict GHA\'s handshake.',
            'Rollback path. git revert + push redeploys server in 3 min; mobile pins to the previous OTA bundle by channel rollback.',
        ],
    }),
]));

sections.push(sec1('cv-sec-lss-closing-head', 'LSS', [
    heading('<h2>§ G · Closing notes</h2><p><em>handoff · references · back to dossier</em></p>'),
]));
sections.push(sec3('cv-sec-lss-closing-grid', 'LSS', [1, 1, 1], [
    item('LIST', 'facts', {
        title: "What's interesting here",
        items: [
            {label: '—', value: 'Device-first data model. Practice data never reaches the server.'},
            {label: '—', value: 'One TypeScript contract — packages/shared — binds 3 apps.'},
            {label: '—', value: 'Tier enforcement only at the JWT-issuing edge; webhook is truth.'},
            {label: '—', value: 'EU-region SQLite + Prisma — $13/mo all-in for the backend.'},
            {label: '—', value: 'OTA channel ships JS-only fixes without a store round-trip.'},
        ],
    }),
    item('LIST', 'facts', {
        title: 'Live',
        items: [
            {label: 'Marketing', value: 'peaches.legal ↗', href: 'https://peaches.legal'},
            {label: 'Web app', value: 'app.peaches.legal ↗', href: 'https://app.peaches.legal'},
            {label: 'Production', value: 'legalstablesure.com ↗', href: 'https://legalstablesure.com'},
            {label: 'API', value: 'api.peaches.legal · JWT-gated'},
            {label: 'Stores', value: 'Play closed test · TestFlight'},
        ],
    }),
    item('LIST', 'facts', {
        title: 'Source paths',
        items: [
            {label: 'Mobile', value: 'apps/mobile/src/'},
            {label: 'API routes', value: 'apps/api/src/routes/'},
            {label: 'Schema', value: 'apps/api/prisma/schema.prisma'},
            {label: 'Shared', value: 'packages/shared/src/types/'},
            {label: 'Docs', value: 'docs/architecture/'},
            {label: 'CI', value: '.github/workflows/ci.yml'},
        ],
    }),
]));

// --- Bundle envelope -------------------------------------------------------
const bundle = {
    manifest: {
        version: 1,
        exportedAt: new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z'),
        app: 'redis-node-js-cloud',
        note: 'CV Bundle (design-v7) — three-page editorial dossier on the Paper theme: Home (Dossier), Contact, CMS case study. Generated by scripts/buildCvBundle.cjs from public/CV/v2 mockups.',
    },
    site: {
        siteFlags: {blogEnabled: false, layoutMode: 'tabs'},
        siteSeo: {
            title: 'Gatis Priede — Dossier · Architect · AI-driven CMS · Engineer',
            description: 'Editorial portfolio of Gatis Priede — Digital Solutions Architect and Senior JavaScript Engineer. 15+ years building React/Next.js/Node products, GraphQL data layers, 3D/WebGL surfaces, and an AI-driven editorial CMS designed as a content language an LLM can author with — beautiful, complex, fully editable sites generated within minutes. Includes the funisimo CMS case study and the Legal Stable Sure architecture dossier.',
            keywords: ['Gatis Priede','portfolio','digital solutions architect','senior javascript engineer','ai cms','ai content authoring','llm cms','schema-first cms','headless cms','react','next.js','node.js','typescript','graphql','mongodb','expo','react native','fastify','sqlite','cms','legal stable sure','case study','sigulda','latvia','remote'],
            author: 'Gatis Priede',
            url: 'https://funisimo.pro/',
            image: '/images/20260415_142341.jpg',
            image_alt: 'Portrait of Gatis Priede',
            locale: 'en',
            viewport: 'width=device-width,initial-scale=1',
            charSet: 'utf-8',
        },
        activeThemeId: 'paper-v5-preset-v1',
        themes: [{
            id: 'paper-v5-preset-v1', name: 'Paper (v5)', custom: false,
            tokens: {
                colorPrimary: '#c65a2a', colorBgBase: '#f7f3e8', colorTextBase: '#1f1b15',
                colorSuccess: '#52c41a', colorWarning: '#faad14', colorError: '#ff4d4f', colorInfo: '#1f3a8a',
                colorBgInset: 'oklch(0.945 0.012 82)', colorInkSecondary: 'oklch(0.36 0.01 60)', colorInkTertiary: 'oklch(0.55 0.008 60)',
                colorRule: 'oklch(0.82 0.012 70)', colorRuleStrong: 'oklch(0.62 0.012 60)',
                colorAccent: 'oklch(0.58 0.17 35)', colorAccentInk: 'oklch(0.98 0.008 85)', colorMark: 'oklch(0.58 0.17 35 / 0.14)',
                fontDisplay: "'Instrument Serif', ui-serif, Georgia, serif",
                fontMono: "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace",
                fontSans: "'Inter Tight', system-ui, -apple-system, 'Segoe UI', sans-serif",
                borderRadius: 0, fontSize: 15, contentPadding: 28, themeSlug: 'paper',
            },
        }],
        navigation: [
            {id: 'cv-nav-home', type: 'navigation', page: 'Home',
                seo: {
                    title: 'Gatis Priede — Digital Solutions Architect · Senior JavaScript Engineer',
                    description: 'Editorial dossier for Gatis Priede — Digital Solutions Architect and Senior JavaScript Engineer based in Sigulda, Latvia. 15+ years across React, Next.js, Node.js, GraphQL, 3D/WebGL and large-data front-ends. Career timeline, capability matrix, contact.',
                    keywords: ['Gatis Priede','portfolio','digital solutions architect','senior javascript engineer','react','next.js','node.js','graphql','typescript','scichart','webgl','remote engineer','sigulda','latvia','consultant'],
                    viewport: 'width=device-width,initial-scale=1', charSet: 'utf-8',
                    url: 'https://funisimo.pro/',
                    image: '/images/20260415_142341.jpg',
                    image_alt: 'Portrait of Gatis Priede — Digital Solutions Architect',
                    author: 'Gatis Priede', locale: 'en',
                },
                sections: sections.filter(s => s.page === 'Home').map(s => s.id)},
            {id: 'cv-nav-contact', type: 'navigation', page: 'Contact',
                seo: {
                    title: 'Contact — Gatis Priede · Consulting & Engineering',
                    description: 'Get in touch with Gatis Priede for consulting, engineering and architecture engagements. Reply within one working day, EET hours. Inquiry form, channels (LinkedIn · GitHub · email) and engagement terms.',
                    keywords: ['contact gatis priede','hire javascript engineer','consulting','remote engineer','architecture consulting','funisimo','support@funisimo.pro','linkedin','github'],
                    viewport: 'width=device-width,initial-scale=1', charSet: 'utf-8',
                    url: 'https://funisimo.pro/contact',
                    image: '/images/20260415_142341.jpg',
                    image_alt: 'Portrait of Gatis Priede',
                    author: 'Gatis Priede', locale: 'en',
                },
                sections: sections.filter(s => s.page === 'Contact').map(s => s.id)},
            {id: 'cv-nav-cms', type: 'navigation', page: 'CMS',
                seo: {
                    title: 'CMS — Built for AI · A content language for LLMs · Case study',
                    description: 'funisimo is a CMS built for AI to use as a content language — a small declarative grammar of pages, sections, items and styles an LLM can author end-to-end. One prompt, one bundle: a beautiful, complex, fully editable site generated within minutes. Case study covers schema-first item types, architecture tiers, 12-entry tech stack, 10-collection data model with audit triplet, two-droplet infra and 7-stage CI/CD pipeline.',
                    keywords: ['ai cms','ai content authoring','llm cms','schema-first cms','generate site with ai','editable site generation','cms case study','next.js cms','mongodb','graphql','apollo','editorial cms','multi-tenant','headless cms','architecture','digitalocean','caddy','pm2','docker','funisimo'],
                    viewport: 'width=device-width,initial-scale=1', charSet: 'utf-8',
                    url: 'https://funisimo.pro/cms',
                    image: '/images/20260415_142341.jpg',
                    image_alt: 'CMS architecture · two droplets, one codebase',
                    author: 'Gatis Priede', locale: 'en',
                },
                sections: sections.filter(s => s.page === 'CMS').map(s => s.id)},
            {id: 'cv-nav-lss', type: 'navigation', page: 'LSS',
                seo: {
                    title: 'Legal Stable Sure — Architecture dossier · Expo · Fastify · SQLite',
                    description: 'Architecture dossier for Legal Stable Sure (peaches) — a device-first legal compliance app for European freelancers and small firms. Built on Expo SDK 52 + React Native 0.76 with on-device SQLite, a Fastify 4 + Prisma server, and a single $13/mo EU droplet. 7 hand-translated locales, Stripe-driven tier state, EUR-Lex CELLAR delta sync.',
                    keywords: ['legal stable sure','legalstablesure','peaches','expo','react native','fastify','prisma','sqlite','device-first','eur-lex','stripe','digitalocean','android','testflight','openrouter','i18next','case study','architecture'],
                    viewport: 'width=device-width,initial-scale=1', charSet: 'utf-8',
                    url: 'https://legalstablesure.com/',
                    image: '/images/20260415_142341.jpg',
                    image_alt: 'Legal Stable Sure — architecture dossier',
                    author: 'Gatis Priede', locale: 'en',
                },
                sections: sections.filter(s => s.page === 'LSS').map(s => s.id)},
        ],
        sections,
        languages: [
            {label: 'English', symbol: 'en', default: true, flag: '🇬🇧'},
            {label: 'Latviešu', symbol: 'lv', flag: '🇱🇻'},
        ],
        logo: null,
        images: [],
        posts: [],
        footer: {enabled: true, columns: [], bottom: '© 2026 · Gatis Priede · Everything is possible.'},
    },
    assets: {},
};

const out = JSON.stringify(bundle, null, 2) + '\n';
fs.writeFileSync(OUT, out);
fs.writeFileSync(OUT_CV, out);
console.log(`[buildCvBundle] wrote ${OUT}`);
console.log(`[buildCvBundle] wrote ${OUT_CV}`);
console.log(`  navs: ${bundle.site.navigation.length}, sections: ${bundle.site.sections.length}, repo nodes: cms=${repoNodes.length} lss=${repoNodesLss.length}`);
