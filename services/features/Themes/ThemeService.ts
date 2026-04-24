import fs from 'node:fs';
import path from 'node:path';
import {Collection, Db} from 'mongodb';
import guid from '@utils/guid';
import {ITheme, IThemeTokens, InTheme} from '@interfaces/ITheme';
import {auditStamp} from '@services/features/Audit/audit';
import {nextVersion, requireVersion} from '@services/infra/conflict';

/**
 * Editorial presets live as source-controlled JSON in `ui/client/themes/`
 * (one file per preset). Loaded at module init so `PRESETS` stays a plain
 * in-memory array; the four JSON-backed entries are the canonical designs
 * and are diffable on disk. The remaining hardcoded presets below are the
 * colour-only basics kept for continuity — they don't need a SCSS pair.
 */
const THEMES_DIR = path.join(process.cwd(), 'ui/client/themes');
const JSON_PRESET_SLUGS = ['industrial', 'studio', 'paper', 'high-contrast'] as const;
type JsonPresetSlug = typeof JSON_PRESET_SLUGS[number];

function readJsonPreset(slug: JsonPresetSlug): Omit<ITheme, 'id'> {
    const file = path.join(THEMES_DIR, `${slug}.json`);
    const raw = fs.readFileSync(file, 'utf-8');
    const parsed = JSON.parse(raw) as Omit<ITheme, 'id'>;
    return {name: parsed.name, custom: false, tokens: parsed.tokens};
}

function loadJsonPresets(): Omit<ITheme, 'id'>[] {
    return JSON_PRESET_SLUGS.map(readJsonPreset);
}

/** Names of presets backed by on-disk JSON — eligible for "Reset to preset". */
export const JSON_PRESET_NAMES: Set<string> = new Set(
    loadJsonPresets().map(p => p.name),
);

export const PRESETS: Omit<ITheme, 'id'>[] = [
    ...loadJsonPresets(),
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
        name: 'Brandappart',
        custom: false,
        tokens: {
            // design-v6 Brandappart — parchment palette + sea accent +
            // Instrument Serif display. Rounded 18px cards distinguish it
            // visually from Studio (same palette, sharp corners).
            colorPrimary: '#1E5A6B',
            colorBgBase: '#E8E3D3',
            colorTextBase: '#13201A',
            colorSuccess: '#52c41a',
            colorWarning: '#faad14',
            colorError: '#ff4d4f',
            colorInfo: '#C24B1E',
            colorBgInset: '#DDD7C2',
            colorInkSecondary: '#2C3A30',
            colorInkTertiary: '#6B7C75',
            colorRule: '#B5B49B',
            colorRuleStrong: '#8A8A73',
            colorAccent: '#1E5A6B',
            colorAccentInk: '#F4F1EA',
            colorMark: 'rgba(30, 90, 107, 0.12)',
            fontDisplay: `'Instrument Serif', 'Times New Roman', serif`,
            fontMono: `'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace`,
            fontSans: `'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif`,
            borderRadius: 18,
            fontSize: 16,
            contentPadding: 32,
            themeSlug: 'studio',
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
            if (count === 0) {
                const docs: ITheme[] = PRESETS.map(p => ({id: guid(), ...p}));
                await this.themes.insertMany(docs as any);
                await this.setActive(docs[0].id);
                return;
            }
            // Collection already seeded: upsert any preset names that are
            // missing so existing installations pick up new presets after a
            // deploy. Customised themes (`custom: true`) are never touched.
            for (const preset of PRESETS) {
                const existing = await this.themes.findOne({name: preset.name, custom: false});
                if (!existing) {
                    await this.themes.insertOne({id: guid(), ...preset} as any);
                }
            }
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
            version: (d as any).version ?? 0,
            editedBy: (d as any).editedBy,
            editedAt: (d as any).editedAt,
        }));
    }

    async getActive(): Promise<ITheme | null> {
        const setting = await this.settings.findOne({key: ACTIVE_KEY});
        const activeId = (setting as any)?.value;
        // Prefer the setting-level audit (latest activation / delete-reassign)
        // over the theme doc's own save-time stamp — the tab badge reflects
        // what the admin touched most recently, which includes theme switches.
        const settingAudit = {
            editedBy: (setting as any)?.editedBy,
            editedAt: (setting as any)?.editedAt,
        };
        if (!activeId) {
            const first = await this.themes.findOne({}, {projection: {_id: 0}});
            if (!first) return null;
            return {...(first as any), version: (first as any).version ?? 0, ...settingAudit} as ITheme;
        }
        const found = await this.themes.findOne({id: activeId}, {projection: {_id: 0}});
        if (!found) return null;
        const themeAudit = {editedBy: (found as any).editedBy, editedAt: (found as any).editedAt};
        const pick = (settingAudit.editedAt ?? '') > (themeAudit.editedAt ?? '') ? settingAudit : themeAudit;
        return {...(found as any), version: (found as any).version ?? 0, ...pick} as ITheme;
    }

    async setActive(id: string, editedBy?: string): Promise<{id: string}> {
        const exists = await this.themes.findOne({id});
        if (!exists) throw new Error('theme not found');
        const audit = auditStamp(editedBy);
        await this.settings.updateOne(
            {key: ACTIVE_KEY},
            {$set: {key: ACTIVE_KEY, value: id, ...audit}},
            {upsert: true},
        );
        return {id};
    }

    async saveTheme(theme: InTheme, editedBy?: string, expectedVersion?: number | null): Promise<{id: string; version: number}> {
        if (!theme.name?.trim()) throw new Error('name is required');
        const tokens: IThemeTokens = theme.tokens ?? {};
        const audit = auditStamp(editedBy);
        if (theme.id) {
            const existing = await this.themes.findOne({id: theme.id});
            if (!existing) throw new Error('theme not found');
            if ((existing as any).custom === false && theme.custom !== false) {
                throw new Error('cannot modify a preset theme; duplicate it first');
            }
            const existingVersion = (existing as any).version as number | undefined;
            requireVersion(existing, existingVersion, expectedVersion, `Theme "${theme.name}"`);
            const version = nextVersion(existingVersion);
            await this.themes.updateOne(
                {id: theme.id},
                {$set: {name: theme.name, tokens, custom: true, version, ...audit}},
            );
            return {id: theme.id, version};
        }
        const id = guid();
        const version = 1;
        await this.themes.insertOne({
            id,
            name: theme.name,
            tokens,
            custom: theme.custom ?? true,
            version,
            ...audit,
        } as any);
        return {id, version};
    }

    /**
     * Re-reads the JSON preset matching the target row's `name` and overwrites
     * the DB doc's tokens with file values — the "Reset to preset" path for
     * admins. Only works on JSON-backed presets; in-code presets (Classic /
     * Ocean / Midnight / Forest) have nothing to reset against on disk.
     *
     * The doc stays in place (same id) so any `activeThemeId` pointer keeps
     * working; `custom` is forced back to `false` and version bumps so concurrent
     * editors notice.
     */
    async resetPreset(id: string, editedBy?: string): Promise<{id: string; version: number}> {
        const existing = await this.themes.findOne({id});
        if (!existing) throw new Error('theme not found');
        const name = (existing as any).name as string;
        if (!JSON_PRESET_NAMES.has(name)) {
            throw new Error(`no JSON preset on disk for "${name}"`);
        }
        // Re-read from disk each call so an admin can `git pull` fresh preset
        // values and hit "Reset" without a server restart.
        const slug = JSON_PRESET_SLUGS.find(s => {
            try { return readJsonPreset(s).name === name; } catch { return false; }
        });
        if (!slug) throw new Error(`no JSON preset on disk for "${name}"`);
        const jsonPreset = readJsonPreset(slug);
        const existingVersion = (existing as any).version as number | undefined;
        const version = nextVersion(existingVersion);
        const audit = auditStamp(editedBy);
        await this.themes.updateOne(
            {id},
            {$set: {name: jsonPreset.name, tokens: jsonPreset.tokens, custom: false, version, ...audit}},
        );
        return {id, version};
    }

    async deleteTheme(id: string, deletedBy?: string): Promise<{id: string; deletedBy?: string}> {
        const existing = await this.themes.findOne({id});
        if (!existing) throw new Error('theme not found');
        if ((existing as any).custom === false) throw new Error('cannot delete a preset theme');
        const activeSetting = await this.settings.findOne({key: ACTIVE_KEY});
        if ((activeSetting as any)?.value === id) {
            const fallback = await this.themes.findOne({id: {$ne: id}});
            if (fallback) {
                await this.settings.updateOne(
                    {key: ACTIVE_KEY},
                    {$set: {value: (fallback as any).id, ...auditStamp(deletedBy)}},
                );
            } else {
                await this.settings.deleteOne({key: ACTIVE_KEY});
            }
        }
        await this.themes.deleteOne({id});
        return {id, ...(deletedBy ? {deletedBy} : {})};
    }
}
