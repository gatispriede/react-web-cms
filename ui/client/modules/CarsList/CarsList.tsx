import React, {useCallback, useMemo, useState} from 'react';
import CarListingCard from '@client/modules/CarListingCard/CarListingCard';
import EmptyStateBlock from '@client/lib/EmptyStateBlock';
import {
    type CarsListFilterValues,
    type CarsListProps,
    FUEL_VALUES,
    GEARBOX_VALUES,
    FUEL_LABELS,
    GEARBOX_LABELS,
} from './CarsList.types';

function isFilterSet(f: CarsListFilterValues): boolean {
    if (f.make) return true;
    if (f.model) return true;
    if (f.fuel && f.fuel !== 'all') return true;
    if (f.gearbox && f.gearbox !== 'all') return true;
    if (typeof f.minYear === 'number') return true;
    if (typeof f.maxYear === 'number') return true;
    if (typeof f.minPrice === 'number') return true;
    if (typeof f.maxPrice === 'number') return true;
    if (typeof f.maxMileage === 'number') return true;
    return false;
}

function toNumOrUndefined(v: string): number | undefined {
    if (v.trim() === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
}

const CarsList: React.FC<CarsListProps> = ({
    testId,
    cars,
    totalCount,
    filters,
    facets,
    onFilterChange,
    hasMore,
    onLoadMore,
    emptyState,
}) => {
    const [loadingMore, setLoadingMore] = useState(false);
    const filtersActive = useMemo(() => isFilterSet(filters), [filters]);

    const update = useCallback((patch: Partial<CarsListFilterValues>) => {
        onFilterChange({...filters, ...patch});
    }, [filters, onFilterChange]);

    const clear = useCallback(() => {
        onFilterChange({});
    }, [onFilterChange]);

    const handleLoadMore = useCallback(async () => {
        if (!onLoadMore || loadingMore) return;
        setLoadingMore(true);
        try {
            await onLoadMore();
        } finally {
            setLoadingMore(false);
        }
    }, [onLoadMore, loadingMore]);

    if (cars.length === 0) {
        const title = emptyState?.title ?? 'No cars match your filters';
        const description = emptyState?.description;
        const primary = emptyState?.primary
            ? {
                label: emptyState.primary.label,
                href: emptyState.primary.href,
                onClick: emptyState.primary.onClick,
            }
            : {label: 'Clear filters', onClick: clear};
        return (
            <EmptyStateBlock
                testId={`${testId}-empty`}
                title={title}
                description={description}
                primary={primary}
            />
        );
    }

    const currentFuel = filters.fuel ?? 'all';
    const currentGearbox = filters.gearbox ?? 'all';

    return (
        <div className="cars-list" data-testid={testId}>
            <form
                className="cars-list__filters"
                data-testid={`${testId}-filters`}
                onSubmit={e => e.preventDefault()}
            >
                <label className="cars-list__field">
                    <span className="cars-list__field-label">Make</span>
                    <select
                        className="cars-list__select"
                        value={filters.make ?? ''}
                        onChange={e => update({make: e.target.value || undefined, model: undefined})}
                        data-testid={`${testId}-filter-make`}
                    >
                        <option value="">Any make</option>
                        {facets.makes.map(opt => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label} ({opt.count})
                            </option>
                        ))}
                    </select>
                </label>

                <label className="cars-list__field">
                    <span className="cars-list__field-label">Model</span>
                    <select
                        className="cars-list__select"
                        value={filters.model ?? ''}
                        onChange={e => update({model: e.target.value || undefined})}
                        data-testid={`${testId}-filter-model`}
                    >
                        <option value="">Any model</option>
                        {facets.models.map(opt => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label} ({opt.count})
                            </option>
                        ))}
                    </select>
                </label>

                <div className="cars-list__chip-group" role="group" aria-label="Fuel">
                    {FUEL_VALUES.map(value => (
                        <button
                            key={value}
                            type="button"
                            className={`cars-list__chip${currentFuel === value ? ' cars-list__chip--active' : ''}`}
                            data-testid={`${testId}-filter-fuel-${value}`}
                            aria-pressed={currentFuel === value}
                            onClick={() => update({fuel: value})}
                        >{FUEL_LABELS[value]}</button>
                    ))}
                </div>

                <div className="cars-list__chip-group" role="group" aria-label="Gearbox">
                    {GEARBOX_VALUES.map(value => (
                        <button
                            key={value}
                            type="button"
                            className={`cars-list__chip${currentGearbox === value ? ' cars-list__chip--active' : ''}`}
                            data-testid={`${testId}-filter-gearbox-${value}`}
                            aria-pressed={currentGearbox === value}
                            onClick={() => update({gearbox: value})}
                        >{GEARBOX_LABELS[value]}</button>
                    ))}
                </div>

                <div className="cars-list__range">
                    <label className="cars-list__field">
                        <span className="cars-list__field-label">Min year</span>
                        <input
                            type="number"
                            className="cars-list__input"
                            value={filters.minYear ?? ''}
                            onChange={e => update({minYear: toNumOrUndefined(e.target.value)})}
                            data-testid={`${testId}-filter-min-year`}
                        />
                    </label>
                    <label className="cars-list__field">
                        <span className="cars-list__field-label">Max year</span>
                        <input
                            type="number"
                            className="cars-list__input"
                            value={filters.maxYear ?? ''}
                            onChange={e => update({maxYear: toNumOrUndefined(e.target.value)})}
                            data-testid={`${testId}-filter-max-year`}
                        />
                    </label>
                </div>

                <div className="cars-list__range">
                    <label className="cars-list__field">
                        <span className="cars-list__field-label">Min price</span>
                        <input
                            type="number"
                            className="cars-list__input"
                            value={filters.minPrice ?? ''}
                            onChange={e => update({minPrice: toNumOrUndefined(e.target.value)})}
                            data-testid={`${testId}-filter-min-price`}
                        />
                    </label>
                    <label className="cars-list__field">
                        <span className="cars-list__field-label">Max price</span>
                        <input
                            type="number"
                            className="cars-list__input"
                            value={filters.maxPrice ?? ''}
                            onChange={e => update({maxPrice: toNumOrUndefined(e.target.value)})}
                            data-testid={`${testId}-filter-max-price`}
                        />
                    </label>
                </div>

                <label className="cars-list__field">
                    <span className="cars-list__field-label">Max mileage</span>
                    <input
                        type="number"
                        className="cars-list__input"
                        value={filters.maxMileage ?? ''}
                        onChange={e => update({maxMileage: toNumOrUndefined(e.target.value)})}
                        data-testid={`${testId}-filter-max-mileage`}
                    />
                </label>

                {filtersActive ? (
                    <button
                        type="button"
                        className="cars-list__clear"
                        data-testid={`${testId}-clear-filters`}
                        onClick={clear}
                    >Clear filters</button>
                ) : null}
            </form>

            <div className="cars-list__results">
                <div className="cars-list__count" data-testid={`${testId}-count`}>
                    {totalCount} {totalCount === 1 ? 'car' : 'cars'}
                </div>

                <div className="cars-list__grid" data-testid={`${testId}-grid`}>
                    {cars.map(car => (
                        <CarListingCard key={car.productId} listing={car} />
                    ))}
                </div>

                {hasMore && onLoadMore ? (
                    <button
                        type="button"
                        className="cars-list__load-more"
                        data-testid={`${testId}-load-more`}
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                    >{loadingMore ? 'Loading...' : 'Load more'}</button>
                ) : null}
            </div>
        </div>
    );
};

export default CarsList;
export {CarsList};
