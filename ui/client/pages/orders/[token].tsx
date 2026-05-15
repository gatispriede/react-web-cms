/**
 * `/orders/[token]` — system-page-backed public guest order view
 * (Phase 1.D-c). Thin loader: rate-limit + token-bearer check stay
 * server-side; valid lookups render via `<SystemPageDispatch>` over
 * `order-by-token`. The `OrderSummary` + `MagicLinkAccountUpgrade`
 * modules carry the per-order presentation; the route just gates +
 * dispatches.
 *
 * Token URLs: ≥128 bits random; rate-limited 5/min/IP via `_rateLimit`.
 * Presence-only auth — no PII beyond what the bearer already knows.
 */
import React from 'react';
import {Alert} from 'antd';
import {useTranslation} from 'next-i18next/pages';
import type {GetServerSideProps} from 'next';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {clientIp, rateLimit} from '@client/pages/api/_rateLimit';
import {log} from '@services/infra/logger';
import {loadSystemPageSnapshot, type ISystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import SystemPageDispatch from '@client/lib/systemPage/SystemPageDispatch';

interface PageProps {
    systemPage: ISystemPageSnapshot | null;
    error: 'rate' | 'not-found' | null;
}

const PublicOrderByTokenPage: React.FC<PageProps> = ({systemPage, error}) => {
    const {t} = useTranslation('common');
    const {t: tApp} = useTranslation('app');
    if (error) {
        return (
            <div style={{maxWidth: 720, margin: '40px auto', padding: 16}}>
                <Alert
                    type="error"
                    showIcon
                    message={error === 'rate' ? 'Too many lookups' : 'Order not found'}
                    description={error === 'rate'
                        ? 'Try again in a minute.'
                        : 'Double-check the link from your receipt email, or sign in to /account if you have a customer account.'}
                    data-testid="public-order-error"
                />
            </div>
        );
    }
    return (
        <main data-testid="page-order-by-token" style={{maxWidth: 720, margin: '40px auto', padding: 16}}>
            {systemPage
                ? <SystemPageDispatch systemKey="order-by-token" sections={systemPage.defaultSections} t={t} tApp={tApp}/>
                : null}
        </main>
    );
};

export const getServerSideProps: GetServerSideProps<PageProps> = async (ctx) => {
    const token = String(ctx.params?.token ?? '');
    const ip = clientIp(ctx.req as never);
    const rl = rateLimit(`order-by-token:${ip}`, 5, 60_000);
    const systemPage = loadSystemPageSnapshot('order-by-token');
    if (!rl.ok) return {props: {systemPage, error: 'rate'}};
    if (!token || token.length < 24) return {props: {systemPage, error: 'not-found'}};
    try {
        const conn = getMongoConnection();
        const svc = (conn as never as {featureServices?: {orders?: {getByTokenPublic?: (t: string) => Promise<unknown>}}}).featureServices?.orders;
        const order = svc?.getByTokenPublic ? await svc.getByTokenPublic(token) : null;
        if (!order) return {props: {systemPage, error: 'not-found'}};
        return {props: {systemPage, error: null}};
    } catch (err) {
        log.error({scope: 'order.byToken.page', err}, 'public order page failed');
        return {props: {systemPage, error: 'not-found'}};
    }
};

export default PublicOrderByTokenPage;
