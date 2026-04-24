import React, {useCallback, useMemo} from "react";
import {message} from "antd";
import {TFunction} from "i18next";
import {IItem} from "@interfaces/IItem";
import {EItemType} from "@enums/EItemType";
import {IConfigSectionAddRemove} from "@interfaces/IConfigSectionAddRemove";
import {EStyle} from "@enums/EStyle";
import ImageDropTarget from "@client/lib/ImageDropTarget";
import {ImageDropPayload} from "@client/lib/useImageDrop";
import {PUBLIC_IMAGE_PATH} from "@utils/imgPath";

/**
 * Admin-only drop host for the *rendered* module on the page (the public
 * `Display` component wrapped by `EditWrapper` in `SectionContent.tsx`).
 *
 * Until this wrapper existed, the image-drop targets only lived inside the
 * Edit modal's `<GalleryEditor> / <PlainImageEditor> / <HeroEditor>` — so
 * dragging a rail thumbnail onto the in-page preview of those modules just
 * showed a no-drop cursor. See `docs/roadmap/drag-drop-images-modules.md` —
 * the original design said "drop onto any module that displays an image",
 * and this is what closes that gap.
 *
 * For item types without an image field (Text, List, Timeline, …) the
 * component is a pass-through so non-image modules don't grow spurious
 * dashed outlines.
 *
 * On drop we mutate the item's JSON `content` field and call
 * `addRemoveSectionItem` with the full item — matches the same write path
 * the Edit modal uses when saving, so the section-level optimistic /
 * version-check plumbing is unchanged.
 */
interface Props {
    sectionId: string;
    item: IItem;
    index: number;
    admin: boolean;
    addRemoveSectionItem: (sectionId: string, config: IConfigSectionAddRemove) => Promise<void>;
    t: TFunction<"translation", undefined>;
    children: React.ReactNode;
}

/** Narrow the set of item types that actually carry an image. Everything
 *  else passes through unchanged. */
const IMAGE_BEARING_TYPES = new Set<string>([
    EItemType.Image,
    EItemType.Gallery,
    EItemType.Carousel,
    EItemType.Hero,
    EItemType.ProjectCard,
]);

/** `true` iff the item's current JSON looks like it already has at least
 *  one image set. Drives both the hint label ("replace" vs "add") and the
 *  `is-empty` class that puffs the drop zone out to 100×100 when there's
 *  nothing visible to drop onto. */
function hasImage(item: IItem): boolean {
    let data: any = {};
    try { data = item.content ? JSON.parse(item.content) : {}; } catch { /* treat as empty */ }
    switch (item.type) {
        case EItemType.Image:
            return !!data?.src;
        case EItemType.Gallery:
        case EItemType.Carousel:
            return Array.isArray(data?.items) && data.items.some((it: any) => !!it?.src);
        case EItemType.Hero:
            return !!data?.bgImage || !!data?.portraitImage;
        case EItemType.ProjectCard:
            return !!data?.image;
        default:
            return false;
    }
}

/** Per-type content patch. Returns the new stringified JSON and a human
 *  label for the toast. */
function patchContent(item: IItem, src: string, t: TFunction<"translation", undefined>): {next: string; toast: string} {
    let data: any = {};
    try { data = item.content ? JSON.parse(item.content) : {}; } catch { data = {}; }
    switch (item.type) {
        case EItemType.Image: {
            const next = {...data, src};
            return {next: JSON.stringify(next), toast: t('Image replaced')};
        }
        case EItemType.Gallery:
        case EItemType.Carousel: {
            const items = Array.isArray(data?.items) ? [...data.items] : [];
            // Drop = append. The editor modal still offers per-tile replace;
            // in-page drops default to "add another" because the user has
            // no way to point at a specific tile from here.
            items.push({
                src,
                alt: '',
                text: '',
                height: 0,
                preview: true,
                imgWidth: '',
                imgHeight: '',
                textPosition: 'bottom',
            });
            const next = {...data, items};
            return {next: JSON.stringify(next), toast: t('Image added to gallery')};
        }
        case EItemType.Hero: {
            // Background wins by default — the big visual slot the operator
            // is usually staring at. Portrait stays editable via the Edit
            // modal until per-slot in-page targeting ships.
            const next = {...data, bgImage: src};
            return {next: JSON.stringify(next), toast: t('Hero background replaced')};
        }
        case EItemType.ProjectCard: {
            const next = {...data, image: src};
            return {next: JSON.stringify(next), toast: t('Cover image replaced')};
        }
        default:
            return {next: item.content ?? '', toast: ''};
    }
}

const AdminItemDropHost: React.FC<Props> = ({sectionId, item, index, admin, addRemoveSectionItem, t, children}) => {
    const bearing = admin && IMAGE_BEARING_TYPES.has(item.type as string);

    const filled = useMemo(() => bearing && hasImage(item), [bearing, item]);

    const onImage = useCallback(async (img: ImageDropPayload) => {
        if (!bearing) return;
        const src = PUBLIC_IMAGE_PATH + img.name;
        const {next, toast} = patchContent(item, src, t);
        try {
            await addRemoveSectionItem(sectionId, {
                index,
                type: item.type,
                style: (item.style as string) ?? EStyle.Default,
                content: next,
                action: item.action,
                actionStyle: item.actionStyle,
                actionType: item.actionType,
                actionContent: item.actionContent,
                animation: item.animation,
            });
            if (toast) void message.success(toast);
        } catch (err) {
            void message.error(String((err as Error)?.message ?? err));
        }
    }, [bearing, sectionId, item, index, addRemoveSectionItem, t]);

    if (!bearing) return <>{children}</>;

    // Hint mirrors the in-editor wording so editors see the same prompts
    // regardless of whether they're dropping on the preview or inside the
    // Edit modal. Gallery/Carousel always "add" in this surface; single-
    // image modules swap between replace/add based on `filled`.
    const hint = (item.type === EItemType.Gallery || item.type === EItemType.Carousel)
        ? t('Drop to add to gallery')
        : undefined;

    return (
        <ImageDropTarget
            onImage={onImage}
            filled={filled}
            hint={hint}
            className={`admin-item-drop-host${filled ? '' : ' is-empty'}`}
        >
            {children}
        </ImageDropTarget>
    );
};

export default AdminItemDropHost;
