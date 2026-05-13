/** PlaceOrderButton — Phase 1.D. Locked final-submit; finalize→clear cart→confirmation. */
import React, {useState} from 'react';
import type {IItem} from '@interfaces/IItem';
import {useCart} from '@client/features/Cart/useCart';
import {useCheckoutMachine} from '@client/lib/checkout/useCheckoutMachine';
import {OrderApi} from '@services/api/client/OrderApi';
import type {IPlaceOrderButton} from './PlaceOrderButton.types';

export interface PlaceOrderButtonProps {
    item: IItem;
    /** Test-only injection point; production path runs the real finalize flow. */
    onClick?: () => void;
}

function parseContent(raw: string|object|undefined): IPlaceOrderButton {
    if (!raw) return {} as IPlaceOrderButton;
    if (typeof raw === 'string') { try { return JSON.parse(raw) as IPlaceOrderButton; } catch { return {} as IPlaceOrderButton; } }
    return raw as IPlaceOrderButton;
}

const mkIdempotencyKey = () =>
    (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
        ? crypto.randomUUID()
        : `finalize-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const PlaceOrderButton: React.FC<PlaceOrderButtonProps> = ({item, onClick}) => {
    const c = parseContent(item.content);
    const {orderId, goTo} = useCheckoutMachine();
    const {clear} = useCart();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleClick = async () => {
        if (onClick) { onClick(); return; }
        if (!orderId || busy) return;
        setBusy(true);
        setError(null);
        try {
            const api = new OrderApi();
            const res = await api.finalizeOrder({orderId, idempotencyKey: mkIdempotencyKey()});
            if ('error' in res) { setError(res.error); return; }
            await clear();
            goTo('confirmation');
            if (typeof window !== 'undefined') {
                const token = (res as {orderToken?: string}).orderToken;
                if (token) window.location.assign(`/orders/${encodeURIComponent(token)}`);
                else window.location.assign('/checkout/confirmation');
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="place-order-button-wrap">
            <button
                type="button"
                className="place-order-button"
                data-testid="module-place-order-button"
                onClick={handleClick}
                disabled={busy || (!onClick && !orderId)}
            >
                {busy ? 'Placing…' : (c.label ?? 'Place order')}
            </button>
            {error && <p className="place-order-button__error" data-testid="place-order-error">{error}</p>}
        </div>
    );
};

export default PlaceOrderButton;
export {PlaceOrderButton};
export {EPlaceOrderButtonStyle, type IPlaceOrderButton} from './PlaceOrderButton.types';
