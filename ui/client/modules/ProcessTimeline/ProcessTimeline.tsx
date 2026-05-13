import React from 'react';
import type {ProcessTimelineProps, ProcessPhaseStatus} from './ProcessTimeline.types';
import './ProcessTimeline.scss';

function formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    try {
        return d.toLocaleDateString(undefined, {year: 'numeric', month: 'short', day: 'numeric'});
    } catch {
        return iso;
    }
}

const ProcessTimeline: React.FC<ProcessTimelineProps> = ({
    testId,
    phases,
    ariaLabel = 'Project process timeline',
}) => {
    if (phases.length === 0) return null;

    return (
        <ol
            className="process-timeline"
            data-testid={testId}
            aria-label={ariaLabel}
        >
            {phases.map(phase => {
                const status: ProcessPhaseStatus = phase.status ?? 'pending';
                return (
                    <li
                        key={phase.key}
                        className="process-timeline__phase"
                        data-testid={`${testId}-phase-${phase.key}`}
                        data-status={status}
                        aria-current={status === 'active' ? 'step' : undefined}
                    >
                        <span
                            className="process-timeline__dot"
                            aria-hidden
                            data-testid={`${testId}-status-${phase.key}`}
                        />
                        <div className="process-timeline__content">
                            <h3 className="process-timeline__title">{phase.title}</h3>
                            {phase.date ? (
                                <time
                                    className="process-timeline__date"
                                    dateTime={phase.date}
                                    data-testid={`${testId}-date-${phase.key}`}
                                >{formatDate(phase.date)}</time>
                            ) : null}
                            <p className="process-timeline__description">{phase.description}</p>
                        </div>
                    </li>
                );
            })}
        </ol>
    );
};

export default ProcessTimeline;
export {ProcessTimeline};
