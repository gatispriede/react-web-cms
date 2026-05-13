import React from 'react';
import CountdownTimer from '@client/modules/CountdownTimer/CountdownTimer';
import type {EventHeroVideoProps} from './EventHeroVideo.types';
import './EventHeroVideo.scss';

function detectReducedMotion(force: boolean | undefined): boolean {
    if (force !== undefined) return force;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const EventHeroVideo: React.FC<EventHeroVideoProps> = ({
    testId,
    videoUrl,
    posterUrl,
    headline,
    subHeadline,
    countdownTarget,
    primaryCta,
    forceReducedMotion,
}) => {
    if (!videoUrl && !posterUrl) return null;
    const reduced = detectReducedMotion(forceReducedMotion);

    return (
        <section className="event-hero-video" data-testid={testId}>
            <div className="event-hero-video__media" aria-hidden>
                {reduced ? (
                    <img
                        className="event-hero-video__poster"
                        data-testid={`${testId}-poster`}
                        src={posterUrl}
                        alt=""
                    />
                ) : (
                    <video
                        className="event-hero-video__video"
                        data-testid={`${testId}-video`}
                        poster={posterUrl}
                        autoPlay
                        muted
                        loop
                        playsInline
                    >
                        <source src={videoUrl} />
                    </video>
                )}
            </div>
            <div className="event-hero-video__overlay">
                <h1 className="event-hero-video__headline" data-testid={`${testId}-headline`}>{headline}</h1>
                {subHeadline ? <p className="event-hero-video__sub">{subHeadline}</p> : null}
                {countdownTarget ? (
                    <CountdownTimer
                        testId={`${testId}-countdown`}
                        target={countdownTarget}
                        forceReducedMotion={forceReducedMotion}
                    />
                ) : null}
                {primaryCta ? (
                    <a
                        className="event-hero-video__cta"
                        data-testid={`${testId}-cta`}
                        href={primaryCta.href}
                    >{primaryCta.label}</a>
                ) : null}
            </div>
        </section>
    );
};

export default EventHeroVideo;
export {EventHeroVideo};
