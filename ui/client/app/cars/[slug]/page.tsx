/**
 * `/cars/[slug]` — App Router migration, Batch 5.
 *
 * Server-Component port of the former `pages/cars/[slug].tsx`. The
 * server-side car lookup (Mongo `Products` row matching `slug` +
 * `categories: 'cars'`) is retained only for SEO `<title>` /
 * `<meta description>` — surfaced here via `generateMetadata`. The
 * visible body is module-composed via `<SystemPageDispatch>` over
 * `cars-detail` inside the `'use client'` `CarDetailView`.
 *
 * Pages-Router file deleted in the same commit.
 */
import React from 'react';
import type {Metadata} from 'next';
import {getT} from 'next-i18next/server';
import {loadSystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import CarDetailView from './CarDetailView';

export const dynamic = 'force-dynamic';

interface RouteParams {
    slug: string;
}

interface CarHead {
    title: string;
    description: string;
}

async function loadCarHead(slug: string): Promise<CarHead | null> {
    if (!slug) return null;
    try {
        const {getMongoConnection} = await import('@services/infra/mongoDBConnection');
        const conn = getMongoConnection();
        for (let i = 0; i < 30 && !conn.database; i++) {
            await new Promise(r => setTimeout(r, 100));
        }
        if (!conn.database) return null;
        const row = await conn.database
            .collection('Products')
            .findOne({slug, categories: 'cars', draft: {$ne: true}}, {projection: {_id: 0, title: 1, description: 1}});
        if (!row) return null;
        const r = row as {title?: string; description?: string};
        return {
            title: String(r.title ?? ''),
            description: String(r.description ?? '').slice(0, 160),
        };
    } catch {
        return null;
    }
}

export async function generateMetadata({
    params,
}: {
    params: Promise<RouteParams>;
}): Promise<Metadata> {
    const {slug} = await params;
    const {t} = await getT('common');
    const car = await loadCarHead(slug);
    if (!car) {
        return {title: (t('cars.detail.notFound', {defaultValue: 'Car not found'}) as string)};
    }
    return {
        title: car.title,
        description: car.description || undefined,
    };
}

export default async function CarDetailPage(): Promise<React.ReactElement> {
    const systemPage = loadSystemPageSnapshot('cars-detail');
    return <CarDetailView systemPage={systemPage}/>;
}
