import React from 'react';
import VatBadge from '@client/components/VatBadge';
import type {CarListingCardProps} from './CarListingCard.types';

const CarListingCard: React.FC<CarListingCardProps> = ({listing, testId}) => {
    const tid = testId ?? `car-listing-${listing.productId}`;
    const showTenPlus = listing.photoCount >= 10;

    return (
        <a
            className="car-listing-card"
            href={listing.href}
            data-testid={tid}
            aria-label={`${listing.title}, ${listing.priceFormatted}`}
        >
            <div className="car-listing-card__thumb" data-testid={`${tid}-thumb`}>
                <img
                    className="car-listing-card__img"
                    src={listing.thumbUrl}
                    alt=""
                    loading="lazy"
                />
                <span
                    className="car-listing-card__photo-count"
                    data-testid={`${tid}-photo-count`}
                >
                    {listing.photoCount} photos
                </span>
            </div>

            <div className="car-listing-card__body">
                <div className="car-listing-card__header">
                    <h3 className="car-listing-card__title" data-testid={`${tid}-title`}>
                        {listing.title}
                    </h3>
                    <div className="car-listing-card__price-wrap">
                        <span className="car-listing-card__price" data-testid={`${tid}-price`}>
                            {listing.priceFormatted}
                        </span>
                        {listing.monthlyPaymentEstimate ? (
                            <span
                                className="car-listing-card__monthly"
                                data-testid={`${tid}-monthly`}
                            >
                                {listing.monthlyPaymentEstimate}
                            </span>
                        ) : null}
                    </div>
                </div>

                <dl className="car-listing-card__specs">
                    <div><dt>Mileage</dt><dd>{listing.mileage}</dd></div>
                    <div><dt>Fuel</dt><dd>{listing.fuel}</dd></div>
                    <div><dt>Gearbox</dt><dd>{listing.gearbox}</dd></div>
                    <div><dt>Year</dt><dd>{listing.year}</dd></div>
                    <div><dt>Region</dt><dd>{listing.region}</dd></div>
                </dl>

                <div className="car-listing-card__badges">
                    {listing.dealerVerified ? (
                        <span
                            className="car-listing-card__badge car-listing-card__badge--verified"
                            data-testid={`${tid}-badge-verified`}
                        >Verified seller</span>
                    ) : null}
                    {listing.accidentFree ? (
                        <span
                            className="car-listing-card__badge car-listing-card__badge--accident-free"
                            data-testid={`${tid}-badge-accident-free`}
                        >Accident-free</span>
                    ) : null}
                    {showTenPlus ? (
                        <span
                            className="car-listing-card__badge car-listing-card__badge--photos"
                            data-testid={`${tid}-badge-10-photos`}
                        >10+ photos</span>
                    ) : null}
                    <VatBadge regime={listing.vatRegime} />
                </div>
            </div>
        </a>
    );
};

export default CarListingCard;
export {CarListingCard};
