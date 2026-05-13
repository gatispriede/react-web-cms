import React from "react";
import {Button, Checkbox, Col, Collapse, ColorPicker, Divider, Input, Row, Slider, Space, Typography} from "antd";
import ImageRefInput from "@admin/lib/ImageRefInput";
import LinkRefInput from "@admin/lib/LinkRefInput";
import {DeleteOutlined, PlusOutlined} from "@client/lib/icons";
import {IInputContent} from "@interfaces/IInputContent";
import {EItemType} from "@enums/EItemType";
import {HeroContent, IHero, IHeroCoord, IHeroCta, IHeroMeta} from "@client/modules/Hero";

const toHex = (v: any): string => (typeof v === 'string' ? v : v?.toHexString?.() ?? '');

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
        update('titles', titles.map((tt, j) => j === i ? v : tt));
    const addTitle = () => update('titles', [...titles, '']);
    const removeTitle = (i: number) => update('titles', titles.filter((_, j) => j !== i));

    // ---- CTAs ----
    const ctaPrimary: IHeroCta = data.ctaPrimary ?? {url: '', label: '', primary: true};
    const ctaSecondary: IHeroCta = data.ctaSecondary ?? {url: '', label: ''};

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
                        data-testid="module-editor-primary-text-input"
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
                                    <LinkRefInput
                                        t={t}
                                        value={ctaPrimary}
                                        onChange={(link) => update('ctaPrimary', {...ctaPrimary, ...link, primary: true})}
                                        placeholder="#career-record"
                                        hostId="hero-cta-primary"
                                    />
                                </Col>
                                <Col xs={12}>
                                    <Divider titlePlacement="left" plain style={{fontSize: 12}}>{t('Secondary')}</Divider>
                                    <LinkRefInput
                                        t={t}
                                        value={ctaSecondary}
                                        onChange={(link) => update('ctaSecondary', {...ctaSecondary, ...link})}
                                        placeholder="mailto:you@example.com"
                                        hostId="hero-cta-secondary"
                                    />
                                </Col>
                            </Row>
                        ),
                    },
                    {
                        key: 'portrait',
                        label: <span data-testid="module-editor-hero-tab-portrait">{t('Portrait tile')}</span>,
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
                                    <label>{t('Portrait image (overrides placeholder)')}</label>
                                    <ImageRefInput
                                        t={t}
                                        value={data.portraitImage ?? {src: ''}}
                                        onChange={(image) => update('portraitImage', image.src || image.width || image.height ? image : undefined)}
                                        placeholder="api/portrait.jpg"
                                        data-testid="module-editor-hero-portrait-image-input"
                                    />
                                </Col>
                                <Col xs={12}>
                                    <label>{t('Portrait width (px) — optional override')}</label>
                                    <Input
                                        data-testid="module-editor-hero-portrait-width-input"
                                        type="number"
                                        min={0}
                                        value={(data.portraitImage?.width as number | undefined) ?? ''}
                                        onChange={e => {
                                            const raw = e.target.value;
                                            const n = raw === '' ? undefined : Number(raw);
                                            const cur = data.portraitImage ?? {src: ''};
                                            const nextImg = {...cur, width: n};
                                            update('portraitImage', nextImg.src || nextImg.width || nextImg.height ? nextImg : undefined);
                                        }}
                                        placeholder={t('auto')}
                                    />
                                </Col>
                                <Col xs={12}>
                                    <label>{t('Portrait height (px) — optional override')}</label>
                                    <Input
                                        data-testid="module-editor-hero-portrait-height-input"
                                        type="number"
                                        min={0}
                                        value={(data.portraitImage?.height as number | undefined) ?? ''}
                                        onChange={e => {
                                            const raw = e.target.value;
                                            const n = raw === '' ? undefined : Number(raw);
                                            const cur = data.portraitImage ?? {src: ''};
                                            const nextImg = {...cur, height: n};
                                            update('portraitImage', nextImg.src || nextImg.width || nextImg.height ? nextImg : undefined);
                                        }}
                                        placeholder={t('auto')}
                                    />
                                </Col>
                                <Col xs={24} onPointerDown={e => e.stopPropagation()}>
                                    <Typography.Text type="secondary" style={{fontSize: 12}}>
                                        {t('Portrait image transparency')}: {data.portraitOpacity ?? 0}%
                                    </Typography.Text>
                                    <Slider
                                        min={0}
                                        max={100}
                                        step={5}
                                        value={data.portraitOpacity ?? 0}
                                        disabled={!data.portraitImage?.src}
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
                                    <label>{t('Background image')}</label>
                                    <ImageRefInput
                                        t={t}
                                        value={data.bgImage}
                                        onChange={(image) => update('bgImage', image)}
                                        placeholder="api/hero.jpg or https://…"
                                    />
                                </Col>
                                <Col xs={8}>
                                    <label>{t('Accent color')}</label>
                                    <br/>
                                    <ColorPicker value={data.accent || '#1677ff'} onChange={v => update('accent', toHex(v))} showText/>
                                </Col>
                                <Col xs={24} onPointerDown={e => e.stopPropagation()}>
                                    <Typography.Text type="secondary" style={{fontSize: 12}}>
                                        {t('Background image transparency')}: {data.bgOpacity ?? 0}%
                                    </Typography.Text>
                                    <Slider
                                        min={0}
                                        max={100}
                                        step={5}
                                        value={data.bgOpacity ?? 0}
                                        disabled={!data.bgImage.src}
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
