import React from "react";
import {Button, Checkbox, Col, Collapse, ColorPicker, Divider, Input, Row, Slider, Space, Typography} from "antd";
import ImageUrlInput from "@client/lib/ImageUrlInput";
import {LabeledInput} from "@client/lib/LabeledInput";
import {DeleteOutlined, PlusOutlined} from "@client/lib/icons";
import {IInputContent} from "@interfaces/IInputContent";
import {EItemType} from "@enums/EItemType";
import {HeroContent, IHero, IHeroCoord, IHeroCta, IHeroMeta} from "@client/modules/Hero";

const toHex = (v: any): string => (typeof v === 'string' ? v : v?.toHexString?.() ?? '');

/**
 * Full Hero editor — every field that drives the rendered output is surfaced
 * here so no translatable text gets stranded in the JSON. Primary fields
 * (Headline / Subtitle / Tagline) live at the top; everything else sits under
 * collapsible "More options" groups to keep the form approachable.
 */
const HeroEditor = ({content, setContent, t}: IInputContent) => {
    const hero = new HeroContent(EItemType.Hero, content);
    const data = hero.data;

    const commit = (next: IHero) => {
        hero.data = next;
        setContent(hero.stringData);
    };
    const update = <K extends keyof IHero>(k: K, v: IHero[K]) => commit({...data, [k]: v});

    // ---- Meta ----
    const meta: IHeroMeta[] = Array.isArray(data.meta) ? data.meta : [];
    const patchMeta = (i: number, patch: Partial<IHeroMeta>) =>
        update('meta', meta.map((m, j) => j === i ? {...m, ...patch} : m));
    const addMeta = () => update('meta', [...meta, {label: '', value: ''}]);
    const removeMeta = (i: number) => update('meta', meta.filter((_, j) => j !== i));

    // ---- Coords ----
    const coords: IHeroCoord[] = Array.isArray(data.coords) ? data.coords : [];
    const patchCoord = (i: number, patch: Partial<IHeroCoord>) =>
        update('coords', coords.map((c, j) => j === i ? {...c, ...patch} : c));
    const addCoord = () => update('coords', [...coords, {label: '', value: '', liveTime: false}]);
    const removeCoord = (i: number) => update('coords', coords.filter((_, j) => j !== i));

    // ---- Titles ----
    const titles: string[] = Array.isArray(data.titles) ? data.titles : [];
    const patchTitle = (i: number, v: string) =>
        update('titles', titles.map((t, j) => j === i ? v : t));
    const addTitle = () => update('titles', [...titles, '']);
    const removeTitle = (i: number) => update('titles', titles.filter((_, j) => j !== i));

    // ---- CTAs ----
    const ctaPrimary: IHeroCta = data.ctaPrimary ?? {label: '', href: '', primary: true};
    const ctaSecondary: IHeroCta = data.ctaSecondary ?? {label: '', href: ''};
    const patchCta = (key: 'ctaPrimary' | 'ctaSecondary', patch: Partial<IHeroCta>) =>
        update(key, {...(key === 'ctaPrimary' ? ctaPrimary : ctaSecondary), ...patch});

    return (
        <div className={'hero-editor'}>
            <Row gutter={[12, 8]}>
                <Col xs={24}>
                    <label>{t('Eyebrow (small caps overline)')}</label>
                    <Input
                        value={data.eyebrow ?? ''}
                        onChange={e => update('eyebrow', e.target.value)}
                        placeholder="DOSSIER № 001 / SIGULDA, LATVIA / EST. 2009"
                    />
                </Col>
                <Col xs={12}>
                    <label>{t('Headline')}</label>
                    <Input
                        value={data.headline}
                        onChange={e => update('headline', e.target.value)}
                        placeholder="Gatis"
                    />
                </Col>
                <Col xs={12}>
                    <label>{t('Headline soft (italic second line)')}</label>
                    <Input
                        value={data.headlineSoft ?? ''}
                        onChange={e => update('headlineSoft', e.target.value)}
                        placeholder="Priede."
                    />
                </Col>
                <Col xs={24}>
                    <label>{t('Subtitle (used when no Titles list is set)')}</label>
                    <Input
                        value={data.subtitle}
                        onChange={e => update('subtitle', e.target.value)}
                    />
                </Col>
            </Row>

            <Collapse
                ghost
                size="small"
                style={{marginTop: 8}}
                defaultActiveKey={['titles']}
                items={[
                    {
                        key: 'titles',
                        label: t('Titles (A / B / C separator row)'),
                        children: (
                            <Space orientation="vertical" style={{width: '100%'}}>
                                {titles.map((title, i) => (
                                    <Space key={i} align="start" style={{width: '100%'}}>
                                        <Input
                                            value={title}
                                            onChange={e => patchTitle(i, e.target.value)}
                                            placeholder="Digital Solutions Architect"
                                            style={{width: 360}}
                                        />
                                        <Button danger size="small" icon={<DeleteOutlined/>} onClick={() => removeTitle(i)}/>
                                    </Space>
                                ))}
                                <Button type="dashed" icon={<PlusOutlined/>} onClick={addTitle}>
                                    {t('Add title')}
                                </Button>
                            </Space>
                        ),
                    },
                    {
                        key: 'tagline',
                        label: t('Tagline + motto attribution'),
                        children: (
                            <Row gutter={[12, 8]}>
                                <Col xs={14}>
                                    <label>{t('Tagline / motto')}</label>
                                    <Input
                                        value={data.tagline}
                                        onChange={e => update('tagline', e.target.value)}
                                        placeholder="Everything is possible."
                                    />
                                </Col>
                                <Col xs={10}>
                                    <label>{t('Attribution')}</label>
                                    <Input
                                        value={data.taglineAttribution ?? ''}
                                        onChange={e => update('taglineAttribution', e.target.value)}
                                        placeholder="— personal motto"
                                    />
                                </Col>
                            </Row>
                        ),
                    },
                    {
                        key: 'cta',
                        label: t('Call-to-action buttons'),
                        children: (
                            <Row gutter={[12, 8]}>
                                <Col xs={12}>
                                    <Divider titlePlacement="left" plain style={{fontSize: 12}}>{t('Primary')}</Divider>
                                    <LabeledInput
                                        value={ctaPrimary.label}
                                        onChange={e => patchCta('ctaPrimary', {label: e.target.value, primary: true})}
                                        placeholder="View work ↘"
                                        label={t('Label')}
                                    />
                                    <LabeledInput
                                        value={ctaPrimary.href ?? ''}
                                        onChange={e => patchCta('ctaPrimary', {href: e.target.value})}
                                        placeholder="#career-record"
                                        label={t('Link')}
                                        wrapperStyle={{marginTop: 6}}
                                    />
                                </Col>
                                <Col xs={12}>
                                    <Divider titlePlacement="left" plain style={{fontSize: 12}}>{t('Secondary')}</Divider>
                                    <LabeledInput
                                        value={ctaSecondary.label}
                                        onChange={e => patchCta('ctaSecondary', {label: e.target.value})}
                                        placeholder="Get in touch"
                                        label={t('Label')}
                                    />
                                    <LabeledInput
                                        value={ctaSecondary.href ?? ''}
                                        onChange={e => patchCta('ctaSecondary', {href: e.target.value})}
                                        placeholder="mailto:you@example.com"
                                        label={t('Link')}
                                        wrapperStyle={{marginTop: 6}}
                                    />
                                </Col>
                            </Row>
                        ),
                    },
                    {
                        key: 'portrait',
                        label: t('Portrait tile'),
                        children: (
                            <Row gutter={[12, 8]}>
                                <Col xs={12}>
                                    <label>{t('Portrait label (placeholder letters, e.g. "GP")')}</label>
                                    <Input
                                        value={data.portraitLabel ?? ''}
                                        onChange={e => update('portraitLabel', e.target.value)}
                                        placeholder="GP"
                                    />
                                </Col>
                                <Col xs={12}>
                                    <label>{t('Portrait image URL (overrides placeholder)')}</label>
                                    <ImageUrlInput
                                        t={t}
                                        value={data.portraitImage ?? ''}
                                        onChange={v => update('portraitImage', v)}
                                        placeholder="api/portrait.jpg"
                                    />
                                </Col>
                                {/* Portrait image opacity — only meaningful when an
                                    image is set. Slider reads 0–100 where 0 is
                                    fully visible (historical behaviour) and 100
                                    hides the image. */}
                                <Col xs={24}>
                                    <Typography.Text type="secondary" style={{fontSize: 12}}>
                                        {t('Portrait image transparency')}: {data.portraitOpacity ?? 0}%
                                    </Typography.Text>
                                    <Slider
                                        min={0}
                                        max={100}
                                        step={5}
                                        value={data.portraitOpacity ?? 0}
                                        disabled={!data.portraitImage}
                                        onChange={v => update('portraitOpacity', typeof v === 'number' ? v : 0)}
                                        tooltip={{formatter: (v) => `${v}%`}}
                                    />
                                </Col>
                            </Row>
                        ),
                    },
                    {
                        key: 'meta',
                        label: t('Meta rows (Based / Years / Mode / Stack)'),
                        children: (
                            <Space orientation="vertical" style={{width: '100%'}}>
                                {meta.map((m, i) => (
                                    <Space key={i} align="start" style={{width: '100%'}}>
                                        <Input
                                            value={m.label}
                                            onChange={e => patchMeta(i, {label: e.target.value})}
                                            placeholder="Based"
                                            style={{width: 140}}
                                        />
                                        <Input
                                            value={m.value}
                                            onChange={e => patchMeta(i, {value: e.target.value})}
                                            placeholder="Sigulda, Latvia"
                                            style={{width: 300}}
                                        />
                                        <Button danger size="small" icon={<DeleteOutlined/>} onClick={() => removeMeta(i)}/>
                                    </Space>
                                ))}
                                <Button type="dashed" icon={<PlusOutlined/>} onClick={addMeta}>
                                    {t('Add meta row')}
                                </Button>
                            </Space>
                        ),
                    },
                    {
                        key: 'coords',
                        label: t('Coordinates strip (LAT / LON / LOCAL …)'),
                        children: (
                            <Space orientation="vertical" style={{width: '100%'}}>
                                {coords.map((c, i) => (
                                    <Space key={i} align="start" style={{width: '100%'}}>
                                        <Input
                                            value={c.label}
                                            onChange={e => patchCoord(i, {label: e.target.value})}
                                            placeholder="LAT"
                                            style={{width: 90}}
                                        />
                                        <Input
                                            value={c.value}
                                            onChange={e => patchCoord(i, {value: e.target.value})}
                                            placeholder="57.15°N"
                                            style={{width: 200}}
                                            disabled={c.liveTime}
                                        />
                                        <Checkbox
                                            checked={!!c.liveTime}
                                            onChange={e => patchCoord(i, {liveTime: e.target.checked})}
                                        >
                                            {t('Live time (Europe/Riga)')}
                                        </Checkbox>
                                        <Button danger size="small" icon={<DeleteOutlined/>} onClick={() => removeCoord(i)}/>
                                    </Space>
                                ))}
                                <Button type="dashed" icon={<PlusOutlined/>} onClick={addCoord}>
                                    {t('Add coord cell')}
                                </Button>
                            </Space>
                        ),
                    },
                    {
                        key: 'bg',
                        label: t('Background image & accent'),
                        children: (
                            <Row gutter={[12, 8]}>
                                <Col xs={16}>
                                    <label>{t('Background image URL')}</label>
                                    <ImageUrlInput
                                        t={t}
                                        value={data.bgImage}
                                        onChange={v => update('bgImage', v)}
                                        placeholder="api/hero.jpg or https://…"
                                    />
                                </Col>
                                <Col xs={8}>
                                    <label>{t('Accent color')}</label>
                                    <br/>
                                    <ColorPicker value={data.accent || '#1677ff'} onChange={v => update('accent', toHex(v))} showText/>
                                </Col>
                                {/* Background image opacity — fades the bg layer
                                    behind the text overlay so authors can tone a
                                    busy photograph without dropping legibility
                                    (text + scrim stay at full opacity). Scale
                                    mirrors the section-level transparency slider:
                                    0 = historical, 100 = invisible. */}
                                <Col xs={24}>
                                    <Typography.Text type="secondary" style={{fontSize: 12}}>
                                        {t('Background image transparency')}: {data.bgOpacity ?? 0}%
                                    </Typography.Text>
                                    <Slider
                                        min={0}
                                        max={100}
                                        step={5}
                                        value={data.bgOpacity ?? 0}
                                        disabled={!data.bgImage}
                                        onChange={v => update('bgOpacity', typeof v === 'number' ? v : 0)}
                                        tooltip={{formatter: (v) => `${v}%`}}
                                    />
                                </Col>
                            </Row>
                        ),
                    },
                ]}
            />
        </div>
    );
};

export {HeroEditor};
export default HeroEditor;
