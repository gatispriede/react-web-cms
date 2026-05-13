// @vitest-environment jsdom
import React from 'react';
import {act, render, screen, fireEvent} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import SaveSearchPrompt from './SaveSearchPrompt';

describe('SaveSearchPrompt', () => {
    beforeEach(() => {
        window.sessionStorage.clear();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders nothing when loggedIn is false', () => {
        const {container} = render(
            <SaveSearchPrompt
                testId="ssp"
                persistKey="k1"
                loggedIn={false}
                activityKey={1}
                onSave={() => {}}
            />,
        );
        act(() => { vi.advanceTimersByTime(10_000); });
        expect(container.firstChild).toBeNull();
        expect(screen.queryByTestId('ssp')).toBeNull();
    });

    it('renders nothing before 5s elapse', () => {
        render(
            <SaveSearchPrompt
                testId="ssp"
                persistKey="k2"
                loggedIn
                activityKey={1}
                onSave={() => {}}
            />,
        );
        act(() => { vi.advanceTimersByTime(4_000); });
        expect(screen.queryByTestId('ssp')).toBeNull();
    });

    it('renders after 5s with the same activityKey', () => {
        render(
            <SaveSearchPrompt
                testId="ssp"
                persistKey="k3"
                loggedIn
                activityKey={1}
                onSave={() => {}}
            />,
        );
        act(() => { vi.advanceTimersByTime(5_000); });
        expect(screen.getByTestId('ssp')).toBeInTheDocument();
    });

    it('activityKey bump within the window resets the countdown', () => {
        const {rerender} = render(
            <SaveSearchPrompt
                testId="ssp"
                persistKey="k4"
                loggedIn
                activityKey={1}
                onSave={() => {}}
            />,
        );
        act(() => { vi.advanceTimersByTime(4_000); });
        rerender(
            <SaveSearchPrompt
                testId="ssp"
                persistKey="k4"
                loggedIn
                activityKey={2}
                onSave={() => {}}
            />,
        );
        act(() => { vi.advanceTimersByTime(4_000); });
        expect(screen.queryByTestId('ssp')).toBeNull();
        act(() => { vi.advanceTimersByTime(1_000); });
        expect(screen.getByTestId('ssp')).toBeInTheDocument();
    });

    it('dismiss button hides component and writes sessionStorage', () => {
        render(
            <SaveSearchPrompt
                testId="ssp"
                persistKey="k5"
                loggedIn
                activityKey={1}
                onSave={() => {}}
            />,
        );
        act(() => { vi.advanceTimersByTime(5_000); });
        expect(screen.getByTestId('ssp')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('ssp-dismiss'));
        expect(window.sessionStorage.getItem('savesearch.dismissed.k5')).toBe('1');
        expect(screen.queryByTestId('ssp')).toBeNull();
    });

    it('pre-dismissed sessionStorage renders nothing even when timer would fire', () => {
        window.sessionStorage.setItem('savesearch.dismissed.k6', '1');
        render(
            <SaveSearchPrompt
                testId="ssp"
                persistKey="k6"
                loggedIn
                activityKey={1}
                onSave={() => {}}
            />,
        );
        act(() => { vi.advanceTimersByTime(10_000); });
        expect(screen.queryByTestId('ssp')).toBeNull();
    });

    it('save fires the callback once', () => {
        const onSave = vi.fn();
        render(
            <SaveSearchPrompt
                testId="ssp"
                persistKey="k7"
                loggedIn
                activityKey={1}
                onSave={onSave}
            />,
        );
        act(() => { vi.advanceTimersByTime(5_000); });
        fireEvent.click(screen.getByTestId('ssp-save'));
        expect(onSave).toHaveBeenCalledOnce();
        expect(window.sessionStorage.getItem('savesearch.dismissed.k7')).toBe('1');
    });

    it('renders correct testids', () => {
        render(
            <SaveSearchPrompt
                testId="my-prompt"
                persistKey="k8"
                loggedIn
                activityKey={1}
                onSave={() => {}}
            />,
        );
        act(() => { vi.advanceTimersByTime(5_000); });
        expect(screen.getByTestId('my-prompt')).toBeInTheDocument();
        expect(screen.getByTestId('my-prompt-save')).toBeInTheDocument();
        expect(screen.getByTestId('my-prompt-dismiss')).toBeInTheDocument();
    });
});
