import React, {useCallback, useEffect, useRef, useState} from 'react';

/**
 * Mobile-only collapsible public-site navigation. Mirrors the design-v5 Portfolio.html
 * reference: at `≤ 720 px` the full top-bar nav is hidden (see `styles/globals/global.scss`
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
    /** F1 sub-pages — optional nested children. When present, the row
     *  renders expandable: tapping the chevron toggles the child list,
     *  tapping the label still navigates to the parent's `href`. Empty
     *  / missing keeps the legacy flat-row behaviour. */
    children?: MobileNavLink[];
}

interface MobileNavProps {
    links: MobileNavLink[];
    activeKey: string;
    /** Called when the user picks an item; parent handles navigation. Also fired
     *  on "external" activation (e.g. a hash-link click) so the panel can close. */
    onNavigate: (link: MobileNavLink) => void;
}

/** Recursively flatten a nested link tree into a single list — used to
 *  resolve the `activeKey` lookup so a child being active still surfaces
 *  the right "current page" label on the trigger button. */
const flattenLinks = (list: MobileNavLink[]): MobileNavLink[] => {
    const out: MobileNavLink[] = [];
    for (const l of list) {
        out.push(l);
        if (l.children?.length) out.push(...flattenLinks(l.children));
    }
    return out;
};

export const MobileNav: React.FC<MobileNavProps> = ({links, activeKey, onNavigate}) => {
    const [open, setOpen] = useState(false);
    const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
    const rootRef = useRef<HTMLDivElement>(null);
    const flat = flattenLinks(links);
    const active = flat.find(l => l.key === activeKey) ?? flat[0];

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
                    {links.map((l, i) => {
                        const hasKids = !!l.children?.length;
                        const expanded = !!expandedKeys[l.key];
                        const num = String(i + 1).padStart(2, '0');
                        return (
                            <React.Fragment key={l.key}>
                                <div className={`mobile-nav-row${hasKids ? ' has-children' : ''}${expanded ? ' is-expanded' : ''}`}>
                                    <a
                                        href={l.href}
                                        className={`mobile-nav-item${l.key === active?.key ? ' is-active' : ''}`}
                                        onClick={onPick(l)}
                                        role="menuitem"
                                    >
                                        <span className="mobile-nav-item-label">{l.label}</span>
                                        <span className="mobile-nav-item-num" aria-hidden>{num}</span>
                                    </a>
                                    {hasKids && (
                                        <button
                                            type="button"
                                            className="mobile-nav-toggle"
                                            aria-expanded={expanded}
                                            aria-label={expanded ? 'Collapse' : 'Expand'}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setExpandedKeys(prev => ({...prev, [l.key]: !prev[l.key]}));
                                            }}
                                        >
                                            <span aria-hidden>{expanded ? '▴' : '▾'}</span>
                                        </button>
                                    )}
                                </div>
                                {hasKids && expanded && (
                                    <div className="mobile-nav-children" role="group">
                                        {l.children!.map((c) => (
                                            <a
                                                key={c.key}
                                                href={c.href}
                                                className={`mobile-nav-item is-child${c.key === active?.key ? ' is-active' : ''}`}
                                                onClick={onPick(c)}
                                                role="menuitem"
                                            >
                                                <span className="mobile-nav-item-label">{c.label}</span>
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </React.Fragment>
                        );
                    })}
                </nav>
            )}
        </div>
    );
};

export default MobileNav;
