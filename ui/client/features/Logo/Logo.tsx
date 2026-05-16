"use client";
import {Component} from "react";
import LogoEditDialog from "@admin/features/Logo/LogoEditDialog";
import MongoApi from "@services/api/client/MongoApi";
import {ILogo, ILogoContent, ILogoVariantAsset, resolveLogoVariantSrc} from "@interfaces/ILogo";
import {ELogoStyle} from "@enums/ELogoStyle";
import {ELogoContext, ELogoVariant} from "@enums/ELogoVariant";
import Link from "next/link";
import {TFunction} from "i18next";
import SizedImage from "@client/lib/SizedImage";

interface ILogoProps {
    admin: boolean,
    t: TFunction<"translation", undefined>
    /**
     * Where this Logo is being rendered. Drives variant selection together
     * with the active theme's declared lockup. Defaults to `Header`.
     */
    context?: ELogoContext;
    /**
     * Explicit variant override — bypasses the theme + context picker.
     * Useful for previews / admin chrome.
     */
    variant?: ELogoVariant;
}

interface ILogoComponentState {
    logo: ILogoContent;
    open: boolean;
}

/**
 * Pick the best logo variant for a given (context, theme-declared-lockup)
 * pair. The picker is *aspirational* — the caller's content may not actually
 * have the chosen variant uploaded, in which case `resolveLogoVariantSrc`
 * falls back through `Full` → legacy `src` → `◆` mark. So this function is
 * safe to call without checking what's been uploaded.
 *
 * Picker matrix (rows = context, cols = theme lockup):
 *
 *                   | wordmark    | mark-only | combined / unset
 *   ----------------+-------------+-----------+------------------
 *   Header          | Wordmark    | Icon      | Full
 *   Footer          | Mono        | Mono      | Mono
 *   MobileCollapsed | Icon        | Icon      | Icon
 *   Error           | Full        | Full      | Full
 */
export function pickLogoVariant(context: ELogoContext, lockup: string | undefined): ELogoVariant {
    if (context === ELogoContext.Footer) return ELogoVariant.Mono;
    if (context === ELogoContext.MobileCollapsed) return ELogoVariant.Icon;
    if (context === ELogoContext.Error) return ELogoVariant.Full;
    // Header — pick by theme-declared lockup.
    if (lockup === 'wordmark') return ELogoVariant.Wordmark;
    if (lockup === 'mark-only') return ELogoVariant.Icon;
    return ELogoVariant.Full;
}

class Logo extends Component<ILogoProps, ILogoComponentState> {
    private _mongoApi: MongoApi;
    private _mounted = false;
    state: ILogoComponentState = {
        logo: {
            src: '',
            width: 40,
            height: 40,
            style: ELogoStyle.Default as ELogoStyle,
            variants: {},
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
            const parsed = JSON.parse(logo.content) as Partial<ILogoContent>;
            // Normalise — variants is optional and must default to `{}` so the
            // picker can index it safely. Legacy rows have no `variants` field
            // and surface as the `Full` variant via the legacy `src` slot.
            const rawVariants = (parsed?.variants ?? {}) as Record<string, ILogoVariantAsset>;
            const variants: ILogoContent['variants'] = {};
            for (const k of Object.values(ELogoVariant)) {
                const entry = rawVariants[k];
                if (entry && typeof entry.src === 'string' && entry.src) variants[k] = entry;
            }
            const normalised: ILogoContent = {
                src: typeof parsed?.src === 'string' ? parsed.src : '',
                width: Number.isFinite(parsed?.width) ? parsed.width as number : 40,
                height: Number.isFinite(parsed?.height) ? parsed.height as number : 40,
                style: (typeof parsed?.style === 'string' ? parsed.style : ELogoStyle.Default) as ELogoStyle,
                variants,
            };
            this.setState({logo: normalised});
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
        // Variant pick: explicit prop wins; otherwise derive from context +
        // theme lockup (read from `body[data-logo-lockup]`, set by
        // `applyThemeCssVars`). SSR has no `document`, so during the first
        // paint we fall back to `Full` — the post-hydration re-render under
        // a real `document` picks the right variant. This avoids a hydration
        // mismatch (same markup either way unless the operator has uploaded
        // distinct variants, which is the operator opting into the cost).
        const lockup = (typeof document !== 'undefined')
            ? document.body.getAttribute('data-logo-lockup') ?? undefined
            : undefined;
        const chosenVariant = this.props.variant
            ?? pickLogoVariant(this.props.context ?? ELogoContext.Header, lockup ?? undefined);
        const resolvedSrc = resolveLogoVariantSrc(this.state.logo, chosenVariant);
        return (
            <Link
                href={this.admin ? '#' : '/'}
                className={`logo logo--${this.state.logo.style ?? ELogoStyle.Default} logo--variant-${chosenVariant}`}
                data-logo-variant={chosenVariant}
                style={logoHeightStyle}
                onClick={() => {
                if (this.admin && !this.state.open) {
                    this.setState({open: true})
                }
            }}>
                {resolvedSrc
                    ? <SizedImage
                        alt={resolvedSrc}
                        src={`/${resolvedSrc}`}
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