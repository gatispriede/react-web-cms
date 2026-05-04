import {GOOGLE_FONTS, IGoogleFont, extractFontFamily} from '@client/features/Themes/googleFonts';
import {observable} from '@client/lib/state/observable';

export type Slot = 'display' | 'sans' | 'mono';

export const SLOT_PREFERRED_CATEGORIES: Record<Slot, IGoogleFont['category'][]> = {
    display: ['display', 'serif', 'sans-serif'],
    sans: ['sans-serif', 'serif'],
    mono: ['monospace'],
};

/** VM3 — font-picker modal. Holds search/category/picked. */
export class FontPickerViewModel {
    search   = '';
    category: IGoogleFont['category'] | 'all';
    picked:  string | null;

    constructor(slot: Slot, currentStack: string | undefined) {
        this.category = SLOT_PREFERRED_CATEGORIES[slot][0];
        this.picked   = extractFontFamily(currentStack ?? '');
        return observable(this);
    }

    setSearch(v: string): void { this.search = v; }
    setCategory(v: IGoogleFont['category'] | 'all'): void { this.category = v; }
    setPicked(v: string | null): void { this.picked = v; }

    /** Re-seed when the modal re-opens for a different slot / current stack. */
    reset(slot: Slot, currentStack: string | undefined): void {
        this.search   = '';
        this.category = SLOT_PREFERRED_CATEGORIES[slot][0];
        this.picked   = extractFontFamily(currentStack ?? '');
    }

    get list(): IGoogleFont[] {
        const lower = this.search.trim().toLowerCase();
        return GOOGLE_FONTS
            .filter(f => this.category === 'all' || f.category === this.category)
            .filter(f => !lower || f.family.toLowerCase().includes(lower));
    }
}
