export interface PricingFeature {
    key: string;
    label: string;
    tooltip?: string;
    /** Per-tier presence. Missing key = not included. */
    perTier: Record<string, boolean | string>;
}

export interface PricingTier {
    key: string;
    name: string;
    monthlyPriceFormatted: string;
    annualPriceFormatted: string;
    /** Optional pre-computed savings line for annual ('2 months free'). */
    annualSavingsLabel?: string;
    description?: string;
    ctaLabel: string;
    ctaHref: string;
    highlighted?: boolean;
}

export interface PricingTableProps {
    testId: string;
    tiers: PricingTier[];
    features: PricingFeature[];
    /** Default 'monthly'. */
    initialBilling?: 'monthly' | 'annual';
    monthlyLabel?: string;
    annualLabel?: string;
    mostPopularLabel?: string;
}
