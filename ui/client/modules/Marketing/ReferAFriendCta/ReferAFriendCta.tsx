/** ReferAFriendCta — Phase 1.D. Composable invite block on confirmation. */
import React from 'react';
import type {IItem} from '@interfaces/IItem';
import type {IReferAFriendCta} from './ReferAFriendCta.types';
import './ReferAFriendCta.scss';
export interface ReferAFriendCtaProps { item: IItem; }
function parseContent(raw: string|object|undefined): IReferAFriendCta {
    if (!raw) return {} as IReferAFriendCta;
    if (typeof raw === 'string') { try { return JSON.parse(raw) as IReferAFriendCta; } catch { return {} as IReferAFriendCta; } }
    return raw as IReferAFriendCta;
}
const ReferAFriendCta: React.FC<ReferAFriendCtaProps> = ({item}) => {
    const c = parseContent(item.content);
    return (
        <section className="refer-a-friend-cta" data-testid="module-refer-a-friend-cta">
            <h3>{c.title ?? 'Refer a friend'}</h3>
            <p>{c.body ?? 'Share your code and earn rewards.'}</p>
            <a href={c.ctaHref ?? '#'} data-testid="refer-a-friend-cta-link">{c.ctaLabel ?? 'Get my link'}</a>
        </section>
    );
};
export default ReferAFriendCta;
export {ReferAFriendCta};
export {EReferAFriendCtaStyle, type IReferAFriendCta} from './ReferAFriendCta.types';
