import React, {useState} from 'react';
import ComparisonTable from '@client/lib/ComparisonTable/ComparisonTable';
import type {ComparisonColumn, ComparisonRow} from '@client/lib/ComparisonTable/ComparisonTable.types';
import type {PricingTableProps} from './PricingTable.types';

const MAX_TIERS = 5;

const PricingTable: React.FC<PricingTableProps> = ({
    testId,
    tiers,
    features,
    initialBilling = 'monthly',
    monthlyLabel = 'Monthly',
    annualLabel = 'Annual',
    mostPopularLabel = 'Most popular',
}) => {
    const [billing, setBilling] = useState<'monthly' | 'annual'>(initialBilling);
    const capped = tiers.slice(0, MAX_TIERS);

    if (capped.length === 0) return null;

    const columns: ComparisonColumn[] = capped.map(t => ({
        key: t.key,
        label: t.name,
        badge: t.highlighted ? mostPopularLabel : undefined,
        highlighted: t.highlighted,
    }));

    const rows: ComparisonRow[] = features.map(f => ({
        key: f.key,
        label: f.tooltip ? `${f.label}` : f.label,
        values: capped.reduce<Record<string, boolean | string>>((acc, t) => {
            const v = f.perTier[t.key];
            if (v !== undefined) acc[t.key] = v;
            return acc;
        }, {}),
    }));

    return (
        <section className="pricing-table" data-testid={testId}>
            <div className="pricing-table__toggle" role="tablist" aria-label="Billing period">
                <button
                    type="button"
                    role="tab"
                    aria-selected={billing === 'monthly'}
                    className={'pricing-table__toggle-btn' + (billing === 'monthly' ? ' pricing-table__toggle-btn--active' : '')}
                    data-testid={`${testId}-toggle-monthly`}
                    onClick={() => setBilling('monthly')}
                >{monthlyLabel}</button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={billing === 'annual'}
                    className={'pricing-table__toggle-btn' + (billing === 'annual' ? ' pricing-table__toggle-btn--active' : '')}
                    data-testid={`${testId}-toggle-annual`}
                    onClick={() => setBilling('annual')}
                >{annualLabel}</button>
            </div>

            <div className="pricing-table__tiers">
                {capped.map(t => (
                    <div
                        key={t.key}
                        className={'pricing-table__tier' + (t.highlighted ? ' pricing-table__tier--highlighted' : '')}
                    >
                        {t.highlighted ? (
                            <span className="pricing-table__popular" data-testid={`${testId}-popular-${t.key}`}>
                                {mostPopularLabel}
                            </span>
                        ) : null}
                        <h3 className="pricing-table__tier-name">{t.name}</h3>
                        <p className="pricing-table__price" data-testid={`${testId}-price-${t.key}`}>
                            {billing === 'monthly' ? t.monthlyPriceFormatted : t.annualPriceFormatted}
                        </p>
                        {billing === 'annual' && t.annualSavingsLabel ? (
                            <p className="pricing-table__savings">{t.annualSavingsLabel}</p>
                        ) : null}
                        {t.description ? <p className="pricing-table__tier-desc">{t.description}</p> : null}
                    </div>
                ))}
            </div>

            <ComparisonTable
                testId={`${testId}-features`}
                columns={columns}
                rows={rows}
                highlightDifferences={false}
            />

            <div className="pricing-table__ctas">
                {capped.map(t => (
                    <a
                        key={t.key}
                        className={'pricing-table__cta' + (t.highlighted ? ' pricing-table__cta--highlighted' : '')}
                        href={t.ctaHref}
                        data-testid={`${testId}-cta-${t.key}`}
                    >{t.ctaLabel}</a>
                ))}
            </div>
        </section>
    );
};

export default PricingTable;
export {PricingTable};
