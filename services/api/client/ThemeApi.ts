import {resolve} from "@services/api/generated";
import {ITheme, InTheme} from "@interfaces/ITheme";
import {refreshBus} from "@client/lib/refreshBus";
import {isConflictError, parseMutationResponse} from "@client/lib/conflict";

// Module-level theme cache. A page navigation may touch 2–3 components that
// each call `getActive()`; with `maxAge: 0` on the gqty cache every one of
// them triggers its own fetch. Cache for 30s per tab and invalidate on any
// theme mutation.
let cachedTheme: {at: number; theme: ITheme | null} | null = null;
const TTL_MS = 30_000;

export class ThemeApi {
    async listThemes(): Promise<ITheme[]> {
        try {
            const raw = await resolve(({query}) => (query as any).mongo.getThemes);
            return raw ? JSON.parse(raw) : [];
        } catch (err) {
            console.error('listThemes:', err);
            return [];
        }
    }

    async getActive(): Promise<ITheme | null> {
        if (cachedTheme && Date.now() - cachedTheme.at < TTL_MS) {
            return cachedTheme.theme;
        }
        try {
            const raw = await resolve(({query}) => (query as any).mongo.getActiveTheme);
            const theme = raw ? JSON.parse(raw) : null;
            cachedTheme = {at: Date.now(), theme};
            return theme;
        } catch (err) {
            console.error('getActive theme:', err);
            return null;
        }
    }

    /** Call this after any admin theme mutation so the next getActive fetches fresh. */
    invalidateCache(): void {
        cachedTheme = null;
    }

    async saveTheme(theme: InTheme, expectedVersion?: number | null): Promise<{id?: string; version?: number; error?: string}> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.saveTheme({
                theme,
                ...(expectedVersion != null ? {expectedVersion} : {}),
            }));
            // parseMutationResponse throws ConflictError on the conflict shape; the
            // editor catches that and surfaces a `<ConflictDialog>`. Any other
            // server error still falls through to the `{error}` shape so existing
            // toast handlers keep working.
            const parsed: any = parseMutationResponse(raw);
            this.invalidateCache();
            refreshBus.emit('settings');
            return parsed.saveTheme ?? parsed;
        } catch (err) {
            if (isConflictError(err)) throw err;
            return {error: String(err)};
        }
    }

    async deleteTheme(id: string): Promise<{id?: string; error?: string}> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.deleteTheme({id}));
            const parsed = JSON.parse(raw || '{}');
            this.invalidateCache();
            refreshBus.emit('settings');
            return parsed.deleteTheme ?? parsed;
        } catch (err) {
            return {error: String(err)};
        }
    }

    async resetPreset(id: string): Promise<{id?: string; version?: number; error?: string}> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.resetPreset({id}));
            const parsed = JSON.parse(raw || '{}');
            this.invalidateCache();
            refreshBus.emit('settings');
            return parsed.resetPreset ?? parsed;
        } catch (err) {
            return {error: String(err)};
        }
    }

    async setActive(id: string): Promise<{id?: string; error?: string}> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.setActiveTheme({id}));
            const parsed = JSON.parse(raw || '{}');
            this.invalidateCache();
            refreshBus.emit('settings');
            return parsed.setActiveTheme ?? parsed;
        } catch (err) {
            return {error: String(err)};
        }
    }
}

export default ThemeApi;
