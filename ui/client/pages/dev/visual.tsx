import React from 'react';
import {GetServerSideProps} from 'next';
import {useTranslation} from 'next-i18next/pages';
import {serverSideTranslations} from 'next-i18next/pages/serverSideTranslations';
import {useRouter} from 'next/router';
import {EItemType} from '@enums/EItemType';
import {itemTypeList} from '@admin/lib/itemTypes/registry';
import {resolveSampleMedia} from '@client/lib/preview/samplesMedia';
import {sampleContent} from '@client/lib/preview/samples';
import {IItem} from '@interfaces/IItem';

/**
 * Visual-regression render slot. Single isolated mount per request — no
 * admin shell, no theme dropdown, no collapse panel chrome. Used by
 * Playwright `tests/e2e/visual/` to capture per-module baselines.
 *
 * Query params:
 *   - `type=<EItemType>`  required; module type to render
 *   - `editor=1`          render the Editor instead of the Display
 *   - `style=<value>`     optional; pick a non-default style variant
 *   - `sample=<idx>`      optional; pick sample N from samples.ts (default 0)
 *   - `theme=<slug>`      optional; sets data-theme-name on the slot wrapper
 *                          so the per-theme SCSS layer (e.g. editorial,
 *                          agency, commerce) applies. Used by
 *                          `tests/e2e/visual/themes/<slug>.spec.ts`.
 *
 * Returns 404 outside development / e2e builds so this never reaches prod.
 */
const VisualSlot = () => {
    const {t, i18n} = useTranslation('app');
    const tApp = i18n.getFixedT(i18n.language, 'app') as any;
    const router = useRouter();
    const {type, editor, style, sample, theme} = router.query as Record<string, string | undefined>;

    if (!type) return <div data-testid="visual-error">missing ?type</div>;

    const entry = itemTypeList().find((d) => d.key === type);
    if (!entry) return <div data-testid="visual-error">unknown type {type}</div>;

    const styleValues = Object.values(entry.styleEnum).filter((v) => typeof v === 'string') as string[];
    const styleVal = style && styleValues.includes(style) ? style : styleValues[0];

    // Whitelist the theme slug to known first-class themes. Anything else
    // falls through to the unthemed slot — keeps a malformed query param
    // from setting an arbitrary attribute that a CSS rule somewhere
    // unrelated might match.
    const KNOWN_THEME_SLUGS = new Set(['editorial', 'agency', 'commerce']);
    const themeSlug = theme && KNOWN_THEME_SLUGS.has(theme) ? theme : undefined;

    if (editor === '1') {
        const {Editor} = entry;
        // Default empty content — exercises the "freshly-added module" path.
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

export const getServerSideProps: GetServerSideProps = async ({locale}) => {
    // Gate: dev or e2e builds only. `E2E_BUILD_DIR` is the marker the e2e
    // pipeline sets in next.config.js; if neither flag is on, hide this route.
    if (process.env.NODE_ENV !== 'development' && !process.env.E2E_BUILD_DIR) {
        return {notFound: true};
    }
    return {
        props: {
            ...(await serverSideTranslations(locale ?? 'en', ['common', 'app'])),
        },
    };
};

export default VisualSlot;

// Re-export EItemType keys for the spec — keeps the test source-of-truth
// pinned to the same registry the page itself reads.
export const VISUAL_TYPES = Object.values(EItemType).filter((v) => v !== EItemType.Empty);
