/** ShippingCalculator — Phase 1.D. Composable shipping-cost estimator. */
import React from 'react';
import type {IItem} from '@interfaces/IItem';
import type {IShippingCalculator} from './ShippingCalculator.types';
import './ShippingCalculator.scss';
export interface ShippingCalculatorProps { item: IItem; }
function parseContent(raw: string|object|undefined): IShippingCalculator {
    if (!raw) return {} as IShippingCalculator;
    if (typeof raw === 'string') { try { return JSON.parse(raw) as IShippingCalculator; } catch { return {} as IShippingCalculator; } }
    return raw as IShippingCalculator;
}
const ShippingCalculator: React.FC<ShippingCalculatorProps> = ({item}) => {
    const c = parseContent(item.content);
    return (
        <form className="shipping-calculator" data-testid="module-shipping-calculator" onSubmit={e => e.preventDefault()}>
            <h3>{c.title ?? 'Estimate shipping'}</h3>
            <input data-testid="shipping-calculator-postal" placeholder="Postal code" />
            <button type="submit" data-testid="shipping-calculator-submit">Estimate</button>
        </form>
    );
};
export default ShippingCalculator;
export {ShippingCalculator};
export {EShippingCalculatorStyle, type IShippingCalculator} from './ShippingCalculator.types';
