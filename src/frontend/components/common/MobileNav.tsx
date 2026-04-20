import React, {useCallback, useEffect, useRef, useState} from 'react';

/**
 * Mobile-only collapsible public-site navigation. Mirrors the design-v5 Portfolio.html
 * reference: at `≤ 720 px` the full top-bar nav is hidden (see `scss/global.scss`
 * `.site-tabs` media rules) and this component renders in its place as:
 *
 *   [ {activeLabel} ▾ ]  (trigger button)
 *   --- panel below ---
 *   01  HOME
 *   02  WORK
 *   03  VOICES
 *   …
 *
 * The panel expands inline (no portal) so keyboard focus flows naturally. Tapping
 * a link closes the panel via `onNavigate` — the parent owns the actual routing
 * (push to `/voices`, scroll to `#voices`, etc.) so this component stays layout-
 * agnostic between the Tabs and ScrollNav modes.
 */
export interface MobileNavLink {
    /** Short display label (already translated). */
    label: string;
    /** Target href or anchor for the link. */
    href: string;
    /** Stable identifier used for active-state comparison. */
    key: string;
}

interface MobileNavProps {
    links: MobileNavLink[];
    activeKey: string;
    /** Called when the user picks an item; parent handles navigation. Also fired
     *  on "external" activation (e.g. a hash-link click) so the panel can close. */
    onNavigate: (link: MobileNavLink) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({links, activeKey, onNavigate}) => {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const active = links.find(l => l.key === activeKey) ?? links[0];

    // Close on outside click / Escape — keeps interaction feeling native.
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (!rootRef.current) return;
            if (!rootRef.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const onPick = useCallback((link: MobileNavLink) => (e: React.MouseEvent) => {
        e.preventDefault();
        onNavigate(link);
        setOpen(false);
    }, [onNavigate]);

    if (!links.length) return null;

    return (
        <div ref={rootRef} className={`mobile-nav-root${open ? ' is-open' : ''}`}>
            <button
                type="button"
                className="mobile-nav-trigger"
                aria-expanded={open}
                aria-haspopup="menu"
                onClick={() => setOpen(o => !o)}
            >
                <span className="mobile-nav-trigger-label">{active?.label ?? '—'}</span>
                <span className="mobile-nav-trigger-caret" aria-hidden>▾</span>
            </button>
            {open && (
                <nav className="mobile-nav-panel" role="menu" aria-label="Site navigation">
                    {links.map((l, i) => (
                        <a
                            key={l.key}
                            href={l.href}
                            className={`mobile-nav-item${l.key === active?.key ? ' is-active' : ''}`}
                            onClick={onPick(l)}
                            role="menuitem"
                        >
                            <span className="mobile-nav-item-label">{l.label}</span>
                            <span className="mobile-nav-item-num" aria-hidden>{String(i + 1).padStart(2, '0')}</span>
                        </a>
                    ))}
                </nav>
            )}
        </div>
    );
};

export default MobileNav;
