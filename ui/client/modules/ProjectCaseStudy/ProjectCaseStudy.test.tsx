// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import ProjectCaseStudy from './ProjectCaseStudy';
import type {CaseStudySection, CaseStudyMetric} from './ProjectCaseStudy.types';

const sections: CaseStudySection[] = [
    {key: 'context', heading: 'Context', body: 'Why this project mattered.'},
    {key: 'process', heading: 'Process', body: 'How we delivered.', imageUrl: 'p.jpg'},
    {key: 'outcome', heading: 'Outcome', body: 'Results.'},
];

const metrics: CaseStudyMetric[] = [
    {key: 'conv', value: '3.2x', label: 'Signup conversion'},
    {key: 'rev', value: '$4.7M', label: 'Pipeline'},
];

describe('ProjectCaseStudy', () => {
    it('renders hero, title and client', () => {
        render(<ProjectCaseStudy testId="pcs" heroImageUrl="h.jpg" title="The Build" client="Acme" sections={sections} />);
        expect(screen.getByTestId('pcs-hero')).toHaveAttribute('src', 'h.jpg');
        expect(screen.getByTestId('pcs-title')).toHaveTextContent('The Build');
        expect(screen.getByTestId('pcs')).toHaveTextContent('Acme');
    });

    it('renders one section per entry', () => {
        render(<ProjectCaseStudy testId="pcs" heroImageUrl="h.jpg" title="t" client="c" sections={sections} />);
        expect(screen.getByTestId('pcs-section-context')).toBeInTheDocument();
        expect(screen.getByTestId('pcs-section-process')).toBeInTheDocument();
        expect(screen.getByTestId('pcs-section-outcome')).toBeInTheDocument();
    });

    it('renders metrics only when supplied', () => {
        const {rerender} = render(<ProjectCaseStudy testId="pcs" heroImageUrl="h.jpg" title="t" client="c" sections={sections} />);
        expect(screen.queryByTestId('pcs-metric-conv')).toBeNull();
        rerender(<ProjectCaseStudy testId="pcs" heroImageUrl="h.jpg" title="t" client="c" sections={sections} metrics={metrics} />);
        expect(screen.getByTestId('pcs-metric-conv')).toHaveTextContent('3.2x');
        expect(screen.getByTestId('pcs-metric-rev')).toHaveTextContent('$4.7M');
    });

    it('renders next-case link conditionally', () => {
        const {rerender} = render(<ProjectCaseStudy testId="pcs" heroImageUrl="h.jpg" title="t" client="c" sections={sections} />);
        expect(screen.queryByTestId('pcs-next-case')).toBeNull();
        rerender(<ProjectCaseStudy testId="pcs" heroImageUrl="h.jpg" title="t" client="c" sections={sections} nextCase={{label: 'Next', href: '/x'}} />);
        const link = screen.getByTestId('pcs-next-case');
        expect(link).toHaveAttribute('href', '/x');
        expect(link).toHaveTextContent('Next');
    });

    it('sets data-motion=reduced when forceReducedMotion=true', () => {
        render(<ProjectCaseStudy testId="pcs" heroImageUrl="h.jpg" title="t" client="c" sections={sections} forceReducedMotion={true} />);
        expect(screen.getByTestId('pcs')).toHaveAttribute('data-motion', 'reduced');
    });

    it('sets data-motion=full by default in jsdom', () => {
        render(<ProjectCaseStudy testId="pcs" heroImageUrl="h.jpg" title="t" client="c" sections={sections} forceReducedMotion={false} />);
        expect(screen.getByTestId('pcs')).toHaveAttribute('data-motion', 'full');
    });
});
