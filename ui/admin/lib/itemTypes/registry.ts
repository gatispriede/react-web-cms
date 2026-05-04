/**
 * Item type registry — composer (Class Loader L4, 2026-05-03).
 *
 * Used to be a flat list of `{key, Display, Editor, …}` entries with
 * both halves living together. Now composes from two split sources:
 *
 *   - `ui/client/modules/clientItemTypes.ts`     → Display half (renderer)
 *   - `ui/admin/modules/adminItemTypeEditors.ts` → Editor + metadata half
 *
 * Public API (`itemTypeList`, `getItemTypeDefinition`, `styleEnumFor`,
 * `ITEM_TYPE_REGISTRY`, `ItemTypeDefinition`, `ItemCategory`) is
 * unchanged — every existing caller keeps working with no edits.
 *
 * The composer throws at module load if a key shows up on one side and
 * not the other. That's a build-blocking programmer error.
 */
import React from 'react';
import {EItemType} from '@enums/EItemType';
import {EStyle} from '@enums/EStyle';
import {TFunction} from 'i18next';
import {IItem} from '@interfaces/IItem';
import {CLIENT_ITEM_TYPES} from '@client/modules/clientItemTypes';
import {ADMIN_ITEM_TYPE_EDITORS} from '@admin/modules/adminItemTypeEditors';

export type ItemCategory = 'hero' | 'media' | 'content' | 'cta';

export interface ItemTypeDefinition {
    key: EItemType;
    /** Translation key — passed through `t(labelKey)` in menus. */
    labelKey: string;
    /** Translation key — one-line module description shown in the picker dialog. */
    descriptionKey: string;
    /** Category bucket — drives the picker dialog's filter chips. */
    category: ItemCategory;
    /** Public-site renderer. */
    Display: React.ComponentType<{item: IItem; t: TFunction<'translation', undefined>; tApp: TFunction<string, undefined>; admin?: boolean}>;
    /** Admin editor. */
    Editor: React.ComponentType<{
        t: TFunction<'translation', undefined>;
        content: string;
        setContent: (value: string) => void;
    }>;
    /** Enum of allowed style values for this type; used to populate the Style picker. */
    styleEnum: Record<string, string>;
    /** Default content JSON for a freshly created item. */
    defaultContent: string;
}

const compose = (): ItemTypeDefinition[] => {
    const displays = new Map(CLIENT_ITEM_TYPES.map(c => [c.key as string, c.Display]));
    const out: ItemTypeDefinition[] = [];
    for (const a of ADMIN_ITEM_TYPE_EDITORS) {
        const Display = displays.get(a.key as string);
        if (!Display) {
            throw new Error(`[itemTypes] no client Display registered for key "${a.key}"`);
        }
        out.push({
            key: a.key,
            labelKey: a.labelKey,
            descriptionKey: a.descriptionKey,
            category: a.category,
            Display: Display as ItemTypeDefinition['Display'],
            Editor: a.Editor as ItemTypeDefinition['Editor'],
            styleEnum: a.styleEnum,
            defaultContent: a.defaultContent,
        });
        displays.delete(a.key as string);
    }
    if (displays.size > 0) {
        const orphans = [...displays.keys()].join(', ');
        throw new Error(`[itemTypes] client Display(s) without an admin Editor: ${orphans}`);
    }
    return out;
};

const entries: ItemTypeDefinition[] = compose();

export const ITEM_TYPE_REGISTRY: Record<string, ItemTypeDefinition> = Object.fromEntries(
    entries.map(e => [e.key, e])
);

export const getItemTypeDefinition = (key: string | EItemType): ItemTypeDefinition | undefined =>
    ITEM_TYPE_REGISTRY[key as string];

export const styleEnumFor = (key: string | EItemType): Record<string, string> =>
    ITEM_TYPE_REGISTRY[key as string]?.styleEnum ?? (EStyle as unknown as Record<string, string>);

export const itemTypeList = (): ItemTypeDefinition[] => entries;
