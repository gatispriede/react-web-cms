/**
 * `/cars/[slug]` — system-page-backed car detail
 * (all-pages-module-composed, Cars batch).
 *
 * The vehicle detail composition is replaced by `<SystemPageDispatch>`
 * over the registered `cars-detail` system page, whose locked
 * `CarDetail` module reads the `[slug]` route param and fetches the
 * car. The route keeps a server-side car lookup purely to drive the
 * SEO `<Head>` (title + description) — the visible body is module-
 * composed.
 */
import React from 'react';
import type {GetServerSideProps} from 'next';
import Head from 'next/head';
import {ConfigProvider} from 'antd';
import {useTranslation} from 'next-i18next/pages';
import {serverSideTranslations} from 'next-i18next/pages/serverSideTranslations';
import staticTheme from '@client/features/Themes/themeConfig';
import {loadSystemPageSnapshot, type ISystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import SystemPageDispatch from '@client/lib/systemPage/SystemPageDispatch';

interface CarHead {
    title: string;
    description: string;
}

interface Props {
    systemPage: ISystemPageSnapshot | null;
    car: CarHead | null;
}

const CarSlugPage: React.FC<Props> = ({systemPage, car}) => {
    const {t} = useTranslation('translation');
    const {t: tApp} = useTranslation('app');
    const {t: tCommon} = useTranslation('common');
    return (
        <ConfigProvider theme={staticTheme}>
            <Head>
                <title>{car?.title || (tCommon('cars.detail.notFound', {defaultValue: 'Car not found'}) as string)}</title>
                {car?.description ? <meta name="description" content={car.description}/> : null}
            </Head>
            <main data-testid="page-cars-detail" style={{padding: '24px 16px 80px'}}>
                {systemPage
                    ? <SystemPageDispatch systemKey="cars-detail" sections={systemPage.defaultSections} t={t} tApp={tApp}/>
                    : null}
            </main>
        </ConfigProvider>
    );
};

export const getServerSideProps: GetServerSideProps<Props> = async ({params, locale}) => {
    const slug = typeof params?.slug === 'string' ? params.slug : '';
    let car: CarHead | null = null;
    try {
        const {getMongoConnection} = await import('@services/infra/mongoDBConnection');
        const conn = getMongoConnection();
        for (let i = 0; i < 30 && !conn.database; i++) {
            await new Promise(r => setTimeout(r, 100));
        }
        if (conn.database && slug) {
            const row = await conn.database
                .collection('Products')
                .findOne({slug, categories: 'cars', draft: {$ne: true}}, {projection: {_id: 0, title: 1, description: 1}});
            if (row) {
                const r = row as {title?: string; description?: string};
                car = {
                    title: String(r.title ?? ''),
                    description: String(r.description ?? '').slice(0, 160),
                };
            }
        }
    } catch {
        car = null;
    }
    const i18n = await serverSideTranslations(locale ?? 'en', ['common', 'app', 'translation']).catch(() => ({}));
    return {props: {systemPage: loadSystemPageSnapshot('cars-detail'), car, ...(i18n as object)} as Props};
};

export default CarSlugPage;
