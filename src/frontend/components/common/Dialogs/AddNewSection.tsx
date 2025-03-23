import React from "react";
import {Button, Modal} from "antd";
import {PlusCircleOutlined} from "@ant-design/icons";

class AddNewSection extends React.Component <{
    page: string,
    addSectionToPage: (item: any) => Promise<void>
}> {
    state = {
        dialogOpen: false,
        page: '',
        type: 1,
        label: '100%',
    }
    addSectionToPage = async (item: any) => {
    }

    constructor(props: {
        page: string,
        addSectionToPage: (item: any) => Promise<void>
    }) {
        super(props)
        this.state.page = props.page
        this.addSectionToPage = props.addSectionToPage
    }

    render() {
        return (
            <>
                <Button type="primary" onClick={() => {
                    this.setState({dialogOpen: true})
                }}>
                    Add new section <PlusCircleOutlined/>
                </Button>
                <Modal width={'90%'} open={this.state.dialogOpen}
                       onCancel={() => {
                           this.setState({dialogOpen: false})
                       }}
                       onOk={async () => {
                           const item = {
                               pageName: this.state.page,
                               section: {
                                   page: this.state.page,
                                   type: this.state.type,
                                   content: []
                               }
                           }
                           await this.addSectionToPage(item)
                           this.setState({dialogOpen: false})
                       }}

                >
                    <div className={'add-new-section'}>
                        <div className={'section-types'}>
                            <div className={`section-100 ${this.state.type === 1 ? 'active' : ''}`} onClick={() => {
                                this.setState({type: 1, label: '100%'})
                            }}>
                                <p>100%</p>
                            </div>
                            <div className={`section-50 ${this.state.type === 2 ? 'active' : ''}`} onClick={() => {
                                this.setState({type: 2, label: '50% 50%'})
                            }}>
                                <p>50%</p>
                                <p>50%</p>
                            </div>
                            <div className={`section-33 ${this.state.type === 3 ? 'active' : ''}`} onClick={() => {
                                this.setState({type: 3, label: '33% 33% 33%'})
                            }}>
                                <p>33%</p>
                                <p>33%</p>
                                <p>33%</p>
                            </div>
                            <div className={`section-25 ${this.state.type === 4 ? 'active' : ''}`} onClick={() => {
                                this.setState({type: 4, label: '25% 25% 25% 25%'})
                            }}>
                                <p>25%</p>
                                <p>25%</p>
                                <p>25%</p>
                                <p>25%</p>
                            </div>
                        </div>
                        <div>Selected type: {this.state.label}</div>
                    </div>
                </Modal>
            </>
        )
    }
}

export default AddNewSection