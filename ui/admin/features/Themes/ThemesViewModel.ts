import {notifyError, notifySuccess} from '@admin/lib/notify';
import ThemeApi from '@services/api/client/ThemeApi';
import {ITheme, IThemeTokens, InTheme} from '@interfaces/ITheme';
import {ConflictError, isConflictError} from '@client/lib/conflict';
import {observable} from '@client/lib/state/observable';
import {GuardedAction} from '@admin/lib/useGuardedAction';
import type {FontPickerSlot} from './FontPicker';

/**
 * Themes view-model — VM3 final pane (Themes was deferred because of
 * the style/font picker complexity, then completed 2026-05-02 alongside
 * Translations).
 *
 * Owns:
 *   - The theme list + active id + active-row audit metadata.
 *   - The "is the editor open?" state, including the in-flight draft
 *     (so colour / font / numeric token edits live here, not as
 *     transient `useState` inside the modal — the spec rule "everything
 *     that mutates state lives on the class" applies to the editor too).
 *   - The font picker slot — `'display' | 'sans' | 'mono' | null`.
 *   - The optimistic-concurrency baseline + the conflict surface.
 *   - Loading / saving flags.
 *
 * The component is a render-only shell; every mutation goes through a
 * method on this class.
 */

export interface ThemesConflictState {
    error: ConflictError<unknown>;
    retry: () => Promise<void>;
}

export const BLANK_TOKENS: IThemeTokens = {
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
};

type Translator = (key: string, opts?: Record<string, unknown>) => string;

const FONT_TOKEN_KEY = (slot: FontPickerSlot): 'fontDisplay' | 'fontSans' | 'fontMono' =>
    slot === 'sans' ? 'fontSans' : slot === 'mono' ? 'fontMono' : 'fontDisplay';

export class ThemesViewModel {
    themes: ITheme[] = [];
    activeId: string | null = null;
    activeAudit: {editedBy?: string; editedAt?: string} = {};
    loading = false;
    saving = false;

    /** Editor draft — `null` = modal closed. */
    editing: InTheme | null = null;
    /** Server-side `version` at the time the editor opened. */
    editingVersion: number | undefined = undefined;
    /** Currently-open font picker slot — `null` = picker closed. */
    pickerSlot: FontPickerSlot | null = null;

    conflict: ThemesConflictState | null = null;

    /** F2 — top-level mirror so the Proxy notifies on `pending` changes. */
    removePending = false;
    removeAction!: GuardedAction<[string]>;

    constructor(
        private readonly themeApi: ThemeApi = new ThemeApi(),
        private readonly t: Translator = (k) => k,
    ) {
        const proxy = observable(this);
        proxy.removeAction = new GuardedAction<[string]>(
            async ({idempotencyKey}, id) => {
                const result = await proxy.themeApi.deleteTheme(id, {idempotencyKey});
                if (result.error) { notifyError(result.error); return; }
                // TODO: wire Undo — theme delete routes through trash but the deleteTheme API does not return a trashGroup yet.
                notifySuccess(proxy.t('Theme deleted'));
                await proxy.refresh();
            },
            {onPendingChange: (v) => { proxy.removePending = v; }},
        );
        return proxy;
    }

    async refresh(): Promise<void> {
        this.loading = true;
        try {
            const [list, active] = await Promise.all([
                this.themeApi.listThemes(),
                this.themeApi.getActive(),
            ]);
            this.themes = list;
            this.activeId = active?.id ?? null;
            this.activeAudit = {editedBy: active?.editedBy, editedAt: active?.editedAt};
        } finally {
            this.loading = false;
        }
    }

    async activate(id: string): Promise<void> {
        const result = await this.themeApi.setActive(id);
        if (result.error) { notifyError(result.error); return; }
        notifySuccess(this.t('Theme activated — reload to see changes site-wide.'));
        this.activeId = id;
    }

    async remove(id: string): Promise<void> {
        await this.removeAction.trigger(id);
    }

    async resetPreset(id: string): Promise<void> {
        const result = await this.themeApi.resetPreset(id);
        if (result.error) { notifyError(result.error); return; }
        notifySuccess(this.t('Preset reset to on-disk defaults'));
        await this.refresh();
    }

    duplicate(theme: ITheme): void {
        // Duplicate writes a brand-new theme — no expectedVersion baseline yet.
        this.editing = {
            name: `${theme.name} ${this.t('(copy)')}`,
            tokens: {...theme.tokens},
            custom: true,
        };
        this.editingVersion = undefined;
    }

    edit(theme: ITheme): void {
        this.editing = {id: theme.id, name: theme.name, tokens: {...theme.tokens}, custom: true};
        this.editingVersion = typeof theme.version === 'number' ? theme.version : 0;
    }

    createBlank(): void {
        this.editing = {name: this.t('New theme'), tokens: {...BLANK_TOKENS}, custom: true};
        this.editingVersion = undefined;
    }

    closeEditor(): void {
        this.editing = null;
        this.editingVersion = undefined;
        this.pickerSlot = null;
    }

    /** Mutate the in-flight editor draft. Called from controlled inputs. */
    setName(name: string): void {
        if (!this.editing) return;
        this.editing = {...this.editing, name};
    }

    setToken(key: keyof IThemeTokens, value: string | number): void {
        if (!this.editing) return;
        this.editing = {...this.editing, tokens: {...this.editing.tokens, [key]: value}};
    }

    openPicker(slot: FontPickerSlot): void {
        this.pickerSlot = slot;
    }

    closePicker(): void {
        this.pickerSlot = null;
    }

    pickFont(stack: string): void {
        if (!this.pickerSlot || !this.editing) return;
        this.setToken(FONT_TOKEN_KEY(this.pickerSlot), stack);
        this.pickerSlot = null;
    }

    /** Resolve `currentStack` for the open picker slot — derived getter
     *  used by the modal to seed the picker's preview. */
    get pickerCurrentStack(): string | undefined {
        if (!this.pickerSlot || !this.editing) return undefined;
        return this.editing.tokens[FONT_TOKEN_KEY(this.pickerSlot)] as string | undefined;
    }

    private async performSave(draft: InTheme, expectedVersion: number | undefined): Promise<boolean> {
        const result = await this.themeApi.saveTheme(draft, expectedVersion);
        if (result.error) { notifyError(result.error); return false; }
        notifySuccess(this.t('Theme saved'));
        this.closeEditor();
        await this.refresh();
        return true;
    }

    async save(): Promise<void> {
        const draft = this.editing;
        if (!draft) return;
        if (!draft.name.trim()) { notifyError(this.t('Name is required')); return; }
        this.saving = true;
        try {
            await this.performSave(draft, this.editingVersion);
        } catch (err) {
            if (isConflictError(err)) {
                this.conflict = {
                    error: err,
                    retry: async () => {
                        this.saving = true;
                        try {
                            await this.performSave(draft, err.currentVersion);
                            this.conflict = null;
                        } finally {
                            this.saving = false;
                        }
                    },
                };
            } else {
                notifyError(err);
            }
        } finally {
            this.saving = false;
        }
    }

    dismissConflict(): void {
        this.conflict = null;
    }

    async takeTheirs(): Promise<void> {
        this.conflict = null;
        this.closeEditor();
        await this.refresh();
    }
}
