/**
 * all-pages-module-composed — Account batch admin editors.
 *
 * Thin copy editors for the 4 Account smart-wrapper modules. The
 * structural behaviour (GraphQL fetch, mutation wiring) lives in
 * `ui/client/modules/_AccountPageModules/wrappers.tsx`; these editors
 * only expose the operator-editable copy (section titles, empty-state
 * text, the contact-support link target).
 *
 * Cargo-cult of `ui/admin/modules/_CheckoutPageModules/editors.tsx`.
 */
import React from 'react';
import {Input} from 'antd';
import type {IInputContent} from '@interfaces/IInputContent';

function parse<T>(raw: string): T {
    if (!raw) return {} as T;
    try { return JSON.parse(raw) as T; } catch { return {} as T; }
}
function stringify<T>(v: T): string {
    try { return JSON.stringify(v); } catch { return '{}'; }
}

function useTypedContent<T>({content, setContent}: IInputContent): [T, (patch: Partial<T>) => void] {
    const data = parse<T>(content);
    const patch = (p: Partial<T>) => setContent(stringify({...data, ...p}));
    return [data, patch];
}

const Field: React.FC<{label: string; testid: string; value: string; onChange: (v: string) => void; placeholder?: string}> =
    ({label, testid, value, onChange, placeholder}) => (
        <div style={{marginBottom: 12}}>
            <label style={{display: 'block', fontSize: 12, opacity: 0.8, marginBottom: 4}}>{label}</label>
            <Input data-testid={`editor-${testid}`} value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}/>
        </div>
    );

interface OrdersListContent {
    title?: string;
    emptyTitle?: string;
    emptyDescription?: string;
}
interface OrderDetailContent {
    supportHref?: string;
}
interface AddressListContent {
    title?: string;
    emptyTitle?: string;
    emptyDescription?: string;
}
interface NotificationInboxContent {
    emptyTitle?: string;
    emptyDescription?: string;
}

export const OrdersListEditor: React.FC<IInputContent> = (props) => {
    const [d, patch] = useTypedContent<OrdersListContent>(props);
    return (
        <div className="account-editor account-editor--orders-list" data-testid="editor-orders-list">
            <Field label="Section heading (optional)" testid="orders-list-title" value={d.title ?? ''} onChange={v => patch({title: v})} placeholder="My orders"/>
            <Field label="Empty-state title" testid="orders-list-empty-title" value={d.emptyTitle ?? ''} onChange={v => patch({emptyTitle: v})} placeholder="No orders yet"/>
            <Field label="Empty-state description (optional)" testid="orders-list-empty-body" value={d.emptyDescription ?? ''} onChange={v => patch({emptyDescription: v})}/>
        </div>
    );
};

export const OrderDetailEditor: React.FC<IInputContent> = (props) => {
    const [d, patch] = useTypedContent<OrderDetailContent>(props);
    return (
        <div className="account-editor account-editor--order-detail" data-testid="editor-order-detail">
            <Field label="Contact-support link target" testid="order-detail-support-href" value={d.supportHref ?? ''} onChange={v => patch({supportHref: v})} placeholder="/account/inbox"/>
        </div>
    );
};

export const AddressListEditor: React.FC<IInputContent> = (props) => {
    const [d, patch] = useTypedContent<AddressListContent>(props);
    return (
        <div className="account-editor account-editor--address-list" data-testid="editor-address-list">
            <Field label="Section heading (optional)" testid="address-list-title" value={d.title ?? ''} onChange={v => patch({title: v})} placeholder="Shipping addresses"/>
            <Field label="Empty-state title" testid="address-list-empty-title" value={d.emptyTitle ?? ''} onChange={v => patch({emptyTitle: v})} placeholder="No saved addresses"/>
            <Field label="Empty-state description (optional)" testid="address-list-empty-body" value={d.emptyDescription ?? ''} onChange={v => patch({emptyDescription: v})}/>
        </div>
    );
};

export const NotificationInboxEditor: React.FC<IInputContent> = (props) => {
    const [d, patch] = useTypedContent<NotificationInboxContent>(props);
    return (
        <div className="account-editor account-editor--notification-inbox" data-testid="editor-notification-inbox">
            <Field label="Empty-state title" testid="notification-inbox-empty-title" value={d.emptyTitle ?? ''} onChange={v => patch({emptyTitle: v})} placeholder="Your inbox is empty"/>
            <Field label="Empty-state description (optional)" testid="notification-inbox-empty-body" value={d.emptyDescription ?? ''} onChange={v => patch({emptyDescription: v})}/>
        </div>
    );
};
