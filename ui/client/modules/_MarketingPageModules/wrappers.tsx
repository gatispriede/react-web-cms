/**
 * all-pages-module-composed — Marketing batch content-parser wrappers.
 *
 * `FeatureGrid` / `LogoCloud` / `PricingTable` / `TestimonialWall` are
 * pure presentational modules that take typed data arrays as props.
 * Unlike the Account / Auth hosts these wrappers do not fetch anything
 * — the content is operator-authored, so the wrapper just parses the
 * arrays out of `item.content` and forwards them. (Same shape as
 * `BlogFeed`'s `ContentManager`, kept as a thin local helper here.)
 */
import React from 'react';
import type {IItem} from '@interfaces/IItem';
import FeatureGrid from '@client/modules/FeatureGrid/FeatureGrid';
import type {FeatureCard} from '@client/modules/FeatureGrid/FeatureGrid.types';
import LogoCloud from '@client/modules/LogoCloud/LogoCloud';
import type {LogoEntry} from '@client/modules/LogoCloud/LogoCloud.types';
import PricingTable from '@client/modules/PricingTable/PricingTable';
import type {PricingFeature, PricingTier} from '@client/modules/PricingTable/PricingTable.types';
import TestimonialWall from '@client/modules/TestimonialWall/TestimonialWall';
import type {Testimonial} from '@client/modules/TestimonialWall/TestimonialWall.types';

function parse<T>(raw: string | undefined): T {
    if (!raw) return {} as T;
    try { return JSON.parse(raw) as T; } catch { return {} as T; }
}

interface FeatureGridContent {
    features?: FeatureCard[];
    columns?: 2 | 3;
}

export const FeatureGridHost: React.FC<{item: IItem}> = ({item}) => {
    const c = parse<FeatureGridContent>(item.content);
    return (
        <FeatureGrid
            testId="marketing-feature-grid"
            features={c.features ?? []}
            columns={c.columns}
        />
    );
};

interface LogoCloudContent {
    headline?: string;
    logos?: LogoEntry[];
}

export const LogoCloudHost: React.FC<{item: IItem}> = ({item}) => {
    const c = parse<LogoCloudContent>(item.content);
    return (
        <LogoCloud
            testId="marketing-logo-cloud"
            headline={c.headline}
            logos={c.logos ?? []}
        />
    );
};

interface PricingTableContent {
    tiers?: PricingTier[];
    features?: PricingFeature[];
    initialBilling?: 'monthly' | 'annual';
    monthlyLabel?: string;
    annualLabel?: string;
    mostPopularLabel?: string;
}

export const PricingTableHost: React.FC<{item: IItem}> = ({item}) => {
    const c = parse<PricingTableContent>(item.content);
    return (
        <PricingTable
            testId="marketing-pricing-table"
            tiers={c.tiers ?? []}
            features={c.features ?? []}
            initialBilling={c.initialBilling}
            monthlyLabel={c.monthlyLabel}
            annualLabel={c.annualLabel}
            mostPopularLabel={c.mostPopularLabel}
        />
    );
};

interface TestimonialWallContent {
    items?: Testimonial[];
    desktopColumns?: 2 | 3 | 4;
}

export const TestimonialWallHost: React.FC<{item: IItem}> = ({item}) => {
    const c = parse<TestimonialWallContent>(item.content);
    return (
        <TestimonialWall
            testId="marketing-testimonial-wall"
            items={c.items ?? []}
            desktopColumns={c.desktopColumns}
        />
    );
};
