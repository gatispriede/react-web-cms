import React from "react";
import {Button, Input, Modal} from "antd";
import {PlusCircleOutlined} from "@ant-design/icons";
import MongoApi from "../../api/MongoApi";

interface IProps {
    refresh:  () => Promise<void>;
}

class AddNewDialogNavigation extends React.Component<IProps, {}> {
    sections: string[] = []
    refresh: () => Promise<void>
    state = {
        dialogOpen: false,
        newNavigationName: ''
    }
    private count = 0
    private MongoApi: MongoApi = new MongoApi()

    constructor(props: IProps) {
        super(props)
        this.refresh = props.refresh
    }

    set newNavigationName(value: string) {
        this.setState({newNavigationName: value})
    }

    render() {

        return (
            <>

                <Button type="primary" onClick={() => {
                    this.setState({dialogOpen: true})
                }}>
                    Pievienot jaunu lapu: <PlusCircleOutlined/>
                </Button>
                <Modal width={'90%'} open={this.state.dialogOpen}
                       okButtonProps={{disabled: this.state.newNavigationName.length < 4}}
                       onOk={async () => {
                           await this.MongoApi.createNavigation(this.state.newNavigationName, this.sections)
                           this.setState({newNavigationName: '', dialogOpen: false})
                           await this.props.refresh()
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