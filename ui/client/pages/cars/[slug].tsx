/**
 * `/cars/[slug]` storefront detail page — Wave 7b.
 *
 * Stitches the Cars module components into a vehicle detail page with
 * photo gallery, spec table, VAT badge, and reservation CTA. Style-light
 * — per-theme styling is Wave 5 follow-up.
 */
import React from 'react';
import type {GetServerSideProps} from 'next';
import Head from 'next/head';
import {useTranslation} from 'next-i18next/pages';
import {serverSideTranslations} from 'next-i18next/pages/serverSideTranslations';
import {CarVehicleDetailPage, type CarListing} from '@client/modules/Cars';

interface Props {
    car: CarListing | null;
}

const CarSlugPage: React.FC<Props> = ({car}) => {
    const {t} = useTranslation('common');
    if (!car) {
        return (
            <div style={{padding: 16}} data-testid="car-detail-not-found">
                <Head><title>{t('cars.detail.notFound', {defaultValue: 'Car not found'}) as string}</title></Head>
                <h1>{t('cars.detail.notFound', {defaultValue: 'Car not found'}) as string}</h1>
            </div>
        );
    }
    return (
        <>
            <Head>
                <title>{car.title}</title>
                <meta name="description" content={car.description?.slice(0, 160) || car.title}/>
            </Head>
            <CarVehicleDetailPage car={car}/>
        </>
    );
};

export const getServerSideProps: GetServerSideProps<Props> = async ({params, locale}) => {
    const slug = typeof params?.slug === 'string' ? params.slug : '';
    let car: CarListing | null = null;
    try {
        const {getMongoConnection} = await import('@services/infra/mongoDBConnection');
        const conn = getMongoConnection();
        for (let i = 0; i < 30 && !conn.database; i++) {
            await new Promise(r => setTimeout(r, 100));
        }
        if (conn.database && slug) {
            const row = await conn.database
                .collection('Products')
                .findOne({slug, categories: 'cars', draft: {$ne: true}}, {projection: {_id: 0}});
            car = (row as unknown as CarListing) ?? null;
        }
    } catch {
        car = null;
    }
    const i18n = await serverSideTranslations(locale ?? 'en', ['common']).catch(() => ({}));
    return {props: {car, ...(i18n as object)} as Props};
};

export default CarSlugPage;
