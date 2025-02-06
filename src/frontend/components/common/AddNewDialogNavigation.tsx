import React from "react";
import {resolve} from '../../gqty'
import {Button, Input, Modal} from "antd";
import {PlusCircleOutlined} from "@ant-design/icons";
import {MutationMongo} from "../../../Interfaces/IMongo";

class AddNewDialogNavigation extends React.Component {
    props = {
        refresh: async () => {}
    }
    sections: string[] = []
    refresh: () => Promise<void>
    state = {
        dialogOpen: false,
        newNavigationName: ''
    }
    private count = 0

    constructor(props: {
        refresh: () => Promise<void>
    }) {
        super(props)
        this.refresh = props.refresh
    }

    set newNavigationName(value: string) {
        this.setState({newNavigationName: value})
    }

    public async createNavigation() {
        await resolve(
            ({mutation}) => {
                const update: {pageName: string, sections: string[]} = {
                    pageName: this.state.newNavigationName,
                    sections: []
                }
                if (this.sections.length > 0) {
                    update.sections = this.sections
                }
                return (mutation as MutationMongo).mongo.addUpdateNavigationItem(update)
            },
        );
        this.newNavigationName = ''
        await this.refresh()
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
                       okButtonProps={{disabled: this.state.newNavigationName.length < 4}}
                       onOk={async () => {
                           this.setState({dialogOpen: false})
                           await this.createNavigation()
                       }}
                       onCancel={() => {
                           this.setState({dialogOpen: false})
                       }}>
                    <label>Enter name</label>
                    <Input value={this.state.newNavigationName}
                           onChange={(input) => this.newNavigationName = input.target.value}/>

                </Modal>
            </>

        )
    }
}

export default AddNewDialogNavigation