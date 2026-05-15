/**
 * all-pages-module-composed — Cars batch smart wrappers.
 *
 * `CarsListHost` bridges the new pure `CarsList` faceted-listing module
 * to the `{item}` SystemPageDispatch contract: it fetches the storefront
 * `/api/cars` feed once, maps each `IProduct` car row onto the module's
 * `ICarListingCard` shape, derives the make/model facets, and applies
 * the module's filter values client-side (the `/api/cars` endpoint only
 * filters make + fuel server-side, so faceting + range filters run in
 * the host — fine for the ≤200-row storefront feed).
 *
 * `CarDetailHost` wraps the existing `Cars/CarVehicleDetailPage`
 * composite — that component already self-maps a whole `CarListing`
 * (gallery + spec table + VAT badge + reservation CTA), so the host
 * just fetches the car by `[slug]` and hands it over.
 */
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useRouter} from 'next/router';
import type {IItem} from '@interfaces/IItem';
import type {IProduct} from '@interfaces/IProduct';
import type {VatRegime} from '@client/components/VatBadge';
import CarsList from '@client/modules/CarsList/CarsList';
import type {CarsListFacets, CarsListFilterValues} from '@client/modules/CarsList/CarsList.types';
import type {ICarListingCard} from '@client/modules/CarListingCard/CarListingCard.types';
import {CarVehicleDetailPage, type CarListing} from '@client/modules/Cars';

function parse<T>(raw: string | undefined): T {
    if (!raw) return {} as T;
    try { return JSON.parse(raw) as T; } catch { return {} as T; }
}

function formatEur(cents: number, currency = 'EUR'): string {
    try {
        return new Intl.NumberFormat(undefined, {style: 'currency', currency, maximumFractionDigits: 0}).format((cents ?? 0) / 100);
    } catch {
        return `${Math.round((cents ?? 0) / 100)} ${currency}`;
    }
}

/** Map a warehouse car `IProduct` onto the pure module's card shape.
 *  Attribute keys mirror `SsComCarsNormaliser.buildAttributes`. */
function toCard(p: IProduct): ICarListingCard {
    const a = p.attributes ?? {};
    const gearbox: ICarListingCard['gearbox'] = a.transmission === 'automatic' ? 'automatic' : 'manual';
    const mileageKm = a.mileage_km ? `${a.mileage_km} km` : '—';
    return {
        productId: p.id,
        title: p.title,
        priceFormatted: formatEur(p.price, p.currency),
        mileage: mileageKm,
        fuel: a.fuel ?? '—',
        gearbox,
        year: Number(a.year) || 0,
        region: a.region ?? '',
        vatRegime: (a.vat_regime as VatRegime) ?? ('unknown' as VatRegime),
        photoCount: Array.isArray(p.images) ? p.images.length : 0,
        thumbUrl: (Array.isArray(p.images) && p.images[0]) || '',
        href: `/cars/${p.slug}`,
    };
}

function matchesFilters(p: IProduct, f: CarsListFilterValues): boolean {
    const a = p.attributes ?? {};
    if (f.make && a.make !== f.make) return false;
    if (f.model && a.model !== f.model) return false;
    if (f.fuel && f.fuel !== 'all' && a.fuel !== f.fuel) return false;
    if (f.gearbox && f.gearbox !== 'all' && a.transmission !== f.gearbox) return false;
    const year = Number(a.year);
    if (typeof f.minYear === 'number' && (!year || year < f.minYear)) return false;
    if (typeof f.maxYear === 'number' && (!year || year > f.maxYear)) return false;
    // Filter price inputs are read as major units; `p.price` is minor units.
    const priceMajor = (p.price ?? 0) / 100;
    if (typeof f.minPrice === 'number' && priceMajor < f.minPrice) return false;
    if (typeof f.maxPrice === 'number' && priceMajor > f.maxPrice) return false;
    if (typeof f.maxMileage === 'number') {
        const km = Number(a.mileage_km);
        if (!km || km > f.maxMileage) return false;
    }
    return true;
}

/** Count distinct attribute values into facet `{value, label, count}` rows. */
function facetOf(rows: IProduct[], key: 'make' | 'model'): CarsListFacets['makes'] {
    const counts = new Map<string, number>();
    for (const p of rows) {
        const v = p.attributes?.[key];
        if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return [...counts.entries()]
        .sort((x, y) => x[0].localeCompare(y[0]))
        .map(([value, count]) => ({value, label: value, count}));
}

interface CarsListContent {
    emptyTitle?: string;
    emptyDescription?: string;
}

export const CarsListHost: React.FC<{item: IItem}> = ({item}) => {
    const c = parse<CarsListContent>(item.content);
    const [rows, setRows] = useState<IProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState<CarsListFilterValues>({});

    useEffect(() => {
        let live = true;
        fetch('/api/cars?limit=200', {credentials: 'same-origin'})
            .then(r => r.json())
            .then((j: {rows?: IProduct[]}) => { if (live) setRows(Array.isArray(j?.rows) ? j.rows : []); })
            .catch(() => { if (live) setRows([]); })
            .finally(() => { if (live) setLoading(false); });
        return () => { live = false; };
    }, []);

    const filtered = useMemo(() => rows.filter(p => matchesFilters(p, filters)), [rows, filters]);
    const cards = useMemo(() => filtered.map(toCard), [filtered]);
    const facets: CarsListFacets = useMemo(() => ({
        // Makes from the whole feed; models scoped to the chosen make.
        makes: facetOf(rows, 'make'),
        models: facetOf(filters.make ? rows.filter(p => p.attributes?.make === filters.make) : rows, 'model'),
    }), [rows, filters.make]);

    const onFilterChange = useCallback((next: CarsListFilterValues) => setFilters(next), []);

    if (loading) return <p data-testid="cars-index-loading">Loading…</p>;

    return (
        <CarsList
            testId="cars-index"
            cars={cards}
            totalCount={cards.length}
            filters={filters}
            facets={facets}
            onFilterChange={onFilterChange}
            emptyState={{
                title: c.emptyTitle ?? 'No cars match your filters',
                description: c.emptyDescription,
            }}
        />
    );
};

export const CarDetailHost: React.FC<{item: IItem}> = () => {
    const router = useRouter();
    const slug = typeof router.query.slug === 'string' ? router.query.slug : null;
    const [car, setCar] = useState<CarListing | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!slug) return;
        let live = true;
        fetch(`/api/cars?slug=${encodeURIComponent(slug)}`, {credentials: 'same-origin'})
            .then(r => (r.ok ? r.json() : null))
            .then((row: CarListing | null) => { if (live) setCar(row); })
            .catch(() => { if (live) setCar(null); })
            .finally(() => { if (live) setLoading(false); });
        return () => { live = false; };
    }, [slug]);

    if (loading) return <p data-testid="cars-detail-loading">Loading…</p>;
    if (!car) return <p data-testid="cars-detail-missing">Car not found.</p>;

    return <CarVehicleDetailPage car={car} testId="cars-detail"/>;
};
