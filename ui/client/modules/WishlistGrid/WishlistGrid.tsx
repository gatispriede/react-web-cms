import React, {useCallback} from 'react';
import EmptyStateBlock from '@client/lib/EmptyStateBlock';
import type {WishlistGridProps, WishlistItem} from './WishlistGrid.types';
import './WishlistGrid.scss';

const DEFAULT_EMPTY_TITLE = 'Nothing in your wishlist yet';

const WishlistGrid: React.FC<WishlistGridProps> = ({
    testId,
    items,
    onRemove,
    onPrimaryAction,
    emptyState,
    columns,
}) => {
    const handlePrimary = useCallback((e: React.MouseEvent, item: WishlistItem) => {
        e.preventDefault();
        e.stopPropagation();
        void onPrimaryAction(item);
    }, [onPrimaryAction]);

    const handleRemove = useCallback((e: React.MouseEvent, productId: string) => {
        e.preventDefault();
        e.stopPropagation();
        void onRemove(productId);
    }, [onRemove]);

    if (items.length === 0) {
        return (
            <EmptyStateBlock
                testId={`${testId}-empty`}
                title={emptyState?.title ?? DEFAULT_EMPTY_TITLE}
                description={emptyState?.description}
                primary={emptyState?.primary}
            />
        );
    }

    const className = `wishlist-grid${columns ? ` wishlist-grid--cols-${columns}` : ''}`;

    return (
        <ul
            className={className}
            data-testid={testId}
            data-columns={columns ?? 'auto'}
        >
            {items.map(item => {
                const primaryLabel = item.isReservation ? 'Reserve' : 'Move to cart';
                return (
                    <li
                        key={item.productId}
                        className="wishlist-grid__row"
                        data-testid={`${testId}-row-${item.productId}`}
                    >
                        <a
                            className="wishlist-grid__link"
                            href={item.href}
                            data-testid={`${testId}-link-${item.productId}`}
                        >
                            <span
                                className="wishlist-grid__thumb"
                                style={{backgroundImage: `url(${item.thumbUrl})`}}
                                role="img"
                                aria-label={item.title}
                            />
                            <span className="wishlist-grid__title">{item.title}</span>
                            <span className="wishlist-grid__price">{item.priceFormatted}</span>
                        </a>
                        <div className="wishlist-grid__actions">
                            <button
                                type="button"
                                className="wishlist-grid__primary"
                                data-testid={`${testId}-primary-${item.productId}`}
                                onClick={e => handlePrimary(e, item)}
                            >{primaryLabel}</button>
                            <button
                                type="button"
                                className="wishlist-grid__remove"
                                data-testid={`${testId}-remove-${item.productId}`}
                                onClick={e => handleRemove(e, item.productId)}
                            >Remove</button>
                        </div>
                    </li>
                );
            })}
        </ul>
    );
};

export default WishlistGrid;
export {WishlistGrid};
