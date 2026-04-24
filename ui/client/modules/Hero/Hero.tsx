import React, {useEffect, useState} from "react";
import {EItemType} from "@enums/EItemType";
import {IItem} from "@interfaces/IItem";
import ContentManager from "@client/lib/ContentManager";
import {TFunction} from "i18next";
import {translateOrKeep} from "@utils/translateOrKeep";
import {InlineTranslatable} from "@client/lib/InlineTranslatable";
import RevealOnScroll from "@client/lib/RevealOnScroll";
import type {IHero, IHeroCta} from "./Hero.types";
export type {IHero, IHeroCta, IHeroMeta, IHeroCoord} from "./Hero.types";
export {EHeroStyle} from "./Hero.types";

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

const renderCta = (cta: IHeroCta | undefined, tr: (v: string) => React.ReactNode) => {
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
    const trStr = (v: string) => translateOrKeep(tApp, v);
    const tr = (v: string) => <InlineTranslatable tApp={tApp as any} source={v}/>;
    // Fullbleed hero: scrim is rendered by a CSS ::before pseudo (see Hero.scss
    // `.hero.is-fullbleed::before`) rather than as a gradient layer baked into
    // `background-image`, so each theme can tune the scrim opacity via
    // `--hero-scrim-opacity` and we get a readable top-edge (client report
    // 2026-04-24 #2 — text over bright images was washing out at the top where
    // the previous bottom-only gradient hadn't landed yet).
    // Background image is rendered as its own absolutely-positioned layer
    // (`.hero__bg`) rather than a `background-image` on the hero root, so
    // authors can fade it independently of the text overlay. Opacity of 0
    // (default) keeps historical rendering; 100 hides the image entirely
    // without dropping the scrim + text-shadow legibility layer above it.
    const style: React.CSSProperties = {
        borderLeft: c.accent ? `4px solid ${c.accent}` : undefined,
    };
    const fullbleed = !!c.bgImage;
    const bgOpacityPct = typeof c.bgOpacity === 'number'
        ? Math.max(0, Math.min(100, c.bgOpacity))
        : 0;
    const portraitOpacityPct = typeof c.portraitOpacity === 'number'
        ? Math.max(0, Math.min(100, c.portraitOpacity))
        : 0;
    const hasSideBlock = Boolean(c.portraitLabel || c.portraitImage);
    const hasCta = Boolean(c.ctaPrimary?.label || c.ctaSecondary?.label);

    return (
        <div className={`hero ${item.style ?? ''}${fullbleed ? ' is-fullbleed' : ''}${hasSideBlock ? ' hero--has-portrait' : ''}`} style={style}>
            {fullbleed && (
                <div
                    className="hero__bg"
                    aria-hidden
                    style={{
                        backgroundImage: `url(${c.bgImage})`,
                        opacity: bgOpacityPct > 0 ? 1 - bgOpacityPct / 100 : undefined,
                    }}
                />
            )}
            <div className="hero__main">
                {c.eyebrow && (
                    <RevealOnScroll as="div" className="hero__eyebrow">
                        <span className="hero__eyebrow-bullet">◆</span>&nbsp;&nbsp;{tr(c.eyebrow)}
                    </RevealOnScroll>
                )}
                {c.headline && (
                    <RevealOnScroll as="h1" className="hero__headline">
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
                        {c.titles.map((t, i) => (
                            <React.Fragment key={i}>
                                {i > 0 && <span className="hero__title-sep">/</span>}
                                <span>{renderAccentRuns(t, trStr)}</span>
                            </React.Fragment>
                        ))}
                    </p>
                )}
                {c.subtitle && (
                    <RevealOnScroll as="h2" className="hero__subtitle" delay={120}>
                        {renderAccentRuns(c.subtitle, trStr)}
                    </RevealOnScroll>
                )}
                {c.tagline && (
                    <RevealOnScroll as="p" className="hero__tagline" delay={220}>
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
                    </div>
                )}
            </div>

            {hasSideBlock && (
                <div className="hero__portrait">
                    {c.portraitImage ? (
                        <img
                            src={c.portraitImage}
                            alt=""
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
