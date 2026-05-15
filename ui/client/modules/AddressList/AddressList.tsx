import React, {useCallback} from 'react';
import EmptyStateBlock from '@client/lib/EmptyStateBlock';
import type {AddressListAddress, AddressListProps} from './AddressList.types';

const DEFAULT_EMPTY_TITLE = 'No saved addresses';
const DEFAULT_EMPTY_PRIMARY_LABEL = 'Add your first address';

function formatRegionLine(a: AddressListAddress): string {
    return [a.postalCode, a.city, a.region].filter(Boolean).join(' ');
}

const AddressList: React.FC<AddressListProps> = ({
    testId,
    addresses,
    onAdd,
    onEdit,
    onDelete,
    onSetDefault,
    emptyState,
}) => {
    const handleAdd = useCallback(() => {
        void onAdd();
    }, [onAdd]);

    const handleEdit = useCallback((id: string) => {
        onEdit(id);
    }, [onEdit]);

    const handleDelete = useCallback((id: string) => {
        void onDelete(id);
    }, [onDelete]);

    const handleSetDefault = useCallback((id: string) => {
        if (onSetDefault) void onSetDefault(id);
    }, [onSetDefault]);

    if (addresses.length === 0) {
        const fallbackPrimary = {label: DEFAULT_EMPTY_PRIMARY_LABEL, onClick: handleAdd};
        return (
            <EmptyStateBlock
                testId={`${testId}-empty`}
                title={emptyState?.title ?? DEFAULT_EMPTY_TITLE}
                description={emptyState?.description}
                primary={emptyState?.primary ?? fallbackPrimary}
            />
        );
    }

    return (
        <div className="address-list" data-testid={testId}>
            <div className="address-list__head">
                <button
                    type="button"
                    className="address-list__add"
                    data-testid={`${testId}-add`}
                    onClick={handleAdd}
                >Add address</button>
            </div>
            <ul className="address-list__cards">
                {addresses.map(a => {
                    const showSetDefault = !a.isDefault && Boolean(onSetDefault);
                    return (
                        <li
                            key={a.id}
                            className="address-list__card"
                            data-testid={`${testId}-card-${a.id}`}
                        >
                            <div className="address-list__card-head">
                                {a.label ? (
                                    <span className="address-list__label">{a.label}</span>
                                ) : null}
                                {a.isDefault ? (
                                    <span
                                        className="address-list__default"
                                        data-testid={`${testId}-default-${a.id}`}
                                    >Default</span>
                                ) : null}
                            </div>
                            <div className="address-list__body">
                                <strong className="address-list__name">{a.name}</strong>
                                <span className="address-list__line">{a.line1}</span>
                                {a.line2 ? (
                                    <span className="address-list__line">{a.line2}</span>
                                ) : null}
                                <span className="address-list__line">{formatRegionLine(a)}</span>
                                <span className="address-list__line">{a.country}</span>
                                {a.phone ? (
                                    <span className="address-list__line address-list__line--phone">{a.phone}</span>
                                ) : null}
                            </div>
                            <div className="address-list__actions">
                                <button
                                    type="button"
                                    className="address-list__edit"
                                    data-testid={`${testId}-edit-${a.id}`}
                                    onClick={() => handleEdit(a.id)}
                                >Edit</button>
                                <button
                                    type="button"
                                    className="address-list__delete"
                                    data-testid={`${testId}-delete-${a.id}`}
                                    onClick={() => handleDelete(a.id)}
                                >Delete</button>
                                {showSetDefault ? (
                                    <button
                                        type="button"
                                        className="address-list__set-default"
                                        data-testid={`${testId}-set-default-${a.id}`}
                                        onClick={() => handleSetDefault(a.id)}
                                    >Make default</button>
                                ) : null}
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default AddressList;
export {AddressList};
