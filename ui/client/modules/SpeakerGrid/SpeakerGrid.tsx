import React, {useCallback, useEffect, useState} from 'react';
import type {Speaker, SpeakerGridProps} from './SpeakerGrid.types';

function SpeakerCard({
    speaker,
    testId,
    onOpen,
}: {
    speaker: Speaker;
    testId: string;
    onOpen: (key: string) => void;
}): React.ReactElement {
    return (
        <button
            type="button"
            className="speaker-grid__card"
            data-testid={`${testId}-card-${speaker.key}`}
            onClick={() => onOpen(speaker.key)}
        >
            {speaker.headshotUrl ? (
                <img
                    className="speaker-grid__headshot"
                    src={speaker.headshotUrl}
                    alt={speaker.name}
                    loading="lazy"
                />
            ) : (
                <span className="speaker-grid__headshot speaker-grid__headshot--placeholder" aria-hidden>
                    {speaker.name.charAt(0)}
                </span>
            )}
            <span className="speaker-grid__name">{speaker.name}</span>
            {speaker.role ? <span className="speaker-grid__role">{speaker.role}</span> : null}
        </button>
    );
}

const SpeakerGrid: React.FC<SpeakerGridProps> = ({testId, speakers, initialOpenKey}) => {
    const [openKey, setOpenKey] = useState<string | null>(() => initialOpenKey ?? null);

    const close = useCallback(() => setOpenKey(null), []);

    useEffect(() => {
        if (!openKey) return;
        const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') close(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [openKey, close]);

    if (speakers.length === 0) return null;
    const open = openKey ? speakers.find(s => s.key === openKey) ?? null : null;

    return (
        <section className="speaker-grid" data-testid={testId}>
            <ul className="speaker-grid__list" role="list">
                {speakers.map(s => (
                    <li key={s.key} className="speaker-grid__item">
                        <SpeakerCard speaker={s} testId={testId} onOpen={setOpenKey} />
                    </li>
                ))}
            </ul>

            {open ? (
                <div
                    className="speaker-grid__modal"
                    data-testid={`${testId}-modal`}
                    role="dialog"
                    aria-modal="true"
                    aria-label={open.name}
                >
                    <div className="speaker-grid__backdrop" onClick={close} aria-hidden />
                    <div className="speaker-grid__modal-inner">
                        <button
                            type="button"
                            className="speaker-grid__close"
                            data-testid={`${testId}-modal-close`}
                            aria-label="Close"
                            onClick={close}
                        >×</button>
                        {open.headshotUrl ? (
                            <img className="speaker-grid__modal-headshot" src={open.headshotUrl} alt={open.name} />
                        ) : null}
                        <h3 className="speaker-grid__modal-name">{open.name}</h3>
                        {open.role ? <p className="speaker-grid__modal-role">{open.role}</p> : null}
                        <p className="speaker-grid__modal-bio">{open.bio}</p>
                        {open.socials && open.socials.length > 0 ? (
                            <ul className="speaker-grid__socials" role="list">
                                {open.socials.map(soc => (
                                    <li key={soc.platform}>
                                        <a
                                            className="speaker-grid__social"
                                            href={soc.url}
                                            data-testid={`${testId}-social-${open.key}-${soc.platform}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >{soc.platform}</a>
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </section>
    );
};

export default SpeakerGrid;
export {SpeakerGrid};
