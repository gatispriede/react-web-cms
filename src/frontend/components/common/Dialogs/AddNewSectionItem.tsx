import {Button, Modal, Select, Tabs} from "antd";
import {EditOutlined, PlusCircleOutlined} from "@ant-design/icons";
import React from "react";
import {ISection} from "../../../../Interfaces/ISection";
import {ContentSection} from "../ContentSection";
import PreviewDialog from "./PreviewDialog";
import {EItemType} from "../../../../enums/EItemType";
import {IConfigSectionAddRemove} from "../../../../Interfaces/IConfigSectionAddRemove";
import {IItem} from "../../../../Interfaces/IItem";
import {EStyle} from "../../../../enums/EStyle";
import {EImageStyle} from "../../SectionComponents/PlainImage";
import {ECarouselStyle} from "../../SectionComponents/CarouselView";
import {EGalleryStyle} from "../../SectionComponents/Gallery";
import {ERichTextStyle} from "../../SectionComponents/RichText";
import {EPlainTextStyle} from "../../SectionComponents/PlainText";
import {TFunction} from "i18next";

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
        selectOptions: [
            {
                label: this.props.t("Simple Text"),
                value: EItemType.Text,
            },
            {
                label: this.props.t("Rich text"),
                value: EItemType.RichText,
            },
            {
                label: this.props.t("Image"),
                value: EItemType.Image,
            },
            {
                label: this.props.t("Gallery"),
                value: EItemType.Gallery,
            },
            {
                label: this.props.t("Carousel"),
                value: EItemType.Carousel,
            },
        ]
    }
    section: ISection
    index: number

    constructor(props: IAddNewSectionItemProps) {
        super(props);
        this.section = props.section
        this.index = props.index
        if (props.loadItem) {
            const item: IItem = this.section.content[props.index]
            this.state.selected = item.type
            this.state.content = item.content
            this.state.style = item.style ? item.style : 'default'
            if (item.action) this.state.action = item.action
            if (item.actionType) this.state.actionType = item.actionType
            if (item.actionStyle) this.state.actionStyle = item.actionStyle
            if (item.actionContent) this.state.actionContent = item.actionContent
        }
    }

    setActiveOptionState(selectedModule: any, style?: string) {
        let styleEnum: any;

        switch (selectedModule as unknown as EItemType) {
            case EItemType.Text:
                styleEnum = EPlainTextStyle;
                break;
            case EItemType.RichText:
                styleEnum = ERichTextStyle;
                break;
            case EItemType.Gallery:
                styleEnum = EGalleryStyle;
                break;
            case EItemType.Carousel:
                styleEnum = ECarouselStyle;
                break;
            case EItemType.Image:
                styleEnum = EImageStyle;
                break;
            default:
                styleEnum = EStyle
        }
        this.setState({
            style: style ? style : styleEnum.Default,
            styleOptions: Object.keys(styleEnum).map(key => ({
                label: key,
                value: styleEnum[key],
            })),
            selected: selectedModule
        });
    }

    generateContentSection() {
        return <div>
            <h4>{this.props.t("Content configuration")}</h4>
            <label>{this.props.t("Please select content type")}: </label>
            <Select variant={'filled'} value={this.activeOption()} options={this.state.selectOptions}
                    onSelect={(e) => {
                        this.setActiveOptionState(e)
                    }}/>
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
                        let styleEnum: any;

                        switch (this.state.actionType as unknown as EItemType) {
                            case EItemType.Text:
                                styleEnum = EPlainTextStyle;
                                break;
                            case EItemType.RichText:
                                styleEnum = ERichTextStyle;
                                break;
                            case EItemType.Gallery:
                                styleEnum = EGalleryStyle;
                                break;
                            case EItemType.Carousel:
                                styleEnum = ECarouselStyle;
                                break;
                            case EItemType.Image:
                                styleEnum = EImageStyle;
                                break;
                            default:
                                styleEnum = EStyle
                        }
                        this.setState({
                            action: value, actionStyleOptions: Object.keys(styleEnum).map(key => ({
                                label: key,
                                value: styleEnum[key],
                            }))
                        })
                    }}/>
            {this.state.action !== 'none' &&
                <div>
                    <h4>{this.props.t("Content configuration")}</h4>
                    <label>{this.props.t("Please select content type")}: </label>
                    <Select variant={'filled'} value={this.state.actionType} options={this.state.selectOptions}
                            onSelect={(e) => {
                                this.setState({actionType: e})
                            }}/>
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
                                this.setActiveOptionState(activeOption.value, this.state.style)
                            let styleEnum: any;

                            switch (this.state.actionType as unknown as EItemType) {
                                case EItemType.Text:
                                    styleEnum = EPlainTextStyle;
                                    break;
                                case EItemType.RichText:
                                    styleEnum = ERichTextStyle;
                                    break;
                                case EItemType.Gallery:
                                    styleEnum = EGalleryStyle;
                                    break;
                                case EItemType.Carousel:
                                    styleEnum = ECarouselStyle;
                                    break;
                                case EItemType.Image:
                                    styleEnum = EImageStyle;
                                    break;
                                default:
                                    styleEnum = EStyle
                            }
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
                <Modal width={'90%'} open={this.state.dialogOpen}
                       footer={(_, {OkBtn, CancelBtn}) => (
                           <>
                               <CancelBtn/>
                               <PreviewDialog t={this.props.t} tApp={this.props.tApp} item={item}/>
                               <OkBtn/>
                           </>
                       )}
                       onCancel={() => {
                           this.setState({dialogOpen: false})
                       }}
                       onOk={async () => {
                           await this.addSectionItem()
                           this.setState({dialogOpen: false})
                       }}
                >
                    <Tabs tabPosition={'left'} defaultActiveKey="1" items={tabContent}/>

                </Modal>
            </>
        )
    }
}

export default AddNewSectionItem