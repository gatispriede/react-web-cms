'use client';
/**
 * Client view for `/dev/visual` — App Router migration, Batch 6.
 *
 * Direct lift of `pages/dev/visual.tsx` chrome. `useRouter().query` →
 * `useSearchParams()` (App-Router-native AND Pages-Router-compatible
 * since Next 13 — B4.5 unification rule). Translation lookups stay on
 * `next-i18next/client` v16 — same fix-up the migrated cars/blog views
 * used.
 */
import React from 'react';
import {useSearchParams} from 'next/navigation';
import {useT} from 'next-i18next/client';
import {EItemType} from '@enums/EItemType';
import {itemTypeList} from '@admin/lib/itemTypes/registry';
import {resolveSampleMedia} from '@client/lib/preview/samplesMedia';
import {sampleContent} from '@client/lib/preview/samples';
import {IItem} from '@interfaces/IItem';

const VisualSlotView: React.FC = () => {
    const {t, i18n} = useT('app');
    const tApp = i18n.getFixedT(i18n.language, 'app') as any;
    const sp = useSearchParams();
    const type = sp?.get('type') ?? undefined;
    const editor = sp?.get('editor') ?? undefined;
    const style = sp?.get('style') ?? undefined;
    const sample = sp?.get('sample') ?? undefined;
    const theme = sp?.get('theme') ?? undefined;

    if (!type) return <div data-testid="visual-error">missing ?type</div>;

    const entry = itemTypeList().find((d) => d.key === type);
    if (!entry) return <div data-testid="visual-error">unknown type {type}</div>;

    const styleValues = Object.values(entry.styleEnum).filter((v) => typeof v === 'string') as string[];
    const styleVal = style && styleValues.includes(style) ? style : styleValues[0];

    // Whitelist the theme slug to known first-class themes. Anything else
    // falls through to the unthemed slot — keeps a malformed query param
    // from setting an arbitrary attribute that a CSS rule somewhere
    // unrelated might match.
    const KNOWN_THEME_SLUGS = new Set(['editorial', 'agency', 'commerce', 'saas-landing', 'restaurant']);
    const themeSlug = theme && KNOWN_THEME_SLUGS.has(theme) ? theme : undefined;

    if (editor === '1') {
        const {Editor} = entry;
        const setContent = () => undefined;
        return (
            <div
                data-testid="visual-slot"
                data-mode="editor"
                data-type={type}
                data-theme-name={themeSlug}
                style={{padding: 24, maxWidth: 720}}
            >
                <Editor t={t as any} content={entry.defaultContent} setContent={setContent}/>
            </div>
        );
    }

    const samples = sampleContent[entry.key] ?? [];
    const idx = Math.max(0, Math.min(samples.length - 1, parseInt(sample ?? '0', 10) || 0));
    const fixture = samples[idx];
    if (!fixture) return <div data-testid="visual-error">no sample for {type}</div>;

    const item: IItem = {
        type: entry.key,
        style: styleVal,
        content: resolveSampleMedia(fixture.content),
    };
    const {Display} = entry;
    return (
        <div
            data-testid="visual-slot"
            data-mode="display"
            data-type={type}
            data-style={styleVal}
            data-theme-name={themeSlug}
            style={{padding: 24}}
        >
            <Display item={item} t={t as any} tApp={tApp} admin={false}/>
        </div>
    );
};

export default VisualSlotView;

// Re-export EItemType keys for the spec — keeps the test source-of-truth
// pinned to the same registry the page itself reads.
export const VISUAL_TYPES = Object.values(EItemType).filter((v) => v !== EItemType.Empty);
