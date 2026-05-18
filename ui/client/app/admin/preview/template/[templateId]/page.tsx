/**
 * `/admin/preview/template/[templateId]` — App Router migration, Batch 6
 * (Phase 1.F product-display-templates).
 *
 * Server-renders a product display template against a fixture product
 * so operators see the layout before assigning to live products. Admin
 * shell is hidden; the page is wrapped in `<ProductContext>` so the
 * template's modules bind to the fixture product like they would on a
 * real leaf product page.
 *
 * App Router signature: `params` / `searchParams` are now `Promise`s.
 *
 * Pages-Router file deleted in the same commit.
 */
import React from 'react';
import type {Metadata} from 'next';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import type {IProduct} from '@interfaces/IProduct';
import TemplatePreviewView from './TemplatePreviewView';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {title: 'Admin · Template preview', robots: {index: false, follow: false}};

export default async function TemplatePreviewPage({
    params,
    searchParams,
}: {
    params: Promise<{templateId: string}>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.ReactElement> {
    const {templateId} = await params;
    const sp = await searchParams;
    const fixtureProductId = typeof sp.product === 'string' ? sp.product : undefined;

    const conn = getMongoConnection();
    const template = await conn.productTemplateService.get(String(templateId ?? ''));
    if (!template) {
        return <TemplatePreviewView template={null} product={null} sections={[]}/>;
    }
    let product: IProduct | null = fixtureProductId
        ? await conn.productService.getById(fixtureProductId)
        : null;
    if (!product) {
        const list = await conn.productService.list({limit: 1});
        product = Array.isArray(list) ? (list[0] ?? null) : null;
    }
    const sections = product
        ? conn.productTemplateService.applyTemplate(template, product)
        : template.sections;
    return <TemplatePreviewView template={template} product={product} sections={sections}/>;
}
