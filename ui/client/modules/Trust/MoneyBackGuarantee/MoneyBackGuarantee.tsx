/** MoneyBackGuarantee — Phase 1.D. Composable refund-policy callout. */
import React from 'react';
import type {IItem} from '@interfaces/IItem';
import type {IMoneyBackGuarantee} from './MoneyBackGuarantee.types';
export interface MoneyBackGuaranteeProps { item: IItem; }
function parseContent(raw: string|object|undefined): IMoneyBackGuarantee {
    if (!raw) return {} as IMoneyBackGuarantee;
    if (typeof raw === 'string') { try { return JSON.parse(raw) as IMoneyBackGuarantee; } catch { return {} as IMoneyBackGuarantee; } }
    return raw as IMoneyBackGuarantee;
}
const MoneyBackGuarantee: React.FC<MoneyBackGuaranteeProps> = ({item}) => {
    const c = parseContent(item.content);
    return (
        <aside className="money-back-guarantee" data-testid="module-money-back-guarantee">
            <h3>{c.title ?? '30-day money-back guarantee'}</h3>
            <p>{c.body ?? 'Not satisfied? Return within 30 days for a full refund.'}</p>
        </aside>
    );
};
export default MoneyBackGuarantee;
export {MoneyBackGuarantee};
export {EMoneyBackGuaranteeStyle, type IMoneyBackGuarantee} from './MoneyBackGuarantee.types';
