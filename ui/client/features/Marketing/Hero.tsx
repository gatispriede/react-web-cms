import React from 'react';
import {HERO} from './copy';

const Hero: React.FC = () => (
    <section className="hero" aria-labelledby="hero-title">
        <div className="marketing__shell hero__grid">
            <div>
                <p className="hero__eyebrow">{HERO.eyebrow}</p>
                <h1 id="hero-title" className="hero__title">{HERO.headline}</h1>
                <p className="hero__sub">{HERO.subhead}</p>
                <div className="hero__ctas">
                    <a className="btn btn--primary" href={HERO.primaryCta.href}>
                        {HERO.primaryCta.label}
                    </a>
                    <a className="btn btn--ghost" href={HERO.secondaryCta.href}>
                        {HERO.secondaryCta.label}
                    </a>
                </div>
            </div>

            <div className="demo" role="img" aria-label="Animated demo of MCP prompts">
                <div className="demo__chrome" aria-hidden="true">
                    <span /><span /><span />
                </div>
                <div className="demo__stage">
                    {HERO.demoPrompts.map((line) => (
                        <p key={line} className="demo__line">{line}</p>
                    ))}
                </div>
                <p className="demo__output">Page generated. Ready to publish.</p>
            </div>
        </div>
    </section>
);

export default Hero;
