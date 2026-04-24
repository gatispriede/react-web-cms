import React from "react";
import {Col, Collapse, Input, Row, Select} from "antd";
import ImageUrlInput from "@client/lib/ImageUrlInput";
import {IInputContent} from "@interfaces/IInputContent";
import {EItemType} from "@enums/EItemType";
import {IProjectCard, IProjectLink, ProjectCardContent} from "@client/modules/ProjectCard";

const linkPatch = (existing: IProjectLink | undefined, patch: Partial<IProjectLink>): IProjectLink => ({
    url: patch.url ?? existing?.url ?? '',
    label: patch.label ?? existing?.label ?? '',
});

const ProjectCardEditor = ({content, setContent, t}: IInputContent) => {
    const card = new ProjectCardContent(EItemType.ProjectCard, content);
    const data = card.data;
    const update = <K extends keyof IProjectCard>(k: K, v: IProjectCard[K]) => {
        card.setField(k, v);
        setContent(card.stringData);
    };
    return (
        <div className={'project-card-editor'}>
            <Row gutter={[8, 8]}>
                <Col xs={24} md={16}>
                    <label>{t('Title')}</label>
                    <Input value={data.title} onChange={e => update('title', e.target.value)}/>
                </Col>
                <Col xs={24} md={8}>
                    <label>{t('Cover image URL')}</label>
                    <ImageUrlInput
                        t={t}
                        value={data.image}
                        onChange={v => update('image', v)}
                        placeholder="api/project.jpg"
                    />
                </Col>
                <Col xs={24}>
                    <label>{t('Short description')}</label>
                    <Input.TextArea rows={3} value={data.description} onChange={e => update('description', e.target.value)}/>
                </Col>
                <Col xs={24}>
                    <label>{t('Tags (Enter after each)')}</label>
                    <Select
                        mode="tags"
                        style={{width: '100%'}}
                        value={data.tags}
                        onChange={v => update('tags', v)}
                        tokenSeparators={[',', ';']}
                    />
                </Col>
            </Row>
            <Collapse
                ghost
                size="small"
                style={{marginTop: 8}}
                items={[{
                    key: 'more',
                    label: t('More options (links)'),
                    children: (
                        <Row gutter={[8, 8]}>
                            <Col xs={24} md={12}>
                                <label>{t('Primary link URL')}</label>
                                <Input
                                    value={data.primaryLink?.url ?? ''}
                                    onChange={e => update('primaryLink', linkPatch(data.primaryLink, {url: e.target.value}))}
                                    placeholder="https://…"
                                />
                                <Input
                                    value={data.primaryLink?.label ?? ''}
                                    onChange={e => update('primaryLink', linkPatch(data.primaryLink, {label: e.target.value}))}
                                    placeholder={t('Label (e.g. Live)')}
                                    style={{marginTop: 4}}
                                />
                            </Col>
                            <Col xs={24} md={12}>
                                <label>{t('Secondary link URL')}</label>
                                <Input
                                    value={data.secondaryLink?.url ?? ''}
                                    onChange={e => update('secondaryLink', linkPatch(data.secondaryLink, {url: e.target.value}))}
                                    placeholder="https://github.com/…"
                                />
                                <Input
                                    value={data.secondaryLink?.label ?? ''}
                                    onChange={e => update('secondaryLink', linkPatch(data.secondaryLink, {label: e.target.value}))}
                                    placeholder={t('Label (e.g. GitHub)')}
                                    style={{marginTop: 4}}
                                />
                            </Col>
                        </Row>
                    ),
                }]}
            />
        </div>
    );
};

export {ProjectCardEditor};
export default ProjectCardEditor;
