import React from "react";
import {Col, Collapse, ColorPicker, Input, Row} from "antd";
import {IInputContent} from "../../../../Interfaces/IInputContent";
import {EItemType} from "../../../../enums/EItemType";
import {HeroContent, IHero} from "../../SectionComponents/Hero";

const toHex = (v: any): string => (typeof v === 'string' ? v : v?.toHexString?.() ?? '');

const InputHero = ({content, setContent, t}: IInputContent) => {
    const hero = new HeroContent(EItemType.Hero, content);
    const data = hero.data;
    const update = <K extends keyof IHero>(k: K, v: IHero[K]) => {
        hero.setField(k, v);
        setContent(hero.stringData);
    };
    return (
        <div className={'hero-editor'}>
            <Row gutter={[12, 8]}>
                <Col xs={24}>
                    <label>{t('Headline')}</label>
                    <Input value={data.headline} onChange={e => update('headline', e.target.value)}/>
                </Col>
                <Col xs={24}>
                    <label>{t('Subtitle')}</label>
                    <Input value={data.subtitle} onChange={e => update('subtitle', e.target.value)}/>
                </Col>
            </Row>
            <Collapse
                ghost
                size="small"
                style={{marginTop: 8}}
                items={[{
                    key: 'more',
                    label: t('More options'),
                    children: (
                        <Row gutter={[12, 8]}>
                            <Col xs={24}>
                                <label>{t('Tagline / motto')}</label>
                                <Input value={data.tagline} onChange={e => update('tagline', e.target.value)}/>
                            </Col>
                            <Col xs={16}>
                                <label>{t('Background image URL')}</label>
                                <Input value={data.bgImage} onChange={e => update('bgImage', e.target.value)} placeholder="api/hero.jpg or https://…"/>
                            </Col>
                            <Col xs={8}>
                                <label>{t('Accent color')}</label>
                                <br/>
                                <ColorPicker value={data.accent || '#1677ff'} onChange={v => update('accent', toHex(v))} showText/>
                            </Col>
                        </Row>
                    ),
                }]}
            />
        </div>
    );
};

export default InputHero;
