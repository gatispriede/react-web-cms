import {ItemCategory} from '@admin/lib/itemTypes/registry';
import {observable} from '@client/lib/state/observable';

export type CategoryFilter = 'all' | ItemCategory;

/** VM3 — module-picker dialog. Holds search/filter/focus state. */
export class ModulePickerDialogViewModel {
    query       = '';
    category: CategoryFilter = 'all';
    focusIndex  = 0;

    constructor() { return observable(this); }

    setQuery(v: string): void { this.query = v; }
    setCategory(v: CategoryFilter): void { this.category = v; }
    setFocusIndex(v: number): void { this.focusIndex = v; }

    reset(startIdx: number): void {
        this.query = '';
        this.category = 'all';
        this.focusIndex = startIdx;
    }

    clamp(maxLen: number): void {
        if (this.focusIndex >= maxLen) this.focusIndex = Math.max(0, maxLen - 1);
    }
}
