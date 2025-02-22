import React from "react";
import {Input, Modal} from "antd";
import MongoApi from "../../../api/MongoApi";
import {ISeo} from "../../../../Interfaces/ISeo";
import {INavigation} from "../../../../Interfaces/INavigation";
import guid from "../../../../helpers/guid";

interface IProps {
    refresh:  () => Promise<void>;
    close:  () => void;
    open: boolean,
    activeNavigation: INavigation
}
interface ISate {
    dialogOpen: boolean,
    newNavigationName: string,
    activeNavigation: INavigation
    seo: ISeo
}

class AddNewDialogNavigation extends React.Component<IProps, {}> {
    sections: string[] = []
    refresh: () => Promise<void>
    state: ISate = {
        dialogOpen: false,
        newNavigationName: '',
        activeNavigation: {
            id: undefined,
            page: "",
            sections: [],
            type: "",
            seo: {}
        },
        seo: {},
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
        if(this.props.activeNavigation && this.props.activeNavigation.id && this.props.activeNavigation.id.length > 0){
            this.inEditMode = true
            if("id" in this.state.activeNavigation){
                if(this.state.activeNavigation.id !== this.props.activeNavigation.id){
                    this.setState({
                        activeNavigation: {
                            ...this.props.activeNavigation
                        },
                        newNavigationName: this.props.activeNavigation.page
                    })
                }
            }else if("id" in this.props.activeNavigation){
                if(this.state.activeNavigation.id !== this.props.activeNavigation.id) {
                    this.setState({
                        activeNavigation: {
                            ...this.props.activeNavigation
                        },
                        newNavigationName: this.props.activeNavigation.page
                    })
                }
            }
        }else{
            this.inEditMode = false
            if(this.state.newNavigationName.length > 0 && prevProps.open !== this.props.open){
                this.setState({newNavigationName: '', activeNavigation: {}})
            }
        }
    }

    async createEditNavigation() {
        if(!this.inEditMode){
            await this.MongoApi.createNavigation({
                id: guid(),
                type: 'navigation',
                page: this.state.newNavigationName,
                seo: this.state.activeNavigation.seo,
                sections: this.sections
            })
        }else{
            if("id" in this.state.activeNavigation){
                const newNavigation: INavigation = this.state.activeNavigation;
                const oldNavigationName: string = this.state.activeNavigation.page
                newNavigation.page = this.state.newNavigationName;
                await this.MongoApi.replaceUpdateNavigation(oldNavigationName,newNavigation)
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
        let seo: ISeo = {};
        if(this.state.activeNavigation && this.state.activeNavigation.seo){
            seo = this.state.activeNavigation.seo
        }
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
                        <label>Page name</label>
                        <Input value={this.state.newNavigationName}
                               onChange={(input) => this.newNavigationName = input.target.value}/>
                    </div>
                    <hr />
                    <div className={'page-seo'}>
                        <h1>SEO fields</h1>
                        {
                            this.seoFields.map((field:string, index:number) => (
                                <div key={index} className={'seo-config'}>
                                    <label>{field.toLocaleUpperCase()}</label>
                                    <Input value={(seo as any)[field]}
                                           onChange={(input) => {
                                               const seo: ISeo = this.state.activeNavigation.seo
                                               this.setState({
                                                   activeNavigation: {
                                                       ...this.state.activeNavigation,
                                                       seo: {
                                                           ...seo,
                                                           [field]: input.target.value
                                                       }
                                                   }
                                               })
                                           }}
                                    />
                                </div>
                            ))
                        }
                    </div>
                </Modal>
            </>

        )
    }
}

export default AddNewDialogNavigation