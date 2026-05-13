/** TrustBadges — Phase 1.D. Composable payment/security badges row. */
import React from 'react';
import type {IItem} from '@interfaces/IItem';
import type {ITrustBadges} from './TrustBadges.types';
import './TrustBadges.scss';
export interface TrustBadgesProps { item: IItem; }
function parseContent(raw: string|object|undefined): ITrustBadges {
    if (!raw) return {} as ITrustBadges;
    if (typeof raw === 'string') { try { return JSON.parse(raw) as ITrustBadges; } catch { return {} as ITrustBadges; } }
    return raw as ITrustBadges;
}
const TrustBadges: React.FC<TrustBadgesProps> = ({item}) => {
    const c = parseContent(item.content);
    const badges = c.badges ?? ['Visa', 'Mastercard', 'PayPal', 'SSL secure'];
    return (
        <ul className="trust-badges" data-testid="module-trust-badges">
            {badges.map((b, i) => <li key={i} data-testid={`trust-badge-${i}`}>{b}</li>)}
        </ul>
    );
};
export default TrustBadges;
export {TrustBadges};
export {ETrustBadgesStyle, type ITrustBadges} from './TrustBadges.types';
