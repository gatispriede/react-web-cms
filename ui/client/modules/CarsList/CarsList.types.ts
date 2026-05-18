import type {ICarListingCard} from '@client/modules/CarListingCard/CarListingCard.types';

export interface CarsListFilterValues {
    make?: string;
    model?: string;
    fuel?: 'petrol' | 'diesel' | 'hybrid' | 'electric' | 'lpg' | 'all';
    gearbox?: 'manual' | 'automatic' | 'all';
    minYear?: number;
    maxYear?: number;
    minPrice?: number;
    maxPrice?: number;
    maxMileage?: number;
}

export interface CarsListFacets {
    makes: ReadonlyArray<{value: string; label: string; count: number}>;
    models: ReadonlyArray<{value: string; label: string; count: number}>;
}

export interface CarsListProps {
    testId: string;
    cars: ICarListingCard[];
    totalCount: number;
    filters: CarsListFilterValues;
    facets: CarsListFacets;
    onFilterChange: (next: CarsListFilterValues) => void;
    hasMore?: boolean;
    onLoadMore?: () => void | Promise<void>;
    emptyState?: {
        title: string;
        description?: string;
        primary?: {label: string; href?: string; onClick?: () => void};
    };
}

export const FUEL_VALUES: ReadonlyArray<NonNullable<CarsListFilterValues['fuel']>> = [
    'all', 'petrol', 'diesel', 'hybrid', 'electric', 'lpg',
];

export const GEARBOX_VALUES: ReadonlyArray<NonNullable<CarsListFilterValues['gearbox']>> = [
    'all', 'manual', 'automatic',
];

export const FUEL_LABELS: Record<NonNullable<CarsListFilterValues['fuel']>, string> = {
    all: 'Any fuel',
    petrol: 'Petrol',
    diesel: 'Diesel',
    hybrid: 'Hybrid',
    electric: 'Electric',
    lpg: 'LPG',
};

export const GEARBOX_LABELS: Record<NonNullable<CarsListFilterValues['gearbox']>, string> = {
    all: 'Any gearbox',
    manual: 'Manual',
    automatic: 'Automatic',
};
