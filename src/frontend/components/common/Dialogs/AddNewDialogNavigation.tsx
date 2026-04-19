import React from "react";
import {Button, Input, Modal} from "antd";
import {DownOutlined, UpOutlined} from "@ant-design/icons";
import MongoApi from "../../../api/MongoApi";
import {ISeo} from "../../../../Interfaces/ISeo";
import {INavigation} from "../../../../Interfaces/INavigation";
import guid from "../../../../helpers/guid";
import {TFunction} from "i18next";

interface IProps {
    refresh: () => Promise<void>,
    close: () => void,
    open: boolean,
    activeNavigation: Partial<INavigation>,
    t: TFunction<"translation", undefined>
}

interface ISate {
    dialogOpen: boolean,
    newNavigationName: string,
    activeNavigation: INavigation
    seo: ISeo
    seoExpanded: boolean
}

class AddNewDialogNavigation extends React.Component<IProps, {}> {
    sections: string[] = []
    refresh: () => Promise<void>
    state: ISate = {
        dialogOpen: false,
        newNavigationName: '',
        activeNavigation: {
            id: '',
            page: "",
            sections: [],
            type: "",
            seo: {}
        },
        seo: {},
        // SEO fields start collapsed — editors usually just want to name the
        // page and set content, SEO can be filled later. When editing an
        // existing page that already has values we auto-expand below.
        seoExpanded: false,
    }
    inEditMode: boolean = false
    private MongoApi: MongoApi = new MongoApi()

    constructor(props: IProps) {
        super(props)
        this.refresh = props.refresh
    }

    set newNavigationName(value: string) {
        this.setState({newNavigationName: value})
    }

    componentDidUpdate(prevProps: Readonly<IProps>, prevState: Readonly<{}>, snapshot?: any) {
        if (this.props.activeNavigation && this.props.activeNavigation.id && this.props.activeNavigation.id.length > 0) {
            this.inEditMode = true
            if ("id" in this.props.activeNavigation) {
                if (this.state.activeNavigation.id !== this.props.activeNavigation.id) {
                    // SEO stays collapsed even when the existing page already has
                    // values — the editor must click "Show more options" to view
                    // / edit them. Keeps the primary flow focused on the page name.
                    this.setState({
                        activeNavigation: this.props.activeNavigation,
                        seo: this.props.activeNavigation.seo ?? {},
                        newNavigationName: this.props.activeNavigation.page,
                        seoExpanded: false,
                    })
                }
            }
        } else {
            this.inEditMode = false
            if (this.state.newNavigationName.length > 0 && prevProps.open !== this.props.open) {
                this.setState({newNavigationName: '', activeNavigation: {}, seo: {}})
            }
        }
    }

    async createEditNavigation() {
        if (!this.inEditMode) {
            await this.MongoApi.createNavigation({
                id: guid(),
                type: 'navigation',
                page: this.state.newNavigationName,
                seo: this.state.seo,
                sections: this.sections
            })
        } else {
            if ("id" in this.state.activeNavigation) {
                const newNavigation: INavigation = this.state.activeNavigation;
                const oldNavigationName: string = this.state.activeNavigation.page
                newNavigation.page = this.state.newNavigationName;
                newNavigation.seo = this.state.seo;
                await this.MongoApi.replaceUpdateNavigation(oldNavigationName, newNavigation)
            }

        }
        await this.props.refresh()
        this.props.close()
    }

    seoFields = [
        "description",
        "keywords",
        "viewport",
        "charSet",
        "url",
        "image",
        "image_alt",
        "author",
        "locale"
    ]

    render() {
        const seo: ISeo = this.state.seo;
        return (
            <>
                <Modal width={'90%'} open={this.props.open}
                       okButtonProps={{disabled: this.state.newNavigationName.length < 4}}
                       onOk={async () => {
                           await this.createEditNavigation()
                       }}
                       onCancel={() => {
                           this.props.close()
                       }}>
                    <div className={'page-name'}>
                        <label>{this.props.t("Page name")}</label>
                        <Input value={this.state.newNavigationName}
                               onChange={(input) => this.newNavigationName = input.target.value}/>
                    </div>
                    <hr/>
                    <div className={'page-seo'}>
                        <Button
                            type="link"
                            size="small"
                            icon={this.state.seoExpanded ? <UpOutlined/> : <DownOutlined/>}
                            onClick={() => this.setState({seoExpanded: !this.state.seoExpanded})}
                            style={{padding: 0}}
                        >
                            {this.state.seoExpanded
                                ? this.props.t('Hide SEO fields')
                                : this.props.t('Show more options · SEO fields')}
                        </Button>
                        {this.state.seoExpanded && (
                            <div style={{marginTop: 12}}>
                                <h3 style={{margin: '0 0 8px'}}>{this.props.t("SEO fields")}</h3>
                                {
                                    this.seoFields.map((field: string, index: number) => (
                                        <div key={index} className={'seo-config'}>
                                            <label>{this.props.t(field.toLocaleUpperCase())}</label>
                                            <Input value={(seo as any)[field]}
                                                   onChange={(input) => {
                                                       this.setState({
                                                           seo: {
                                                               ...this.state.seo,
                                                               [field]: input.target.value
                                                           }
                                                       })
                                                   }}
                                            />
                                        </div>
                                    ))
                                }
                            </div>
                        )}
                    </div>
                </Modal>
            </>

        )
    }
}

export default AddNewDialogNavigation