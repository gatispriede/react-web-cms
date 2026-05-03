import React from 'react';
import {PRICING} from './copy';

const Pricing: React.FC = () => (
    <section
        id="pricing"
        className="marketing__section"
        aria-labelledby="pricing-title"
    >
        <div className="marketing__shell">
            <h2 id="pricing-title" className="marketing__h2">
                {PRICING.headline}
            </h2>
            <div className="pricing__grid">
                {PRICING.tiers.map((tier) => (
                    <div
                        key={tier.id}
                        className={`tier${tier.popular ? ' tier--popular' : ''}`}
                        aria-label={`${tier.name} plan`}
                    >
                        {tier.popular && <span className="tier__tag">Most popular</span>}
                        <h3>{tier.name}</h3>
                        <p className="tier__price">
                            {tier.price}<small>{tier.cadence}</small>
                        </p>
                        <p className="tier__tag-line">{tier.tagline}</p>
                        <ul>
                            {tier.features.map((feat) => (
                                <li key={feat}>{feat}</li>
                            ))}
                        </ul>
                        <a className="btn btn--primary" href={tier.cta.href}>
                            {tier.cta.label}
                        </a>
                    </div>
                ))}
            </div>
            <p className="pricing__footnote">{PRICING.footnote}</p>
        </div>
    </section>
);

export default Pricing;
