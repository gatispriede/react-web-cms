import {Component} from "react";
import LogoEditDialog from "@admin/features/Logo/LogoEditDialog";
import MongoApi from "@services/api/client/MongoApi";
import {ILogo} from "@interfaces/ILogo";
import {ELogoStyle} from "@enums/ELogoStyle";
import Link from "next/link";
import {TFunction} from "i18next";
import SizedImage from "@client/lib/SizedImage";

interface ILogoProps {
    admin: boolean,
    t: TFunction<"translation", undefined>
}

class Logo extends Component<ILogoProps> {
    private _mongoApi: MongoApi;
    private _mounted = false;
    state = {
        logo: {
            src: '',
            width: 40,
            height: 40,
            style: ELogoStyle.Default as ELogoStyle,
        },
        open: false,
    }
    admin: boolean;

    constructor(props: ILogoProps) {
        super(props);
        this._mongoApi = new MongoApi();
        this.admin = props.admin;
    }

    componentDidMount() {
        // Defer the network call out of the constructor — under React 18+
        // strict mode the constructor can fire before the fiber is mounted,
        // which used to log "Can't call setState on a component that is
        // not yet mounted" (the inner async setState raced the mount).
        this._mounted = true;
        void this.loadLogo(true);
    }

    componentWillUnmount() {
        this._mounted = false;
    }

    async loadLogo(_init?: boolean | undefined) {
        const logo: ILogo = await this._mongoApi.getLogo()
        if (!logo || !logo.content) {
            return;
        }
        if (!this._mounted) return;
        try {
            const content = JSON.parse(logo.content)
            this.setState({logo: content});
        } catch (e) {
            console.error(e)
        }
    }

    async saveLogo(file: File) {
        const stateLogo = { ...this.state.logo };
        // Assuming file has a 'location' property after upload
        // If not, adjust this logic accordingly
        (stateLogo as any).src = (file as any).location;
        await this._mongoApi.saveLogo(JSON.stringify(stateLogo));
        await this.loadLogo();
        this.setState({ open: false });
    }

    render() {
        // When no logo is uploaded we still want a visible wordmark — otherwise
        // the top-bar left slot collapses to zero width and the layout looks
        // unanchored (see design-v5 reference, which ships a bordered "◆" mark
        // as the default). `.logo-mark` is styled module-level in
        // `scss/Common/Logo.scss` so every theme picks up the same structural
        // rules and only layers in its own accents.
        // Admin-set height drives the `--logo-height` CSS variable so the
        // base cap in Logo.scss (`.logo img { max-height: var(--logo-height) }`)
        // expands to match — without this, every logo silently caps at the
        // 40px default regardless of what the admin configures.
        const logoHeightStyle = (this.state.logo.height && this.state.logo.height > 0)
            ? ({'--logo-height': `${this.state.logo.height}px`} as React.CSSProperties)
            : undefined;
        return (
            <Link href={this.admin ? '#' : '/'} className={`logo logo--${this.state.logo.style ?? ELogoStyle.Default}`} style={logoHeightStyle} onClick={() => {
                if (this.admin && !this.state.open) {
                    this.setState({open: true})
                }
            }}>
                {this.state.logo.src
                    ? <SizedImage
                        alt={this.state.logo.src}
                        src={`/${this.state.logo.src}`}
                        // Logo aspect-ratio is sacred — admin's width field used
                        // to be passed too, but `SizedImage` caps via `maxWidth`
                        // which squishes wide logos at small heights. Pass
                        // height only; the browser computes width from the
                        // natural image ratio.
                        height={this.state.logo.height}
                    />
                    : <span className="logo-mark" aria-hidden>◆</span>}
                <LogoEditDialog t={this.props.t} key={`logo-${this.state.open}`} open={this.state.open}
                                setOpen={(file: File | false): void => {
                                    if (file) {
                                        void this.saveLogo(file)
                                    } else {
                                        this.setState({open: false})
                                    }
                                }}/>
            </Link>
        )
    }
}

export default Logo