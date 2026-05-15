/** MagicLinkAccountUpgrade — Phase 1.D. Locked guest→customer upgrade prompt. */
import React from 'react';
import type {IItem} from '@interfaces/IItem';
import type {IMagicLinkAccountUpgrade} from './MagicLinkAccountUpgrade.types';

export interface MagicLinkAccountUpgradeProps { item: IItem; guestEmail?: string; }
function parseContent(raw: string|object|undefined): IMagicLinkAccountUpgrade {
    if (!raw) return {} as IMagicLinkAccountUpgrade;
    if (typeof raw === 'string') { try { return JSON.parse(raw) as IMagicLinkAccountUpgrade; } catch { return {} as IMagicLinkAccountUpgrade; } }
    return raw as IMagicLinkAccountUpgrade;
}
const MagicLinkAccountUpgrade: React.FC<MagicLinkAccountUpgradeProps> = ({item, guestEmail}) => {
    const c = parseContent(item.content);
    const href = guestEmail
        ? `/account/magic-link?prefillEmail=${encodeURIComponent(guestEmail)}&callbackUrl=${encodeURIComponent('/account/orders')}`
        : '/account/magic-link';
    return (
        <section className="magic-link-account-upgrade" data-testid="module-magic-link-account-upgrade">
            <h3>{c.title ?? 'Save your details for next time'}</h3>
            {c.body && <p>{c.body}</p>}
            <a className="magic-link-account-upgrade__cta" href={href} data-testid="magic-link-upgrade-cta">{c.ctaLabel ?? 'Create an account'}</a>
        </section>
    );
};
export default MagicLinkAccountUpgrade;
export {MagicLinkAccountUpgrade};
export {EMagicLinkAccountUpgradeStyle, type IMagicLinkAccountUpgrade} from './MagicLinkAccountUpgrade.types';
