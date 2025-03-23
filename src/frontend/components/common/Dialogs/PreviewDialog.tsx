import React from "react";
import {Button, Modal} from "antd";
import ContentType from "../ContentType";
import {IItem} from "../../../../Interfaces/IItem";
import ActionDialog from "./ActionDialog";

class PreviewDialog extends React.Component<{item: IItem}> {
    state = {
        dialogOpen: false,
        actionDialogOpen: false,
    }

    constructor(props: {item: IItem}) {
        super(props)
    }

    render() {
        return (
            <div>
                <Button type="primary" onClick={() => {
                    this.setState({dialogOpen: true})
                }}>
                    Preview
                </Button>
                <Modal
                    width={'90%'}
                    title={'Preview'}
                    open={this.state.dialogOpen}
                    onCancel={async () => {
                        this.setState({dialogOpen: false})
                    }}
                    onOk={async () => {
                        this.setState({dialogOpen: false})
                    }}
                >
                    <div className={`content-wrapper ${this.props.item.action === "onClick" ? 'action-enabled' : ''}`} onClick={(event) => {
                        if (this.props.item.action === 'onClick' && !this.state.actionDialogOpen) {
                            this.setState({actionDialogOpen: true})
                        }
                    }}>
                        <ContentType admin={false} item={this.props.item} addButton={""} />
                        <ActionDialog item={this.props.item} open={this.state.actionDialogOpen} close={() => {
                            this.setState({actionDialogOpen: false})
                        }}/>
                    </div>
                </Modal>
            </div>
        )
    }
}

export default PreviewDialog