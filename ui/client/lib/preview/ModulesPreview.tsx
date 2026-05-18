import React, {useMemo, useState} from 'react';
import {Space, Switch, Typography, Button, Collapse, Select, Segmented} from 'antd';
import {TFunction} from 'i18next';
import {useTranslation} from 'react-i18next';
import {useT as useAppTranslation} from 'next-i18next/client';
import {IItem} from '@interfaces/IItem';
import {itemTypeList, ItemTypeDefinition} from '@admin/lib/itemTypes/registry';
import AdminPreviewModule from '@admin/modules/shapes/AdminPreviewModule';
import {sampleContent, PreviewSample} from './samples';
import {resolveSampleMedia} from './samplesMedia';
import ThemeSwitcher from './ThemeSwitcher';

/**
 * Sample-modules / module-matrix page (was "modules-preview" pre-rename
 * — the URL stays `/admin/modules-preview` to avoid link rot, the
 * header label and tooling all read "Sample modules" now).
 *
 * Two modes, toggled by the toolbar:
 *   - **Simple** — one sample × one style per module. Each panel ships
 *     a Style dropdown so operators can preview the variants without
 *     getting drowned in a full N×M grid. Default landing state.
 *   - **Advanced** — full matrix (every module × every style × every
 *     sample fixture). Same behaviour the page shipped with originally.
 *
 * Modules are rendered inside an AntD `<Collapse>` so operators can
 * focus on one module at a time. Expand-all / collapse-all buttons
 * flip every panel at once.
 *
 * Intentionally self-contained — no MongoDB section round-trip, no
 * `SectionContent` reducer, no undo plumbing. Samples are pure data and
 * every module's `Display` component is invoked directly with a
 * synthetic `IItem`.
 *
 * admin-module-composed: this is the `AdminLoader` bridge for the
 * pane. Toolbar slots into `AdminPreviewModule.controls`, the
 * collapse becomes its `children`.
 */
export default function ModulesPreview() {
    const {t} = useTranslation();
    const {t: tApp} = useAppTranslation('app');

    const [transparentOn, setTransparentOn] = useState(false);
    const [filter, setFilter] = useState<string>('');
    const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
    // Per-module style selection (Simple mode only). Keyed by EItemType
    // value — empty / missing entries fall back to the enum's first
    // value (typically `Default`).
    const [pickedStyles, setPickedStyles] = useState<Record<string, string>>({});
    const entries = useMemo(() => itemTypeList(), []);

    const visibleEntries = useMemo(() => entries.filter((def) =>
        !filter ||
        def.key.toLowerCase().includes(filter.toLowerCase()) ||
        def.labelKey.toLowerCase().includes(filter.toLowerCase()),
    ), [entries, filter]);

    // Active panel keys — drives the Collapse's `activeKey` prop. Tracked in
    // local state so "expand / collapse all" can overwrite the whole set at
    // once while individual panel clicks still work.
    const [activeKeys, setActiveKeys] = useState<string[]>([]);

    const expandAll = () => setActiveKeys(visibleEntries.map((d) => d.key));
    const collapseAll = () => setActiveKeys([]);

    const controls = (
        <div
            className="modules-preview-toolbar"
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 24,
                flexWrap: 'wrap',
                width: '100%',
            }}
        >
            <ThemeSwitcher/>
            <Space align="center">
                <Typography.Text style={{fontSize: 12, opacity: 0.7}}>{t('Mode')}</Typography.Text>
                <Segmented
                    size="small"
                    value={mode}
                    onChange={(v) => setMode(v as 'simple' | 'advanced')}
                    options={[
                        {label: t('Simple'), value: 'simple'},
                        {label: t('Advanced'), value: 'advanced'},
                    ]}
                    data-testid="sample-modules-mode-toggle"
                />
            </Space>
            <Space align="center">
                <Typography.Text style={{fontSize: 12, opacity: 0.7}}>{t('Transparent bg')}</Typography.Text>
                <Switch size="small" checked={transparentOn} onChange={setTransparentOn}/>
            </Space>
            <Space align="center">
                <Typography.Text style={{fontSize: 12, opacity: 0.7}}>{t('Filter')}</Typography.Text>
                <input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="module name"
                    style={{padding: '4px 8px', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 4}}
                />
                {filter && <Button size="small" type="link" onClick={() => setFilter('')}>{t('clear')}</Button>}
            </Space>
            <Space align="center">
                <Button size="small" onClick={expandAll}>{t('Expand all')}</Button>
                <Button size="small" onClick={collapseAll}>{t('Collapse all')}</Button>
            </Space>
            <Typography.Text type="secondary" style={{fontSize: 12, marginLeft: 'auto'}}>
                {mode === 'advanced'
                    ? t('Matrix: every module × every style × every sample. Switch the theme to spot regressions.')
                    : t('Pick a style per module to preview the variant — flip Advanced for the full matrix.')}
            </Typography.Text>
        </div>
    );

    return (
        <AdminPreviewModule testId="admin-modules-preview" title={t('Sample modules')} controls={controls}>
            <div className="modules-preview-page" style={{padding: '16px 24px'}}>
                <Collapse
                    activeKey={activeKeys}
                    onChange={(keys) => setActiveKeys(Array.isArray(keys) ? keys : [keys])}
                    bordered
                    items={visibleEntries.map((def) => {
                        const samples: PreviewSample[] = sampleContent[def.key] ?? [];
                        const styleValues = Object.values(def.styleEnum).filter((v) => typeof v === 'string') as string[];
                        const pickedStyle = pickedStyles[def.key] ?? styleValues[0] ?? 'default';
                        const summary = mode === 'advanced'
                            ? `${samples.length} sample${samples.length === 1 ? '' : 's'} × ${styleValues.length} style${styleValues.length === 1 ? '' : 's'}`
                            : `${styleValues.length} style${styleValues.length === 1 ? '' : 's'}`;
                        return {
                            key: def.key,
                            label: (
                                <div style={{display: 'flex', alignItems: 'baseline', gap: 12, width: '100%'}}>
                                    <span style={{
                                        fontSize: 16,
                                        fontWeight: 800,
                                        textTransform: 'uppercase',
                                        letterSpacing: 1.1,
                                        color: 'var(--theme-colorTextBase, #111)',
                                    }}>
                                        {t(def.labelKey)}
                                    </span>
                                    <code style={{fontSize: 11, opacity: 0.55, fontFamily: 'ui-monospace, monospace'}}>
                                        {def.key}
                                    </code>
                                    <span style={{marginLeft: 'auto', fontSize: 11, opacity: 0.55, fontFamily: 'ui-monospace, monospace'}}>
                                        {summary}
                                    </span>
                                </div>
                            ),
                            children: (
                                <ModuleBody
                                    def={def}
                                    samples={samples}
                                    styleValues={styleValues}
                                    mode={mode}
                                    pickedStyle={pickedStyle}
                                    onPickStyle={(s) => setPickedStyles((prev) => ({...prev, [def.key]: s}))}
                                    transparentOn={transparentOn}
                                    t={t}
                                    tApp={tApp}
                                />
                            ),
                        };
                    })}
                />
            </div>
        </AdminPreviewModule>
    );
}

function ModuleBody({def, samples, styleValues, mode, pickedStyle, onPickStyle, transparentOn, t, tApp}: {
    def: ItemTypeDefinition;
    samples: PreviewSample[];
    styleValues: string[];
    mode: 'simple' | 'advanced';
    pickedStyle: string;
    onPickStyle: (s: string) => void;
    transparentOn: boolean;
    t: TFunction<'translation', undefined>;
    tApp: TFunction<string, undefined>;
}) {
    if (samples.length === 0) {
        return (
            <div style={{fontSize: 12, opacity: 0.7}}>
                {t('No sample configured — add one in ui/client/lib/preview/samples.ts.')}
            </div>
        );
    }
    const {Display} = def;
    // Friendly labels (HERO_STYLE_LABELS etc.) come off the registry
    // via `def.styleLabels`; fall back to the raw enum value when no
    // label map is registered for the module.
    const labelFor = (v: string) => def.styleLabels?.[v] ?? v;

    if (mode === 'simple') {
        const sample = samples[0];
        const item: IItem = {
            type: def.key,
            style: pickedStyle,
            content: resolveSampleMedia(sample.content),
        };
        return (
            <div style={{display: 'grid', gap: 16}}>
                <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                    <Typography.Text style={{fontSize: 12, opacity: 0.7}}>{t('Style')}</Typography.Text>
                    <Select
                        size="small"
                        value={pickedStyle}
                        onChange={onPickStyle}
                        style={{minWidth: 200}}
                        data-testid={`sample-modules-style-${def.key.toLowerCase()}`}
                        options={styleValues.map((v) => ({label: labelFor(v), value: v}))}
                    />
                    <Typography.Text type="secondary" style={{fontSize: 11, fontFamily: 'ui-monospace, monospace'}}>
                        {sample.label} · style: {pickedStyle}
                    </Typography.Text>
                </div>
                <div
                    className={transparentOn ? 'is-transparent' : ''}
                    style={{
                        border: '1px dashed rgba(0,0,0,0.12)',
                        padding: 12,
                        minWidth: 0,
                        overflow: 'hidden',
                        background: transparentOn
                            ? 'repeating-linear-gradient(45deg, rgba(0,0,0,0.03) 0 8px, transparent 8px 16px)'
                            : undefined,
                    }}
                >
                    <Display item={item} t={t} tApp={tApp} admin={false}/>
                </div>
            </div>
        );
    }

    // Advanced — full matrix (every sample × every style).
    return (
        <div style={{display: 'grid', gap: 24}}>
            {samples.flatMap((sample) =>
                styleValues.map((styleVal) => {
                    const item: IItem = {
                        type: def.key,
                        style: styleVal,
                        // Swap `preview:<key>` tokens for bundled image URLs
                        // so fixtures stay portable (Jest + SSR) while the
                        // rendered preview shows real media.
                        content: resolveSampleMedia(sample.content),
                    };
                    return (
                        <figure key={`${sample.label}-${styleVal}`} style={{margin: 0, minWidth: 0}}>
                            <figcaption style={{fontSize: 11, opacity: 0.6, marginBottom: 6, fontFamily: 'ui-monospace, monospace'}}>
                                {sample.label} · style: {labelFor(styleVal)} ({styleVal})
                            </figcaption>
                            <div
                                className={transparentOn ? 'is-transparent' : ''}
                                style={{
                                    border: '1px dashed rgba(0,0,0,0.12)',
                                    padding: 12,
                                    // `minWidth: 0` + `overflow: hidden` keep this
                                    // preview frame from being inflated to a
                                    // descendant's min-content width. The Carousel
                                    // module — inline-block AntD slides + `<img>`
                                    // + aspect-ratio — has a min-content of 2^25 px
                                    // (Chrome's layout max) pre-slick-init; without
                                    // a hard block here the grid column blows out
                                    // and slick records the huge width as its list
                                    // size, so every slide renders 33 M px wide
                                    // with a black, overflowing carousel.
                                    minWidth: 0,
                                    overflow: 'hidden',
                                    background: transparentOn
                                        ? 'repeating-linear-gradient(45deg, rgba(0,0,0,0.03) 0 8px, transparent 8px 16px)'
                                        : undefined,
                                }}
                            >
                                <Display item={item} t={t} tApp={tApp} admin={false}/>
                            </div>
                        </figure>
                    );
                }),
            )}
        </div>
    );
}
