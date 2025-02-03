import {Button, Input, Modal, Select} from "antd";
import {PlusCircleOutlined} from "@ant-design/icons";
import React from "react";

class AddNewSectionItem  extends React.Component {
    state = {
        dialogOpen: false,
        selected: 'TEXT',
        selectOptions: [
            { label: "Simple Text", value: "TEXT" },
            { label: "Rich text", value: "RICH_TEXT" },
            { label: "Image", value: "IMAGE" },
            { label: "Image with text", value: "IMAGE_WITH_TEXT" },
            { label: "Carousel of images", value: "CAROUSEL" },
        ]
    }

    constructor(props: {}) {
        super(props);

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
                       }}

                >
                    <Select defaultValue={this.state.selectOptions[0]} options={this.state.selectOptions} onSelect={(e) => {
                        this.setState({selected: e})
                    }}/>
                    <div>Selected content type: {this.state.selectOptions.find(item => item.value === this.state.selected).label}</div>
                    <div>
                        Content:
                        <div>
                            <Input />
                        </div>
                    </div>
                </Modal>
            </>
        )
    }
}

export default AddNewSectionItem