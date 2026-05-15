// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import FeatureGrid from './FeatureGrid';
import type {FeatureCard} from './FeatureGrid.types';

const features: FeatureCard[] = [
    {key: 'a', title: 'A', description: 'Adesc'},
    {key: 'b', title: 'B', description: 'Bdesc', icon: <svg data-testid="svg-b" />},
    {key: 'c', title: 'C', description: 'Cdesc'},
];

describe('FeatureGrid', () => {
    it('renders all features', () => {
        render(<FeatureGrid testId="fg" features={features} />);
        expect(screen.getByTestId('fg-card-a')).toBeInTheDocument();
        expect(screen.getByTestId('fg-card-b')).toBeInTheDocument();
        expect(screen.getByTestId('fg-card-c')).toBeInTheDocument();
        expect(screen.getByTestId('fg-title-a')).toHaveTextContent('A');
    });

    it('caps at 6 features', () => {
        const many: FeatureCard[] = Array.from({length: 7}, (_, i) => ({
            key: `f${i}`, title: `T${i}`, description: `D${i}`,
        }));
        render(<FeatureGrid testId="fg" features={many} />);
        expect(screen.getByTestId('fg-card-f5')).toBeInTheDocument();
        expect(screen.queryByTestId('fg-card-f6')).toBeNull();
    });

    it('columns=2 sets class', () => {
        render(<FeatureGrid testId="fg" features={features} columns={2} />);
        expect(screen.getByTestId('fg').className).toMatch(/feature-grid--cols-2/);
    });

    it('icon conditional', () => {
        render(<FeatureGrid testId="fg" features={features} />);
        expect(screen.getByTestId('fg-icon-b')).toBeInTheDocument();
        expect(screen.queryByTestId('fg-icon-a')).toBeNull();
    });

    it('renders null when empty', () => {
        const {container} = render(<FeatureGrid testId="fg" features={[]} />);
        expect(container.firstChild).toBeNull();
    });
});
