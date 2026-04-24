import React, {useMemo, useState} from 'react';
import {Space, Switch, Typography, Button, Collapse} from 'antd';
import {TFunction} from 'i18next';
import {IItem} from '@interfaces/IItem';
import {itemTypeList, ItemTypeDefinition} from '@admin/lib/itemTypes/registry';
import {sampleContent, PreviewSample} from './samples';
import {resolveSampleMedia} from './samplesMedia';
import ThemeSwitcher from './ThemeSwitcher';

/**
 * C10 — admin modules-preview page body.
 *
 * Renders every module from the item-type registry against every declared
 * style variant and every fixture in `samples.ts`. A sticky toolbar swaps
 * the active theme (same helper the public app boots with) + flips a global
 * `is-transparent` toggle so operators can eyeball theme regressions + the
 * C8 transparency behaviour on one page without navigating real content.
 *
 * Modules are rendered inside an AntD `<Collapse>` so operators can
 * focus on one module at a time. Expand-all / collapse-all buttons in the
 * toolbar flip every panel at once — the full-matrix view is still one
 * click away, but the default landing state is compact (all collapsed).
 *
 * Intentionally self-contained — no MongoDB section round-trip, no
 * `SectionContent` reducer, no undo plumbing. Samples are pure data and
 * every module's `Display` component is invoked directly with a synthetic
 * `IItem`.
 */
export default function ModulesPreview({t, tApp}: {
    t: TFunction<'translation', undefined>;
    tApp: TFunction<string, undefined>;
}) {
    const [transparentOn, setTransparentOn] = useState(false);
    const [filter, setFilter] = useState<string>('');
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

    return (
        <div className="modules-preview-page" style={{padding: '16px 24px'}}>
            <div
                className="modules-preview-toolbar"
                style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    background: 'var(--theme-colorBgBase, #fff)',
                    padding: '12px 0',
                    borderBottom: '1px solid rgba(0,0,0,0.08)',
                    marginBottom: 24,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 24,
                    flexWrap: 'wrap',
                }}
            >
                <ThemeSwitcher/>
                <Space align="center">
                    <Typography.Text style={{fontSize: 12, opacity: 0.7}}>Transparent bg</Typography.Text>
                    <Switch size="small" checked={transparentOn} onChange={setTransparentOn}/>
                </Space>
                <Space align="center">
                    <Typography.Text style={{fontSize: 12, opacity: 0.7}}>Filter</Typography.Text>
                    <input
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        placeholder="module name"
                        style={{padding: '4px 8px', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 4}}
                    />
                    {filter && <Button size="small" type="link" onClick={() => setFilter('')}>clear</Button>}
                </Space>
                <Space align="center">
                    <Button size="small" onClick={expandAll}>{t('Expand all')}</Button>
                    <Button size="small" onClick={collapseAll}>{t('Collapse all')}</Button>
                </Space>
                <Typography.Text type="secondary" style={{fontSize: 12, marginLeft: 'auto'}}>
                    {t('Matrix: every module × every style × every sample. Switch the theme to spot regressions.')}
                </Typography.Text>
            </div>

            <Collapse
                activeKey={activeKeys}
                onChange={(keys) => setActiveKeys(Array.isArray(keys) ? keys : [keys])}
                bordered
                items={visibleEntries.map((def) => {
                    const samples: PreviewSample[] = sampleContent[def.key] ?? [];
                    const styleValues = Object.values(def.styleEnum).filter((v) => typeof v === 'string') as string[];
                    return {
                        key: def.key,
                        label: (
                            // Bold per-module separation header — the whole point of the
                            // matrix is scanning across types quickly, so the heading
                            // has to read as a hard divider even collapsed. Heavy weight
                            // + uppercase title, muted enum key + count summary to the
                            // right so operators know "what's in here" before expanding.
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
                                    {samples.length} sample{samples.length === 1 ? '' : 's'} × {styleValues.length} style{styleValues.length === 1 ? '' : 's'}
                                </span>
                            </div>
                        ),
                        children: <ModuleBody def={def} samples={samples} styleValues={styleValues} transparentOn={transparentOn} t={t} tApp={tApp}/>,
                    };
                })}
            />
        </div>
    );
}

function ModuleBody({def, samples, styleValues, transparentOn, t, tApp}: {
    def: ItemTypeDefinition;
    samples: PreviewSample[];
    styleValues: string[];
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
                                {sample.label} · style: {styleVal}
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
