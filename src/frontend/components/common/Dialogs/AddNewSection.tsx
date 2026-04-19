import React from "react";
import {Button, Card, Col, Modal, Row, Segmented, Typography} from "antd";
import {PlusCircleOutlined} from "@ant-design/icons";
import {TFunction} from "i18next";
import {SECTION_TEMPLATES, SectionTemplate} from "../../itemTypes/templates";

// Define a type for the section object
export interface Section {
    page: string;
    type: number;
    content: any[];
}

// Define a type for the item passed to addSectionToPage
export interface AddSectionItem {
    pageName: string;
    section: Section;
}

type Mode = 'blank' | 'template';

interface State {
    dialogOpen: boolean;
    page: string;
    type: number;
    label: string;
    mode: Mode;
    selectedTemplate: string | null;
}

class AddNewSection extends React.Component <{
    page: string,
    addSectionToPage: (item: AddSectionItem) => Promise<void>,
    t: TFunction<"translation", undefined>
}> {
    state: State = {
        dialogOpen: false,
        page: '',
        type: 1,
        label: '100%',
        mode: 'blank',
        selectedTemplate: null,
    }
    addSectionToPage = async (_item: AddSectionItem) => {
    }

    constructor(props: {
        page: string,
        addSectionToPage: (item: AddSectionItem) => Promise<void>,
        t: TFunction<"translation", undefined>
    }) {
        super(props)
        this.state.page = props.page
        this.addSectionToPage = props.addSectionToPage
    }

    close = () => this.setState({dialogOpen: false, selectedTemplate: null, mode: 'blank'})

    createFromBlank = async () => {
        const item: AddSectionItem = {
            pageName: this.state.page,
            section: {
                page: this.state.page,
                type: this.state.type,
                content: [],
            },
        };
        await this.addSectionToPage(item);
        this.close();
    }

    createFromTemplate = async (tpl: SectionTemplate) => {
        const item: AddSectionItem = {
            pageName: this.state.page,
            section: {
                page: this.state.page,
                type: tpl.sectionType,
                content: tpl.items.map(i => ({
                    type: i.type,
                    style: i.style ?? 'default',
                    content: i.content,
                    action: i.action ?? 'none',
                    actionStyle: i.actionStyle ?? 'default',
                    actionType: i.actionType ?? 'TEXT',
                    actionContent: i.actionContent ?? '{}',
                })),
            },
        };
        await this.addSectionToPage(item);
        this.close();
    }

    renderBlankPicker() {
        const {t} = this.props;
        return (
            <div className={'add-new-section'}>
                <div className={'section-types'}>
                    {[
                        {n: 1, label: '100%', slots: ['100%']},
                        {n: 2, label: '50% 50%', slots: ['50%', '50%']},
                        {n: 3, label: '33% 33% 33%', slots: ['33%', '33%', '33%']},
                        {n: 4, label: '25% 25% 25% 25%', slots: ['25%', '25%', '25%', '25%']},
                    ].map(layout => (
                        <div
                            key={layout.n}
                            className={`section-${layout.slots[0].replace('%', '')} ${this.state.type === layout.n ? 'active' : ''}`}
                            onClick={() => this.setState({type: layout.n, label: layout.label})}
                        >
                            {layout.slots.map((s, i) => <p key={i}>{s}</p>)}
                        </div>
                    ))}
                </div>
                <div>{t("Selected type")}: {this.state.label}</div>
            </div>
        );
    }

    renderTemplatePicker() {
        const {t} = this.props;
        return (
            <Row gutter={[12, 12]}>
                {SECTION_TEMPLATES.map(tpl => (
                    <Col xs={24} sm={12} md={8} key={tpl.key}>
                        <Card
                            hoverable
                            size="small"
                            style={{
                                borderColor: this.state.selectedTemplate === tpl.key ? 'var(--theme-colorPrimary, #1677ff)' : undefined,
                                borderWidth: this.state.selectedTemplate === tpl.key ? 2 : 1,
                            }}
                            onClick={() => this.setState({selectedTemplate: tpl.key})}
                        >
                            <div style={{display: 'flex', gap: 12, alignItems: 'flex-start'}}>
                                <div style={{fontSize: 24, lineHeight: 1}}>{tpl.icon}</div>
                                <div style={{flex: 1, minWidth: 0}}>
                                    <Typography.Text strong>{t(tpl.labelKey)}</Typography.Text>
                                    <div>
                                        <Typography.Text type="secondary" style={{fontSize: 12}}>
                                            {t(tpl.descriptionKey)}
                                        </Typography.Text>
                                    </div>
                                    <div style={{marginTop: 4}}>
                                        <Typography.Text type="secondary" style={{fontSize: 11}}>
                                            {tpl.sectionType === 1 ? '100%'
                                                : tpl.sectionType === 2 ? '50% · 50%'
                                                : tpl.sectionType === 3 ? '33% · 33% · 33%'
                                                : '25% × 4'}
                                            {' · '}
                                            {tpl.items.length === 1
                                                ? t('1 item')
                                                : `${tpl.items.length} ${t('items')}`}
                                        </Typography.Text>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </Col>
                ))}
            </Row>
        );
    }

    render() {
        const {t} = this.props;
        const picked = this.state.selectedTemplate
            ? SECTION_TEMPLATES.find(tp => tp.key === this.state.selectedTemplate)
            : undefined;
        return (
            <>
                <Button type="primary" onClick={() => this.setState({dialogOpen: true})}>
                    {t("Add new section")} <PlusCircleOutlined/>
                </Button>
                <Modal
                    width={'90%'}
                    open={this.state.dialogOpen}
                    title={t('Add new section')}
                    onCancel={this.close}
                    footer={[
                        <Button key="cancel" onClick={this.close}>{t('Cancel')}</Button>,
                        this.state.mode === 'blank' ? (
                            <Button key="ok" type="primary" onClick={this.createFromBlank}>{t('Create')}</Button>
                        ) : (
                            <Button key="tpl" type="primary" disabled={!picked} onClick={() => picked && this.createFromTemplate(picked)}>
                                {t('Create from template')}
                            </Button>
                        ),
                    ]}
                >
                    <div style={{marginBottom: 16}}>
                        <Segmented
                            value={this.state.mode}
                            onChange={(v) => this.setState({mode: v as Mode})}
                            options={[
                                {label: t('Blank layout'), value: 'blank'},
                                {label: t('From template'), value: 'template'},
                            ]}
                        />
                    </div>
                    {this.state.mode === 'blank' ? this.renderBlankPicker() : this.renderTemplatePicker()}
                </Modal>
            </>
        );
    }
}

export default AddNewSection
