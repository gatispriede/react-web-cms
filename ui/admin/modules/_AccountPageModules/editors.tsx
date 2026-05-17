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

/**
 * `/account` home dashboard — locked entry-points grid. v1 ships with
 * no operator-editable copy; the dashboard renders the default card
 * set defined in `AccountDashboardGrid.types.ts` and surfaces saved-
 * address count as the only badge. A future operator-controllable
 * card-visibility / reorder editor would slot here.
 */
export const AccountDashboardGridEditor: React.FC<IInputContent> = () => {
    return (
        <div className="account-editor account-editor--dashboard-grid" data-testid="editor-account-dashboard-grid">
            <p style={{margin: 0, color: 'var(--ink-2)'}}>
                Locked layout — renders the default account-page entry-points grid.
                Compose marketing modules around the locked section to extend the page.
            </p>
        </div>
    );
};

// ── Auth batch ───────────────────────────────────────────────────────

interface SigninFormContent {
    headline?: string;
    submitLabel?: string;
    forgotHref?: string;
    signupHref?: string;
}
interface SignupFormContent {
    headline?: string;
    submitLabel?: string;
    signinHref?: string;
}
interface MagicLinkRequestContent {
    headline?: string;
    body?: string;
    placeholder?: string;
    submitLabel?: string;
    successHeadline?: string;
    successBody?: string;
}

export const SigninFormEditor: React.FC<IInputContent> = (props) => {
    const [d, patch] = useTypedContent<SigninFormContent>(props);
    return (
        <div className="account-editor account-editor--signin-form" data-testid="editor-signin-form">
            <Field label="Headline" testid="signin-form-headline" value={d.headline ?? ''} onChange={v => patch({headline: v})} placeholder="Sign in"/>
            <Field label="Submit button label" testid="signin-form-submit" value={d.submitLabel ?? ''} onChange={v => patch({submitLabel: v})} placeholder="Sign in"/>
            <Field label="Forgot-password link target (optional)" testid="signin-form-forgot" value={d.forgotHref ?? ''} onChange={v => patch({forgotHref: v})}/>
            <Field label="Sign-up link target (optional)" testid="signin-form-signup" value={d.signupHref ?? ''} onChange={v => patch({signupHref: v})} placeholder="/account/signup"/>
        </div>
    );
};

export const SignupFormEditor: React.FC<IInputContent> = (props) => {
    const [d, patch] = useTypedContent<SignupFormContent>(props);
    return (
        <div className="account-editor account-editor--signup-form" data-testid="editor-signup-form">
            <Field label="Headline" testid="signup-form-headline" value={d.headline ?? ''} onChange={v => patch({headline: v})} placeholder="Create your account"/>
            <Field label="Submit button label" testid="signup-form-submit" value={d.submitLabel ?? ''} onChange={v => patch({submitLabel: v})} placeholder="Create account"/>
            <Field label="Sign-in link target (optional)" testid="signup-form-signin" value={d.signinHref ?? ''} onChange={v => patch({signinHref: v})} placeholder="/account/signin"/>
        </div>
    );
};

export const MagicLinkRequestFormEditor: React.FC<IInputContent> = (props) => {
    const [d, patch] = useTypedContent<MagicLinkRequestContent>(props);
    return (
        <div className="account-editor account-editor--magic-link-request" data-testid="editor-magic-link-request">
            <Field label="Headline" testid="magic-link-headline" value={d.headline ?? ''} onChange={v => patch({headline: v})} placeholder="Sign in with a magic link"/>
            <Field label="Body copy" testid="magic-link-body" value={d.body ?? ''} onChange={v => patch({body: v})} placeholder="We'll email you a one-click sign-in link."/>
            <Field label="Email field placeholder" testid="magic-link-placeholder" value={d.placeholder ?? ''} onChange={v => patch({placeholder: v})} placeholder="you@example.com"/>
            <Field label="Submit button label" testid="magic-link-submit" value={d.submitLabel ?? ''} onChange={v => patch({submitLabel: v})} placeholder="Email me a link"/>
            <Field label="Success headline" testid="magic-link-success-headline" value={d.successHeadline ?? ''} onChange={v => patch({successHeadline: v})} placeholder="Check your inbox"/>
            <Field label="Success body" testid="magic-link-success-body" value={d.successBody ?? ''} onChange={v => patch({successBody: v})}/>
        </div>
    );
};
