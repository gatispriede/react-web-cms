import React, {useCallback, useMemo} from 'react';
import EmptyStateBlock from '@client/lib/EmptyStateBlock';
import type {NotificationInboxProps, NotificationRow} from './NotificationInbox.types';

const DEFAULT_EMPTY_TITLE = 'Your inbox is empty';

function formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
}

function isUnread(n: NotificationRow): boolean {
    return n.readAt === null || n.readAt === undefined;
}

const NotificationInbox: React.FC<NotificationInboxProps> = ({
    testId,
    notifications,
    onMarkRead,
    onMarkAllRead,
    onDelete,
    emptyState,
}) => {
    const unreadCount = useMemo(() => notifications.filter(isUnread).length, [notifications]);

    const handleMarkRead = useCallback((id: string) => {
        void onMarkRead(id);
    }, [onMarkRead]);

    const handleMarkAll = useCallback(() => {
        if (onMarkAllRead) void onMarkAllRead();
    }, [onMarkAllRead]);

    const handleDelete = useCallback((id: string) => {
        if (onDelete) void onDelete(id);
    }, [onDelete]);

    if (notifications.length === 0) {
        return (
            <EmptyStateBlock
                testId={`${testId}-empty`}
                title={emptyState?.title ?? DEFAULT_EMPTY_TITLE}
                description={emptyState?.description}
                primary={emptyState?.primary}
            />
        );
    }

    const showMarkAll = Boolean(onMarkAllRead) && unreadCount > 0;

    return (
        <div className="notification-inbox" data-testid={testId}>
            <div className="notification-inbox__head">
                <h3 className="notification-inbox__title">Inbox</h3>
                {unreadCount > 0 ? (
                    <span
                        className="notification-inbox__unread-count"
                        data-testid={`${testId}-unread-count`}
                    >{unreadCount}</span>
                ) : null}
                {showMarkAll ? (
                    <button
                        type="button"
                        className="notification-inbox__mark-all"
                        data-testid={`${testId}-mark-all`}
                        onClick={handleMarkAll}
                    >Mark all as read</button>
                ) : null}
            </div>
            <ul className="notification-inbox__rows">
                {notifications.map(n => {
                    const unread = isUnread(n);
                    return (
                        <li
                            key={n.id}
                            className={`notification-inbox__row${unread ? ' notification-inbox__row--unread' : ''}`}
                            data-testid={`${testId}-row-${n.id}`}
                            data-unread={unread ? 'true' : 'false'}
                            data-category={n.category}
                        >
                            <span className="notification-inbox__dot" aria-hidden />
                            <div className="notification-inbox__body">
                                {n.href ? (
                                    <a className="notification-inbox__row-title" href={n.href}>{n.title}</a>
                                ) : (
                                    <span className="notification-inbox__row-title">{n.title}</span>
                                )}
                                {n.body ? (
                                    <span className="notification-inbox__row-body">{n.body}</span>
                                ) : null}
                                <small className="notification-inbox__row-date">{formatDate(n.createdAt)}</small>
                            </div>
                            <div className="notification-inbox__row-actions">
                                {unread ? (
                                    <button
                                        type="button"
                                        className="notification-inbox__mark-read"
                                        data-testid={`${testId}-mark-read-${n.id}`}
                                        onClick={() => handleMarkRead(n.id)}
                                    >Mark as read</button>
                                ) : null}
                                {onDelete ? (
                                    <button
                                        type="button"
                                        className="notification-inbox__delete"
                                        data-testid={`${testId}-delete-${n.id}`}
                                        onClick={() => handleDelete(n.id)}
                                    >Delete</button>
                                ) : null}
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default NotificationInbox;
export {NotificationInbox};
