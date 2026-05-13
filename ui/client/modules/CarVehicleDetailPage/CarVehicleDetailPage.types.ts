import type {CarPhotoGalleryPhoto} from '@client/modules/CarPhotoGallery/CarPhotoGallery.types';
import type {CarSpecAttribute} from '@client/modules/CarSpecTable/CarSpecTable.types';
import type {ICarListingCard} from '@client/modules/CarListingCard/CarListingCard.types';
import type {ReservationState} from '@client/modules/CarReservationCta/CarReservationCta.types';
import type {VatRegime} from '@client/components/VatBadge';

export interface CarTrustItem {
    key: string;
    label: string;
    /** Optional supporting copy. */
    value?: string;
}

export interface CarVehicleDetailPageProps {
    testId: string;
    productId: string;
    title: string;
    priceFormatted: string;
    monthlyPaymentEstimate?: string;
    vatRegime: VatRegime;
    photos: CarPhotoGalleryPhoto[];
    /** Quick-stats strip above the fold (mileage, fuel, gearbox, year, region). */
    keyStats: ReadonlyArray<{key: string; label: string; value: string}>;
    /** Full attribute map for the spec section. */
    specs: CarSpecAttribute[];
    /** Trust strip items: history report, VIN, accident-free badge, dealer rating. */
    trust: CarTrustItem[];
    /** Reservation widget state + handlers. */
    reservation: {
        state: ReservationState;
        depositFormatted?: string;
        onReserve: () => void | Promise<void>;
        onCancel?: () => void | Promise<void>;
        onContact?: () => void;
    };
    /** Similar-listings strip (up to 4). */
    similar?: ICarListingCard[];
}
