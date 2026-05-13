// @vitest-environment jsdom
import React from 'react';
import {render, screen, fireEvent, within} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect, vi} from 'vitest';
import OauthButtonStack from './OauthButtonStack';

describe('OauthButtonStack', () => {
    it('renders all 3 providers in web order by default', () => {
        render(<OauthButtonStack testId="oauth" onChoose={vi.fn()} forcePlatform="web" />);
        const stack = screen.getByTestId('oauth');
        const buttons = within(stack).getAllByRole('button');
        expect(buttons.map(b => b.getAttribute('data-provider'))).toEqual(['google', 'apple', 'facebook']);
    });

    it('iOS platform: Apple first', () => {
        render(<OauthButtonStack testId="oauth" onChoose={vi.fn()} forcePlatform="ios" />);
        const buttons = within(screen.getByTestId('oauth')).getAllByRole('button');
        expect(buttons.map(b => b.getAttribute('data-provider'))).toEqual(['apple', 'google', 'facebook']);
    });

    it("lastUsed='facebook' moves Facebook to position 0", () => {
        render(<OauthButtonStack testId="oauth" onChoose={vi.fn()} forcePlatform="web" lastUsed="facebook" />);
        const buttons = within(screen.getByTestId('oauth')).getAllByRole('button');
        expect(buttons.map(b => b.getAttribute('data-provider'))).toEqual(['facebook', 'google', 'apple']);
    });

    it("providers=['google','apple'] hides Facebook", () => {
        render(<OauthButtonStack testId="oauth" onChoose={vi.fn()} forcePlatform="web" providers={['google', 'apple']} />);
        expect(screen.queryByTestId('oauth-facebook')).toBeNull();
        expect(screen.getByTestId('oauth-google')).toBeInTheDocument();
        expect(screen.getByTestId('oauth-apple')).toBeInTheDocument();
    });

    it("providers=['google'] renders only Google", () => {
        render(<OauthButtonStack testId="oauth" onChoose={vi.fn()} forcePlatform="web" providers={['google']} />);
        const buttons = within(screen.getByTestId('oauth')).getAllByRole('button');
        expect(buttons).toHaveLength(1);
        expect(buttons[0].getAttribute('data-provider')).toBe('google');
    });

    it('click calls onChoose with the provider', () => {
        const onChoose = vi.fn();
        render(<OauthButtonStack testId="oauth" onChoose={onChoose} forcePlatform="web" />);
        fireEvent.click(screen.getByTestId('oauth-google'));
        fireEvent.click(screen.getByTestId('oauth-apple'));
        expect(onChoose).toHaveBeenCalledTimes(2);
        expect(onChoose).toHaveBeenNthCalledWith(1, 'google');
        expect(onChoose).toHaveBeenNthCalledWith(2, 'apple');
    });

    it('forcePlatform=ios overrides UA detection', () => {
        // Don't mock navigator; just rely on the prop override.
        render(<OauthButtonStack testId="oauth" onChoose={vi.fn()} forcePlatform="ios" />);
        const buttons = within(screen.getByTestId('oauth')).getAllByRole('button');
        expect(buttons[0].getAttribute('data-provider')).toBe('apple');
    });
});
