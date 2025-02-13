import {Button, Modal, Select, Tabs} from "antd";
import {EditOutlined, PlusCircleOutlined} from "@ant-design/icons";
import React from "react";
import {ISection} from "../../../../Interfaces/ISection";
import {ContentSection} from "../ContentSection";
import PreviewDialog from "./PreviewDialog";
import {EItemType} from "../../../../enums/EItemType";
import {IConfigSectionAddRemove} from "../../../../Interfaces/IConfigSectionAddRemove";
import {IItem} from "../../../../Interfaces/IItem";

class AddNewSectionItem extends React.Component {
    props: any = {
        addSectionItem: (sectionId: string, config: any) => {
        },
        section: {},
        index: 0,
        loadItem: false
    }
    state = {
        dialogOpen: false,
        selected: EItemType.Text,
        action: 'none',
        content: '{}',
        actionType: EItemType.Text,
        actionContent: '{}',
        actionSelectOptions: [
            {
                label: "No action",
                value: "none",
            },
            {
                label: "On click",
                value: "onClick",
            },
        ],
        tabContent: [
            {
                key: 'content',
                label: 'Content',
                children: <></>
            },
            {
                key: 'action',
                label: 'Action',
                children: <></>
            }
        ],
        selectOptions: [
            {
                label: "Simple Text",
                value: "TEXT",
                text: "Please enter text"
            },
            {
                label: "Rich text",
                value: "RICH_TEXT",
                text: "Please enter text"
            },
            {
                label: "Image",
                value: "IMAGE",
                text: "Please enter image URL"
            },
            {
                label: "Gallery",
                value: "GALLERY",
                text: ""
            },
        ]
    }
    section: ISection
    index: number

    constructor(props: {
        addSectionItem: (sectionId: string, config: IConfigSectionAddRemove) => void,
        section: ISection,
        index: number,
        loadItem: boolean
    }) {
        super(props);
        this.section = props.section
        this.index = props.index
        if (props.loadItem) {
            const item: IItem = this.section.content[props.index]
            this.state.selected = item.type
            this.state.content = item.content
            if (item.action) this.state.action = item.action
            if (item.actionType) this.state.actionType = item.actionType
            if (item.actionContent) this.state.actionContent = item.actionContent

        }
    }

    generateContentSection() {
        return <div>
            <h4>Content configuration: </h4>
            <label>Please select content type: </label>
            <Select variant={'filled'} value={this.activeOption()} options={this.state.selectOptions}
                    onSelect={(e) => {
                        this.setState({selected: e})
                    }}/>
            <hr/>
            <ContentSection content={this.state.content} selected={this.state.selected} setContent={(value: string) => {
                this.setState({content: value})
            }}/>
        </div>
    }

    generateActionSection() {
        return <div>
            <h4>Action configuration</h4>
            <label>Please select action type: </label>
            <Select variant={'filled'} value={this.state.action} options={this.state.actionSelectOptions}
                    onChange={(value) => {
                        this.setState({action: value})
                    }}/>
            {this.state.action !== 'none' &&
                <div>
                    <h4>Content configuration: </h4>
                    <label>Please select content type: </label>
                    <Select variant={'filled'} value={this.state.actionType} options={this.state.selectOptions}
                            onSelect={(e) => {
                                this.setState({actionType: e})
                            }}/>
                    <hr/>
                    <ContentSection content={this.state.actionContent} selected={this.state.actionType}
                                    setContent={(value: string) => {
                                        this.setState({actionContent: value})
                                    }}
                    />
                </div>
            }
        </div>
    }

    addSectionItem = async () => {
        this.props.addSectionItem(
            this.section.id ? this.section.id : '', {
                index: this.index,
                type: this.state.selected,
                content: this.state.content,
                action: this.state.action,
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
        const item = {
            index: this.index,
            type: this.state.selected,
            content: this.state.content,
            action: this.state.action,
            actionType: this.state.actionType,
            actionContent: this.state.actionContent,
        }
        return (
            <>
                {
                    <Button type="primary" onClick={() => {
                        this.setState({dialogOpen: true})
                    }}>

                        {!this.props.loadItem ? <div><PlusCircleOutlined/> Add content</div> : <EditOutlined/>}
                    </Button>
                }
                <Modal width={'90%'} open={this.state.dialogOpen}
                       footer={(_, {OkBtn, CancelBtn}) => (
                           <>
                               <CancelBtn/>
                               <PreviewDialog item={item} content={this.state.content}/>
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