import React, {useEffect, useState} from 'react';

export interface ScrollNavLink {
    key: string;
    slug: string;
    label: React.ReactNode;
}

/**
 * Scroll-mode navigation strip with IntersectionObserver-backed scrollspy.
 * Each anchor targets `#<slug>`; the observer watches every matching section
 * and the one currently closest to the viewport top gets `.is-active`.
 *
 * Clicks honour `prefers-reduced-motion` — if the user has it set, we skip
 * the `behavior: 'smooth'` scroll and just jump to the anchor instantly.
 */
export const ScrollNav: React.FC<{links: ScrollNavLink[]}> = ({links}) => {
    const [activeSlug, setActiveSlug] = useState<string | null>(null);

    useEffect(() => {
        if (links.length === 0) return;
        const sections = links
            .map(l => ({slug: l.slug, el: document.getElementById(l.slug)}))
            .filter((s): s is {slug: string; el: HTMLElement} => Boolean(s.el));
        if (sections.length === 0) return;

        // Track intersection ratios per section — pick the one with the
        // largest visible area inside the viewport. `rootMargin` top-offset
        // matches the `scrollMarginTop: 80` on the sections so the handoff
        // point feels right as the user scrolls past a sticky header.
        const ratios = new Map<string, number>();
        const observer = new IntersectionObserver(
            (entries) => {
                for (const e of entries) {
                    const slug = (e.target as HTMLElement).id;
                    ratios.set(slug, e.intersectionRatio);
                }
                let best = {slug: sections[0].slug, ratio: -1};
                for (const [slug, ratio] of ratios) {
                    if (ratio > best.ratio) best = {slug, ratio};
                }
                setActiveSlug(best.slug);
            },
            {
                rootMargin: '-80px 0px -40% 0px',
                threshold: [0, 0.25, 0.5, 0.75, 1],
            },
        );
        for (const s of sections) observer.observe(s.el);
        return () => observer.disconnect();
    }, [links]);

    const prefersReducedMotion = (): boolean =>
        typeof window !== 'undefined'
        && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

    const onClick = (slug: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
        const target = document.getElementById(slug);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({
            behavior: prefersReducedMotion() ? 'auto' : 'smooth',
            block: 'start',
        });
        // Keep the URL hash in sync so the anchor is shareable.
        if (typeof history !== 'undefined') {
            history.replaceState(null, '', `#${slug}`);
        }
        setActiveSlug(slug);
    };

    return (
        <nav aria-label="Site navigation" style={{display: 'flex', gap: 12}}>
            {links.map(l => {
                const isActive = l.slug === activeSlug;
                return (
                    <a
                        key={l.key}
                        href={`#${l.slug}`}
                        className={`scroll-nav-link${isActive ? ' is-active' : ''}`}
                        aria-current={isActive ? 'true' : undefined}
                        onClick={onClick(l.slug)}
                        style={{
                            textTransform: 'uppercase',
                            textDecoration: 'none',
                            fontWeight: isActive ? 600 : 400,
                            opacity: isActive ? 1 : 0.7,
                            transition: 'opacity 180ms ease, font-weight 180ms ease',
                        }}
                    >
                        {l.label}
                    </a>
                );
            })}
        </nav>
    );
};

export default ScrollNav;
