import {resolve} from "@services/api/generated";
import type {
    IAdapterConfig,
    IInventoryDeadLetter,
    InventoryStatus,
    SyncReport,
} from "@interfaces/IInventory";

const parse = <T,>(raw: string | null | undefined, fallback: T): T => {
    if (!raw) return fallback;
    try { return JSON.parse(raw) as T; }
    catch { return fallback; }
};

export class InventoryApi {
    async status(): Promise<InventoryStatus | {error: string}> {
        try {
            const raw = await resolve(({query}) => (query as any).mongo.inventoryStatus());
            return parse<InventoryStatus | {error: string}>(raw, {error: 'no response'} as any);
        } catch (err) {
            return {error: String(err)};
        }
    }

    async readDeadLetters(limit = 50): Promise<IInventoryDeadLetter[]> {
        try {
            const raw = await resolve(({query}) => (query as any).mongo.inventoryReadDeadLetters({limit}));
            const parsed = parse<IInventoryDeadLetter[] | {error: string}>(raw, []);
            return Array.isArray(parsed) ? parsed : [];
        } catch (err) {
            console.error('InventoryApi.readDeadLetters:', err);
            return [];
        }
    }

    async syncAll(): Promise<SyncReport | {error: string}> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.inventorySyncAll());
            const parsed = parse<{inventorySyncAll?: SyncReport; error?: string}>(raw, {error: 'no response'});
            return parsed.inventorySyncAll ?? (parsed as {error: string});
        } catch (err) {
            return {error: String(err)};
        }
    }

    async syncDelta(): Promise<SyncReport | {error: string}> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.inventorySyncDelta());
            const parsed = parse<{inventorySyncDelta?: SyncReport; error?: string}>(raw, {error: 'no response'});
            return parsed.inventorySyncDelta ?? (parsed as {error: string});
        } catch (err) {
            return {error: String(err)};
        }
    }

    async saveAdapterConfig(config: IAdapterConfig): Promise<{ok?: boolean; error?: string}> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.inventorySaveAdapterConfig({config}));
            const parsed = parse<{inventorySaveAdapterConfig?: {ok: boolean}; error?: string}>(raw, {error: 'no response'});
            return parsed.inventorySaveAdapterConfig ?? (parsed as {error: string});
        } catch (err) {
            return {error: String(err)};
        }
    }
}

export default InventoryApi;
