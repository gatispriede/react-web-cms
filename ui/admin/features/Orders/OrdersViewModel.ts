import {Modal} from 'antd';
import {notifyError, notifySuccess} from '@admin/lib/notify';
import OrderApi from '@services/api/client/OrderApi';
import type {IOrder, OrderStatus} from '@interfaces/IOrder';
import {observable} from '@client/lib/state/observable';

const formatMoney = (amount: number, currency: string) => {
    try {
        return new Intl.NumberFormat(undefined, {style: 'currency', currency: currency || 'USD'}).format((amount ?? 0) / 100);
    } catch { return `${(amount ?? 0) / 100} ${currency || ''}`; }
};

/** VM3 — Orders admin pane state. */
export class OrdersViewModel {
    orders: IOrder[] = [];
    loading = false;
    statusFilter: OrderStatus | 'all' = 'all';
    dateRange: [any, any] | null = null;
    detail: IOrder | null = null;

    constructor(private readonly api: OrderApi = new OrderApi()) {
        return observable(this);
    }

    setStatusFilter(s: OrderStatus | 'all'): void {
        this.statusFilter = s;
        void this.refresh();
    }

    setDateRange(r: [any, any] | null): void { this.dateRange = r; }
    selectDetail(o: IOrder | null): void { this.detail = o; }

    async refresh(): Promise<void> {
        this.loading = true;
        try {
            this.orders = await this.api.adminOrders({
                status: this.statusFilter === 'all' ? undefined : this.statusFilter,
                limit: 100,
            });
        } finally { this.loading = false; }
    }

    get filtered(): IOrder[] {
        if (!this.dateRange?.[0] || !this.dateRange?.[1]) return this.orders;
        const from = this.dateRange[0].toDate?.().getTime?.() ?? 0;
        const to = this.dateRange[1].toDate?.().getTime?.() ?? Date.now();
        return this.orders.filter(o => {
            const t = new Date(o.createdAt).getTime();
            return t >= from && t <= to;
        });
    }

    async transition(next: OrderStatus): Promise<void> {
        if (!this.detail) return;
        const result = await this.api.adminTransitionOrder({orderId: this.detail.id, next});
        if ((result as {error?: string}).error) { notifyError((result as {error?: string}).error ?? ''); return; }
        notifySuccess(`Marked ${next}`);
        this.detail = result as IOrder;
        await this.refresh();
    }

    refund(): void {
        if (!this.detail) return;
        const order = this.detail;
        Modal.confirm({
            title: 'Refund whole order?',
            content: `Refund ${formatMoney(order.total, order.currency)} for order ${order.orderNumber}?`,
            okText: 'Refund',
            okButtonProps: {danger: true},
            onOk: async () => {
                const result = await this.api.adminRefundOrder({orderId: order.id});
                if ((result as {error?: string}).error) { notifyError((result as {error?: string}).error ?? ''); return; }
                notifySuccess('Refunded');
                this.detail = result as IOrder;
                await this.refresh();
            },
        });
    }
}
