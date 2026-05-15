import type {VatRegime} from '@client/components/VatBadge';

export interface ICarListingCard {
    productId: string;
    title: string;
    priceFormatted: string;
    monthlyPaymentEstimate?: string;
    mileage: string;
    fuel: string;
    gearbox: 'manual' | 'automatic';
    year: number;
    region: string;
    vatRegime: VatRegime;
    photoCount: number;
    thumbUrl: string;
    dealerVerified?: boolean;
    accidentFree?: boolean;
    /** Detail page URL — caller-supplied so the card stays route-agnostic. */
    href: string;
}

export interface CarListingCardProps {
    listing: ICarListingCard;
    /** Stable testid prefix; defaults to `car-listing-${productId}`. */
    testId?: string;
}
