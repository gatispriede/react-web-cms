import React from 'react';
import type {ProjectCaseStudyProps} from './ProjectCaseStudy.types';
import './ProjectCaseStudy.scss';

function detectReducedMotion(force: boolean | undefined): boolean {
    if (force !== undefined) return force;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const ProjectCaseStudy: React.FC<ProjectCaseStudyProps> = ({
    testId,
    heroImageUrl,
    title,
    client,
    sections,
    metrics,
    nextCase,
    forceReducedMotion,
}) => {
    const reduced = detectReducedMotion(forceReducedMotion);
    const motion = reduced ? 'reduced' : 'full';

    return (
        <article
            className="project-case-study"
            data-testid={testId}
            data-motion={motion}
        >
            <header className="project-case-study__hero">
                <img
                    className="project-case-study__hero-img"
                    data-testid={`${testId}-hero`}
                    src={heroImageUrl}
                    alt=""
                    loading="eager"
                />
                <div className="project-case-study__hero-text">
                    <span className="project-case-study__client">{client}</span>
                    <h1
                        className="project-case-study__title"
                        data-testid={`${testId}-title`}
                    >{title}</h1>
                </div>
            </header>

            <div className="project-case-study__sections">
                {sections.map((section, i) => (
                    <section
                        key={section.key}
                        className={`project-case-study__section project-case-study__section--${i % 2 === 0 ? 'left' : 'right'}`}
                        data-testid={`${testId}-section-${section.key}`}
                    >
                        {section.imageUrl ? (
                            <div className="project-case-study__section-media">
                                <img src={section.imageUrl} alt="" loading="lazy" />
                            </div>
                        ) : null}
                        <div className="project-case-study__section-body">
                            <h2 className="project-case-study__section-heading">{section.heading}</h2>
                            <p className="project-case-study__section-text">{section.body}</p>
                        </div>
                    </section>
                ))}
            </div>

            {metrics && metrics.length > 0 ? (
                <div className="project-case-study__metrics">
                    {metrics.map(metric => (
                        <div
                            key={metric.key}
                            className="project-case-study__metric"
                            data-testid={`${testId}-metric-${metric.key}`}
                        >
                            <strong className="project-case-study__metric-value">{metric.value}</strong>
                            <small className="project-case-study__metric-label">{metric.label}</small>
                        </div>
                    ))}
                </div>
            ) : null}

            {nextCase ? (
                <a
                    className="project-case-study__next"
                    data-testid={`${testId}-next-case`}
                    href={nextCase.href}
                >{nextCase.label}</a>
            ) : null}
        </article>
    );
};

export default ProjectCaseStudy;
export {ProjectCaseStudy};
