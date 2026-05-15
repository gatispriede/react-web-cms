import React from 'react';
import type {OrderProgressTimelineProps} from './OrderProgressTimeline.types';

const OrderProgressTimeline: React.FC<OrderProgressTimelineProps> = ({
    testId,
    variant = 'sale',
    steps,
    ariaLabel,
}) => {
    return (
        <ol
            className="order-progress-timeline"
            data-testid={testId}
            data-variant={variant}
            role="list"
            aria-label={ariaLabel ?? 'Order progress'}
        >
            {steps.map(step => (
                <li
                    key={step.key}
                    className="order-progress-timeline__step"
                    data-testid={`${testId}-step-${step.key}`}
                    data-status={step.status}
                    aria-current={step.status === 'active' ? 'step' : undefined}
                >
                    <span className="order-progress-timeline__dot" aria-hidden />
                    <span className="order-progress-timeline__label">{step.label}</span>
                    {step.date ? (
                        <small
                            className="order-progress-timeline__date"
                            data-testid={`${testId}-step-${step.key}-date`}
                        >{step.date}</small>
                    ) : null}
                </li>
            ))}
        </ol>
    );
};

export default OrderProgressTimeline;
export {OrderProgressTimeline};
