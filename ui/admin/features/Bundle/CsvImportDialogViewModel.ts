import {message} from 'antd';
import {parseCsv, translationsFromCsv} from '@utils/csvTranslations';
import TranslationManager from '@admin/shell/TranslationManager';
import {triggerRevalidate} from '@client/lib/triggerRevalidate';
import {observable} from '@client/lib/state/observable';

/** VM3 — paste/upload CSV dialog. Holds raw text, target locale, save state. */
export class CsvImportDialogViewModel {
    raw           = '';
    targetLocale: string | undefined;
    saving        = false;

    constructor(
        private readonly translationManager: TranslationManager,
        private readonly languages: Array<{symbol: string; label: string}>,
        private readonly closeCb: (didImport: boolean) => void,
    ) {
        this.targetLocale = languages[0]?.symbol;
        return observable(this);
    }

    setRaw(v: string): void { this.raw = v; }
    setTargetLocale(v: string | undefined): void { this.targetLocale = v; }

    get parsed(): unknown {
        if (!this.raw.trim()) return null;
        try { return parseCsv(this.raw); }
        catch (err) { return {error: String((err as Error)?.message ?? err)}; }
    }

    get preview(): unknown {
        const p = this.parsed;
        if (!p || (p as {error?: string}).error || !this.targetLocale) return null;
        try { return translationsFromCsv(p as Parameters<typeof translationsFromCsv>[0], this.targetLocale); }
        catch (err) { return {error: String((err as Error)?.message ?? err)}; }
    }

    async handleFile(file: File): Promise<void> {
        this.raw = await file.text();
    }

    cancel(): void {
        this.closeCb(false);
    }

    async handleImport(): Promise<void> {
        const preview = this.preview;
        if (!this.targetLocale || !preview || (preview as {error?: string}).error) return;
        this.saving = true;
        try {
            const lang = this.languages.find(l => l.symbol === this.targetLocale);
            if (!lang) return;
            const previewMap = preview as Record<string, string>;
            const previewCount = Object.keys(previewMap).length;
            await this.translationManager.saveNewTranslation(lang, previewMap);
            // ISR cache busting — fire-and-forget so a slow webhook doesn't
            // block the modal close.
            void triggerRevalidate({scope: 'all'});
            void message.success(`Imported ${previewCount} translations into ${lang.label} — rebuilding public pages`);
            this.raw = '';
            this.closeCb(true);
        } catch (err) {
            void message.error(String((err as Error)?.message ?? err));
        } finally { this.saving = false; }
    }
}
