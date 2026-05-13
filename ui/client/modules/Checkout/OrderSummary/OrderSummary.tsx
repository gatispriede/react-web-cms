/** OrderSummary — Phase 1.D. Locked confirmation / order-by-token main block. */
import React from 'react';
import type {IItem} from '@interfaces/IItem';
import type {IOrderSummary} from './OrderSummary.types';
import './OrderSummary.scss';
export interface OrderSummaryProps { item: IItem; }
function parseContent(raw: string|object|undefined): IOrderSummary {
    if (!raw) return {} as IOrderSummary;
    if (typeof raw === 'string') { try { return JSON.parse(raw) as IOrderSummary; } catch { return {} as IOrderSummary; } }
    return raw as IOrderSummary;
}
const OrderSummary: React.FC<OrderSummaryProps> = ({item}) => {
    const c = parseContent(item.content);
    return (
        <article className="order-summary" data-testid="module-order-summary">
            <h2>{c.title ?? 'Order summary'}</h2>
            <div className="order-summary__items" data-testid="order-summary-items" />
            <div className="order-summary__total" data-testid="order-summary-total">Total: —</div>
        </article>
    );
};
export default OrderSummary;
export {OrderSummary};
export {EOrderSummaryStyle, type IOrderSummary} from './OrderSummary.types';
