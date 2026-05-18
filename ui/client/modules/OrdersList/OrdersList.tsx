import React, {useCallback} from 'react';
import EmptyStateBlock from '@client/lib/EmptyStateBlock';
import type {OrderListRow, OrderListStatus, OrdersListProps} from './OrdersList.types';

const DEFAULT_EMPTY_TITLE = 'No orders yet';

const FILTER_CHIPS: {status: OrderListStatus; label: string}[] = [
    {status: 'all', label: 'All'},
    {status: 'pending', label: 'Pending'},
    {status: 'paid', label: 'Paid'},
    {status: 'shipped', label: 'Shipped'},
    {status: 'delivered', label: 'Delivered'},
    {status: 'cancelled', label: 'Cancelled'},
    {status: 'refunded', label: 'Refunded'},
];

function formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString();
}

const OrdersList: React.FC<OrdersListProps> = ({
    testId,
    orders,
    activeStatus = 'all',
    onStatusChange,
    emptyState,
}) => {
    const handleChip = useCallback((status: OrderListStatus) => {
        if (onStatusChange) onStatusChange(status);
    }, [onStatusChange]);

    const renderChips = () => (
        <div className="orders-list__filters" role="group" aria-label="Filter orders by status">
            {FILTER_CHIPS.map(chip => {
                const isActive = chip.status === activeStatus;
                return (
                    <button
                        key={chip.status}
                        type="button"
                        className={`orders-list__chip${isActive ? ' orders-list__chip--active' : ''}`}
                        data-testid={`${testId}-filter-${chip.status}`}
                        data-status={chip.status}
                        aria-pressed={isActive}
                        onClick={() => handleChip(chip.status)}
                    >{chip.label}</button>
                );
            })}
        </div>
    );

    if (orders.length === 0) {
        return (
            <div className="orders-list orders-list--empty">
                {renderChips()}
                <EmptyStateBlock
                    testId={`${testId}-empty`}
                    title={emptyState?.title ?? DEFAULT_EMPTY_TITLE}
                    description={emptyState?.description}
                    primary={emptyState?.primary}
                />
            </div>
        );
    }

    return (
        <div className="orders-list">
            {renderChips()}
            <ul className="orders-list__rows" data-testid={testId}>
                {orders.map((o: OrderListRow) => (
                    <li
                        key={o.id}
                        className="orders-list__row"
                        data-testid={`${testId}-row-${o.id}`}
                    >
                        <a
                            className="orders-list__link"
                            href={o.href}
                            data-testid={`${testId}-link-${o.id}`}
                        >
                            <span className="orders-list__col orders-list__col--number">
                                <span className="orders-list__number">{o.orderNumber}</span>
                                <small className="orders-list__date">{formatDate(o.placedAt)}</small>
                            </span>
                            <span
                                className="orders-list__status"
                                data-testid={`${testId}-status-${o.id}`}
                                data-status={o.status}
                            >{o.status}</span>
                            <span className="orders-list__items">{o.itemCount} item{o.itemCount === 1 ? '' : 's'}</span>
                            <span className="orders-list__total">{o.totalFormatted}</span>
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default OrdersList;
export {OrdersList};
