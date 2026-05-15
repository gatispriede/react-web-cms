/**
 * Car vehicle detail page composition — Wave 7b. Stitches together the
 * gallery, spec table, VAT badge and reservation CTA. Style-light per
 * spec (per-theme styling is Wave 5 work).
 */
import React from 'react';
import {useTranslation} from 'next-i18next/pages';
import CarPhotoGallery from './CarPhotoGallery';
import CarSpecTable from './CarSpecTable';
import CarReservationCta from './CarReservationCta';
import VatBadge from './VatBadge';
import type {CarListing} from './types';

interface Props {
    car: CarListing;
    testId?: string;
}

function formatEur(cents: number, currency = 'EUR'): string {
    try {
        return new Intl.NumberFormat(undefined, {style: 'currency', currency, maximumFractionDigits: 0}).format(cents / 100);
    } catch {
        return `${Math.round(cents / 100)} ${currency}`;
    }
}

const CarVehicleDetailPage: React.FC<Props> = ({car, testId}) => {
    const {t} = useTranslation('common');
    const a = car.attributes ?? {};
    return (
        <div data-testid={testId ?? 'car-vehicle-detail'} style={{display: 'grid', gap: 24, gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', maxWidth: 1200, margin: '0 auto', padding: 16}}>
            <div>
                <CarPhotoGallery images={car.images ?? []} title={car.title}/>
                {car.description ? (
                    <p data-testid="car-detail-description" style={{marginTop: 16, fontSize: 15, lineHeight: 1.6}}>
                        {car.description}
                    </p>
                ) : null}
                <h2 style={{marginTop: 24, fontSize: 18}}>{t('cars.spec.title', {defaultValue: 'Specifications'}) as string}</h2>
                <CarSpecTable attributes={a}/>
            </div>
            <aside style={{position: 'sticky', top: 16, alignSelf: 'flex-start'}}>
                <h1 data-testid="car-detail-title" style={{margin: '0 0 8px', fontSize: 22}}>{car.title}</h1>
                <div data-testid="car-detail-price" style={{fontSize: 26, fontWeight: 700, marginBottom: 8}}>
                    {formatEur(car.price, car.currency)}
                </div>
                <div style={{marginBottom: 12}}>
                    <VatBadge regime={a.vat_regime} testId="car-detail-vat"/>
                </div>
                <CarReservationCta carExternalId={car.externalId} carSlug={car.slug}/>
                {a.ss_com_url ? (
                    <p style={{fontSize: 12, opacity: 0.7, marginTop: 12}}>
                        <a href={a.ss_com_url} target="_blank" rel="nofollow noreferrer noopener" data-testid="car-detail-source-link">
                            {t('cars.source.original', {defaultValue: 'Original listing'}) as string}
                        </a>
                    </p>
                ) : null}
            </aside>
        </div>
    );
};

export default CarVehicleDetailPage;
