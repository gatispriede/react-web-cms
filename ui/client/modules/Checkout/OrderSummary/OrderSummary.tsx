/** OrderSummary — Phase 1.D. Locked confirmation / order-by-token main block. */
import React, {useEffect, useState} from 'react';
import type {IItem} from '@interfaces/IItem';
import type {IOrder} from '@interfaces/IOrder';
import {useCheckoutMachine} from '@client/lib/checkout/useCheckoutMachine';
import {formatMoney, orderByToken} from '@client/lib/checkout/api';
import {OrderApi} from '@services/api/client/OrderApi';
import type {IOrderSummary} from './OrderSummary.types';

export interface OrderSummaryProps {
    item: IItem;
    /** Explicit token (e.g. from /orders/[token] page wrapper). When absent,
     *  falls back to the in-progress orderId on the checkout machine. */
    token?: string;
}

function parseContent(raw: string|object|undefined): IOrderSummary {
    if (!raw) return {} as IOrderSummary;
    if (typeof raw === 'string') { try { return JSON.parse(raw) as IOrderSummary; } catch { return {} as IOrderSummary; } }
    return raw as IOrderSummary;
}

const OrderSummary: React.FC<OrderSummaryProps> = ({item, token}) => {
    const c = parseContent(item.content);
    const {orderId} = useCheckoutMachine();
    const [order, setOrder] = useState<IOrder | null>(null);
    const [loading, setLoading] = useState(true);

    const resolvedToken = token;

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                if (resolvedToken) {
                    const fetched = await orderByToken(resolvedToken);
                    if (!cancelled) setOrder(fetched ?? null);
                    return;
                }
                if (orderId) {
                    const api = new OrderApi();
                    const fetched = await api.myOrder(orderId);
                    if (!cancelled) setOrder(fetched);
                    return;
                }
                if (!cancelled) setOrder(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void load();
        return () => { cancelled = true; };
    }, [resolvedToken, orderId]);

    return (
        <article className={`order-summary${item.style && item.style !== 'default' ? ` ${item.style as string}` : ''}`} data-testid="module-order-summary">
            <h2>{c.title ?? 'Order summary'}</h2>
            {loading ? (
                <p data-testid="order-summary-loading">Loading order…</p>
            ) : !order ? (
                <p data-testid="order-summary-empty">No order found.</p>
            ) : (
                <>
                    <p className="order-summary__number" data-testid="order-summary-number">Order #{order.orderNumber}</p>
                    <ul className="order-summary__items" data-testid="order-summary-items">
                        {order.lineItems.map(line => (
                            <li key={`${line.productId}:${line.sku}`} data-testid={`order-summary-line-${line.sku}`}>
                                <span>{line.title}</span>
                                <span>× {line.quantity}</span>
                                <span>{formatMoney(line.lineTotal, order.currency)}</span>
                            </li>
                        ))}
                    </ul>
                    <dl className="order-summary__totals">
                        <div><dt>Subtotal</dt><dd data-testid="order-summary-subtotal">{formatMoney(order.subtotal, order.currency)}</dd></div>
                        <div><dt>Shipping</dt><dd data-testid="order-summary-shipping">{formatMoney(order.shippingTotal, order.currency)}</dd></div>
                        <div><dt>VAT</dt><dd data-testid="order-summary-tax">{formatMoney(order.taxTotal, order.currency)}</dd></div>
                        <div className="order-summary__total-row"><dt>Total</dt><dd data-testid="order-summary-total">{formatMoney(order.total, order.currency)}</dd></div>
                    </dl>
                </>
            )}
        </article>
    );
};

export default OrderSummary;
export {OrderSummary};
export {EOrderSummaryStyle, type IOrderSummary} from './OrderSummary.types';
