export interface TicketTier {
    key: string;
    name: string;
    priceFormatted: string;
    description?: string;
    /** External checkout URL (Stripe link / Eventbrite / etc.). */
    href: string;
    /** When true, mark as the recommended tier. */
    highlighted?: boolean;
}

export interface EventBuyTicketsCtaProps {
    testId: string;
    /** Sticky CTA button label. */
    ctaLabel?: string;
    tiers: TicketTier[];
    /** Disables auto-dismiss after a tier click; default false (dismisses). */
    keepOpenOnPurchase?: boolean;
    /** Test-only forced variant. */
    forceVariant?: 'mobile' | 'desktop';
}
