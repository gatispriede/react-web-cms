/**
 * `/orders/[token]` — App Router migration, Batch 5.
 *
 * Server-Component port of the former `pages/orders/[token].tsx`. The
 * token-bearer + rate-limit checks stay server-side; valid lookups
 * render via the `'use client'` view, which dispatches the
 * `order-by-token` system page (the `OrderSummary` +
 * `MagicLinkAccountUpgrade` modules carry the per-order presentation).
 *
 * Token URLs: ≥128 bits random; rate-limited 5/min/IP. Presence-only
 * auth — no PII beyond what the bearer already knows. Pages-Router file
 * deleted in the same commit.
 */
import React from 'react';
import {headers} from 'next/headers';
import type {Metadata} from 'next';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {rateLimit} from '@client/pages/api/_rateLimit';
import {log} from '@services/infra/logger';
import {loadSystemPageSnapshot, type ISystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import OrderByTokenView from './OrderByTokenView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {title: 'Order details'};

interface RouteParams {
    token: string;
}

interface PageState {
    systemPage: ISystemPageSnapshot | null;
    error: 'rate' | 'not-found' | null;
}

/** Pull a usable client IP out of the App-Router `headers()` map.
 *  Mirrors `clientIp(req)` from the Pages-Router `_rateLimit.ts`, but
 *  operates on the readonly Headers shape App Router exposes. */
async function clientIpFromHeaders(): Promise<string> {
    const h = await headers();
    const xff = h.get('x-forwarded-for');
    if (xff) return xff.split(',')[0].trim();
    return h.get('x-real-ip') ?? 'unknown';
}

async function loadPageState(token: string): Promise<PageState> {
    const systemPage = loadSystemPageSnapshot('order-by-token');
    const ip = await clientIpFromHeaders();
    const rl = rateLimit(`order-by-token:${ip}`, 5, 60_000);
    if (!rl.ok) return {systemPage, error: 'rate'};
    if (!token || token.length < 24) return {systemPage, error: 'not-found'};
    try {
        const conn = getMongoConnection();
        const svc = (conn as never as {featureServices?: {orders?: {getByTokenPublic?: (t: string) => Promise<unknown>}}}).featureServices?.orders;
        const order = svc?.getByTokenPublic ? await svc.getByTokenPublic(token) : null;
        if (!order) return {systemPage, error: 'not-found'};
        return {systemPage, error: null};
    } catch (err) {
        log.error({scope: 'order.byToken.page', err}, 'public order page failed');
        return {systemPage, error: 'not-found'};
    }
}

export default async function PublicOrderByTokenPage({
    params,
}: {
    params: Promise<RouteParams>;
}): Promise<React.ReactElement> {
    const {token} = await params;
    const state = await loadPageState(String(token ?? ''));
    return <OrderByTokenView systemPage={state.systemPage} error={state.error}/>;
}
