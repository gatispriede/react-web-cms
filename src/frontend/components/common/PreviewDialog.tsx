import React from "react";
import {Button, Modal} from "antd";
import ContentType from "./ContentType";
import {IItem} from "../../../Interfaces/IItem";

class PreviewDialog extends React.Component<{item: IItem}> {
    props: any = {
        item: {},
    }
    state = {
        dialogOpen: false,
    }

    constructor(props: {item: IItem}) {
        super(props)
    }

    render() {
        return (
            <>
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
                    <div>
                        <ContentType admin={false} item={this.props.item} addButton={""} />
                    </div>
                </Modal>
            </>
        )
    }
}

export default PreviewDialog