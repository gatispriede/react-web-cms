import React, {useEffect, useState} from 'react';
import type {CarReservationCtaProps} from './CarReservationCta.types';
import './CarReservationCta.scss';

function detectVariant(force: 'mobile' | 'desktop' | undefined): 'mobile' | 'desktop' {
    if (force) return force;
    // SSR-safe default + matchMedia probe post-mount.
    if (typeof window === 'undefined') return 'mobile';
    return window.matchMedia('(max-width: 540px)').matches ? 'mobile' : 'desktop';
}

const CarReservationCta: React.FC<CarReservationCtaProps> = ({
    testId,
    state,
    priceFormatted,
    depositFormatted,
    onReserve,
    onCancel,
    onContact,
    reserveLabel = 'Reserve now',
    contactLabel = 'Contact seller',
    cancelLabel = 'Cancel reservation',
    reservedByOtherLabel = 'Reserved by another buyer',
    reservedByYouLabel = 'You reserved this car',
    unavailableLabel = 'No longer available',
    forceVariant,
}) => {
    const [autoVariant, setAutoVariant] = useState<'mobile' | 'desktop'>(() => detectVariant(undefined));

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mq = window.matchMedia('(max-width: 540px)');
        const update = () => setAutoVariant(mq.matches ? 'mobile' : 'desktop');
        mq.addEventListener?.('change', update);
        return () => mq.removeEventListener?.('change', update);
    }, []);

    const variant = forceVariant ?? autoVariant;

    const reserveDisabled = state === 'reserved-by-other' || state === 'unavailable';

    return (
        <aside
            className={`car-reservation-cta car-reservation-cta--${variant} car-reservation-cta--state-${state}`}
            data-testid={testId}
            data-state={state}
            data-variant={variant}
            aria-label="Reservation"
        >
            <div className="car-reservation-cta__price">
                <span className="car-reservation-cta__price-value">{priceFormatted}</span>
                {depositFormatted && <small className="car-reservation-cta__deposit">{depositFormatted}</small>}
            </div>

            {(state === 'reserved-by-you' || state === 'unavailable') && (
                <span
                    className="car-reservation-cta__status"
                    data-testid={`${testId}-status`}
                    role="status"
                >{state === 'reserved-by-you' ? reservedByYouLabel : unavailableLabel}</span>
            )}

            <div className="car-reservation-cta__actions">
                {state === 'reserved-by-you' && onCancel ? (
                    <button
                        type="button"
                        className="car-reservation-cta__cancel"
                        data-testid={`${testId}-cancel`}
                        onClick={() => { void onCancel(); }}
                    >{cancelLabel}</button>
                ) : (
                    <button
                        type="button"
                        className="car-reservation-cta__reserve"
                        data-testid={`${testId}-reserve`}
                        onClick={() => { void onReserve(); }}
                        disabled={reserveDisabled}
                    >{state === 'reserved-by-other' ? reservedByOtherLabel : reserveLabel}</button>
                )}

                {onContact && state !== 'unavailable' && state !== 'reserved-by-you' && (
                    <button
                        type="button"
                        className="car-reservation-cta__contact"
                        data-testid={`${testId}-contact`}
                        onClick={onContact}
                    >{contactLabel}</button>
                )}
            </div>
        </aside>
    );
};

export default CarReservationCta;
export {CarReservationCta};
export type {CarReservationCtaProps, ReservationState} from './CarReservationCta.types';
