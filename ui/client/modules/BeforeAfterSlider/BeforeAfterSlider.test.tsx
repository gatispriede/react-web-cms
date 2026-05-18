// @vitest-environment jsdom
import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import BeforeAfterSlider from './BeforeAfterSlider';

function setup(initialPercent?: number) {
    render(
        <BeforeAfterSlider
            testId="bas"
            beforeUrl="b.jpg"
            beforeAlt="before"
            afterUrl="a.jpg"
            afterAlt="after"
            initialPercent={initialPercent}
        />,
    );
}

describe('BeforeAfterSlider', () => {
    it('renders both images', () => {
        setup();
        expect(screen.getByTestId('bas-before')).toHaveAttribute('src', 'b.jpg');
        expect(screen.getByTestId('bas-after')).toHaveAttribute('src', 'a.jpg');
    });

    it('renders a focusable handle', () => {
        setup();
        const handle = screen.getByTestId('bas-handle');
        expect(handle).toBeInTheDocument();
        expect(handle.tagName).toBe('BUTTON');
    });

    it('honours initialPercent', () => {
        setup(25);
        expect(screen.getByTestId('bas-percent')).toHaveAttribute('data-percent', '25');
    });

    it('advances percent on ArrowRight in 5% steps', () => {
        setup(50);
        const handle = screen.getByTestId('bas-handle');
        handle.focus();
        fireEvent.keyDown(handle, {key: 'ArrowRight'});
        expect(screen.getByTestId('bas-percent')).toHaveAttribute('data-percent', '55');
    });

    it('retreats percent on ArrowLeft in 5% steps', () => {
        setup(50);
        const handle = screen.getByTestId('bas-handle');
        handle.focus();
        fireEvent.keyDown(handle, {key: 'ArrowLeft'});
        expect(screen.getByTestId('bas-percent')).toHaveAttribute('data-percent', '45');
    });

    it('clamps at 100', () => {
        setup(98);
        const handle = screen.getByTestId('bas-handle');
        handle.focus();
        fireEvent.keyDown(handle, {key: 'ArrowRight'});
        fireEvent.keyDown(handle, {key: 'ArrowRight'});
        expect(screen.getByTestId('bas-percent')).toHaveAttribute('data-percent', '100');
    });

    it('clamps at 0', () => {
        setup(2);
        const handle = screen.getByTestId('bas-handle');
        handle.focus();
        fireEvent.keyDown(handle, {key: 'ArrowLeft'});
        fireEvent.keyDown(handle, {key: 'ArrowLeft'});
        expect(screen.getByTestId('bas-percent')).toHaveAttribute('data-percent', '0');
    });
});
