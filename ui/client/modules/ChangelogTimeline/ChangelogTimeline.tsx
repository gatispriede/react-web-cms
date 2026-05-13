import React from 'react';
import type {ChangelogEntry, ChangelogTimelineProps} from './ChangelogTimeline.types';
import './ChangelogTimeline.scss';

function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString();
    } catch {
        return iso;
    }
}

const ChangelogTimeline: React.FC<ChangelogTimelineProps> = ({testId, entries, maxEntries}) => {
    if (entries.length === 0) return null;
    const visible: ChangelogEntry[] = typeof maxEntries === 'number' ? entries.slice(0, maxEntries) : entries;

    return (
        <ol className="changelog-timeline" data-testid={testId}>
            {visible.map(entry => (
                <li
                    key={entry.version}
                    className="changelog-timeline__entry"
                    data-testid={`${testId}-entry-${entry.version}`}
                >
                    <span className="changelog-timeline__dot" aria-hidden />
                    <header className="changelog-timeline__head">
                        <span className="changelog-timeline__version">{entry.version}</span>
                        <small className="changelog-timeline__date" data-testid={`${testId}-date-${entry.version}`}>{formatDate(entry.date)}</small>
                    </header>
                    <h4 className="changelog-timeline__title">{entry.title}</h4>
                    {entry.body && <p className="changelog-timeline__body">{entry.body}</p>}
                    {entry.tags && entry.tags.length > 0 && (
                        <ul className="changelog-timeline__tags">
                            {entry.tags.map(tag => (
                                <li
                                    key={tag}
                                    className={`changelog-timeline__tag changelog-timeline__tag--${tag}`}
                                    data-testid={`${testId}-tag-${entry.version}-${tag}`}
                                >{tag}</li>
                            ))}
                        </ul>
                    )}
                </li>
            ))}
        </ol>
    );
};

export default ChangelogTimeline;
export {ChangelogTimeline};
export type {ChangelogTimelineProps, ChangelogEntry, ChangelogTag} from './ChangelogTimeline.types';
