import React, {useCallback, useEffect, useState} from 'react';
import type {EventBuyTicketsCtaProps} from './EventBuyTicketsCta.types';

type Variant = 'mobile' | 'desktop';

const MOBILE_MAX = 540;

function detectVariant(force: Variant | undefined): Variant {
    if (force) return force;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'desktop';
    return window.matchMedia(`(max-width: ${MOBILE_MAX}px)`).matches ? 'mobile' : 'desktop';
}

const EventBuyTicketsCta: React.FC<EventBuyTicketsCtaProps> = ({
    testId,
    ctaLabel = 'Buy tickets',
    tiers,
    keepOpenOnPurchase = false,
    forceVariant,
}) => {
    const [autoVariant, setAutoVariant] = useState<Variant>(() => detectVariant(undefined));
    const [open, setOpen] = useState<boolean>(false);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
        const mq = window.matchMedia(`(max-width: ${MOBILE_MAX}px)`);
        const apply = (): void => setAutoVariant(mq.matches ? 'mobile' : 'desktop');
        mq.addEventListener('change', apply);
        return () => mq.removeEventListener('change', apply);
    }, []);

    const variant = forceVariant ?? autoVariant;

    const close = useCallback(() => setOpen(false), []);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') close(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, close]);

    const onTierClick = useCallback(() => {
        if (!keepOpenOnPurchase) close();
    }, [keepOpenOnPurchase, close]);

    return (
        <>
            <button
                type="button"
                className={`event-buy-tickets-cta__trigger event-buy-tickets-cta__trigger--${variant}`}
                data-testid={`${testId}-trigger`}
                onClick={() => setOpen(true)}
            >{ctaLabel}</button>

            {open ? (
                <div
                    className={`event-buy-tickets-cta__modal event-buy-tickets-cta__modal--${variant}`}
                    data-testid={`${testId}-modal`}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Select ticket tier"
                >
                    <div className="event-buy-tickets-cta__backdrop" onClick={close} aria-hidden />
                    <div className="event-buy-tickets-cta__sheet" data-testid={testId}>
                        <button
                            type="button"
                            className="event-buy-tickets-cta__close"
                            data-testid={`${testId}-close`}
                            aria-label="Close"
                            onClick={close}
                        >×</button>
                        <h3 className="event-buy-tickets-cta__title">Choose a tier</h3>
                        <ul className="event-buy-tickets-cta__list" role="list">
                            {tiers.map(t => (
                                <li key={t.key} className="event-buy-tickets-cta__item">
                                    <a
                                        className={`event-buy-tickets-cta__tier${t.highlighted ? ' is-highlighted' : ''}`}
                                        data-testid={`${testId}-tier-${t.key}`}
                                        href={t.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={onTierClick}
                                    >
                                        <span className="event-buy-tickets-cta__tier-name">{t.name}</span>
                                        <span className="event-buy-tickets-cta__tier-price">{t.priceFormatted}</span>
                                        {t.description ? (
                                            <span className="event-buy-tickets-cta__tier-desc">{t.description}</span>
                                        ) : null}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            ) : null}
        </>
    );
};

export default EventBuyTicketsCta;
export {EventBuyTicketsCta};
