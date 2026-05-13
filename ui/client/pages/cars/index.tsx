/**
 * `/cars` storefront index — Wave 7b. Lists imported car listings,
 * paginated server-side via /api/cars. Filter system reuse: the
 * faceted-filter system (storefront-faceted-filter-system) is not yet
 * shipped — this page ships a simple sort+filter shell with `Select`
 * controls keyed off the live attribute set per project standards
 * (predefined selections beat free-text). Wave-5 work will replace
 * the shell with the faceted filter system.
 */
import React, {useEffect, useMemo, useState} from 'react';
import type {GetServerSideProps} from 'next';
import Head from 'next/head';
import {useTranslation} from 'next-i18next/pages';
import {serverSideTranslations} from 'next-i18next/pages/serverSideTranslations';
import {CarListingCard, type CarListing, CAR_FUEL_TYPES} from '@client/modules/Cars';

interface Props {
    cars: CarListing[];
}

type SortOption = 'recent' | 'price-asc' | 'price-desc' | 'year-desc' | 'mileage-asc';
const SORT_OPTIONS: SortOption[] = ['recent', 'price-asc', 'price-desc', 'year-desc', 'mileage-asc'];

const CarsIndex: React.FC<Props> = ({cars}) => {
    const {t} = useTranslation('common');
    const [sort, setSort] = useState<SortOption>('recent');
    const [make, setMake] = useState<string>('');
    const [fuel, setFuel] = useState<string>('');
    const [data, setData] = useState<CarListing[]>(cars);
    const [loading, setLoading] = useState(false);

    // Predefined makes derived from the live dataset — see project
    // standard: predefined selections beat free-text inputs.
    const makes = useMemo(() => {
        const set = new Set<string>();
        for (const c of data) {
            const m = c.attributes?.make;
            if (m) set.add(m);
        }
        return [...set].sort();
    }, [data]);

    useEffect(() => {
        const ctl = new AbortController();
        let cancelled = false;
        const run = async () => {
            const q = new URLSearchParams();
            if (sort) q.set('sort', sort);
            if (make) q.set('make', make);
            if (fuel) q.set('fuel', fuel);
            if (cancelled) return;
            setLoading(true);
            try {
                const r = await fetch(`/api/cars?${q.toString()}`, {signal: ctl.signal, credentials: 'same-origin'});
                const json = await r.json();
                if (!cancelled && Array.isArray(json?.rows)) setData(json.rows);
            } catch {
                /* swallow — keep last good data */
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void run();
        return () => { cancelled = true; ctl.abort(); };
    }, [sort, make, fuel]);

    return (
        <div style={{maxWidth: 1200, margin: '0 auto', padding: 16}} data-testid="cars-index">
            <Head>
                <title>{t('cars.index.title', {defaultValue: 'Cars'}) as string}</title>
            </Head>
            <h1>{t('cars.index.title', {defaultValue: 'Cars'}) as string}</h1>
            <div
                data-testid="cars-filter-shell"
                style={{display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16}}
            >
                <label>
                    <span style={{marginRight: 6, fontSize: 13}}>{t('Sort', {defaultValue: 'Sort'}) as string}</span>
                    <select
                        data-testid="cars-sort-select"
                        value={sort}
                        onChange={e => setSort(e.target.value as SortOption)}
                    >
                        {SORT_OPTIONS.map(s => (
                            <option key={s} value={s}>
                                {t(`cars.sort.${s}`, {defaultValue: s}) as string}
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    <span style={{marginRight: 6, fontSize: 13}}>{t('Make', {defaultValue: 'Make'}) as string}</span>
                    <select
                        data-testid="cars-make-select"
                        value={make}
                        onChange={e => setMake(e.target.value)}
                    >
                        <option value="">{t('cars.filter.any', {defaultValue: 'Any'}) as string}</option>
                        {makes.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </label>
                <label>
                    <span style={{marginRight: 6, fontSize: 13}}>{t('Fuel', {defaultValue: 'Fuel'}) as string}</span>
                    <select
                        data-testid="cars-fuel-select"
                        value={fuel}
                        onChange={e => setFuel(e.target.value)}
                    >
                        <option value="">{t('cars.filter.any', {defaultValue: 'Any'}) as string}</option>
                        {CAR_FUEL_TYPES.map(f => <option key={f} value={f}>{t(`cars.fuel.${f}`, {defaultValue: f}) as string}</option>)}
                    </select>
                </label>
                {loading ? <span data-testid="cars-loading">…</span> : null}
            </div>
            {data.length === 0 ? (
                <p data-testid="cars-empty">{t('cars.index.empty', {defaultValue: 'No cars available right now.'}) as string}</p>
            ) : (
                <div
                    data-testid="cars-grid"
                    style={{display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))'}}
                >
                    {data.map(car => (
                        <CarListingCard key={car.id} car={car}/>
                    ))}
                </div>
            )}
        </div>
    );
};

export const getServerSideProps: GetServerSideProps<Props> = async ({locale}) => {
    let cars: CarListing[] = [];
    try {
        // SSR fetch via direct DB to avoid HTTP loopback. Keep behaviour
        // parallel to /api/cars handler.
        const {getMongoConnection} = await import('@services/infra/mongoDBConnection');
        const conn = getMongoConnection();
        for (let i = 0; i < 30 && !conn.database; i++) {
            await new Promise(r => setTimeout(r, 100));
        }
        if (conn.database) {
            const rows = await conn.database
                .collection('Products')
                .find({categories: 'cars', draft: {$ne: true}}, {projection: {_id: 0}})
                .sort({updatedAt: -1})
                .limit(50)
                .toArray();
            cars = rows as unknown as CarListing[];
        }
    } catch {
        cars = [];
    }
    const i18n = await serverSideTranslations(locale ?? 'en', ['common']).catch(() => ({}));
    return {props: {cars, ...(i18n as object)} as Props};
};

export default CarsIndex;
