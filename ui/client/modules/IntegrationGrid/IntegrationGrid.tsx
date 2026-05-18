import React, {useState} from 'react';
import type {Integration, IntegrationGridProps} from './IntegrationGrid.types';

function Tile({item, testId}: {item: Integration; testId: string}): React.ReactElement {
    const inner = (
        <>
            {item.logoUrl ? (
                <img className="integration-grid__logo" src={item.logoUrl} alt={item.name} loading="lazy" />
            ) : (
                <span className="integration-grid__logo integration-grid__logo--placeholder" aria-hidden />
            )}
            <span className="integration-grid__name">{item.name}</span>
            <span
                className={`integration-grid__status integration-grid__status--${item.status}`}
                data-status={item.status}
                data-testid={`${testId}-status-${item.key}`}
            >{item.status}</span>
        </>
    );
    const tid = `${testId}-tile-${item.key}`;
    if (item.href) {
        return (
            <a className="integration-grid__tile" href={item.href} data-testid={tid}>{inner}</a>
        );
    }
    return <div className="integration-grid__tile" data-testid={tid}>{inner}</div>;
}

const IntegrationGrid: React.FC<IntegrationGridProps> = ({testId, items, categories}) => {
    const [active, setActive] = useState<string | null>(null);
    if (items.length === 0) return null;

    const filtered = active ? items.filter(i => i.category === active) : items;

    return (
        <section className="integration-grid" data-testid={testId}>
            {categories && categories.length > 0 ? (
                <div className="integration-grid__chips" role="tablist" aria-label="Integration categories">
                    {categories.map(cat => {
                        const isActive = active === cat;
                        return (
                            <button
                                key={cat}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                className={'integration-grid__chip' + (isActive ? ' integration-grid__chip--active' : '')}
                                data-testid={`${testId}-category-${cat}`}
                                data-active={isActive ? 'true' : 'false'}
                                onClick={() => setActive(isActive ? null : cat)}
                            >{cat}</button>
                        );
                    })}
                </div>
            ) : null}
            <ul className="integration-grid__list">
                {filtered.map(item => (
                    <li key={item.key} className="integration-grid__item">
                        <Tile item={item} testId={testId} />
                    </li>
                ))}
            </ul>
        </section>
    );
};

export default IntegrationGrid;
export {IntegrationGrid};
