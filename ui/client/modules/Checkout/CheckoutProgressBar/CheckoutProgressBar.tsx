/** CheckoutProgressBar — Phase 1.D. Locked address→shipping→payment indicator. */
import React from 'react';
import type {IItem} from '@interfaces/IItem';
import {useCheckoutMachine, type CheckoutStep} from '@client/lib/checkout/useCheckoutMachine';
import type {ICheckoutProgressBar} from './CheckoutProgressBar.types';

type Step = 'address' | 'shipping' | 'payment' | 'confirmation';

export interface CheckoutProgressBarProps { item: IItem; currentStep?: Step; }

const machineToBarStep = (s: CheckoutStep): Step => {
    if (s === 'cart' || s === 'address') return 'address';
    if (s === 'review') return 'payment';
    return s;
};

function parseContent(raw: string | object | undefined): ICheckoutProgressBar {
    if (!raw) return {} as ICheckoutProgressBar;
    if (typeof raw === 'string') { try { return JSON.parse(raw) as ICheckoutProgressBar; } catch { return {} as ICheckoutProgressBar; } }
    return raw as ICheckoutProgressBar;
}

const STEPS: ReadonlyArray<{key: 'address'|'shipping'|'payment'|'confirmation'; label: string}> = [
    {key: 'address', label: 'Address'},
    {key: 'shipping', label: 'Shipping'},
    {key: 'payment', label: 'Payment'},
    {key: 'confirmation', label: 'Done'},
];

const CheckoutProgressBar: React.FC<CheckoutProgressBarProps> = ({item, currentStep}) => {
    const c = parseContent(item.content);
    void c;
    const {step} = useCheckoutMachine();
    const resolved: Step = currentStep ?? machineToBarStep(step);
    const activeIdx = STEPS.findIndex(s => s.key === resolved);
    return (
        <ol className="checkout-progress-bar" data-testid="module-checkout-progress-bar">
            {STEPS.map((s, i) => (
                <li key={s.key}
                    className={`checkout-progress-bar__step${i <= activeIdx ? ' is-done' : ''}${i === activeIdx ? ' is-active' : ''}`}
                    data-testid={`checkout-progress-step-${s.key}`}>
                    <span className="checkout-progress-bar__num">{i + 1}</span>
                    <span className="checkout-progress-bar__label">{s.label}</span>
                </li>
            ))}
        </ol>
    );
};

export default CheckoutProgressBar;
export {CheckoutProgressBar};
export {ECheckoutProgressBarStyle, type ICheckoutProgressBar} from './CheckoutProgressBar.types';
