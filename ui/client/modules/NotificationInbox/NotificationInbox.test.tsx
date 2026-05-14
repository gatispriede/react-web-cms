// @vitest-environment jsdom
import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect, vi} from 'vitest';
import NotificationInbox from './NotificationInbox';
import type {NotificationRow} from './NotificationInbox.types';

const notifications: NotificationRow[] = [
    {id: 'n1', title: 'Order shipped', body: 'Tracking #ABC123', createdAt: '2026-05-10T09:00:00Z', readAt: null, href: '/account/orders/o1', category: 'shipment'},
    {id: 'n2', title: 'Payment received', createdAt: '2026-05-12T10:30:00Z', readAt: '2026-05-12T11:00:00Z', category: 'order'},
    {id: 'n3', title: 'Wishlist back in stock', createdAt: '2026-05-13T14:00:00Z', category: 'wishlist'},
];

const noop = () => {};
const allRead: NotificationRow[] = [{id: 'n9', title: 'Old', createdAt: '2026-01-01', readAt: '2026-01-02'}];

describe('NotificationInbox', () => {
    it('renders empty state when no notifications', () => {
        render(<NotificationInbox testId="ni" notifications={[]} onMarkRead={noop} />);
        expect(screen.getByTestId('ni-empty')).toBeInTheDocument();
        expect(screen.getByTestId('ni-empty-title')).toHaveTextContent('Your inbox is empty');
    });

    it('unread count chip renders only when count > 0', () => {
        const {rerender} = render(<NotificationInbox testId="ni" notifications={notifications} onMarkRead={noop} />);
        expect(screen.getByTestId('ni-unread-count')).toHaveTextContent('2');
        rerender(<NotificationInbox testId="ni" notifications={allRead} onMarkRead={noop} />);
        expect(screen.queryByTestId('ni-unread-count')).toBeNull();
    });

    it('mark-all hides when count is 0 OR onMarkAllRead not provided', () => {
        const {rerender} = render(<NotificationInbox testId="ni" notifications={notifications} onMarkRead={noop} />);
        expect(screen.queryByTestId('ni-mark-all')).toBeNull();
        rerender(<NotificationInbox testId="ni" notifications={allRead} onMarkRead={noop} onMarkAllRead={noop} />);
        expect(screen.queryByTestId('ni-mark-all')).toBeNull();
        rerender(<NotificationInbox testId="ni" notifications={notifications} onMarkRead={noop} onMarkAllRead={noop} />);
        expect(screen.getByTestId('ni-mark-all')).toBeInTheDocument();
    });

    it('data-unread reflects read state', () => {
        render(<NotificationInbox testId="ni" notifications={notifications} onMarkRead={noop} />);
        expect(screen.getByTestId('ni-row-n1').getAttribute('data-unread')).toBe('true');
        expect(screen.getByTestId('ni-row-n2').getAttribute('data-unread')).toBe('false');
        expect(screen.getByTestId('ni-row-n3').getAttribute('data-unread')).toBe('true');
    });

    it('mark-read button only on unread rows', () => {
        render(<NotificationInbox testId="ni" notifications={notifications} onMarkRead={noop} />);
        expect(screen.getByTestId('ni-mark-read-n1')).toBeInTheDocument();
        expect(screen.queryByTestId('ni-mark-read-n2')).toBeNull();
        expect(screen.getByTestId('ni-mark-read-n3')).toBeInTheDocument();
    });

    it('delete button only when onDelete is provided', () => {
        const {rerender} = render(<NotificationInbox testId="ni" notifications={notifications} onMarkRead={noop} />);
        expect(screen.queryByTestId('ni-delete-n1')).toBeNull();
        rerender(<NotificationInbox testId="ni" notifications={notifications} onMarkRead={noop} onDelete={noop} />);
        expect(screen.getByTestId('ni-delete-n1')).toBeInTheDocument();
    });

    it('click handlers fire with correct ids', () => {
        const onMarkRead = vi.fn();
        const onDelete = vi.fn();
        render(<NotificationInbox testId="ni" notifications={notifications} onMarkRead={onMarkRead} onDelete={onDelete} />);
        fireEvent.click(screen.getByTestId('ni-mark-read-n1'));
        fireEvent.click(screen.getByTestId('ni-delete-n2'));
        expect(onMarkRead).toHaveBeenCalledWith('n1');
        expect(onDelete).toHaveBeenCalledWith('n2');
    });

    it('mark-all click fires onMarkAllRead once', () => {
        const onMarkAllRead = vi.fn();
        render(<NotificationInbox testId="ni" notifications={notifications} onMarkRead={noop} onMarkAllRead={onMarkAllRead} />);
        fireEvent.click(screen.getByTestId('ni-mark-all'));
        expect(onMarkAllRead).toHaveBeenCalledTimes(1);
    });
});
