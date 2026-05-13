import React from 'react';
import './VatBadge.scss';

export type VatRegime = 'private-no-vat' | 'standard-21' | 'margin-scheme';

export interface VatBadgeProps {
    regime: VatRegime;
    /** Optional explicit testid (default 'vat-badge-{regime}'). */
    testId?: string;
}

const LABELS: Record<VatRegime, string> = {
    'private-no-vat': 'Private seller — no VAT',
    'standard-21': 'VAT 21% — reclaimable for businesses',
    'margin-scheme': 'Margin scheme — VAT included, not reclaimable',
};

const VatBadge: React.FC<VatBadgeProps> = ({regime, testId}) => {
    return (
        <span
            className={`vat-badge vat-badge--${regime}`}
            data-testid={testId ?? `vat-badge-${regime}`}
        >
            {LABELS[regime]}
        </span>
    );
};

export default VatBadge;
export {VatBadge};
