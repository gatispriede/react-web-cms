/**
 * Car spec table — Wave 7b. Renders the canonical spec rows from
 * `IProduct.attributes` set by `SsComCarsNormaliser`. Per-theme styling
 * is Wave 5; this is the functional baseline.
 */
import React from 'react';
import {useT as useTranslation} from 'next-i18next/client';

interface Props {
    attributes: Record<string, string>;
    testId?: string;
}

const ROWS: Array<{key: string; labelKey: string; fallback: string}> = [
    {key: 'make', labelKey: 'cars.spec.make', fallback: 'Make'},
    {key: 'model', labelKey: 'cars.spec.model', fallback: 'Model'},
    {key: 'trim', labelKey: 'cars.spec.trim', fallback: 'Trim'},
    {key: 'year', labelKey: 'cars.spec.year', fallback: 'Year'},
    {key: 'mileage_km', labelKey: 'cars.spec.mileage', fallback: 'Mileage'},
    {key: 'fuel', labelKey: 'cars.spec.fuel', fallback: 'Fuel'},
    {key: 'transmission', labelKey: 'cars.spec.transmission', fallback: 'Transmission'},
    {key: 'body', labelKey: 'cars.spec.body', fallback: 'Body'},
    {key: 'drive', labelKey: 'cars.spec.drive', fallback: 'Drive'},
    {key: 'color', labelKey: 'cars.spec.color', fallback: 'Colour'},
    {key: 'engine_cc', labelKey: 'cars.spec.engine', fallback: 'Engine'},
    {key: 'inspection_date', labelKey: 'cars.spec.inspection', fallback: 'Inspection until'},
    {key: 'country_of_origin', labelKey: 'cars.spec.origin', fallback: 'Country of origin'},
    {key: 'region', labelKey: 'cars.spec.region', fallback: 'Region'},
];

const CarSpecTable: React.FC<Props> = ({attributes, testId}) => {
    const {t} = useTranslation('common');
    const a = attributes ?? {};
    return (
        <table
            data-testid={testId ?? 'car-spec-table'}
            style={{width: '100%', borderCollapse: 'collapse', fontSize: 14}}
        >
            <tbody>
                {ROWS.filter(r => a[r.key]).map(r => (
                    <tr key={r.key} data-testid={`car-spec-row-${r.key}`}>
                        <th
                            scope="row"
                            style={{textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--theme-border, rgba(0,0,0,0.08))', width: '40%', fontWeight: 500, opacity: 0.7}}
                        >
                            {t(r.labelKey, {defaultValue: r.fallback}) as string}
                        </th>
                        <td style={{padding: '6px 8px', borderBottom: '1px solid var(--theme-border, rgba(0,0,0,0.08))'}}>
                            {a[r.key]}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

export default CarSpecTable;
