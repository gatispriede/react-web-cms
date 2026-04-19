import {Button, Drawer, Select, Space, Tabs} from "antd";
import {EditOutlined, PlusCircleOutlined} from "@ant-design/icons";
import React from "react";
import {ISection} from "../../../../Interfaces/ISection";
import {ContentSection} from "../ContentSection";
import ContentType from "../ContentType";
import ActionDialog from "./ActionDialog";
import {EItemType} from "../../../../enums/EItemType";
import {IConfigSectionAddRemove} from "../../../../Interfaces/IConfigSectionAddRemove";
import {IItem} from "../../../../Interfaces/IItem";
import {EStyle} from "../../../../enums/EStyle";
import {TFunction} from "i18next";
import {itemTypeList, styleEnumFor} from "../../itemTypes/registry";
import TypeDiagram from "../../itemTypes/TypeDiagram";

interface IAddNewSectionItemProps {
    addSectionItem: (sectionId: string, config: IConfigSectionAddRemove) => void,
    section: ISection,
    item?: IItem,
    index: number,
    loadItem: boolean,
    t: TFunction<"translation", undefined>,
    tApp: TFunction<string, undefined>
}

class AddNewSectionItem extends React.Component <IAddNewSectionItemProps> {
    state = {
        dialogOpen: false,
        actionPreviewOpen: false,
        selected: EItemType.Text,
        action: 'none',
        content: '{}',
        actionType: EItemType.Text,
        actionStyle: 'default',
        actionStyleOptions: [
            {
                label: "Default",
                value: EStyle.Default,
            }
        ],
        actionContent: '{}',
        style: 'Default',
        styleOptions: [
            {
                label: this.props.t("Default"),
                value: EStyle.Default,
            }
        ],
        actionSelectOptions: [
            {
                label: this.props.t("No action"),
                value: "none",
            },
            {
                label: this.props.t("On click"),
                value: "onClick",
            },
        ],
        tabContent: [
            {
                key: 'content',
                label: this.props.t('Content'),
                children: <></>
            },
            {
                key: 'action',
                label: this.props.t('Action'),
                children: <></>
            },
            {
                key: 'style',
                label: this.props.t('Style'),
                children: <></>
            }
        ],
        selectOptions: itemTypeList().map(def => ({
            label: this.props.t(def.labelKey),
            value: def.key,
        })),
    }
    section: ISection
    index: number

    constructor(props: IAddNewSectionItemProps) {
        super(props);
        this.section = props.section;
        this.index = props.index;
        if (props.loadItem) {
            const item: IItem = this.section.content[props.index];
            this.state = {
                ...this.state,
                selected: item.type,
                content: item.content,
                style: item.style ? item.style : 'default',
                action: item.action || 'none',
                actionType: item.actionType || EItemType.Text,
                actionStyle: item.actionStyle || 'default',
                actionContent: item.actionContent || '{}',
            };
        }
    }

    setActiveOptionState(selectedModule: EItemType, style?: string) {
        const styleEnum = styleEnumFor(selectedModule);
        this.setState({
            style: style ? style : (styleEnum.Default ?? EStyle.Default),
            styleOptions: Object.keys(styleEnum).map((key: string) => ({
                label: key,
                value: styleEnum[key],
            })),
            selected: selectedModule
        });
    }

    generateContentSection() {
        const typeOptionRender = (opt: {data: {label: string; value: string}}) => (
            <div style={{display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0', color: 'inherit'}}>
                <TypeDiagram type={opt.data.value}/>
                <span>{opt.data.label}</span>
            </div>
        );
        const currentDiagramType = this.activeOption()?.value;
        return <div>
            <h4>{this.props.t("Content configuration")}</h4>
            <label>{this.props.t("Please select content type")}: </label>
            <Select
                variant={'filled'}
                value={this.activeOption()?.value}
                options={this.state.selectOptions}
                style={{minWidth: 280}}
                optionRender={typeOptionRender as any}
                labelRender={(labelInfo) => (
                    <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                        {currentDiagramType && <TypeDiagram type={currentDiagramType}/>}
                        <span>{labelInfo.label}</span>
                    </div>
                )}
                onSelect={(e: EItemType) => {
                    this.setActiveOptionState(e)
                }}
                listHeight={360}
            />
            <hr/>
            <ContentSection t={this.props.t} content={this.state.content} selected={this.state.selected}
                            setContent={(value: string) => {
                                this.setState({content: value})
                            }}/>
        </div>
    }

    generateActionSection() {
        return <div>
            <h4>{this.props.t("Action configuration")}</h4>
            <label>{this.props.t("Please select action type")}: </label>
            <Select variant={'filled'} value={this.state.action} options={this.state.actionSelectOptions}
                    onChange={(value) => {
                        const styleEnum = styleEnumFor(this.state.actionType);
                        const actionStyleOptions = Object.entries(styleEnum)
                            .map(([_, v]) => ({ label: v as string, value: v as string }));
                        this.setState({
                            action: value, actionStyleOptions
                        })
                    }}/>
            {this.state.action !== 'none' &&
                <div>
                    <h4>{this.props.t("Content configuration")}</h4>
                    <label>{this.props.t("Please select content type")}: </label>
                    <Select
                        variant={'filled'}
                        value={this.state.actionType}
                        options={this.state.selectOptions}
                        style={{minWidth: 280}}
                        optionRender={((opt: {data: {label: string; value: string}}) => (
                            <div style={{display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0'}}>
                                <TypeDiagram type={opt.data.value}/>
                                <span>{opt.data.label}</span>
                            </div>
                        )) as any}
                        labelRender={(info) => (
                            <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                                <TypeDiagram type={this.state.actionType}/>
                                <span>{info.label}</span>
                            </div>
                        )}
                        onSelect={(e: EItemType) => {
                            this.setState({actionType: e})
                        }}
                        listHeight={360}
                    />
                    <hr/>
                    <ContentSection t={this.props.t} content={this.state.actionContent} selected={this.state.actionType}
                                    setContent={(value: string) => {
                                        this.setState({actionContent: value})
                                    }}
                    />
                </div>
            }
        </div>
    }

    generateStyleSection() {

        return <div>
            <h4>{this.props.t("Style configuration")}</h4>
            <label>{this.props.t("Please select style type")}: </label>
            <Select variant={'filled'} value={this.state.style} options={this.state.styleOptions}
                    onSelect={(e) => {
                        this.setState({style: e})
                    }}/>
            {
                this.state.action &&
                <div>
                    <hr/>
                    <label>{this.props.t("Please select style for action component")}: </label>
                    <Select variant={'filled'} value={this.state.actionStyle} options={this.state.actionStyleOptions}
                            onSelect={(e) => {
                                this.setState({actionStyle: e})
                            }}/>
                </div>
            }
        </div>
    }

    addSectionItem = async () => {
        this.props.addSectionItem(
            this.section.id ? this.section.id : '', {
                index: this.index,
                style: this.state.style,
                type: this.state.selected,
                content: this.state.content,
                action: this.state.action,
                actionStyle: this.state.actionStyle,
                actionType: this.state.actionType,
                actionContent: this.state.actionContent,
            }
        )

    }
    activeOption = () => {
        return this.state.selectOptions.find(item => item.value === this.state.selected)
    }

    render() {
        const tabContent = this.state.tabContent
        tabContent[0].children = this.generateContentSection()
        tabContent[1].children = this.generateActionSection()
        tabContent[2].children = this.generateStyleSection()
        const item = {
            index: this.index,
            style: this.state.style,
            type: this.state.selected,
            content: this.state.content,
            action: this.state.action,
            actionStyle: this.state.actionStyle,
            actionType: this.state.actionType,
            actionContent: this.state.actionContent,
        }
        return (
            <>
                {
                    <div className={'add-new-section-container'}>
                        <Button type="primary" onClick={() => {
                            this.setState({dialogOpen: true})

                            const activeOption = this.activeOption()
                            if (typeof activeOption !== 'undefined')
                                this.setActiveOptionState(activeOption.value as EItemType, this.state.style)
                            const styleEnum = styleEnumFor(this.state.actionType);
                            this.setState({
                                actionStyleOptions: Object.keys(styleEnum).map(key => ({
                                    label: key,
                                    value: styleEnum[key],
                                }))
                            })
                        }}>

                            {!this.props.loadItem ? <div><PlusCircleOutlined/> {this.props.t("Add content")}</div> :
                                <EditOutlined/>}
                        </Button>
                    </div>
                }
                <Drawer
                    width={'90%'}
                    open={this.state.dialogOpen}
                    title={this.props.loadItem ? this.props.t('Edit content') : this.props.t('Add content')}
                    onClose={() => this.setState({dialogOpen: false})}
                    destroyOnClose
                    extra={
                        <Space>
                            <Button onClick={() => this.setState({dialogOpen: false})}>
                                {this.props.t('Cancel')}
                            </Button>
                            <Button
                                type="primary"
                                onClick={async () => {
                                    await this.addSectionItem();
                                    this.setState({dialogOpen: false});
                                }}
                            >
                                {this.props.t('Save')}
                            </Button>
                        </Space>
                    }
                >
                    <div style={{display: 'grid', gridTemplateColumns: 'minmax(360px, 1fr) minmax(320px, 1fr)', gap: 24, alignItems: 'start'}}>
                        <div>
                            <Tabs tabPosition={'left'} defaultActiveKey="1" items={tabContent}/>
                        </div>
                        <div
                            style={{
                                position: 'sticky',
                                top: 0,
                                borderLeft: '1px solid rgba(0,0,0,0.06)',
                                paddingLeft: 16,
                            }}
                        >
                            <div style={{fontWeight: 500, marginBottom: 8, textTransform: 'uppercase', fontSize: 12, opacity: 0.65}}>
                                {this.props.t('Live preview')}
                            </div>
                            {/*
                              Key the preview tree by every field that drives how the item
                              renders. When `style` flips, ContentType/Display would otherwise
                              diff onto the same instance and could hold stale className /
                              children — remounting sidesteps that reliably across every
                              module type. Cheap (preview only, no network).
                            */}
                            <div
                                key={`preview-${this.state.selected}-${this.state.style}-${this.state.action}-${this.state.actionStyle}`}
                                className={`content-wrapper ${item.action === 'onClick' ? 'action-enabled' : ''}`}
                                onClick={() => {
                                    if (item.action === 'onClick' && !this.state.actionPreviewOpen) {
                                        this.setState({actionPreviewOpen: true});
                                    }
                                }}
                            >
                                <ContentType t={this.props.t} tApp={this.props.tApp} admin={false} item={item} addButton={''}/>
                                <ActionDialog
                                    t={this.props.t}
                                    tApp={this.props.tApp}
                                    item={item}
                                    open={this.state.actionPreviewOpen}
                                    close={() => this.setState({actionPreviewOpen: false})}
                                />
                            </div>
                        </div>
                    </div>
                </Drawer>
            </>
        )
    }
}

export default AddNewSectionItem

