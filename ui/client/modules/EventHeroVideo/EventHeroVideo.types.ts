export enum EEventHeroVideoStyle {
    Default = 'default',
    Cinematic = 'cinematic',
    Split = 'split',
    Fullscreen = 'fullscreen',
}

export interface EventHeroVideoProps {
    testId: string;
    videoUrl: string;
    posterUrl: string;
    headline: string;
    subHeadline?: string;
    /** Optional countdown — when present, embeds CountdownTimer below the headline. */
    countdownTarget?: string;
    primaryCta?: {label: string; href: string};
    /** Test-only force reduced-motion path. */
    forceReducedMotion?: boolean;
}
