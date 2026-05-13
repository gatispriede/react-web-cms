import React from 'react';
import type {ProductScreenshotHeroProps} from './ProductScreenshotHero.types';
import './ProductScreenshotHero.scss';

function detectReducedMotion(force: boolean | undefined): boolean {
    if (force !== undefined) return force;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const ProductScreenshotHero: React.FC<ProductScreenshotHeroProps> = ({
    testId,
    headline,
    subHeadline,
    screenshotUrl,
    screenshotAlt,
    primaryCta,
    secondaryCta,
    forceReducedMotion,
}) => {
    const reduced = detectReducedMotion(forceReducedMotion);
    const rootCls = 'product-screenshot-hero' + (reduced ? ' product-screenshot-hero--reduced' : '');

    return (
        <section className={rootCls} data-testid={testId} data-reduced-motion={reduced ? 'true' : 'false'}>
            <div className="product-screenshot-hero__copy">
                <h1
                    className="product-screenshot-hero__headline"
                    data-testid={`${testId}-headline`}
                >{headline}</h1>
                {subHeadline ? (
                    <p
                        className="product-screenshot-hero__sub"
                        data-testid={`${testId}-sub`}
                    >{subHeadline}</p>
                ) : null}
                <div className="product-screenshot-hero__ctas">
                    <a
                        className="product-screenshot-hero__cta product-screenshot-hero__cta--primary"
                        href={primaryCta.href}
                        data-testid={`${testId}-primary-cta`}
                    >{primaryCta.label}</a>
                    {secondaryCta ? (
                        <a
                            className="product-screenshot-hero__cta product-screenshot-hero__cta--secondary"
                            href={secondaryCta.href}
                            data-testid={`${testId}-secondary-cta`}
                        >{secondaryCta.label}</a>
                    ) : null}
                </div>
            </div>
            <div className="product-screenshot-hero__media">
                <img
                    className="product-screenshot-hero__screenshot"
                    src={screenshotUrl}
                    alt={screenshotAlt}
                    data-testid={`${testId}-screenshot`}
                    loading="lazy"
                />
            </div>
        </section>
    );
};

export default ProductScreenshotHero;
export {ProductScreenshotHero};
