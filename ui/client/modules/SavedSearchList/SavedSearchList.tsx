import React, {useCallback} from 'react';
import EmptyStateBlock from '@client/lib/EmptyStateBlock';
import type {SavedSearch, SavedSearchListProps} from './SavedSearchList.types';
import './SavedSearchList.scss';

const DEFAULT_EMPTY_TITLE = 'No saved searches';
const EM_DASH = '—';

function formatResultCount(value: SavedSearch['lastResultCount']): string {
    if (value === null || value === undefined) return EM_DASH;
    return String(value);
}

const SavedSearchList: React.FC<SavedSearchListProps> = ({
    testId,
    searches,
    onEdit,
    onDelete,
    emptyState,
}) => {
    const handleEdit = useCallback((e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        onEdit(id);
    }, [onEdit]);

    const handleDelete = useCallback((e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        void onDelete(id);
    }, [onDelete]);

    if (searches.length === 0) {
        return (
            <EmptyStateBlock
                testId={`${testId}-empty`}
                title={emptyState?.title ?? DEFAULT_EMPTY_TITLE}
                description={emptyState?.description}
                primary={emptyState?.primary}
            />
        );
    }

    return (
        <ul className="saved-search-list" data-testid={testId}>
            {searches.map(s => (
                <li
                    key={s.id}
                    className="saved-search-list__row"
                    data-testid={`${testId}-row-${s.id}`}
                >
                    <a
                        className="saved-search-list__link"
                        href={s.href}
                        data-testid={`${testId}-link-${s.id}`}
                    >
                        <span
                            className="saved-search-list__name"
                            data-testid={`${testId}-name-${s.id}`}
                        >{s.name}</span>
                        <span className="saved-search-list__meta">
                            <span className="saved-search-list__count">
                                {formatResultCount(s.lastResultCount)}
                                <span className="saved-search-list__count-suffix"> results</span>
                            </span>
                            {s.lastScannedAt ? (
                                <small className="saved-search-list__scanned">{s.lastScannedAt}</small>
                            ) : null}
                        </span>
                    </a>
                    <span
                        className="saved-search-list__cadence"
                        data-testid={`${testId}-cadence-${s.id}`}
                        data-cadence={s.cadence}
                    >{s.cadence}</span>
                    <div className="saved-search-list__actions">
                        <button
                            type="button"
                            className="saved-search-list__edit"
                            data-testid={`${testId}-edit-${s.id}`}
                            onClick={e => handleEdit(e, s.id)}
                        >Edit</button>
                        <button
                            type="button"
                            className="saved-search-list__delete"
                            data-testid={`${testId}-delete-${s.id}`}
                            onClick={e => handleDelete(e, s.id)}
                        >Delete</button>
                    </div>
                </li>
            ))}
        </ul>
    );
};

export default SavedSearchList;
export {SavedSearchList};
