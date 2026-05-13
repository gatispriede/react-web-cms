/**
 * Role presets — opinionated defaults per role. Picking a preset
 * pre-populates the tier-grid; operators can adjust any cell.
 *
 * Role names match the existing `UserRole` enum in `IUser.ts`
 * (`viewer | editor | admin`) plus two **UX-only** preset labels
 * (Designer, Reviewer) that don't change the underlying role rank —
 * they just preset tiers. Custom is the empty-preset escape hatch.
 */
import {ScopeKey, Tier} from './tierMapping';

export type RolePresetId = 'admin' | 'designer' | 'editor' | 'reviewer' | 'viewer' | 'custom';

export interface RolePreset {
    id: RolePresetId;
    /** i18n key; resolved at render time. */
    labelKey: string;
    /** i18n key for the description line under the option. */
    descriptionKey: string;
    /** Tier per scope. 'custom' returns {} — caller leaves the grid alone. */
    tiers: Partial<Record<ScopeKey, Tier>>;
}

export const ROLE_PRESETS: readonly RolePreset[] = [
    {
        id: 'admin',
        labelKey: 'permissions.preset.admin.label',
        descriptionKey: 'permissions.preset.admin.description',
        tiers: {
            Pages: 'Full', Posts: 'Full', Products: 'Full', Themes: 'Full',
            Orders: 'Full', Customers: 'Full', Settings: 'Full',
        },
    },
    {
        id: 'designer',
        labelKey: 'permissions.preset.designer.label',
        descriptionKey: 'permissions.preset.designer.description',
        tiers: {
            Pages: 'Full', Themes: 'Full',
            Posts: 'Edit', Products: 'Edit',
            Orders: 'View', Customers: 'View', Settings: 'View',
        },
    },
    {
        id: 'editor',
        labelKey: 'permissions.preset.editor.label',
        descriptionKey: 'permissions.preset.editor.description',
        tiers: {
            Pages: 'Edit', Posts: 'Edit',
            Products: 'View', Themes: 'View',
            Orders: 'View', Customers: 'View', Settings: 'View',
        },
    },
    {
        id: 'reviewer',
        labelKey: 'permissions.preset.reviewer.label',
        descriptionKey: 'permissions.preset.reviewer.description',
        tiers: {
            Pages: 'Comment', Posts: 'Comment',
            Products: 'View', Themes: 'View',
            Orders: 'View', Customers: 'View', Settings: 'View',
        },
    },
    {
        id: 'viewer',
        labelKey: 'permissions.preset.viewer.label',
        descriptionKey: 'permissions.preset.viewer.description',
        tiers: {
            Pages: 'View', Posts: 'View', Products: 'View', Themes: 'View',
            Orders: 'View', Customers: 'View', Settings: 'View',
        },
    },
    {
        id: 'custom',
        labelKey: 'permissions.preset.custom.label',
        descriptionKey: 'permissions.preset.custom.description',
        tiers: {},
    },
];

export function findPreset(id: RolePresetId): RolePreset | undefined {
    return ROLE_PRESETS.find(p => p.id === id);
}
