/**
 * `/products/category/[slug]` — App Router migration, Batch 5.
 *
 * Server-Component port of the former `pages/products/category/[slug].tsx`.
 * Reuses the same SSR data-load + card render as `/products` so the
 * visual identity stays consistent. Pages-Router file deleted in the
 * same commit.
 */
import React from 'react';
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {getT} from 'next-i18next/server';
import {gqlFetch} from '@client/lib/gqlFetch';
import {gateForPath} from '@client/lib/loaders/applyPublicGates';
import {isFeatureEnabled} from '@services/infra/featureFlags';
import type {IProduct} from '@interfaces/IProduct';
import {DEFAULT_FOOTER, type IFooterConfig} from '@interfaces/IFooter';
import CategoryView from './CategoryView';

export const dynamic = 'force-dynamic';

interface RouteParams {
    slug: string;
}

interface CategoryData {
    products: IProduct[];
    category: string;
    themeTokens: any | null;
    footer: IFooterConfig;
    pages: {page: string}[];
}

async function loadCategoryData(slugRaw: string): Promise<CategoryData> {
    const slug = decodeURIComponent(String(slugRaw ?? '')).toLowerCase();
    let products: IProduct[] = [];
    let themeTokens: any | null = null;
    let footer: IFooterConfig = {...DEFAULT_FOOTER};
    let pages: {page: string}[] = [];
    const data = await gqlFetch<{mongo: {getProducts: string; getActiveTheme: string | null; getFooter: string; getNavigationCollection: {page: string}[]}}>(
        `{ mongo { getProducts(limit: 500) getActiveTheme getFooter getNavigationCollection { page } } }`,
    );
    try {
        const all: IProduct[] = data?.mongo?.getProducts ? JSON.parse(data.mongo.getProducts) : [];
        products = all.filter(p => (p.categories ?? []).some(c => c.toLowerCase() === slug));
        const themeRaw = data?.mongo?.getActiveTheme;
        if (themeRaw) themeTokens = JSON.parse(themeRaw).tokens ?? null;
        if (data?.mongo?.getFooter) footer = JSON.parse(data.mongo.getFooter);
        pages = (data?.mongo?.getNavigationCollection ?? []).map(p => ({page: p.page}));
    } catch (err) {
        console.error('[app/products/category] parse error:', err);
    }
    return {products, category: slug, themeTokens, footer, pages};
}

export async function generateMetadata({
    params,
}: {
    params: Promise<RouteParams>;
}): Promise<Metadata> {
    const {slug} = await params;
    const {t} = await getT('common');
    const category = decodeURIComponent(String(slug ?? '')).toLowerCase();
    return {title: `${category} — ${t('Products')}`};
}

export default async function CategoryPage({
    params,
}: {
    params: Promise<RouteParams>;
}): Promise<React.ReactElement> {
    // The Pages-Router file used the `/products` feature gate (no
    // dedicated `/products/category/[slug]` registration); preserve.
    const featureId = gateForPath('/products');
    if (featureId && !isFeatureEnabled(featureId)) notFound();
    const {slug} = await params;
    const data = await loadCategoryData(slug);
    return <CategoryView {...data}/>;
}
