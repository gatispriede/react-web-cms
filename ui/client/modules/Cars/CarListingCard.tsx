/**
 * Car listing card — Wave 7b. Renders one car summary tile for the
 * `/cars` index. Style-light (per spec — per-theme styling is Wave 5
 * follow-up); wires to the active theme via existing module shapes.
 */
import React from 'react';
import Link from 'next/link';
import {useT as useTranslation} from 'next-i18next/client';
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

function formatKm(value: string | undefined): string {
    if (!value) return '—';
    const n = Number(value);
    if (!Number.isFinite(n)) return value;
    return `${new Intl.NumberFormat().format(n)} km`;
}

const CarListingCard: React.FC<Props> = ({car, testId}) => {
    const {t} = useTranslation('common');
    const a = car.attributes ?? {};
    const heroImage = car.images?.[0];
    return (
        <Link
            href={`/cars/${car.slug}`}
            data-testid={testId ?? `car-card-${car.slug}`}
            style={{
                display: 'block',
                textDecoration: 'none',
                color: 'inherit',
                border: '1px solid var(--theme-border, rgba(0,0,0,0.12))',
                borderRadius: 8,
                overflow: 'hidden',
                background: 'var(--theme-surface, #fff)',
            }}
        >
            {heroImage ? (
                <img
                    src={heroImage}
                    alt={car.title}
                    loading="lazy"
                    width={400}
                    height={240}
                    style={{width: '100%', height: 240, objectFit: 'cover'}}
                />
            ) : (
                <div style={{width: '100%', height: 240, background: 'var(--theme-surface-muted, #eee)'}}/>
            )}
            <div style={{padding: 12}}>
                <div style={{display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline'}}>
                    <strong data-testid={`car-card-title-${car.slug}`}>{car.title}</strong>
                    <span data-testid={`car-card-price-${car.slug}`} style={{fontWeight: 700}}>
                        {formatEur(car.price, car.currency)}
                    </span>
                </div>
                <div style={{fontSize: 13, opacity: 0.75, marginTop: 4}}>
                    {a.year ? <span>{a.year} · </span> : null}
                    {a.fuel ? <span>{t(`cars.fuel.${a.fuel}`, {defaultValue: a.fuel}) as string} · </span> : null}
                    {a.transmission ? <span>{t(`cars.tx.${a.transmission}`, {defaultValue: a.transmission}) as string} · </span> : null}
                    <span>{formatKm(a.mileage_km)}</span>
                </div>
                <div style={{marginTop: 8}}>
                    <VatBadge regime={a.vat_regime} testId={`car-card-vat-${car.slug}`}/>
                </div>
            </div>
        </Link>
    );
};

export default CarListingCard;
