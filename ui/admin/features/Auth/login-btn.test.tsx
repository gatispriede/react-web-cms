// @vitest-environment jsdom
import React from 'react';
import {describe, it, expect, vi, beforeEach} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mock `next-auth/react` — the module exposes `useSession` and `signIn`.
// The `useSession` return value is re-assigned per test via the exported
// setter so each state (loading / unauthenticated / authenticated) is
// exercised without remounting the mock factory.
const sessionState: {current: any} = {current: {data: null, status: 'unauthenticated'}};
const signInSpy = vi.fn();
vi.mock('next-auth/react', () => ({
    useSession: () => sessionState.current,
    signIn: (...args: any[]) => signInSpy(...args),
}));

// `next-i18next` `useTranslation` — returns an identity `t` so we can assert
// on the English source strings directly. The component calls `useTranslation`
// for both `common` and `app`; a single factory covers both.
vi.mock('next-i18next', () => ({
    useTranslation: () => ({t: (k: string) => k, i18n: {language: 'en', resolvedLanguage: 'en'}}),
    i18n: {language: 'en', resolvedLanguage: 'en'},
}));

// `UserStatusBar` pulls in the entire admin shell (AdminApp, CommandPalette,
// adminI18n, api clients). Mock it to a sentinel — the login-btn contract is
// "authenticated → render the status bar", not the status bar's internals.
vi.mock('@admin/shell/UserStatusBar', () => ({
    __esModule: true,
    default: ({session, view}: any) => (
        <div data-testid="user-status-bar" data-view={view}>
            {session?.user?.name ?? 'no-user'}
        </div>
    ),
}));

import LoginBtn from './login-btn';

describe('LoginBtn', () => {
    beforeEach(() => {
        signInSpy.mockClear();
    });

    it('unauthenticated: renders sign-in prompt + button', () => {
        sessionState.current = {data: null, status: 'unauthenticated'};
        render(<LoginBtn/>);
        expect(screen.getByText('Please sign in to continue')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Sign in'})).toBeInTheDocument();
        expect(screen.queryByTestId('user-status-bar')).not.toBeInTheDocument();
    });

    it('unauthenticated: clicking the button invokes signIn()', () => {
        sessionState.current = {data: null, status: 'unauthenticated'};
        render(<LoginBtn/>);
        fireEvent.click(screen.getByRole('button', {name: 'Sign in'}));
        expect(signInSpy).toHaveBeenCalledTimes(1);
    });

    it('loading: session is null, renders the same sign-in chrome (no flash of bar)', () => {
        // next-auth surfaces `{data: null, status: 'loading'}` during the
        // initial client hydration. The component checks `session` truthiness
        // only — loading falls into the same branch as unauthenticated,
        // which is the intentional behaviour (don't flash the admin bar).
        sessionState.current = {data: null, status: 'loading'};
        render(<LoginBtn/>);
        expect(screen.getByText('Please sign in to continue')).toBeInTheDocument();
        expect(screen.queryByTestId('user-status-bar')).not.toBeInTheDocument();
    });

    it('authenticated: renders UserStatusBar with session + default view=app', () => {
        sessionState.current = {
            data: {user: {name: 'Ada Admin', email: 'ada@example.com'}, expires: ''},
            status: 'authenticated',
        };
        render(<LoginBtn/>);
        const bar = screen.getByTestId('user-status-bar');
        expect(bar).toBeInTheDocument();
        expect(bar).toHaveAttribute('data-view', 'app');
        expect(bar).toHaveTextContent('Ada Admin');
        expect(screen.queryByRole('button', {name: 'Sign in'})).not.toBeInTheDocument();
    });

    it('authenticated: forwards the `view` prop to UserStatusBar', () => {
        sessionState.current = {
            data: {user: {name: 'Ada', email: 'ada@example.com'}, expires: ''},
            status: 'authenticated',
        };
        render(<LoginBtn view="settings"/>);
        expect(screen.getByTestId('user-status-bar')).toHaveAttribute('data-view', 'settings');
    });
});
