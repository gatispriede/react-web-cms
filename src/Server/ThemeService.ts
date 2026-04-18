import {Collection, Db} from 'mongodb';
import guid from '../helpers/guid';
import {ITheme, IThemeTokens, InTheme} from '../Interfaces/ITheme';

const PRESETS: Omit<ITheme, 'id'>[] = [
    {
        name: 'Classic',
        custom: false,
        tokens: {
            colorPrimary: '#3b3939',
            colorBgBase: '#ffffff',
            colorTextBase: '#1f1f1f',
            colorSuccess: '#52c41a',
            colorWarning: '#faad14',
            colorError: '#ff4d4f',
            colorInfo: '#1677ff',
            borderRadius: 6,
            fontSize: 16,
            contentPadding: 24,
        },
    },
    {
        name: 'Ocean',
        custom: false,
        tokens: {
            colorPrimary: '#1677ff',
            colorBgBase: '#f0f5ff',
            colorTextBase: '#001529',
            colorSuccess: '#13c2c2',
            colorWarning: '#fa8c16',
            colorError: '#ff4d4f',
            colorInfo: '#1677ff',
            borderRadius: 8,
            fontSize: 16,
            contentPadding: 24,
        },
    },
    {
        name: 'Forest',
        custom: false,
        tokens: {
            colorPrimary: '#389e0d',
            colorBgBase: '#fcffe6',
            colorTextBase: '#135200',
            colorSuccess: '#52c41a',
            colorWarning: '#d4b106',
            colorError: '#cf1322',
            colorInfo: '#389e0d',
            borderRadius: 4,
            fontSize: 16,
            contentPadding: 24,
        },
    },
    {
        name: 'Midnight',
        custom: false,
        tokens: {
            colorPrimary: '#9254de',
            colorBgBase: '#141414',
            colorTextBase: '#f0f0f0',
            colorSuccess: '#49aa19',
            colorWarning: '#d89614',
            colorError: '#dc4446',
            colorInfo: '#177ddc',
            borderRadius: 8,
            fontSize: 16,
            contentPadding: 28,
        },
    },
];

const ACTIVE_KEY = 'activeThemeId';

export class ThemeService {
    private themes: Collection;
    private settings: Collection;
    private static seeded = false;

    constructor(db: Db) {
        this.themes = db.collection('Themes');
        this.settings = db.collection('SiteSettings');
    }

    async seedIfEmpty(): Promise<void> {
        if (ThemeService.seeded) return;
        ThemeService.seeded = true;
        try {
            const count = await this.themes.estimatedDocumentCount();
            if (count > 0) return;
            const docs: ITheme[] = PRESETS.map(p => ({id: guid(), ...p}));
            await this.themes.insertMany(docs as any);
            await this.setActive(docs[0].id);
        } catch (err) {
            ThemeService.seeded = false;
            console.error('[theme] Failed to seed presets:', err);
        }
    }

    async getThemes(): Promise<ITheme[]> {
        const docs = await this.themes.find({}, {projection: {_id: 0}}).toArray();
        return docs.map(d => ({
            id: (d as any).id,
            name: (d as any).name,
            tokens: (d as any).tokens ?? {},
            custom: Boolean((d as any).custom),
        }));
    }

    async getActive(): Promise<ITheme | null> {
        const setting = await this.settings.findOne({key: ACTIVE_KEY});
        const activeId = (setting as any)?.value;
        if (!activeId) {
            const first = await this.themes.findOne({}, {projection: {_id: 0}});
            return first as unknown as ITheme | null;
        }
        const found = await this.themes.findOne({id: activeId}, {projection: {_id: 0}});
        return found as unknown as ITheme | null;
    }

    async setActive(id: string): Promise<{id: string}> {
        const exists = await this.themes.findOne({id});
        if (!exists) throw new Error('theme not found');
        await this.settings.updateOne(
            {key: ACTIVE_KEY},
            {$set: {key: ACTIVE_KEY, value: id}},
            {upsert: true},
        );
        return {id};
    }

    async saveTheme(theme: InTheme): Promise<{id: string}> {
        if (!theme.name?.trim()) throw new Error('name is required');
        const tokens: IThemeTokens = theme.tokens ?? {};
        if (theme.id) {
            const existing = await this.themes.findOne({id: theme.id});
            if (!existing) throw new Error('theme not found');
            if ((existing as any).custom === false && theme.custom !== false) {
                throw new Error('cannot modify a preset theme; duplicate it first');
            }
            await this.themes.updateOne(
                {id: theme.id},
                {$set: {name: theme.name, tokens, custom: true}},
            );
            return {id: theme.id};
        }
        const id = guid();
        await this.themes.insertOne({
            id,
            name: theme.name,
            tokens,
            custom: theme.custom ?? true,
        } as any);
        return {id};
    }

    async deleteTheme(id: string): Promise<{id: string}> {
        const existing = await this.themes.findOne({id});
        if (!existing) throw new Error('theme not found');
        if ((existing as any).custom === false) throw new Error('cannot delete a preset theme');
        const activeSetting = await this.settings.findOne({key: ACTIVE_KEY});
        if ((activeSetting as any)?.value === id) {
            const fallback = await this.themes.findOne({id: {$ne: id}});
            if (fallback) {
                await this.settings.updateOne(
                    {key: ACTIVE_KEY},
                    {$set: {value: (fallback as any).id}},
                );
            } else {
                await this.settings.deleteOne({key: ACTIVE_KEY});
            }
        }
        await this.themes.deleteOne({id});
        return {id};
    }
}
