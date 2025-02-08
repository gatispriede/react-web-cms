import {Button, Modal, Select, Tabs} from "antd";
import {EditOutlined, PlusCircleOutlined} from "@ant-design/icons";
import React from "react";
import {ISection} from "../../../Interfaces/ISection";
import {ContentSection} from "./ContentSection";
import PreviewDialog from "./PreviewDialog";
import {EItemType} from "../../../enums/EItemType";

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
        actionContentSelected: EItemType.Text,
        content: '{}',
        actionType: '',
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
            // {
            //     label: "Image with text",
            //     value: "IMAGE_WITH_TEXT",
            //     text: "Please enter text"
            // },
            // {
            //     label: "Carousel of images",
            //     value: "CAROUSEL",
            //     text: "Please enter text"
            // },
        ]
    }
    section: ISection
    index: number

    constructor(props: {
        addSectionItem: (sectionId: string, config: any) => void,
        section: ISection,
        index: number,
        loadItem: boolean
    }) {
        super(props);
        this.section = props.section
        this.index = props.index
        if (props.loadItem) {
            this.state.selected = this.section.content[props.index].type
            this.state.content = this.section.content[props.index].content
        }
    }

    generateContentSection() {
        return <div>
            <h2>Content configuration: </h2>
            <label>Please select content type: </label>
            <Select value={this.activeOption()} options={this.state.selectOptions}
                    onSelect={(e) => {
                        this.setState({selected: e})
                    }}/>
            <label>Please enter content: </label>
            <hr/>
            <ContentSection content={this.state.content} selected={this.state.selected} setContent={(value: string) => {
                this.setState({content: value})
            }}/>
        </div>
    }

    generateActionSection() {
        return <div>
            <h2>Action configuration</h2>
            <label>Please select action type: </label>
            <Select value={this.state.actionContentSelected} options={this.state.actionSelectOptions}
                    onChange={(value) => {
                        this.setState({actionContentSelected: value})
                    }}/>
            <h2>Content configuration: </h2>
            <label>Please select content type: </label>
            <Select value={this.state.actionType} options={this.state.selectOptions}
                    onSelect={(e) => {
                        this.setState({actionType: e})
                    }}/>
            <hr/>
            <label>Please enter content: </label>
            <ContentSection content={this.state.actionContent} selected={this.state.actionType}
                            setContent={(value: string) => {
                                this.setState({actionContent: value})
                            }}/>
        </div>
    }

    addSectionItem = async () => {
        this.props.addSectionItem(
            this.section.id ? this.section.id : '', {
                index: this.index,
                type: this.state.selected,
                content: this.state.content,
                actionType: this.state.actionType,
                actionContent: this.state.actionContent,
            }
        )
    }
    activeLabel = () => {
        return this.state.selectOptions.find(item => item.value === this.state.selected)?.label
    }
    activeContentText = () => {
        return this.state.selectOptions.find(item => item.value === this.state.selected)?.text
    }
    activeOption = () => {
        return this.state.selectOptions.find(item => item.value === this.state.selected)
    }

    render() {
        const tabContent = this.state.tabContent
        tabContent[0].children = this.generateContentSection()
        tabContent[1].children = this.generateActionSection()
        return (
            <>
                {
                    <Button type="primary" onClick={() => {
                        this.setState({dialogOpen: true})
                    }}>

                        {!this.props.loadItem ? <div><PlusCircleOutlined/> Add content</div> : <EditOutlined/>}
                    </Button>
                }
                <Modal open={this.state.dialogOpen}
                       footer={(_, {OkBtn, CancelBtn}) => (
                           <>
                               <CancelBtn/>
                               <PreviewDialog type={this.state.selected} content={this.state.content}/>
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