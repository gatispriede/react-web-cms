export interface ProductScreenshotHeroProps {
    testId: string;
    headline: string;
    subHeadline?: string;
    screenshotUrl: string;
    screenshotAlt: string;
    primaryCta: {label: string; href: string};
    secondaryCta?: {label: string; href: string};
    /** When true, hides the parallax animation. Default false; auto-true on prefers-reduced-motion. */
    forceReducedMotion?: boolean;
}
