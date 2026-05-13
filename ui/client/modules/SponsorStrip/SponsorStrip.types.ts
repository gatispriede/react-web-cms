export type SponsorTier = 'platinum' | 'gold' | 'silver' | 'bronze';

export interface Sponsor {
    key: string;
    name: string;
    logoUrl: string;
    href?: string;
    tier: SponsorTier;
}

export interface SponsorStripProps {
    testId: string;
    sponsors: Sponsor[];
    /** Group + sort by tier in this order. Default platinum-first. */
    tierOrder?: SponsorTier[];
}
