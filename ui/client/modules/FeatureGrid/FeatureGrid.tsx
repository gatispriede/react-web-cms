import React from 'react';
import type {FeatureGridProps} from './FeatureGrid.types';

const MAX_FEATURES = 6;

const FeatureGrid: React.FC<FeatureGridProps> = ({testId, features, columns = 3}) => {
    const capped = features.slice(0, MAX_FEATURES);
    if (capped.length === 0) return null;

    const cls = 'feature-grid feature-grid--cols-' + columns;

    return (
        <ul className={cls} data-testid={testId}>
            {capped.map(f => (
                <li
                    key={f.key}
                    className="feature-grid__card"
                    data-testid={`${testId}-card-${f.key}`}
                >
                    {f.icon ? (
                        <div
                            className="feature-grid__icon"
                            aria-hidden
                            data-testid={`${testId}-icon-${f.key}`}
                        >{f.icon}</div>
                    ) : null}
                    <h3
                        className="feature-grid__title"
                        data-testid={`${testId}-title-${f.key}`}
                    >{f.title}</h3>
                    <p className="feature-grid__desc">{f.description}</p>
                </li>
            ))}
        </ul>
    );
};

export default FeatureGrid;
export {FeatureGrid};
