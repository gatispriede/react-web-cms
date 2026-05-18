/**
 * JS-side accessors for the motion-token system.
 *
 * Spec: docs/roadmap/admin/motion-token-system.md (item 0b).
 *
 * SCSS tokens live in `ui/client/styles/_motion-tokens.scss`. When SCSS
 * keyframes can't reach (scroll-tied animations, choreographed sequences,
 * Motion One / Framer Motion call sites), pull from this helper instead of
 * hardcoding millisecond values. Every accessor multiplies by
 * `--motion-scalar` so `prefers-reduced-motion: reduce` collapses durations
 * to zero everywhere — JS and CSS — through a single switch.
 *
 * SSR-safe: returns 0 / empty string on the server (no `document`); call
 * sites should only read motion values in `useEffect` or event handlers.
 */

function rootStyle(): CSSStyleDeclaration | null {
    if (typeof document === 'undefined') return null;
    return getComputedStyle(document.documentElement);
}

function readDuration(name: string): number {
    const root = rootStyle();
    if (!root) return 0;
    const raw = root.getPropertyValue(name);
    const ms = parseInt(raw, 10);
    if (!Number.isFinite(ms)) return 0;
    const scalar = Number(root.getPropertyValue('--motion-scalar')) || 0;
    return ms * scalar;
}

function readEase(name: string): string {
    const root = rootStyle();
    if (!root) return '';
    return root.getPropertyValue(name).trim();
}

export const motion = {
    duration: {
        fast: () => readDuration('--motion-duration-fast'),
        base: () => readDuration('--motion-duration-base'),
        slow: () => readDuration('--motion-duration-slow'),
        deliberate: () => readDuration('--motion-duration-deliberate'),
    },
    ease: {
        standard:   () => readEase('--motion-ease-standard'),
        entrance:   () => readEase('--motion-ease-entrance'),
        exit:       () => readEase('--motion-ease-exit'),
        emphasized: () => readEase('--motion-ease-emphasized'),
    },
    /** Stagger unit (ms) for list-item entrance choreography. */
    stagger: () => readDuration('--motion-stagger'),
    /** True when the OS-level `prefers-reduced-motion: reduce` is active. */
    isReduced: () => {
        const root = rootStyle();
        if (!root) return false;
        return Number(root.getPropertyValue('--motion-scalar')) === 0;
    },
};
