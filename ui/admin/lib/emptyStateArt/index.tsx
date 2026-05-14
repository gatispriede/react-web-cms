/**
 * admin-empty-states-onboarding — operator-grade empty-state illustration set.
 *
 * One lightweight inline-SVG illustration per admin surface, keyed by a
 * stable `EmptyStateArtKey`. These are intentionally simple, single-accent
 * line illustrations (not the hand-drawn Stitch set the spec earmarks as
 * wall-clock design work) — but they read as *designed* rather than the
 * bare AntD glyph the first pass shipped: consistent 240×180 frame, theme
 * `currentColor` stroke so they track light/dark mode, one accent fill.
 *
 * Why inline SVG and not files: keeps the set in one reviewable place,
 * tree-shakes with the bundle, and inherits `color` from `EmptyState` so
 * dark-mode "just works" with zero asset duplication.
 *
 * Adding a surface: add a key to `EmptyStateArtKey`, add a renderer to
 * `ART`, done. `EmptyState` falls back to `generic` for unknown keys.
 */
import React from 'react';

export type EmptyStateArtKey =
    | 'pages'
    | 'posts'
    | 'products'
    | 'themes'
    | 'users'
    | 'orders'
    | 'inventory'
    | 'customers'
    | 'inquiries'
    | 'trash'
    | 'audit'
    | 'errors'
    | 'mcp'
    | 'languages'
    | 'generic';

/** Shared SVG frame — 240×180 viewBox, inherits `currentColor`. */
const Frame: React.FC<{children: React.ReactNode; label: string}> = ({children, label}) => (
    <svg
        width={200}
        height={150}
        viewBox="0 0 240 180"
        fill="none"
        role="img"
        aria-label={label}
        xmlns="http://www.w3.org/2000/svg"
        style={{color: 'var(--ant-color-text-quaternary, #bfbfbf)'}}
    >
        {children}
    </svg>
);

const ACCENT = 'var(--ant-color-primary, #1677ff)';
const stroke = {stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const};

/** A stacked "document" motif reused by content surfaces. */
const docStack = (
    <>
        <rect x="78" y="44" width="84" height="100" rx="6" fill="var(--ant-color-bg-container, #fff)" {...stroke}/>
        <line x1="94" y1="68" x2="146" y2="68" {...stroke}/>
        <line x1="94" y1="88" x2="146" y2="88" {...stroke}/>
        <line x1="94" y1="108" x2="128" y2="108" {...stroke}/>
    </>
);

const ART: Record<EmptyStateArtKey, React.ReactNode> = {
    pages: (
        <Frame label="No pages">
            {docStack}
            <circle cx="160" cy="132" r="18" fill={ACCENT}/>
            <line x1="160" y1="124" x2="160" y2="140" stroke="#fff" strokeWidth={3} strokeLinecap="round"/>
            <line x1="152" y1="132" x2="168" y2="132" stroke="#fff" strokeWidth={3} strokeLinecap="round"/>
        </Frame>
    ),
    posts: (
        <Frame label="No posts">
            {docStack}
            <path d="M150 116 l24 -24 a6 6 0 0 1 8 8 l-24 24 -12 4 z" fill={ACCENT} stroke={ACCENT} {...stroke}/>
        </Frame>
    ),
    products: (
        <Frame label="No products">
            <path d="M84 70 l36 -20 36 20 v44 l-36 20 -36 -20 z" fill="var(--ant-color-bg-container, #fff)" {...stroke}/>
            <path d="M84 70 l36 20 36 -20" {...stroke}/>
            <line x1="120" y1="90" x2="120" y2="134" {...stroke}/>
            <circle cx="120" cy="50" r="10" fill={ACCENT}/>
        </Frame>
    ),
    themes: (
        <Frame label="No themes">
            <circle cx="120" cy="92" r="44" fill="var(--ant-color-bg-container, #fff)" {...stroke}/>
            <path d="M120 48 a44 44 0 0 1 0 88 z" fill={ACCENT}/>
            <circle cx="104" cy="78" r="6" fill="currentColor"/>
        </Frame>
    ),
    users: (
        <Frame label="No team">
            <circle cx="120" cy="76" r="18" fill="var(--ant-color-bg-container, #fff)" {...stroke}/>
            <path d="M88 134 a32 32 0 0 1 64 0" fill="var(--ant-color-bg-container, #fff)" {...stroke}/>
            <circle cx="166" cy="86" r="12" fill={ACCENT}/>
            <path d="M148 132 a20 20 0 0 1 36 0" stroke={ACCENT} {...stroke} fill="none"/>
        </Frame>
    ),
    orders: (
        <Frame label="No orders">
            <path d="M80 64 h80 l-8 70 h-64 z" fill="var(--ant-color-bg-container, #fff)" {...stroke}/>
            <path d="M100 64 v-8 a20 20 0 0 1 40 0 v8" {...stroke}/>
            <circle cx="120" cy="100" r="8" fill={ACCENT}/>
        </Frame>
    ),
    inventory: (
        <Frame label="No warehouse connected">
            <path d="M72 96 l48 -32 48 32 v44 h-96 z" fill="var(--ant-color-bg-container, #fff)" {...stroke}/>
            <rect x="104" y="110" width="32" height="30" {...stroke}/>
            <circle cx="168" cy="64" r="12" fill={ACCENT}/>
            <path d="M120 64 h36" stroke={ACCENT} strokeWidth={3} strokeDasharray="2 6" strokeLinecap="round"/>
        </Frame>
    ),
    customers: (
        <Frame label="No customers">
            <circle cx="120" cy="78" r="20" fill="var(--ant-color-bg-container, #fff)" {...stroke}/>
            <path d="M84 138 a36 36 0 0 1 72 0" fill="var(--ant-color-bg-container, #fff)" {...stroke}/>
            <path d="M156 56 l6 12 13 2 -9 9 2 13 -12 -6 -12 6 2 -13 -9 -9 13 -2 z" fill={ACCENT}/>
        </Frame>
    ),
    inquiries: (
        <Frame label="No inquiries">
            <rect x="74" y="62" width="92" height="64" rx="6" fill="var(--ant-color-bg-container, #fff)" {...stroke}/>
            <path d="M74 68 l46 36 46 -36" {...stroke}/>
            <circle cx="166" cy="62" r="12" fill={ACCENT}/>
        </Frame>
    ),
    trash: (
        <Frame label="Trash empty">
            <path d="M86 70 h68 l-6 70 h-56 z" fill="var(--ant-color-bg-container, #fff)" {...stroke}/>
            <line x1="78" y1="70" x2="162" y2="70" {...stroke}/>
            <path d="M104 70 v-8 h32 v8" {...stroke}/>
            <line x1="108" y1="86" x2="110" y2="124" {...stroke}/>
            <line x1="132" y1="86" x2="130" y2="124" {...stroke}/>
        </Frame>
    ),
    audit: (
        <Frame label="No audit events">
            <rect x="80" y="50" width="80" height="92" rx="6" fill="var(--ant-color-bg-container, #fff)" {...stroke}/>
            <line x1="96" y1="74" x2="144" y2="74" {...stroke}/>
            <line x1="96" y1="94" x2="144" y2="94" {...stroke}/>
            <line x1="96" y1="114" x2="124" y2="114" {...stroke}/>
            <circle cx="156" cy="118" r="20" fill="none" stroke={ACCENT} strokeWidth={3}/>
            <line x1="170" y1="132" x2="182" y2="144" stroke={ACCENT} strokeWidth={3} strokeLinecap="round"/>
        </Frame>
    ),
    errors: (
        <Frame label="No errors recorded">
            <path d="M120 50 l44 80 h-88 z" fill="var(--ant-color-bg-container, #fff)" {...stroke}/>
            <line x1="120" y1="86" x2="120" y2="106" {...stroke}/>
            <circle cx="120" cy="118" r="3" fill="currentColor"/>
            <path d="M150 60 l8 8 m0 -8 l-8 8" stroke={ACCENT} strokeWidth={3} strokeLinecap="round"/>
        </Frame>
    ),
    mcp: (
        <Frame label="No tools enabled">
            <rect x="86" y="64" width="68" height="68" rx="10" fill="var(--ant-color-bg-container, #fff)" {...stroke}/>
            <circle cx="120" cy="98" r="14" {...stroke}/>
            <line x1="120" y1="64" x2="120" y2="54" {...stroke}/>
            <line x1="120" y1="132" x2="120" y2="142" {...stroke}/>
            <line x1="86" y1="98" x2="76" y2="98" {...stroke}/>
            <line x1="154" y1="98" x2="164" y2="98" {...stroke}/>
            <circle cx="120" cy="98" r="5" fill={ACCENT}/>
        </Frame>
    ),
    languages: (
        <Frame label="Add languages">
            <circle cx="120" cy="92" r="42" fill="var(--ant-color-bg-container, #fff)" {...stroke}/>
            <ellipse cx="120" cy="92" rx="18" ry="42" {...stroke}/>
            <line x1="78" y1="92" x2="162" y2="92" {...stroke}/>
            <line x1="86" y1="70" x2="154" y2="70" {...stroke}/>
            <line x1="86" y1="114" x2="154" y2="114" {...stroke}/>
            <circle cx="158" cy="58" r="10" fill={ACCENT}/>
        </Frame>
    ),
    generic: (
        <Frame label="Nothing here yet">
            <rect x="78" y="56" width="84" height="76" rx="8" fill="var(--ant-color-bg-container, #fff)" {...stroke}/>
            <line x1="78" y1="80" x2="162" y2="80" {...stroke}/>
            <circle cx="120" cy="106" r="14" {...stroke}/>
        </Frame>
    ),
};

/** Resolve an illustration by key, falling back to the generic motif. */
export function emptyStateArt(key: EmptyStateArtKey | undefined): React.ReactNode {
    return ART[key ?? 'generic'] ?? ART.generic;
}
