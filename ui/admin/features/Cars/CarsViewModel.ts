/**
 * Cars admin pane — VM. Tracks imported listings + reservation queue
 * and exposes admin actions (import from fixture/live, confirm deposit,
 * cancel reservation).
 */
import {notifyError, notifySuccess} from '@admin/lib/notify';
import {observable} from '@client/lib/state/observable';

export interface CarRow {
    id: string;
    slug: string;
    title: string;
    price: number;
    currency: string;
    stock: number;
    externalId?: string;
    updatedAt: string;
    attributes?: Record<string, string>;
}

export interface ReservationRow {
    id: string;
    createdAt: string;
    name: string;
    email: string;
    phone?: string;
    message?: string;
    reservationStatus?: 'pending' | 'deposit-confirmed' | 'cancelled';
    car?: {
        externalId?: string | null;
        slug?: string | null;
        title?: string | null;
        priceCents?: number | null;
        currency?: string | null;
        vatRegime?: string | null;
    };
}

type Source = 'fixture' | 'live';

async function fetchListings(): Promise<CarRow[]> {
    const r = await fetch('/api/cars/admin?view=listings', {credentials: 'same-origin'});
    if (!r.ok) throw new Error(`Fetch listings failed: ${r.status}`);
    const j = await r.json();
    return Array.isArray(j?.rows) ? j.rows : [];
}

async function fetchReservations(): Promise<ReservationRow[]> {
    const r = await fetch('/api/cars/admin?view=reservations', {credentials: 'same-origin'});
    if (!r.ok) throw new Error(`Fetch reservations failed: ${r.status}`);
    const j = await r.json();
    return Array.isArray(j?.rows) ? j.rows : [];
}

async function postAction(body: Record<string, unknown>): Promise<{ok: boolean; imported?: number}> {
    const r = await fetch('/api/cars/admin', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        credentials: 'same-origin',
        body: JSON.stringify(body),
    });
    if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || `Request failed: ${r.status}`);
    }
    return r.json();
}

export class CarsViewModel {
    listings: CarRow[] = [];
    reservations: ReservationRow[] = [];
    loading = false;
    busy = false;
    activeTab: 'listings' | 'reservations' = 'listings';

    constructor(private readonly t: (k: string, opts?: Record<string, unknown>) => string = (k) => k) {
        return observable(this);
    }

    setTab(tab: 'listings' | 'reservations'): void {
        this.activeTab = tab;
    }

    async refresh(): Promise<void> {
        this.loading = true;
        try {
            const [listings, reservations] = await Promise.all([
                fetchListings().catch(() => [] as CarRow[]),
                fetchReservations().catch(() => [] as ReservationRow[]),
            ]);
            this.listings = listings;
            this.reservations = reservations;
        } catch (err) {
            notifyError(err);
        } finally {
            this.loading = false;
        }
    }

    async importFrom(source: Source): Promise<void> {
        this.busy = true;
        try {
            const out = await postAction({action: 'import', source});
            notifySuccess(this.t('Imported {{n}} car(s) from {{src}}', {n: out.imported ?? 0, src: source}));
            await this.refresh();
        } catch (err) {
            notifyError(err);
        } finally {
            this.busy = false;
        }
    }

    async confirmDeposit(reservationId: string): Promise<void> {
        this.busy = true;
        try {
            await postAction({action: 'confirm-deposit', reservationId});
            notifySuccess(this.t('Deposit confirmed'));
            await this.refresh();
        } catch (err) {
            notifyError(err);
        } finally {
            this.busy = false;
        }
    }

    async cancelReservation(reservationId: string): Promise<void> {
        this.busy = true;
        try {
            await postAction({action: 'cancel-reservation', reservationId});
            notifySuccess(this.t('Reservation cancelled'));
            await this.refresh();
        } catch (err) {
            notifyError(err);
        } finally {
            this.busy = false;
        }
    }

    get pendingReservations(): number {
        return this.reservations.filter(r => (r.reservationStatus ?? 'pending') === 'pending').length;
    }
}
