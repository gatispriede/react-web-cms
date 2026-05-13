import React from 'react';
import type {LogoCloudProps, LogoEntry} from './LogoCloud.types';

const MAX_LOGOS = 10;

function LogoImg({entry}: {entry: LogoEntry}): React.ReactElement {
    return (
        <img
            className="logo-cloud__img"
            src={entry.logoUrl}
            alt={entry.name}
            loading="lazy"
        />
    );
}

const LogoCloud: React.FC<LogoCloudProps> = ({
    testId,
    headline = 'Trusted by teams at',
    logos,
}) => {
    const capped = logos.slice(0, MAX_LOGOS);
    if (capped.length === 0) return null;

    return (
        <section className="logo-cloud" data-testid={testId}>
            {headline ? <p className="logo-cloud__headline">{headline}</p> : null}
            <ul className="logo-cloud__list">
                {capped.map(l => (
                    <li
                        key={l.key}
                        className="logo-cloud__item"
                        data-testid={`${testId}-logo-${l.key}`}
                    >
                        {l.href ? (
                            <a className="logo-cloud__link" href={l.href} aria-label={l.name}>
                                <LogoImg entry={l} />
                            </a>
                        ) : (
                            <LogoImg entry={l} />
                        )}
                    </li>
                ))}
            </ul>
        </section>
    );
};

export default LogoCloud;
export {LogoCloud};
