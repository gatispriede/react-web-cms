import React, {useEffect, useState} from "react";
import {EItemType} from "@enums/EItemType";
import {IItem} from "@interfaces/IItem";
import ContentManager from "@client/lib/ContentManager";
import {TFunction} from "i18next";
import {translateOrKeep} from "@utils/translateOrKeep";
import {InlineTranslatable} from "@client/lib/InlineTranslatable";
import RevealOnScroll from "@client/lib/RevealOnScroll";
import {slugifyAnchor} from "@utils/stringFunctions";
import {toImageRef, IImageRef} from "@interfaces/IImageRef";
import {toLinkRef} from "@interfaces/ILinkRef";
import {inlineEditAttr} from "@client/lib/inlineEditAttr";
import type {IHero, IHeroCta, IHeroCtaLegacy, IHeroLegacy} from "./Hero.types";
export type {IHero, IHeroCta, IHeroMeta, IHeroCoord} from "./Hero.types";
export {EHeroStyle} from "./Hero.types";

const normalizeCta = (raw: IHeroCta | IHeroCtaLegacy | undefined): IHeroCta | undefined => {
    if (!raw) return undefined;
    const r = raw as IHeroCtaLegacy;
    const link = toLinkRef(raw, {url: r.url, href: r.href, label: r.label});
    const cta: IHeroCta = {url: link.url};
    if (link.label) cta.label = link.label;
    if (r.primary) cta.primary = true;
    return cta;
};

const normalize = (raw: IHero | IHeroLegacy | undefined): IHero => {
    const r = (raw ?? {}) as IHeroLegacy;
    const result: IHero = {
        headline: r.headline ?? '',
        subtitle: r.subtitle ?? '',
        tagline: r.tagline ?? '',
        accent: r.accent ?? '',
        bgImage: toImageRef(r.bgImage),
    };
    if (r.eyebrow) result.eyebrow = r.eyebrow;
    if (r.headlineSoft) result.headlineSoft = r.headlineSoft;
    if (r.titles) result.titles = r.titles;
    if (r.taglineAttribution) result.taglineAttribution = r.taglineAttribution;
    if (r.bgOpacity !== undefined) result.bgOpacity = r.bgOpacity;
    if (r.portraitLabel) result.portraitLabel = r.portraitLabel;
    if (r.portraitImage !== undefined) {
        // Legacy stored width/height as siblings (`portraitWidth` / `portraitHeight`).
        // Fold them into the IImageRef so the editor + renderer have one source.
        const portrait = toImageRef(r.portraitImage);
        if (portrait.width === undefined && r.portraitWidth !== undefined && r.portraitWidth !== '') {
            portrait.width = r.portraitWidth;
        }
        if (portrait.height === undefined && r.portraitHeight !== undefined && r.portraitHeight !== '') {
            portrait.height = r.portraitHeight;
        }
        if (portrait.src) result.portraitImage = portrait;
        else if (portrait.width || portrait.height) result.portraitImage = portrait;
    }
    if (r.portraitOpacity !== undefined) result.portraitOpacity = r.portraitOpacity;
    if (r.meta) result.meta = r.meta;
    if (r.coords) result.coords = r.coords;
    const p = normalizeCta(r.ctaPrimary);
    if (p) result.ctaPrimary = p;
    const s = normalizeCta(r.ctaSecondary);
    if (s) result.ctaSecondary = s;
    const tCta = normalizeCta(r.ctaTertiary);
    if (tCta) result.ctaTertiary = tCta;
    return result;
};

export class HeroContent extends ContentManager {
    public _parsedContent: IHero = {headline: '', subtitle: '', tagline: '', bgImage: {src: ''}, accent: ''};
    get data(): IHero {
        this.parse();
        this._parsedContent = normalize(this._parsedContent as unknown as IHero | IHeroLegacy);
        return this._parsedContent;
    }
    set data(v: IHero) { this._parsedContent = v; }
    setField<K extends keyof IHero>(k: K, v: IHero[K]) { this._parsedContent[k] = v; }
}

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

const renderCta = (cta: IHeroCta | undefined, tr: (v: string) => React.ReactNode) => {
    if (!cta?.label) return null;
    const cls = `hero__cta${cta.primary ? ' hero__cta--primary' : ''}`;
    if (cta.url) return <a className={cls} href={cta.url}>{tr(cta.label)}</a>;
    return <button className={cls}>{tr(cta.label)}</button>;
};

const dimToCss = (v: IImageRef['width']): string | undefined => {
    if (v === undefined || v === '' || v === null) return undefined;
    return typeof v === 'number' ? `${v}px` : v;
};

const Hero = ({item, tApp, admin}: {
    item: IItem;
    t: TFunction<"translation", undefined>;
    tApp: TFunction<string, undefined>;
    admin?: boolean;
}) => {
    const editId = item.name || EItemType.Hero;
    const c = new HeroContent(EItemType.Hero, item.content).data;
    const trStr = (v: string) => translateOrKeep(tApp, v);
    const tr = (v: string) => <InlineTranslatable tApp={tApp as any} source={v}/>;
    const style: React.CSSProperties = {
        borderLeft: c.accent ? `4px solid ${c.accent}` : undefined,
    };
    const bgSrc = c.bgImage?.src ?? '';
    const fullbleed = !!bgSrc;
    const bgOpacityPct = typeof c.bgOpacity === 'number'
        ? Math.max(0, Math.min(100, c.bgOpacity))
        : 0;
    const portraitOpacityPct = typeof c.portraitOpacity === 'number'
        ? Math.max(0, Math.min(100, c.portraitOpacity))
        : 0;
    const portraitSrc = c.portraitImage?.src ?? '';
    const hasSideBlock = Boolean(c.portraitLabel || portraitSrc);
    const hasCta = Boolean(c.ctaPrimary?.label || c.ctaSecondary?.label || c.ctaTertiary?.label);

    return (
        <div className={`hero ${item.style ?? ''}${fullbleed ? ' is-fullbleed' : ''}${hasSideBlock ? ' hero--has-portrait' : ''}`} style={style}>
            {fullbleed && (
                <div
                    className="hero__bg"
                    aria-hidden
                    style={{
                        backgroundImage: `url(${bgSrc.startsWith('/') || /^https?:/.test(bgSrc) ? bgSrc : '/' + bgSrc})`,
                        opacity: bgOpacityPct > 0 ? 1 - bgOpacityPct / 100 : undefined,
                    }}
                />
            )}
            <div className="hero__main">
                {c.eyebrow && (
                    <RevealOnScroll as="div" className="hero__eyebrow" {...inlineEditAttr(admin, editId, 'eyebrow')}>
                        <span className="hero__eyebrow-bullet">◆</span>&nbsp;&nbsp;{tr(c.eyebrow)}
                    </RevealOnScroll>
                )}
                {c.headline && (
                    <RevealOnScroll
                        as="h1"
                        className="hero__headline"
                        id={slugifyAnchor(c.headline) || undefined}
                        {...inlineEditAttr(admin, editId, 'headline')}
                    >
                        <span style={{color: c.accent || undefined}}>{renderAccentRuns(c.headline, trStr)}</span>
                        {c.headlineSoft && (
                            <>
                                <br/>
                                <span className="hero__headline-soft">{renderAccentRuns(c.headlineSoft, trStr)}</span>
                            </>
                        )}
                    </RevealOnScroll>
                )}
                {c.titles && c.titles.length > 0 && (
                    <p className="hero__titles">
                        {c.titles.map((tt, i) => (
                            <React.Fragment key={i}>
                                {i > 0 && <span className="hero__title-sep">/</span>}
                                <span>{renderAccentRuns(tt, trStr)}</span>
                            </React.Fragment>
                        ))}
                    </p>
                )}
                {c.subtitle && (
                    <RevealOnScroll as="h2" className="hero__subtitle" delay={120} {...inlineEditAttr(admin, editId, 'subtitle')}>
                        {renderAccentRuns(c.subtitle, trStr)}
                    </RevealOnScroll>
                )}
                {c.tagline && (
                    <RevealOnScroll as="p" className="hero__tagline" delay={220} {...inlineEditAttr(admin, editId, 'tagline')}>
                        <em>{renderAccentRuns(c.tagline, trStr)}</em>
                        {c.taglineAttribution && (
                            <span className="hero__tagline-attr">&nbsp;{tr(c.taglineAttribution)}</span>
                        )}
                    </RevealOnScroll>
                )}
                {hasCta && (
                    <div className="hero__cta-row">
                        {renderCta(c.ctaPrimary, tr)}
                        {renderCta(c.ctaSecondary, tr)}
                        {renderCta(c.ctaTertiary, tr)}
                    </div>
                )}
            </div>

            {hasSideBlock && (
                <div
                    className="hero__portrait"
                    style={{
                        width: dimToCss(c.portraitImage?.width),
                        height: dimToCss(c.portraitImage?.height),
                    }}
                >
                    {portraitSrc ? (
                        <img
                            src={portraitSrc.startsWith('/') || /^https?:/.test(portraitSrc) ? portraitSrc : '/' + portraitSrc}
                            alt={c.portraitImage?.alt ?? ''}
                            style={portraitOpacityPct > 0 ? {opacity: 1 - portraitOpacityPct / 100} : undefined}
                        />
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
