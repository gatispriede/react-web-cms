// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import MetricsCallout from './MetricsCallout';
import type {MetricsCalloutItem} from './MetricsCallout.types';

const items: MetricsCalloutItem[] = [
    {key: 'conv', value: '3.2x', description: 'Signup conversion'},
    {key: 'rev', value: '$4.7M', description: 'Pipeline generated'},
];

describe('MetricsCallout', () => {
    it('returns null when empty', () => {
        const {container} = render(<MetricsCallout testId="mc" items={[]} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders one block per item', () => {
        render(<MetricsCallout testId="mc" items={items} />);
        expect(screen.getByTestId('mc-item-conv')).toBeInTheDocument();
        expect(screen.getByTestId('mc-item-rev')).toBeInTheDocument();
    });

    it('renders value and description', () => {
        render(<MetricsCallout testId="mc" items={items} />);
        expect(screen.getByTestId('mc-value-conv')).toHaveTextContent('3.2x');
        expect(screen.getByTestId('mc-desc-conv')).toHaveTextContent('Signup conversion');
    });

    it('applies align class (default center)', () => {
        render(<MetricsCallout testId="mc" items={items} />);
        expect(screen.getByTestId('mc').className).toContain('metrics-callout--align-center');
    });

    it('applies align=left class when passed', () => {
        render(<MetricsCallout testId="mc" items={items} align="left" />);
        expect(screen.getByTestId('mc').className).toContain('metrics-callout--align-left');
    });
});
