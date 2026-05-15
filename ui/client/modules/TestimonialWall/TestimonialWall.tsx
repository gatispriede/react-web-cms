import React from 'react';
import type {TestimonialWallProps} from './TestimonialWall.types';

const TestimonialWall: React.FC<TestimonialWallProps> = ({testId, items, desktopColumns = 3}) => {
    if (items.length === 0) return null;
    const cls = `testimonial-wall testimonial-wall--cols-${desktopColumns}`;

    return (
        <section className={cls} data-testid={testId}>
            {items.map(t => (
                <figure
                    key={t.key}
                    className="testimonial-wall__card"
                    data-testid={`${testId}-item-${t.key}`}
                >
                    <blockquote
                        className="testimonial-wall__quote"
                        data-testid={`${testId}-quote-${t.key}`}
                    >{t.quote}</blockquote>
                    <figcaption
                        className="testimonial-wall__author"
                        data-testid={`${testId}-author-${t.key}`}
                    >
                        {t.photoUrl ? (
                            <img
                                className="testimonial-wall__photo"
                                src={t.photoUrl}
                                alt={t.name}
                                loading="lazy"
                            />
                        ) : null}
                        <span className="testimonial-wall__author-meta">
                            <cite className="testimonial-wall__name">{t.name}</cite>
                            {t.role || t.company ? (
                                <span className="testimonial-wall__role">
                                    {[t.role, t.company].filter(Boolean).join(', ')}
                                </span>
                            ) : null}
                        </span>
                    </figcaption>
                </figure>
            ))}
        </section>
    );
};

export default TestimonialWall;
export {TestimonialWall};
