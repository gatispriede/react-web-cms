import React from "react";
import {Button, Modal, Select} from "antd";
import {PlusCircleOutlined} from "@ant-design/icons";
import {ISection, resolve} from "../../gqty";

class AddNewSection extends React.Component {
    refresh: () => void;
    state = {
        dialogOpen: false,
        page: '',
        type: 1,
        selectOptions:
            [
                {label: "100%", value: 1},
                {label: "50% 50%", value: 2},
                {label: "30% 30% 30%", value: 3},
                {label: "25% 25% 25% 25%", value: 4},
            ],

    }

    constructor(props: {
        page: string,
        refresh: () => void,
    }) {
        super(props)
        this.state.page = props.page
        this.refresh = props.refresh
    }

    async addSectionToPage() {
        const result = await resolve(
            ({mutation}) => {
                const item = {
                    pageName: this.state.page,
                    section: {
                        page: this.state.page,
                        type: this.state.type,
                        content: []
                    }
                }

                return mutation.mongo.addUpdateSectionItem(item)
            },
        );
        console.log(result)
        this.refresh()
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
                           this.addSectionToPage()
                       }}

                >
                    <Select defaultValue={'1'} options={this.state.selectOptions} onSelect={(e) => {
                        this.setState({type: e})
                    }}/>
                    <div>Selected
                        section(-s): {this.state.selectOptions.find(item => item.value === this.state.type).label}</div>
                </Modal>
            </>
        )
    }
}

export default AddNewSection