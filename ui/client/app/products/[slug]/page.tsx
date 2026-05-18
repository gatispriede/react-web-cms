/**
 * `/products/[slug]` — App Router migration, Batch 5.
 *
 * Server-Component port of the former `pages/products/[slug].tsx`. The
 * Pages-Router file used `getStaticProps` + `revalidate: 3600`; under
 * App Router the root layout is `dynamic = 'force-dynamic'`, so per-
 * request rendering supersedes ISR — the staleness gap closes.
 *
 * `notFound()` from `next/navigation` replaces `{notFound: true, revalidate}`.
 *
 * Pages-Router file deleted in the same commit.
 */
import React from 'react';
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {gqlFetch} from '@client/lib/gqlFetch';
import {gateForPath} from '@client/lib/loaders/applyPublicGates';
import {isFeatureEnabled} from '@services/infra/featureFlags';
import type {IProduct} from '@interfaces/IProduct';
import {DEFAULT_FOOTER, type IFooterConfig} from '@interfaces/IFooter';
import {productPrimaryImage} from '@client/lib/productImage';
import ProductDetailView from './ProductDetailView';

export const dynamic = 'force-dynamic';

interface RouteParams {
    slug: string;
}

interface ProductDetailData {
    product: IProduct | null;
    themeTokens: any | null;
    footer: IFooterConfig;
    pages: {page: string}[];
}

async function loadProductDetailData(slug: string): Promise<ProductDetailData> {
    let product: IProduct | null = null;
    let themeTokens: any | null = null;
    let footer: IFooterConfig = {...DEFAULT_FOOTER};
    let pages: {page: string}[] = [];
    const data = await gqlFetch<{mongo: {
        getProduct: string | null;
        getActiveTheme: string | null;
        getFooter: string;
        getNavigationCollection: {page: string}[];
    }}>(
        `query($slug: String!){ mongo { getProduct(slug: $slug) getActiveTheme getFooter getNavigationCollection { page } } }`,
        {slug: slug ?? ''},
    );
    try {
        const raw = data?.mongo?.getProduct;
        product = raw ? JSON.parse(raw) : null;
        const themeRaw = data?.mongo?.getActiveTheme;
        if (themeRaw) themeTokens = JSON.parse(themeRaw).tokens ?? null;
        if (data?.mongo?.getFooter) footer = JSON.parse(data.mongo.getFooter);
        pages = (data?.mongo?.getNavigationCollection ?? []).map(p => ({page: p.page}));
    } catch (err) {
        console.error('[app/products/[slug]] parse error:', err);
    }
    return {product, themeTokens, footer, pages};
}

export async function generateMetadata({
    params,
}: {
    params: Promise<RouteParams>;
}): Promise<Metadata> {
    const {slug} = await params;
    const {product} = await loadProductDetailData(slug);
    if (!product) return {title: 'Product not found'};
    return {
        title: product.title,
        description: product.description ? String(product.description).slice(0, 200) : undefined,
        openGraph: {images: [productPrimaryImage(product)]},
    };
}

export default async function ProductDetailPage({
    params,
}: {
    params: Promise<RouteParams>;
}): Promise<React.ReactElement> {
    const featureId = gateForPath('/products/[slug]');
    if (featureId && !isFeatureEnabled(featureId)) notFound();
    const {slug} = await params;
    const {product, themeTokens, footer, pages} = await loadProductDetailData(slug);
    if (!product) notFound();
    return <ProductDetailView product={product} themeTokens={themeTokens} footer={footer} pages={pages}/>;
}
