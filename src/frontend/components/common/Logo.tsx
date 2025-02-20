import {Component} from "react";
import LogoEditDialog from "./Dialogs/LogoEditDialog";
import MongoApi from "../../api/MongoApi";
import {ILogo} from "../../../Interfaces/ILogo";

class Logo extends Component {
    private _mongoApi: MongoApi;
    state = {
        logo: {
            src: '',
            width: 40,
            height: 40,
        },
        open: false,
    }
    props = {
        admin: false,
    }
    admin: boolean;
    constructor(props: any) {
        super(props);
        this._mongoApi = new MongoApi();
        this.admin = props.admin;
        void this.loadLogo();
    }

    async loadLogo() {
        const logo: ILogo = await this._mongoApi.getLogo()
        try {
            const content = JSON.parse(logo.content)
            this.setState({logo: content})
        }catch (e){
            console.log(e)
        }
    }
    async saveLogo(file: any){
        const stateLogo = this.state.logo;
        stateLogo.src = file.location
        await this._mongoApi.saveLogo(JSON.stringify(stateLogo))
        await this.loadLogo()
        this.setState({open: false})
    }

    render() {
        return (
            <div className={'logo'} onClick={() => {
                if(this.admin && !this.state.open){
                    this.setState({open: true})
                }
            }}>
                <img src={this.state.logo.src} width={this.state.logo.width} height={this.state.logo.height}/>
                <LogoEditDialog key={`logo-${this.state.open}`} open={this.state.open} setOpen={(file: File | false): void => {
                    if(file) {
                        void this.saveLogo(file)
                    }else {
                        this.setState({open: false})
                    }
                }}/>
            </div>
        )
    }
}

export default Logo