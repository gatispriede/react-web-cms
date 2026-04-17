import React from "react";
import {EItemType} from "../../../enums/EItemType";
import {IItem} from "../../../Interfaces/IItem";
import ContentManager from "../ContentManager";
import {TFunction} from "i18next";
import {sanitizeKey} from "../../../utils/stringFunctions";
import RevealOnScroll from "../common/RevealOnScroll";

export interface IHero {
    headline: string;
    subtitle: string;
    tagline: string;
    bgImage: string;
    accent: string;
}

export enum EHeroStyle {
    Default = "default",
    Centered = "centered",
    Compact = "compact",
}

export class HeroContent extends ContentManager {
    public _parsedContent: IHero = {headline: '', subtitle: '', tagline: '', bgImage: '', accent: ''};
    get data(): IHero { this.parse(); return this._parsedContent; }
    set data(v: IHero) { this._parsedContent = v; }
    setField<K extends keyof IHero>(k: K, v: IHero[K]) { this._parsedContent[k] = v; }
}

const Hero = ({item, tApp}: {
    item: IItem;
    t: TFunction<"translation", undefined>;
    tApp: TFunction<string, undefined>;
}) => {
    const c = new HeroContent(EItemType.Hero, item.content).data;
    const tr = (v: string) => v ? tApp(sanitizeKey(v)) : '';
    const style: React.CSSProperties = {
        backgroundImage: c.bgImage ? `linear-gradient(180deg, rgba(0,0,0,.0) 0%, rgba(0,0,0,.35) 100%), url(${c.bgImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        borderLeft: c.accent ? `4px solid ${c.accent}` : undefined,
    };
    return (
        <div className={`hero ${item.style ?? ''}`} style={style}>
            {c.headline && (
                <RevealOnScroll as="h1" className="hero__headline">
                    <span style={{color: c.accent || undefined}}>{tr(c.headline)}</span>
                </RevealOnScroll>
            )}
            {c.subtitle && (
                <RevealOnScroll as="h2" className="hero__subtitle" delay={120}>
                    {tr(c.subtitle)}
                </RevealOnScroll>
            )}
            {c.tagline && (
                <RevealOnScroll as="p" className="hero__tagline" delay={220}>
                    <em>{tr(c.tagline)}</em>
                </RevealOnScroll>
            )}
        </div>
    );
};

export default Hero;
