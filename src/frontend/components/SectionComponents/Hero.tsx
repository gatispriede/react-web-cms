import React, {useEffect, useState} from "react";
import {EItemType} from "../../../enums/EItemType";
import {IItem} from "../../../Interfaces/IItem";
import ContentManager from "../ContentManager";
import {TFunction} from "i18next";
import {translateOrKeep} from "../../../utils/translateOrKeep";
import RevealOnScroll from "../common/RevealOnScroll";

export interface IHeroCta {
    label: string;
    href?: string;
    primary?: boolean;
}

export interface IHeroMeta {
    label: string;
    value: string;
}

export interface IHeroCoord {
    label: string;
    value: string;
    /** When true the value is rendered live as the current time in Europe/Riga.
     * Any string value becomes the fallback until JS mounts. */
    liveTime?: boolean;
}

export interface IHero {
    /** Small caps eyebrow above the headline (e.g. "DOSSIER № 001 / SIGULDA, LATVIA / EST. 2009"). */
    eyebrow?: string;
    headline: string;
    /** Second part of the headline, rendered italic/soft next to the main headline. */
    headlineSoft?: string;
    /** Titles array rendered as "A / B / C" with separators. */
    titles?: string[];
    subtitle: string;
    tagline: string;
    /** Quote attribution under the tagline, e.g. "— personal motto". */
    taglineAttribution?: string;
    bgImage: string;
    accent: string;
    /** Short label drawn inside a portrait placeholder tile, e.g. "GP". */
    portraitLabel?: string;
    /** Optional real portrait image — overrides the diagonal placeholder. */
    portraitImage?: string;
    /** Definition-list pairs below the hero (Based / Years / Mode / Stack). */
    meta?: IHeroMeta[];
    /** Bottom coordinate strip (LAT / LON / ELEV / LOCAL / UPDATED). */
    coords?: IHeroCoord[];
    ctaPrimary?: IHeroCta;
    ctaSecondary?: IHeroCta;
}

export enum EHeroStyle {
    Default = "default",
    Centered = "centered",
    Compact = "compact",
    Editorial = "editorial",
}

export class HeroContent extends ContentManager {
    public _parsedContent: IHero = {headline: '', subtitle: '', tagline: '', bgImage: '', accent: ''};
    get data(): IHero { this.parse(); return this._parsedContent; }
    set data(v: IHero) { this._parsedContent = v; }
    setField<K extends keyof IHero>(k: K, v: IHero[K]) { this._parsedContent[k] = v; }
}

/**
 * Render a translated string with inline emphasis runs. Authors wrap words:
 *   - `*word*`  → `.em-accent`  (italic + accent colour — used by Studio/Paper)
 *   - `!word!`  → `.em-lit`     (accent background + accent-ink — Industrial highlight block)
 *   - `~word~`  → `.em-outline` (transparent fill + accent stroke — Industrial outline)
 *
 * Themes style whatever classes they care about; unthemed browsers fall
 * back to the default `<em>` / `<span>` rendering which stays readable.
 */
function renderAccentRuns(text: string, tr: (s: string) => string): React.ReactNode {
    const translated = tr(text);
    const tokens = translated.split(/(\*[^*]+\*|![^!]+!|~[^~]+~)/g);
    return tokens.map((part, i) => {
        if (!part) return null;
        if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) {
            return <em key={i} className="em-accent">{part.slice(1, -1)}</em>;
        }
        if (part.length > 2 && part.startsWith('!') && part.endsWith('!')) {
            return <span key={i} className="em-lit">{part.slice(1, -1)}</span>;
        }
        if (part.length > 2 && part.startsWith('~') && part.endsWith('~')) {
            return <span key={i} className="em-outline">{part.slice(1, -1)}</span>;
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
    });
}

const LiveTime: React.FC = () => {
    const [time, setTime] = useState('—');
    useEffect(() => {
        const tick = () => {
            try {
                const s = new Date().toLocaleTimeString('en-GB', {
                    timeZone: 'Europe/Riga', hour: '2-digit', minute: '2-digit', hour12: false,
                });
                setTime(`${s} EET`);
            } catch { /* noop */ }
        };
        tick();
        const id = setInterval(tick, 30_000);
        return () => clearInterval(id);
    }, []);
    return <>{time}</>;
};

const renderCta = (cta: IHeroCta | undefined, tr: (v: string) => string) => {
    if (!cta?.label) return null;
    const cls = `hero__cta${cta.primary ? ' hero__cta--primary' : ''}`;
    if (cta.href) return <a className={cls} href={cta.href}>{tr(cta.label)}</a>;
    return <button className={cls}>{tr(cta.label)}</button>;
};

const Hero = ({item, tApp}: {
    item: IItem;
    t: TFunction<"translation", undefined>;
    tApp: TFunction<string, undefined>;
}) => {
    const c = new HeroContent(EItemType.Hero, item.content).data;
    const tr = (v: string) => translateOrKeep(tApp, v);
    const style: React.CSSProperties = {
        backgroundImage: c.bgImage ? `linear-gradient(180deg, rgba(0,0,0,.0) 0%, rgba(0,0,0,.35) 100%), url(${c.bgImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        borderLeft: c.accent ? `4px solid ${c.accent}` : undefined,
    };
    const fullbleed = !!c.bgImage;
    const hasSideBlock = Boolean(c.portraitLabel || c.portraitImage);
    const hasCta = Boolean(c.ctaPrimary?.label || c.ctaSecondary?.label);

    return (
        <div className={`hero ${item.style ?? ''}${fullbleed ? ' is-fullbleed' : ''}${hasSideBlock ? ' hero--has-portrait' : ''}`} style={style}>
            <div className="hero__main">
                {c.eyebrow && (
                    <RevealOnScroll as="div" className="hero__eyebrow">
                        <span className="hero__eyebrow-bullet">◆</span>&nbsp;&nbsp;{tr(c.eyebrow)}
                    </RevealOnScroll>
                )}
                {c.headline && (
                    <RevealOnScroll as="h1" className="hero__headline">
                        <span style={{color: c.accent || undefined}}>{renderAccentRuns(c.headline, tr)}</span>
                        {c.headlineSoft && (
                            <>
                                <br/>
                                <span className="hero__headline-soft">{renderAccentRuns(c.headlineSoft, tr)}</span>
                            </>
                        )}
                    </RevealOnScroll>
                )}
                {(c.titles && c.titles.length > 0) ? (
                    <p className="hero__titles">
                        {c.titles.map((t, i) => (
                            <React.Fragment key={i}>
                                {i > 0 && <span className="hero__title-sep">/</span>}
                                <span>{renderAccentRuns(t, tr)}</span>
                            </React.Fragment>
                        ))}
                    </p>
                ) : c.subtitle ? (
                    <RevealOnScroll as="h2" className="hero__subtitle" delay={120}>
                        {renderAccentRuns(c.subtitle, tr)}
                    </RevealOnScroll>
                ) : null}
                {c.tagline && (
                    <RevealOnScroll as="p" className="hero__tagline" delay={220}>
                        <em>{renderAccentRuns(c.tagline, tr)}</em>
                        {c.taglineAttribution && (
                            <span className="hero__tagline-attr">&nbsp;{tr(c.taglineAttribution)}</span>
                        )}
                    </RevealOnScroll>
                )}
                {hasCta && (
                    <div className="hero__cta-row">
                        {renderCta(c.ctaPrimary, tr)}
                        {renderCta(c.ctaSecondary, tr)}
                    </div>
                )}
            </div>

            {hasSideBlock && (
                <div className="hero__portrait">
                    {c.portraitImage ? (
                        <img src={c.portraitImage} alt=""/>
                    ) : (
                        <>
                            <span className="hero__portrait-corner hero__portrait-corner--tl">+</span>
                            <span className="hero__portrait-corner hero__portrait-corner--tr">+</span>
                            <span className="hero__portrait-corner hero__portrait-corner--br">4:5 · PORTRAIT</span>
                            <span className="hero__portrait-label">{tr(c.portraitLabel ?? '')}</span>
                        </>
                    )}
                </div>
            )}

            {c.meta && c.meta.length > 0 && (
                <dl className="hero__meta">
                    {c.meta.map((m, i) => (
                        <div key={i}>
                            <dt>{tr(m.label)}</dt>
                            <dd>{tr(m.value)}</dd>
                        </div>
                    ))}
                </dl>
            )}

            {c.coords && c.coords.length > 0 && (
                <div className="hero__coords">
                    {c.coords.map((co, i) => (
                        <span key={i}>
                            {tr(co.label)}&nbsp;<b>{co.liveTime ? <LiveTime/> : tr(co.value)}</b>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Hero;
