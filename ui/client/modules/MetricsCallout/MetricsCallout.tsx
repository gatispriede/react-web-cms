import React from 'react';
import type {MetricsCalloutProps} from './MetricsCallout.types';

const MetricsCallout: React.FC<MetricsCalloutProps> = ({testId, items, align = 'center'}) => {
    if (items.length === 0) return null;

    return (
        <div
            className={`metrics-callout metrics-callout--align-${align}`}
            data-testid={testId}
        >
            {items.map(item => (
                <div
                    key={item.key}
                    className="metrics-callout__item"
                    data-testid={`${testId}-item-${item.key}`}
                >
                    <strong
                        className="metrics-callout__value"
                        data-testid={`${testId}-value-${item.key}`}
                    >{item.value}</strong>
                    <small
                        className="metrics-callout__desc"
                        data-testid={`${testId}-desc-${item.key}`}
                    >{item.description}</small>
                </div>
            ))}
        </div>
    );
};

export default MetricsCallout;
export {MetricsCallout};
