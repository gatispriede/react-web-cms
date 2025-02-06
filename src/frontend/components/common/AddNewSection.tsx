import React from "react";
import {Button, Modal, Select} from "antd";
import {PlusCircleOutlined} from "@ant-design/icons";

class AddNewSection extends React.Component {
    props: any = {
        page: '',
        addSectionToPage: async (item: any) => {}
    }
    state = {
        dialogOpen: false,
        page: '',
        type: 1,
        selectOptions: [
            {label: "100%", value: 1},
            {label: "50% 50%", value: 2},
            {label: "30% 30% 30%", value: 3},
            {label: "25% 25% 25% 25%", value: 4},
        ],
    }

    constructor(props: {
        page: string,
        addSectionToPage: (item: any) => Promise<void>
    }) {
        super(props)
        this.state.page = props.page
    }

    selectedSection() {
        const selectedOption = this.state.selectOptions.find(o => o.value === this.state.type)
        return selectedOption?.label
    }

    render() {
        return (
            <>
                <Button type="primary" onClick={() => {
                    this.setState({dialogOpen: true})
                }}>
                    Add new section <PlusCircleOutlined/>
                </Button>
                <Modal open={this.state.dialogOpen}
                       onCancel={() => {
                           this.setState({dialogOpen: false})
                       }}
                       onOk={ async () => {
                           const item = {
                               pageName: this.state.page,
                               section: {
                                   page: this.state.page,
                                   type: this.state.type,
                                   content: []
                               }
                           }
                           await this.props.addSectionToPage(item)
                           this.setState({dialogOpen: false})
                       }}

                >
                    <Select defaultValue={'1'} options={this.state.selectOptions} onSelect={(e) => {
                        this.setState({type: e})
                    }}/>
                    <div>Selected
                        section(-s): {this.selectedSection()}</div>
                </Modal>
            </>
        )
    }
}

export default AddNewSection