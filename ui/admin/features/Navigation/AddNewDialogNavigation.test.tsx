// @vitest-environment jsdom
import React from 'react';
import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// AddNewDialogNavigation imports MongoApi at module scope. Mock it to a
// no-op shell — render-tests assert the slug editor JSX, not the
// network round-trip.
vi.mock('@services/api/client/MongoApi', () => ({
    __esModule: true,
    default: class {
        createNavigation = vi.fn();
        replaceUpdateNavigation = vi.fn();
        setNavigationParent = vi.fn();
    },
}));

import AddNewDialogNavigation from './AddNewDialogNavigation';

const baseProps = {
    refresh: async () => {},
    close: () => {},
    open: true,
    activeNavigation: {} as any,
    allPages: [],
    t: ((k: string) => k) as any,
};

describe('AddNewDialogNavigation — slug editor (F1 follow-up)', () => {
    it('renders the single-field editor with a bare-string slug', () => {
        render(
            <AddNewDialogNavigation
                {...baseProps}
                activeNavigation={{
                    id: 'p1', type: 'navigation', page: 'About', sections: [], seo: {}, slug: 'about',
                } as any}
                activeLocales={['en', 'lv']}
                defaultLocale="en"
            />,
        );
        // Bare-string slug → single-field mode (option (a) — explicit
        // promotion, never auto-expand).
        expect(screen.getByTestId('nav-slug-editor-single')).toBeInTheDocument();
        const input = screen.getByTestId('nav-slug-input') as HTMLInputElement;
        expect(input.value).toBe('about');
        // The "Add per-locale slugs" promote-button is visible because
        // there are 2+ active locales.
        expect(screen.getByTestId('nav-slug-add-per-locale')).toBeInTheDocument();
    });

    it('renders the per-locale editor with a Record slug — one Input per locale', () => {
        render(
            <AddNewDialogNavigation
                {...baseProps}
                activeNavigation={{
                    id: 'p1', type: 'navigation', page: 'About', sections: [], seo: {},
                    slug: {en: 'about', lv: 'par-mums'},
                } as any}
                activeLocales={['en', 'lv']}
                defaultLocale="en"
            />,
        );
        expect(screen.getByTestId('nav-slug-editor-per-locale')).toBeInTheDocument();
        const en = screen.getByTestId('nav-slug-input-en') as HTMLInputElement;
        const lv = screen.getByTestId('nav-slug-input-lv') as HTMLInputElement;
        expect(en.value).toBe('about');
        expect(lv.value).toBe('par-mums');
    });

    it('promote-button converts the bare-string editor to per-locale mode', () => {
        render(
            <AddNewDialogNavigation
                {...baseProps}
                activeNavigation={{
                    id: 'p1', type: 'navigation', page: 'About', sections: [], seo: {}, slug: 'about',
                } as any}
                activeLocales={['en', 'lv']}
                defaultLocale="en"
            />,
        );
        fireEvent.click(screen.getByTestId('nav-slug-add-per-locale'));
        // Per-locale Inputs appear; the default-locale Input is seeded
        // with the previous bare-string value so the operator never
        // loses what they had typed.
        expect(screen.getByTestId('nav-slug-editor-per-locale')).toBeInTheDocument();
        expect((screen.getByTestId('nav-slug-input-en') as HTMLInputElement).value).toBe('about');
        expect((screen.getByTestId('nav-slug-input-lv') as HTMLInputElement).value).toBe('');
    });
});
