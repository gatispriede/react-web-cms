import React, {useCallback} from 'react';
import EmptyStateBlock from '@client/lib/EmptyStateBlock';
import type {PaymentMethodKind, PaymentMethodListProps} from './PaymentMethodList.types';

const DEFAULT_EMPTY_TITLE = 'No saved payment methods';

const KIND_LABEL: Record<PaymentMethodKind, string> = {
    card: 'Card',
    bank: 'Bank',
    paypal: 'PayPal',
};

const PaymentMethodList: React.FC<PaymentMethodListProps> = ({
    testId,
    methods,
    onAdd,
    onDelete,
    onSetDefault,
    emptyState,
}) => {
    const handleAdd = useCallback(() => {
        void onAdd();
    }, [onAdd]);

    const handleDelete = useCallback((id: string) => {
        void onDelete(id);
    }, [onDelete]);

    const handleSetDefault = useCallback((id: string) => {
        if (onSetDefault) void onSetDefault(id);
    }, [onSetDefault]);

    if (methods.length === 0) {
        return (
            <div className="payment-method-list payment-method-list--empty">
                <div className="payment-method-list__head">
                    <button
                        type="button"
                        className="payment-method-list__add"
                        data-testid={`${testId}-add`}
                        onClick={handleAdd}
                    >Add payment method</button>
                </div>
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
        <div className="payment-method-list" data-testid={testId}>
            <div className="payment-method-list__head">
                <button
                    type="button"
                    className="payment-method-list__add"
                    data-testid={`${testId}-add`}
                    onClick={handleAdd}
                >Add payment method</button>
            </div>
            <ul className="payment-method-list__rows">
                {methods.map(m => {
                    const showSetDefault = !m.isDefault && Boolean(onSetDefault);
                    return (
                        <li
                            key={m.id}
                            className="payment-method-list__row"
                            data-testid={`${testId}-row-${m.id}`}
                            data-kind={m.kind}
                        >
                            <span
                                className={`payment-method-list__badge payment-method-list__badge--${m.kind}`}
                                aria-label={KIND_LABEL[m.kind]}
                            >{KIND_LABEL[m.kind]}</span>
                            <span className="payment-method-list__body">
                                <span className="payment-method-list__label">{m.label}</span>
                                {m.expiresAt ? (
                                    <small className="payment-method-list__expiry">Expires {m.expiresAt}</small>
                                ) : null}
                            </span>
                            {m.isDefault ? (
                                <span
                                    className="payment-method-list__default"
                                    data-testid={`${testId}-default-${m.id}`}
                                >Default</span>
                            ) : null}
                            <div className="payment-method-list__actions">
                                {showSetDefault ? (
                                    <button
                                        type="button"
                                        className="payment-method-list__set-default"
                                        data-testid={`${testId}-set-default-${m.id}`}
                                        onClick={() => handleSetDefault(m.id)}
                                    >Make default</button>
                                ) : null}
                                <button
                                    type="button"
                                    className="payment-method-list__delete"
                                    data-testid={`${testId}-delete-${m.id}`}
                                    onClick={() => handleDelete(m.id)}
                                >Delete</button>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default PaymentMethodList;
export {PaymentMethodList};
