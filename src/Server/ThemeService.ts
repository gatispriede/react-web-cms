import {Collection, Db} from 'mongodb';
import guid from '../helpers/guid';
import {ITheme, IThemeTokens, InTheme} from '../Interfaces/ITheme';
import {auditStamp} from './audit';
import {nextVersion, requireVersion} from './conflict';

const PRESETS: Omit<ITheme, 'id'>[] = [
    {
        name: 'Industrial',
        custom: false,
        tokens: {
            // Industrial preset from design-v4 — hi-vis yellow on dark
            // graphite, heavy Barlow Condensed uppercase. `colorAccent`
            // is the safety-yellow #FFC400; `colorAccentInk` is the near-
            // black bg so yellow-bg chips stay readable.
            colorPrimary: '#FFC400',
            colorBgBase: '#0F1419',
            colorTextBase: '#F3F1EC',
            colorSuccess: '#52c41a',
            colorWarning: '#FF6B2C',
            colorError: '#ff4d4f',
            colorInfo: '#4A9EFF',
            colorBgInset: '#171D24',
            colorInkSecondary: '#B7BCC2',
            colorInkTertiary: '#6E7680',
            colorRule: '#2B333C',
            colorRuleStrong: '#3F4750',
            colorAccent: '#FFC400',
            colorAccentInk: '#0F1419',
            colorMark: 'rgba(255, 196, 0, 0.16)',
            fontDisplay: `'Barlow Condensed', 'Barlow', system-ui, sans-serif`,
            fontMono: `'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace`,
            fontSans: `'Barlow', system-ui, -apple-system, 'Segoe UI', sans-serif`,
            borderRadius: 2,
            fontSize: 16,
            contentPadding: 28,
            themeSlug: 'industrial',
        },
    },
    {
        name: 'Studio',
        custom: false,
        tokens: {
            // Studio preset from design-v2 — warm forest palette + ember
            // accent + Fraunces display / Geist sans & mono. Italic accent
            // emphasis on key words is a render-level opt-in (see `Hero`
            // runs + `SvcTitle`), not a token.
            colorPrimary: '#C24B1E',
            colorBgBase: '#E8E3D3',
            colorTextBase: '#13201A',
            colorSuccess: '#52c41a',
            colorWarning: '#faad14',
            colorError: '#ff4d4f',
            colorInfo: '#1E5A6B',
            colorBgInset: '#DDD7C2',
            colorInkSecondary: '#2C3A30',
            colorInkTertiary: '#5A6559',
            colorRule: '#B5B49B',
            colorRuleStrong: '#8A8A73',
            colorAccent: '#C24B1E',
            colorAccentInk: '#F5F0E6',
            colorMark: 'rgba(194, 75, 30, 0.12)',
            fontDisplay: `'Fraunces', 'Times New Roman', serif`,
            fontMono: `'Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace`,
            fontSans: `'Geist', system-ui, -apple-system, 'Segoe UI', sans-serif`,
            borderRadius: 2,
            fontSize: 16,
            contentPadding: 32,
            themeSlug: 'studio',
        },
    },
    {
        name: 'Paper',
        custom: false,
        tokens: {
            // Editorial portfolio look from the Claude Design handoff.
            // Standard AntD tokens use hex equivalents so AntD's colour math
            // (alpha blends, hover / border derivation, dropdown menu bg, …)
            // keeps working. The oklch originals still reach the DOM via the
            // extended CSS-var tokens below; imperceptible visual diff.
            colorPrimary: '#c65a2a',
            // Warmer cream — matches `oklch(0.97 0.008 85)` more faithfully
            // than a cool #f6f5ef. The oklch source is on the CSS-var pipe so
            // any native-oklch consumer can read the exact value via --bg.
            colorBgBase: '#f7f3e8',
            colorTextBase: '#1f1b15',
            colorSuccess: '#52c41a',
            colorWarning: '#faad14',
            colorError: '#ff4d4f',
            colorInfo: '#1f3a8a',
            colorBgInset: 'oklch(0.945 0.012 82)',
            colorInkSecondary: 'oklch(0.36 0.01 60)',
            colorInkTertiary: 'oklch(0.55 0.008 60)',
            colorRule: 'oklch(0.82 0.012 70)',
            colorRuleStrong: 'oklch(0.62 0.012 60)',
            colorAccent: 'oklch(0.58 0.17 35)',
            colorAccentInk: 'oklch(0.98 0.008 85)',
            colorMark: 'oklch(0.58 0.17 35 / 0.14)',
            fontDisplay: `'Instrument Serif', ui-serif, Georgia, serif`,
            fontMono: `'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace`,
            fontSans: `'Inter Tight', system-ui, -apple-system, 'Segoe UI', sans-serif`,
            borderRadius: 0,
            fontSize: 15,
            contentPadding: 28,
            themeSlug: 'paper',
        },
    },
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
        name: 'High contrast',
        custom: false,
        tokens: {
            // A11y preset — pure black on white-equivalent flipped to ink-on-bg
            // ratio that lands above WCAG AAA (7:1) for body, with a safety-yellow
            // accent (#ffd400) tested at 19.56:1 on black. Focus rings, link
            // underlines, and heavier rules live in Themes/HighContrast.scss
            // under the `[data-theme-name="high-contrast"]` selector — no
            // colour-only state, all interactive elements show a visible
            // outline regardless of which module renders them.
            colorPrimary: '#ffd400',
            colorBgBase: '#000000',
            colorTextBase: '#ffffff',
            colorSuccess: '#7cffb2',
            colorWarning: '#ffd400',
            colorError: '#ff8a8a',
            colorInfo: '#a5f3fc',
            colorBgInset: '#0a0a0a',
            colorInkSecondary: '#f5f5f5',
            colorInkTertiary: '#d4d4d4',
            colorRule: '#ffffff',
            colorRuleStrong: '#ffffff',
            colorAccent: '#ffd400',
            colorAccentInk: '#000000',
            colorMark: 'rgba(255, 212, 0, 0.28)',
            borderRadius: 0,
            fontSize: 17,
            contentPadding: 28,
            themeSlug: 'high-contrast',
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
