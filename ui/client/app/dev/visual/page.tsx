/**
 * `/dev/visual` — App Router migration, Batch 6.
 *
 * Visual-regression render slot. Single isolated mount per request —
 * no admin shell, no theme dropdown, no collapse panel chrome. Used by
 * Playwright `tests/e2e/visual/` to capture per-module baselines.
 *
 * Gated: dev or e2e builds only. `E2E_BUILD_DIR` is the marker the e2e
 * pipeline sets in next.config.js; if neither flag is on, the route
 * 404s (this never reaches prod).
 *
 * Pages-Router file deleted in the same commit.
 */
import React from 'react';
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import VisualSlotView from './VisualSlotView';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {title: 'Dev · Visual slot', robots: {index: false, follow: false}};

export default async function VisualSlotPage(): Promise<React.ReactElement> {
    if (process.env.NODE_ENV !== 'development' && !process.env.E2E_BUILD_DIR) notFound();
    return <VisualSlotView/>;
}
