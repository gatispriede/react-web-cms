import {resolve} from "../gqty";
import {ITheme, InTheme} from "../../Interfaces/ITheme";

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
        try {
            const raw = await resolve(({query}) => (query as any).mongo.getActiveTheme);
            return raw ? JSON.parse(raw) : null;
        } catch (err) {
            console.error('getActive theme:', err);
            return null;
        }
    }

    async saveTheme(theme: InTheme): Promise<{id?: string; error?: string}> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.saveTheme({theme}));
            const parsed = JSON.parse(raw || '{}');
            return parsed.saveTheme ?? parsed;
        } catch (err) {
            return {error: String(err)};
        }
    }

    async deleteTheme(id: string): Promise<{id?: string; error?: string}> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.deleteTheme({id}));
            const parsed = JSON.parse(raw || '{}');
            return parsed.deleteTheme ?? parsed;
        } catch (err) {
            return {error: String(err)};
        }
    }

    async setActive(id: string): Promise<{id?: string; error?: string}> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.setActiveTheme({id}));
            const parsed = JSON.parse(raw || '{}');
            return parsed.setActiveTheme ?? parsed;
        } catch (err) {
            return {error: String(err)};
        }
    }
}

export default ThemeApi;
