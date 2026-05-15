/**
 * `/cars` — system-page-backed cars index
 * (all-pages-module-composed, Cars batch).
 *
 * The hand-coded sort/filter shell + listing grid is replaced by
 * `<SystemPageDispatch>` over the registered `cars-index` system page,
 * whose locked `CarsList` module owns the faceted filter UI and binds
 * to the `/api/cars` storefront feed via its smart wrapper.
 *
 * Faceted-filter system (W6b) note: the reusable filter-state lib
 * (`@client/lib/facetedFilter`) exposes `CARS_LIST_CONFIG` — the shared
 * facet schema for this route (make→model cascade, price/year/mileage
 * ranges, fuel/gearbox single-selects). URL-query-state sync for `/cars`
 * is intentionally NOT wired here: the cars filter state lives inside
 * `CarsListHost` (`modules/_CarsPageModules/wrappers.tsx`) as component
 * state, and that module dir is owned by the Cars-batch composition.
 * Swapping its `useState` for `useFilterState(CARS_LIST_CONFIG.facets)`
 * is a clean one-file follow-up in that module; deferred to avoid a
 * cross-agent edit. `/products` is fully wired as the reference
 * consumer.
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

interface Props {
    systemPage: ISystemPageSnapshot | null;
}

const CarsIndex: React.FC<Props> = ({systemPage}) => {
    const {t} = useTranslation('translation');
    const {t: tApp} = useTranslation('app');
    const {t: tCommon} = useTranslation('common');
    return (
        <ConfigProvider theme={staticTheme}>
            <Head>
                <title>{tCommon('cars.index.title', {defaultValue: 'Cars'}) as string}</title>
            </Head>
            <main data-testid="page-cars-index" style={{maxWidth: 1200, margin: '0 auto', padding: '24px 16px 80px'}}>
                {systemPage
                    ? <SystemPageDispatch systemKey="cars-index" sections={systemPage.defaultSections} t={t} tApp={tApp}/>
                    : null}
            </main>
        </ConfigProvider>
    );
};

export const getServerSideProps: GetServerSideProps<Props> = async ({locale}) => {
    const i18n = await serverSideTranslations(locale ?? 'en', ['common', 'app', 'translation']).catch(() => ({}));
    return {props: {systemPage: loadSystemPageSnapshot('cars-index'), ...(i18n as object)} as Props};
};

export default CarsIndex;
