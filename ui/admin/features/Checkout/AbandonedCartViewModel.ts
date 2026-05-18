/**
 * Phase 1.B-d — abandoned-cart admin VM (VM4).
 *
 * MCP-routed reads/writes — no React `useState` (per VM4 policy).
 * Round-trips:
 *   - `cart.abandoned.config.get` / `.config.set` — three flags
 *   - `cart.abandoned.list`                       — recent rows
 *   - `cart.abandoned.stats`                      — recovery rate + counts
 *
 * The pane consumes:
 *   - `state.enabled`       (bool, master switch)
 *   - `state.delayMinutes`  (number — predefined select)
 *   - `state.discountCode`  (string — operator-supplied promo)
 *   - `rows`                (recent abandonments table)
 *   - `stats`               (recoveryRate + counts)
 */
import {observable} from '@client/lib/state/observable';
import {notifyError, notifyPromise} from '@admin/lib/notify';

async function mcp<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const res = await fetch('/api/mcp/tools/call', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({name, arguments: args}),
    });
    if (!res.ok) throw new Error(`MCP ${name} failed: ${res.status}`);
    const env = await res.json();
    const text = env?.content?.[0]?.text ?? JSON.stringify(env);
    const parsed = JSON.parse(text);
    if (parsed?.ok === false) throw new Error(parsed?.error?.message || parsed?.error || 'MCP error');
    return (parsed?.data ?? parsed) as T;
}

export interface AbandonedCartRow {
    cartId: string;
    customerId: string;
    updatedAt: string;
    recoveryEmailSentAt?: string | null;
    status: 'active' | 'recovered' | 'converted' | 'abandoned';
    subtotal: number;
    currency: string;
}

export interface AbandonedCartStats {
    recoveryRate: number;
    recoveryEmailsSent: number;
    recovered: number;
    sentButNotRecovered: number;
    active: number;
    abandoned: number;
}

export interface AbandonedCartState {
    enabled: boolean;
    delayMinutes: number;
    discountCode: string;
}

const DEFAULT_STATE: AbandonedCartState = {
    enabled: false,
    delayMinutes: 60,
    discountCode: '',
};

const DEFAULT_STATS: AbandonedCartStats = {
    recoveryRate: 0,
    recoveryEmailsSent: 0,
    recovered: 0,
    sentButNotRecovered: 0,
    active: 0,
    abandoned: 0,
};

export class AbandonedCartViewModel {
    state: AbandonedCartState = {...DEFAULT_STATE};
    rows: AbandonedCartRow[] = [];
    stats: AbandonedCartStats = {...DEFAULT_STATS};
    loading = false;
    error: string | null = null;

    constructor() { return observable(this); }

    async refresh(): Promise<void> {
        this.loading = true;
        this.error = null;
        try {
            const [cfg, list, stats] = await Promise.all([
                mcp<{commerce?: Record<string, unknown>}>('cart.abandoned.config.get', {}),
                // Port may not be registered yet on dev boots — swallow.
                mcp<{rows?: AbandonedCartRow[]}>('cart.abandoned.list', {rangeHours: 72, limit: 100})
                    .catch(() => ({rows: []})),
                mcp<AbandonedCartStats>('cart.abandoned.stats', {rangeHours: 168})
                    .catch(() => DEFAULT_STATS),
            ]);
            const c = (cfg.commerce ?? {}) as Record<string, unknown>;
            this.state = {
                enabled: c.abandonedCartEnabled === true,
                delayMinutes: Number(c.abandonedCartDelayMinutes ?? 60),
                discountCode: String(c.abandonedCartDiscountCode ?? ''),
            };
            this.rows = list.rows ?? [];
            this.stats = {...DEFAULT_STATS, ...stats};
        } catch (err) {
            this.error = (err as Error).message;
            notifyError(`Failed to load abandoned-cart settings: ${this.error}`);
        } finally {
            this.loading = false;
        }
    }

    private async setFlag<T>(path: string, value: T, optimistic: () => void): Promise<void> {
        optimistic();
        await notifyPromise(
            mcp('cart.abandoned.config.set', {path, value}),
            {
                loading: 'Saving…',
                success: () => 'Saved',
                error: (e: unknown) => `Save failed: ${(e as Error).message}`,
            },
        );
    }

    setEnabled(v: boolean): Promise<void> {
        return this.setFlag('commerce.abandonedCartEnabled', v, () => {
            this.state = {...this.state, enabled: v};
        });
    }

    setDelayMinutes(v: number): Promise<void> {
        return this.setFlag('commerce.abandonedCartDelayMinutes', v, () => {
            this.state = {...this.state, delayMinutes: v};
        });
    }

    /** Local-only edit — used by the controlled input on each keystroke. */
    setDiscountCodeLocal(v: string): void {
        this.state = {...this.state, discountCode: v};
    }

    setDiscountCode(v: string): Promise<void> {
        const next = (v ?? '').toString();
        return this.setFlag('commerce.abandonedCartDiscountCode', next, () => {
            this.state = {...this.state, discountCode: next};
        });
    }
}
