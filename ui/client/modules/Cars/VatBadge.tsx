/**
 * VAT regime badge — Wave 7b. Used cars in the EU run on two regimes
 * (margin vs standard); buyers across LV/EE/LT pay attention because
 * margin-scheme VAT is not reclaimable.
 *
 * Wired from `IProduct.attributes.vat_regime`; falls back to
 * `'unknown'` so the operator review queue can flag it.
 */
import React from 'react';
import {useTranslation} from 'next-i18next/pages';
import type {CarVatRegime} from './types';

interface Props {
    regime?: string;
    testId?: string;
}

const LABEL_KEY: Record<CarVatRegime, string> = {
    'b2c-eu': 'cars.vat.standard',
    'b2c-eu-margin': 'cars.vat.margin',
    'private-no-vat': 'cars.vat.private',
    'unknown': 'cars.vat.unknown',
};

const FALLBACK_TEXT: Record<CarVatRegime, string> = {
    'b2c-eu': 'VAT 21% — reclaimable',
    'b2c-eu-margin': 'Margin scheme — VAT not reclaimable',
    'private-no-vat': 'Private seller — no VAT',
    'unknown': 'VAT regime not confirmed',
};

const VatBadge: React.FC<Props> = ({regime, testId}) => {
    const {t} = useTranslation('common');
    const key = (LABEL_KEY[regime as CarVatRegime] ?? LABEL_KEY.unknown);
    const fallback = FALLBACK_TEXT[regime as CarVatRegime] ?? FALLBACK_TEXT.unknown;
    const text = t(key, {defaultValue: fallback}) as string;
    return (
        <span
            data-testid={testId ?? `car-vat-badge-${regime ?? 'unknown'}`}
            className="car-vat-badge"
            style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                border: '1px solid currentColor',
                opacity: 0.85,
            }}
        >
            {text}
        </span>
    );
};

export default VatBadge;
