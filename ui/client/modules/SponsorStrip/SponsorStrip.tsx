import React, {useMemo} from 'react';
import type {Sponsor, SponsorStripProps, SponsorTier} from './SponsorStrip.types';

const DEFAULT_ORDER: SponsorTier[] = ['platinum', 'gold', 'silver', 'bronze'];

function SponsorLogo({sponsor, testId}: {sponsor: Sponsor; testId: string}): React.ReactElement {
    const img = (
        <img
            className="sponsor-strip__logo"
            src={sponsor.logoUrl}
            alt={sponsor.name}
            loading="lazy"
        />
    );
    if (sponsor.href) {
        return (
            <a
                className="sponsor-strip__link"
                href={sponsor.href}
                data-testid={`${testId}-sponsor-${sponsor.key}`}
                target="_blank"
                rel="noopener noreferrer"
            >{img}</a>
        );
    }
    return (
        <span
            className="sponsor-strip__link"
            data-testid={`${testId}-sponsor-${sponsor.key}`}
        >{img}</span>
    );
}

const SponsorStrip: React.FC<SponsorStripProps> = ({testId, sponsors, tierOrder}) => {
    const order = tierOrder ?? DEFAULT_ORDER;
    const grouped = useMemo(() => {
        const map = new Map<SponsorTier, Sponsor[]>();
        for (const s of sponsors) {
            const arr = map.get(s.tier) ?? [];
            arr.push(s);
            map.set(s.tier, arr);
        }
        return order
            .map(t => ({tier: t, items: map.get(t) ?? []}))
            .filter(g => g.items.length > 0);
    }, [sponsors, order]);

    if (sponsors.length === 0) return null;

    return (
        <section className="sponsor-strip" data-testid={testId}>
            {grouped.map(g => (
                <div
                    key={g.tier}
                    className={`sponsor-strip__tier sponsor-strip__tier--${g.tier}`}
                    data-testid={`${testId}-tier-${g.tier}`}
                >
                    <h3 className="sponsor-strip__tier-label">{g.tier}</h3>
                    <ul className="sponsor-strip__list" role="list">
                        {g.items.map(s => (
                            <li key={s.key} className="sponsor-strip__item">
                                <SponsorLogo sponsor={s} testId={testId} />
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </section>
    );
};

export default SponsorStrip;
export {SponsorStrip};
