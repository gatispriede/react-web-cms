import React from 'react';
import CarPhotoGallery from '@client/modules/CarPhotoGallery/CarPhotoGallery';
import CarSpecTable from '@client/modules/CarSpecTable/CarSpecTable';
import CarReservationCta from '@client/modules/CarReservationCta/CarReservationCta';
import CarListingCard from '@client/modules/CarListingCard/CarListingCard';
import VatBadge from '@client/components/VatBadge';
import type {CarVehicleDetailPageProps} from './CarVehicleDetailPage.types';

const MAX_SIMILAR = 4;

const CarVehicleDetailPage: React.FC<CarVehicleDetailPageProps> = ({
    testId,
    productId,
    title,
    priceFormatted,
    monthlyPaymentEstimate,
    vatRegime,
    photos,
    keyStats,
    specs,
    trust,
    reservation,
    similar,
}) => {
    return (
        <article className="car-vdp" data-testid={testId} data-product-id={productId}>
            <header className="car-vdp__fold">
                <div className="car-vdp__hero">
                    <CarPhotoGallery testId={`${testId}-gallery`} photos={photos} />
                </div>
                <aside className="car-vdp__summary">
                    <h1 className="car-vdp__title" data-testid={`${testId}-title`}>{title}</h1>
                    <div className="car-vdp__price-block">
                        <span className="car-vdp__price" data-testid={`${testId}-price`}>{priceFormatted}</span>
                        {monthlyPaymentEstimate && (
                            <span className="car-vdp__monthly" data-testid={`${testId}-monthly`}>{monthlyPaymentEstimate}</span>
                        )}
                        <VatBadge regime={vatRegime} testId={`${testId}-vat`} />
                    </div>
                    {keyStats.length > 0 && (
                        <dl className="car-vdp__key-stats" data-testid={`${testId}-key-stats`}>
                            {keyStats.map(stat => (
                                <div key={stat.key} className="car-vdp__key-stat" data-testid={`${testId}-stat-${stat.key}`}>
                                    <dt>{stat.label}</dt>
                                    <dd>{stat.value}</dd>
                                </div>
                            ))}
                        </dl>
                    )}
                    <CarReservationCta
                        testId={`${testId}-reservation`}
                        state={reservation.state}
                        priceFormatted={priceFormatted}
                        depositFormatted={reservation.depositFormatted}
                        onReserve={reservation.onReserve}
                        onCancel={reservation.onCancel}
                        onContact={reservation.onContact}
                        forceVariant="desktop"
                    />
                </aside>
            </header>

            {specs.length > 0 && (
                <section className="car-vdp__section" data-testid={`${testId}-specs-section`}>
                    <h2>Specifications</h2>
                    <CarSpecTable testId={`${testId}-specs`} attributes={specs} grouped />
                </section>
            )}

            {trust.length > 0 && (
                <section className="car-vdp__section car-vdp__trust" data-testid={`${testId}-trust`}>
                    <h2>Trust</h2>
                    <ul className="car-vdp__trust-items">
                        {trust.map(item => (
                            <li key={item.key} className="car-vdp__trust-item" data-testid={`${testId}-trust-${item.key}`}>
                                <span className="car-vdp__trust-label">{item.label}</span>
                                {item.value && <span className="car-vdp__trust-value">{item.value}</span>}
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {similar && similar.length > 0 && (
                <section className="car-vdp__section car-vdp__similar" data-testid={`${testId}-similar`}>
                    <h2>Similar listings</h2>
                    <div className="car-vdp__similar-grid">
                        {similar.slice(0, MAX_SIMILAR).map(s => (
                            <CarListingCard
                                key={s.productId}
                                listing={s}
                                testId={`${testId}-similar-${s.productId}`}
                            />
                        ))}
                    </div>
                </section>
            )}

            <div className="car-vdp__sticky-mobile" data-testid={`${testId}-sticky-mobile`}>
                <CarReservationCta
                    testId={`${testId}-reservation-mobile`}
                    state={reservation.state}
                    priceFormatted={priceFormatted}
                    depositFormatted={reservation.depositFormatted}
                    onReserve={reservation.onReserve}
                    onCancel={reservation.onCancel}
                    onContact={reservation.onContact}
                    forceVariant="mobile"
                />
            </div>
        </article>
    );
};

export default CarVehicleDetailPage;
export {CarVehicleDetailPage};
export type {CarVehicleDetailPageProps, CarTrustItem} from './CarVehicleDetailPage.types';
