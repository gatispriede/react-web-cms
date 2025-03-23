import {Component} from "react";
import LogoEditDialog from "./Dialogs/LogoEditDialog";
import MongoApi from "../../api/MongoApi";
import {ILogo} from "../../../Interfaces/ILogo";
import Link from "next/link";

interface ILogoProps {
    admin: boolean,
}

class Logo extends Component<ILogoProps> {
    private _mongoApi: MongoApi;
    state = {
        logo: {
            src: '',
            width: 40,
            height: 40,
        },
        open: false,
    }
    admin: boolean;
    constructor(props: ILogoProps) {
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
            console.error(e)
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
            <Link href={this.admin ? '#' : '/'} className={'logo'} onClick={() => {
                if(this.admin && !this.state.open){
                    this.setState({open: true})
                }
            }}>
                {this.state.logo.src ? <img src={this.state.logo.src} height={this.state.logo.height}/> : '' }
                <LogoEditDialog key={`logo-${this.state.open}`} open={this.state.open} setOpen={(file: File | false): void => {
                    if(file) {
                        void this.saveLogo(file)
                    }else {
                        this.setState({open: false})
                    }
                }}/>
            </Link>
        )
    }
}

export default Logo