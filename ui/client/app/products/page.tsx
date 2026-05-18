/**
 * `/products` — App Router migration, Batch 5.
 *
 * Server-Component port of the former `pages/products/index.tsx`.
 * Per-request fetch of products + active theme + footer + nav rows;
 * `'use client'` view (`ProductsIndexView`) carries antd, the
 * `applyThemeCssVars` `useEffect`, the faceted-filter UI, and the
 * search/sort hooks. Pages-Router file deleted in the same commit.
 *
 * Feature gate: the old `gatePath('/products')` SSR-wrapper is replaced
 * with a direct `isFeatureEnabled()` check + `notFound()`.
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
import ProductsIndexView from './ProductsIndexView';

export const dynamic = 'force-dynamic';

interface ProductsIndexData {
    products: IProduct[];
    themeTokens: any | null;
    footer: IFooterConfig;
    pages: {page: string}[];
}

async function loadProductsIndexData(): Promise<ProductsIndexData> {
    let products: IProduct[] = [];
    let themeTokens: any | null = null;
    let footer: IFooterConfig = {...DEFAULT_FOOTER};
    let pages: {page: string}[] = [];
    const data = await gqlFetch<{mongo: {getProducts: string; getActiveTheme: string | null; getFooter: string; getNavigationCollection: {page: string}[]}}>(
        `{ mongo { getProducts(limit: 200) getActiveTheme getFooter getNavigationCollection { page } } }`,
    );
    try {
        products = data?.mongo?.getProducts ? JSON.parse(data.mongo.getProducts) : [];
        const themeRaw = data?.mongo?.getActiveTheme;
        if (themeRaw) themeTokens = JSON.parse(themeRaw).tokens ?? null;
        if (data?.mongo?.getFooter) footer = JSON.parse(data.mongo.getFooter);
        pages = (data?.mongo?.getNavigationCollection ?? []).map(p => ({page: p.page}));
    } catch (err) {
        console.error('[app/products] parse error:', err);
    }
    return {products, themeTokens, footer, pages};
}

export async function generateMetadata(): Promise<Metadata> {
    const {t} = await getT('common');
    return {title: (t('Products') as string)};
}

export default async function ProductsIndexPage(): Promise<React.ReactElement> {
    const featureId = gateForPath('/products');
    if (featureId && !isFeatureEnabled(featureId)) notFound();
    const {products, themeTokens, footer, pages} = await loadProductsIndexData();
    return <ProductsIndexView products={products} themeTokens={themeTokens} footer={footer} pages={pages}/>;
}
