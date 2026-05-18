/** CheckoutProgressBar — Phase 1.D. Locked address→shipping→payment indicator. */
import React from 'react';
import {usePathname} from 'next/navigation';
import Link from 'next/link';
import type {IItem} from '@interfaces/IItem';
import type {ICheckoutProgressBar} from './CheckoutProgressBar.types';

type Step = 'address' | 'shipping' | 'payment' | 'confirmation';

export interface CheckoutProgressBarProps { item: IItem; currentStep?: Step; }

function parseContent(raw: string | object | undefined): ICheckoutProgressBar {
    if (!raw) return {} as ICheckoutProgressBar;
    if (typeof raw === 'string') { try { return JSON.parse(raw) as ICheckoutProgressBar; } catch { return {} as ICheckoutProgressBar; } }
    return raw as ICheckoutProgressBar;
}

const STEPS: ReadonlyArray<{key: Step; label: string; href: string}> = [
    {key: 'address',      label: 'Address',  href: '/checkout/address'},
    {key: 'shipping',     label: 'Shipping', href: '/checkout/shipping'},
    {key: 'payment',      label: 'Payment',  href: '/checkout/payment'},
    {key: 'confirmation', label: 'Done',     href: '/checkout/confirmation'},
];

/**
 * Step is derived from the URL path so SSR + client render identical
 * markup. Earlier the component read `useCheckoutMachine().step` from
 * localStorage — SSR defaulted to `cart`, client read whatever
 * `payment`/`shipping` the previous flow had stored, and React threw
 * a hydration mismatch on every checkout page.
 */
function stepFromPath(path: string): Step {
    if (path.startsWith('/checkout/confirmation')) return 'confirmation';
    if (path.startsWith('/checkout/payment')) return 'payment';
    if (path.startsWith('/checkout/shipping')) return 'shipping';
    return 'address';
}

const CheckoutProgressBar: React.FC<CheckoutProgressBarProps> = ({item, currentStep}) => {
    const c = parseContent(item.content);
    void c;
    // App-Router-compatible path read; works in Pages Router too (Next 13+).
    const pathname = usePathname() ?? '';
    const resolved: Step = currentStep ?? stepFromPath(pathname);
    const activeIdx = STEPS.findIndex(s => s.key === resolved);

    return (
        <ol className={`checkout-progress-bar${item.style && item.style !== 'default' ? ` ${item.style as string}` : ''}`} data-testid="module-checkout-progress-bar">
            {STEPS.map((s, i) => {
                const isActive = i === activeIdx;
                const isDone = i <= activeIdx;
                // Only past steps are navigable — operators can jump
                // back to edit address/shipping, but jumping ahead to
                // a step the order hasn't reached would skip required
                // state (`createDraftOrder`, `attachOrderShipping`).
                const clickable = i < activeIdx;
                const cls = `checkout-progress-bar__step${isDone ? ' is-done' : ''}${isActive ? ' is-active' : ''}${clickable ? ' is-clickable' : ''}`;
                const inner = (
                    <>
                        <span className="checkout-progress-bar__num">{i + 1}</span>
                        <span className="checkout-progress-bar__label">{s.label}</span>
                    </>
                );
                return (
                    <li key={s.key} className={cls} data-testid={`checkout-progress-step-${s.key}`}>
                        {clickable
                            ? (
                                <Link
                                    href={s.href}
                                    data-testid={`checkout-progress-step-${s.key}-link`}
                                    style={{display: 'inline-flex', alignItems: 'center', gap: 6, color: 'inherit', textDecoration: 'none', cursor: 'pointer'}}
                                >
                                    {inner}
                                </Link>
                            )
                            : inner}
                    </li>
                );
            })}
        </ol>
    );
};

export default CheckoutProgressBar;
export {CheckoutProgressBar};
export {ECheckoutProgressBarStyle, type ICheckoutProgressBar} from './CheckoutProgressBar.types';
