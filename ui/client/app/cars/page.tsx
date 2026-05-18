/**
 * `/cars` — App Router migration, Batch 5.
 *
 * Server-Component port of the former `pages/cars/index.tsx`. The page
 * is a thin loader: pull the `cars-index` system-page snapshot and
 * hand it to the `'use client'` `CarsIndexView`, which carries the
 * antd `ConfigProvider` wrap and the `<SystemPageDispatch>` call.
 * The locked `CarsList` smart-wrapper module owns the faceted filter
 * UI and fetches its own data — the route doesn't load product rows.
 *
 * Pages-Router `pages/cars/index.tsx` deleted in the same commit
 * (`app/cars` and `pages/cars` cannot both exist).
 */
import React from 'react';
import type {Metadata} from 'next';
import {getT} from 'next-i18next/server';
import {loadSystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import CarsIndexView from './CarsIndexView';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
    const {t} = await getT('common');
    return {title: (t('cars.index.title', {defaultValue: 'Cars'}) as string)};
}

export default async function CarsIndexPage(): Promise<React.ReactElement> {
    const systemPage = loadSystemPageSnapshot('cars-index');
    return <CarsIndexView systemPage={systemPage}/>;
}
