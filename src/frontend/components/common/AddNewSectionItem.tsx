import {Button, Input, Modal, Select} from "antd";
import {PlusCircleOutlined} from "@ant-design/icons";
import React from "react";

const ContentSection = ({selected, setContent}:{selected: string, setContent: (value: string) => void}) => {
    switch(selected){
        case 'TEXT':
        case 'RICH_TEXT':
            return <Input onChange={(e) => {
                setContent(e.target.value)
                // this.setState({content: e.target.value})
            }}/>
        case 'IMAGE':
        case 'IMAGE_WITH_TEXT':
        case 'CAROUSEL':
            return <Input onChange={(e) => {
                setContent(e.target.value)
                // this.setState({content: e.target.value})
            }}/>
        default:
            return <></>

    }
}

class AddNewSectionItem extends React.Component {
    state = {
        dialogOpen: false,
        selected: 'TEXT',
        content: '',
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
                label: "Image with text",
                value: "IMAGE_WITH_TEXT",
                text: "Please enter text"
            },
            {
                label: "Carousel of images",
                value: "CAROUSEL",
                text: "Please enter text"
            },
        ]
    }
    section: any
    index: number
    addSectionItemParent: (sectionId: string, config: any) => void

    constructor(props: {
        addSectionItem: (sectionId: string, config: any) => void,
        section: any,
        index: number,
    }) {
        super(props);
        this.section = props.section
        this.index = props.index
        this.addSectionItemParent = props.addSectionItem
    }

    addSectionItem = () => {
        this.addSectionItemParent(
            this.section.id, {
                index: this.index,
                type: this.state.selected,
                content: this.state.content
            }
        )
    }
    activeLabel = (): string => {
        return this.state.selectOptions.find(item => item.value === this.state.selected).label
    }
    activeContentText = (): string => {
        return this.state.selectOptions.find(item => item.value === this.state.selected).text
    }

    render() {
        return (
            <>
                <Button type="primary" onClick={() => {
                    this.setState({dialogOpen: true})
                }}>
                    <PlusCircleOutlined/>
                </Button>
                <Modal open={this.state.dialogOpen}
                       onCancel={() => {
                           this.setState({dialogOpen: false})
                       }}
                       onOk={() => {
                           this.setState({dialogOpen: false})
                           this.addSectionItem()
                       }}

                >
                    <Select defaultValue={this.state.selectOptions[0]} options={this.state.selectOptions}
                            onSelect={(e) => {
                                this.setState({selected: e})
                            }}/>
                    <div>Selected content
                        type: {this.activeLabel()}
                    </div>
                    <div>
                        {this.activeContentText()}
                        <ContentSection selected={this.state.selected} setContent={(value: string) => {
                            this.setState({content: value})
                        }} />
                    </div>
                </Modal>
            </>
        )
    }
}

export default AddNewSectionItem