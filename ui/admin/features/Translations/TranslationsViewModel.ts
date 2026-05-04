import {message} from 'antd';
import TranslationManager from '@admin/shell/TranslationManager';
import {INewLanguage} from '@interfaces/INewLanguage';
import {ConflictError, isConflictError} from '@client/lib/conflict';
import {observable} from '@client/lib/state/observable';

/**
 * Translations / Languages view-model — VM3 final pane.
 *
 * Owns every piece of state that used to live as `useState` on
 * `ui/admin/features/Languages/Languages.tsx`:
 *
 *   - Sidebar + collapse state.
 *   - Currently-edited language symbol + display name.
 *   - The languages dictionary, menu items, dialog flag, mode toggle.
 *   - The pending edits the operator has typed but not yet saved
 *     (the `translation` object — keys → values).
 *   - The save-in-flight flag and the optimistic-concurrency conflict.
 *   - A monotonic `reloadNonce` that bumps the Suspense key on
 *     `ContentLoader` after a save / delete / language switch — without
 *     re-routing or reloading the whole page.
 *
 * The component talks to the existing `TranslationManager` through this
 * VM (it is NOT replaced — the manager owns the network + i18next dance
 * and is shared with `TranslationManager.test.ts`).
 */

export interface TranslationsConflictState {
    error: ConflictError<unknown>;
    retry: () => Promise<void>;
}

export interface TranslationsMenuItem {
    key: string;
    label: string;
    name?: string;
}

type Translator = (key: string, opts?: Record<string, unknown>) => string;

export class TranslationsViewModel {
    /** Sidebar collapse — pure UI but local to this pane. */
    collapsed = false;
    /** The locale symbol the operator is currently editing
     *  (`'default'` = the synthetic "App Translations" overview). */
    currentLanguage = 'default';
    /** Display name shown in the editor header. */
    currentLanguageName = 'App Translations';
    /** "Add new language" dialog open flag. */
    dialogOpen = false;
    /** Pending edits the operator has typed in the form. */
    translation: Record<string, string> = {};
    /** Editor / compare-all toggle. */
    mode: 'edit' | 'compare' = 'edit';
    /** Save-in-flight indicator (also covers delete / set-as-default). */
    saving = false;
    /** Bumped after every server-side mutation to force a fresh
     *  Suspense key on `ContentLoader` — same trick the legacy
     *  component used to re-read disk after save / delete / switch. */
    reloadNonce = 0;
    /** Side menu items (one per locale + the synthetic 'default'). */
    menuItems: TranslationsMenuItem[] = [{key: 'default', label: 'App Translations'}];
    /** Languages dictionary keyed by symbol — drives Set-as-default
     *  + Delete enable/disable + the optimistic-concurrency baseline
     *  passed to the next save. */
    languages: Record<string, INewLanguage> = {};
    /** Optimistic-concurrency conflict surfaced via dialog. */
    conflict: TranslationsConflictState | null = null;

    constructor(
        private readonly translationManager: TranslationManager,
        private readonly i18n: any,
        private readonly tAdmin: Translator,
    ) {
        this.currentLanguage = i18n?.language ?? 'default';
        return observable(this);
    }

    setTranslationValue(data: Record<string, string>): void {
        this.translation = data;
    }

    setMode(mode: 'edit' | 'compare'): void {
        this.mode = mode;
    }

    setCollapsed(v: boolean): void {
        this.collapsed = v;
    }

    openDialog(): void {
        this.dialogOpen = true;
    }

    bumpReload(): void {
        this.reloadNonce += 1;
    }

    /** Pull the latest languages list and rebuild the side menu.
     *  The synthetic 'default' entry stays at the top as the read-only
     *  source-keys overview — it's not a real locale. */
    async refreshMenu(): Promise<void> {
        const data = await this.translationManager.getLanguages();
        this.languages = data;
        const items: TranslationsMenuItem[] = [{
            key: 'default',
            label: this.tAdmin('App Translations'),
            name: 'App Translations',
        }];
        for (const id in data) {
            const lang = data[id];
            if (!lang?.symbol) continue;
            const suffix = lang.default ? ` (${this.tAdmin('default')})` : '';
            items.push({
                key: lang.symbol,
                name: lang.label,
                label: `${lang.label}${suffix}`,
            });
        }
        this.menuItems = items;
        if (this.i18n?.language) {
            const match = items.find(it => it.key === this.i18n.language);
            if (match) {
                this.currentLanguage = this.i18n.language;
                this.currentLanguageName = match.name ?? String(match.label);
            }
        }
    }

    /** Selection from the sidebar — load the target locale's resources
     *  BEFORE flipping the displayed key. Order matters; see legacy
     *  comments in `Languages.tsx` (preserved verbatim in tests). */
    async selectLanguage(key: string): Promise<void> {
        const match = this.menuItems.find(it => it.key === key);
        if (!match) return;
        try {
            if (key !== 'default') {
                await this.i18n.loadLanguages(key);
                await this.i18n.changeLanguage(key);
                await this.i18n.loadNamespaces('app');
                await this.i18n.reloadResources(key, 'app');
            }
        } catch (err) {
            // Logged through console — keep parity with the legacy path.
             
            console.error('switch language failed:', err);
        }
        this.currentLanguage = key;
        this.currentLanguageName = match.name ?? String(match.label);
        this.bumpReload();
    }

    private async performTranslationSave(expectedVersion: number | undefined): Promise<boolean> {
        // Filter out empty-string entries before sending. The editor seeds
        // missing rows with `''` so the placeholder=source shows, but the
        // server-side merge does `{...mongoBase, ...diskBase, ...incoming}`
        // — an empty string in `incoming` would overwrite real translations
        // on disk and Mongo with blanks. Sending only the keys the operator
        // actually typed (or accepted-as-source) keeps untouched rows
        // intact. Same intent as `csvTranslations.translationsFromCsv`'s
        // `if (val === '') continue` skip.
        const trimmed: Record<string, string> = {};
        for (const [k, v] of Object.entries(this.translation ?? {})) {
            if (typeof v === 'string' && v.length > 0) trimmed[k] = v;
        }
        const result = await this.translationManager.saveNewTranslation(
            {label: this.currentLanguageName, symbol: this.currentLanguage},
            trimmed,
            expectedVersion,
        );
        if ((result as any)?.error) {
            message.error(String((result as any).error));
            return false;
        }
        await this.i18n.reloadResources(this.currentLanguage);
        await this.refreshMenu();
        this.bumpReload();
        message.success(this.tAdmin('Translations saved'));
        return true;
    }

    async saveNewTranslation(): Promise<void> {
        if (this.currentLanguage === 'default') {
            message.warning(this.tAdmin('Select a non-default language before saving.'));
            return;
        }
        this.saving = true;
        try {
            const expected = this.languages[this.currentLanguage]?.version;
            await this.performTranslationSave(expected);
        } catch (err) {
            if (isConflictError(err)) {
                this.conflict = {
                    error: err,
                    retry: async () => {
                        this.saving = true;
                        try {
                            await this.performTranslationSave(err.currentVersion);
                            this.conflict = null;
                        } catch (e) {
                            message.error(String((e as Error)?.message ?? e));
                            this.conflict = null;
                        } finally {
                            this.saving = false;
                        }
                    },
                };
            } else {
                message.error(String((err as Error)?.message ?? err));
            }
        } finally {
            this.saving = false;
        }
    }

    async setAsDefault(): Promise<void> {
        if (this.currentLanguage === 'default') return;
        const lang = this.languages[this.currentLanguage];
        if (!lang?.symbol) return;
        if (lang.default) {
            message.info(this.tAdmin('Already the default language.'));
            return;
        }
        this.saving = true;
        try {
            // Send the full language doc with `default: true`. The
            // service-side demotes any previous default in the same call so
            // the collection invariant (at most one default) is preserved
            // atomically.
            const result = await this.translationManager.saveNewLanguage({
                label: lang.label,
                symbol: lang.symbol,
                flag: lang.flag,
                default: true,
                version: lang.version,
            } as INewLanguage);
            if ((result as any)?.error) {
                message.error(String((result as any).error));
                return;
            }
            message.success(this.tAdmin('Default language updated'));
            await this.refreshMenu();
            this.bumpReload();
        } catch (err) {
            if (isConflictError(err)) {
                await this.refreshMenu();
                message.warning(this.tAdmin('Language was modified elsewhere — please retry.'));
            } else {
                message.error(String((err as Error)?.message ?? err));
            }
        } finally {
            this.saving = false;
        }
    }

    async deleteTranslation(): Promise<void> {
        if (this.currentLanguage === 'default') return;
        // Refuse to delete the seeded default language — without it i18next
        // has no fallback to fall through to and the public site renders raw
        // keys.
        if (this.languages[this.currentLanguage]?.default) {
            message.warning(this.tAdmin('The default language cannot be deleted.'));
            return;
        }
        this.saving = true;
        try {
            await this.translationManager.deleteTranslation({
                label: this.currentLanguageName,
                symbol: this.currentLanguage,
            });
            await this.i18n.reloadResources();
            this.currentLanguage = 'default';
            this.currentLanguageName = 'App Translations';
            await this.refreshMenu();
            this.bumpReload();
            message.success(this.tAdmin('Language deleted'));
        } catch (err) {
            message.error(String((err as Error)?.message ?? err));
        } finally {
            this.saving = false;
        }
    }

    async handleDialogClose(didSave: boolean): Promise<void> {
        this.dialogOpen = false;
        if (didSave) {
            await this.refreshMenu();
            await this.i18n.reloadResources();
            this.bumpReload();
        }
    }

    dismissConflict(): void {
        this.conflict = null;
    }

    async takeTheirs(): Promise<void> {
        this.conflict = null;
        await this.refreshMenu();
        this.bumpReload();
    }
}
