import {LANGUAGE_PRESETS, LanguagePreset} from './languagePresets';
import {observable} from '@client/lib/state/observable';

/** VM3 — Add-language modal. Holds the preset filter (form is AntD-owned). */
export class AddNewLanguageDialogViewModel {
    presetFilter = '';

    constructor() { return observable(this); }

    setFilter(v: string): void { this.presetFilter = v; }

    get filteredPresets(): LanguagePreset[] {
        const q = this.presetFilter.trim().toLowerCase();
        if (!q) return LANGUAGE_PRESETS;
        return LANGUAGE_PRESETS.filter(p =>
            p.label.toLowerCase().includes(q) ||
            p.symbol.includes(q));
    }
}
