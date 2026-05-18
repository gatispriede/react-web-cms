import {Collection, Db} from 'mongodb';
import guid from '@utils/guid';
import {ITheme, IThemeTokens, InTheme} from '@interfaces/ITheme';
import {auditStamp} from '@services/features/Audit/audit';
import {nextVersion, requireVersion} from '@services/infra/conflict';
import {log} from '@services/infra/logger';
import {loadFirstClassPresetRows, firstClassThemeNames, loadThemeManifests} from './ThemeRegistry';
import {manifestToTokens} from '@interfaces/Theme/IThemeManifest';

/**
 * First-class themes are the ONLY presets — each lives under
 * `services/themes/<slug>/` with a manifest (`theme.json`), per-theme
 * SCSS overrides (`theme.scss` + `module-styles.scss`), and a design
 * doc README. The legacy color-only presets (Industrial / Studio /
 * Paper / HighContrast + the inline Classic / Ocean / Brandappart /
 * Forest / Midnight blocks) were dropped 2026-05-13 because they only
 * varied colour + radius — no module-level structural differences. A
 * theme that doesn't differentiate the page isn't a theme worth picking.
 */

/** Names of presets eligible for "Reset to preset" — backed by an on-disk manifest. */
export const JSON_PRESET_NAMES: Set<string> = firstClassThemeNames();

export const PRESETS: Omit<ITheme, 'id'>[] = loadFirstClassPresetRows();

const ACTIVE_KEY = 'activeThemeId';

export class ThemeService {
    private themes: Collection;
    private settings: Collection;
    /**
     * Re-entry guard — Promise-based singleton (not a bool). Under App
     * Router, `app/layout.tsx` reads Mongo per request via
     * `getMongoConnection()`, and any reconnect path can re-trigger
     * `bootFeaturesAsync` → `onBoot` → `seedIfEmpty()` concurrently.
     * A bool flag has a TOCTOU race (check-then-set across an `await`):
     * two callers can both observe `false`, both flip it `true`, and
     * both run the seed. Storing the in-flight Promise instead means
     * the second caller awaits the first's work — one seed, every time.
     * Cleared on failure so the next call retries.
     */
    private static seedingPromise: Promise<void> | null = null;

    constructor(db: Db) {
        this.themes = db.collection('Themes');
        this.settings = db.collection('SiteSettings');
    }

    async seedIfEmpty(): Promise<void> {
        if (ThemeService.seedingPromise) return ThemeService.seedingPromise;
        ThemeService.seedingPromise = (async () => {
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
                // Null out so the next caller retries — keeping a rejected
                // promise cached would permanently break seeding for the
                // process lifetime on a transient Mongo blip.
                ThemeService.seedingPromise = null;
                log.error({scope: 'theme.seedPresets', err}, 'failed to seed theme presets');
            }
        })();
        return ThemeService.seedingPromise;
    }

    /** Test-only escape hatch — reset the in-flight seed singleton. */
    static _resetSeedingPromiseForTest(): void {
        ThemeService.seedingPromise = null;
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
     * Re-reads the first-class theme manifest matching the target row's
     * `name` and overwrites the DB doc's tokens with manifest values — the
     * "Reset to preset" path for admins. Only first-class themes are
     * resettable; custom themes have nothing on disk to reset against.
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
            throw new Error(`no preset on disk for "${name}"`);
        }
        // Look the manifest back up by name — `ThemeRegistry` caches its
        // disk read for the process lifetime, so admins `git pull` + restart
        // the server to refresh per the existing first-class-themes contract.
        const manifest = loadThemeManifests().find(m => m.name === name);
        if (!manifest) throw new Error(`no manifest on disk for "${name}"`);
        const tokens = manifestToTokens(manifest);
        const existingVersion = (existing as any).version as number | undefined;
        const version = nextVersion(existingVersion);
        const audit = auditStamp(editedBy);
        await this.themes.updateOne(
            {id},
            {$set: {name: manifest.name, tokens, custom: false, version, ...audit}},
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
