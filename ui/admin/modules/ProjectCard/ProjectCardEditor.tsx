import React from "react";
import {Col, Collapse, Input, Row, Select} from "antd";
import {IInputContent} from "@interfaces/IInputContent";
import {EItemType} from "@enums/EItemType";
import {IProjectCard, ProjectCardContent} from "@client/modules/ProjectCard";
import ImageRefInput from "@admin/lib/ImageRefInput";
import LinkRefInput from "@admin/lib/LinkRefInput";

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
                    <Input data-testid="module-editor-primary-text-input" value={data.title} onChange={e => update('title', e.target.value)}/>
                </Col>
                <Col xs={24} md={8}>
                    <label>{t('Cover image')}</label>
                    <ImageRefInput
                        t={t}
                        value={data.image}
                        onChange={(image) => update('image', image)}
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
                                <label>{t('Primary link')}</label>
                                <LinkRefInput
                                    t={t}
                                    value={data.primaryLink ?? {url: ''}}
                                    onChange={(link) => update('primaryLink', link.url || link.label ? link : undefined)}
                                    placeholder="https://…"
                                    hostId="project-card-primary"
                                />
                            </Col>
                            <Col xs={24} md={12}>
                                <label>{t('Secondary link')}</label>
                                <LinkRefInput
                                    t={t}
                                    value={data.secondaryLink ?? {url: ''}}
                                    onChange={(link) => update('secondaryLink', link.url || link.label ? link : undefined)}
                                    placeholder="https://github.com/…"
                                    hostId="project-card-secondary"
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
