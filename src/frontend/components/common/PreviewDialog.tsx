import React from "react";
import {Button, Modal} from "antd";
import ContentType from "./ContentType";
import {EItemType} from "../../../enums/EItemType";

class PreviewDialog extends React.Component {
    props = {
        type: EItemType.Text,
        content: '{}'
    }
    state = {
        dialogOpen: false,
    }

    constructor(props: {}) {
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
                        <ContentType type={this.props.type} content={this.props.content} addButton={""} />
                    </div>
                </Modal>
            </>
        )
    }
}

export default PreviewDialog