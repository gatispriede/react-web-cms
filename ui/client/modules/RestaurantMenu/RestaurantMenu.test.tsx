// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import RestaurantMenu from './RestaurantMenu';
import type {RestaurantMenuSection} from './RestaurantMenu.types';

const SECTIONS: RestaurantMenuSection[] = [
    {
        key: 'starters',
        title: 'Starters',
        items: [
            {
                key: 'soup',
                name: 'Tomato soup',
                priceFormatted: '€6.00',
                description: 'House-made with basil.',
                dietary: ['vegan', 'gluten-free'],
            },
            {
                key: 'bruschetta',
                name: 'Bruschetta',
                priceFormatted: '€7.50',
                photoUrl: '/img/bruschetta.jpg',
                dietary: ['vegetarian'],
            },
        ],
    },
    {
        key: 'mains',
        title: 'Mains',
        items: [
            {key: 'steak', name: 'Ribeye', priceFormatted: '€24.00', dietary: ['spicy']},
        ],
    },
];

describe('RestaurantMenu', () => {
    it('renders nothing when sections is empty', () => {
        const {container} = render(<RestaurantMenu testId="menu" sections={[]} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders sections and items with testids', () => {
        render(<RestaurantMenu testId="menu" sections={SECTIONS} />);
        expect(screen.getByTestId('menu')).toBeInTheDocument();
        expect(screen.getByTestId('menu-section-starters')).toBeInTheDocument();
        expect(screen.getByTestId('menu-section-mains')).toBeInTheDocument();
        expect(screen.getByTestId('menu-item-soup')).toBeInTheDocument();
        expect(screen.getByTestId('menu-item-bruschetta')).toBeInTheDocument();
        expect(screen.getByTestId('menu-item-steak')).toBeInTheDocument();
    });

    it('renders dietary badges per flag', () => {
        render(<RestaurantMenu testId="menu" sections={SECTIONS} />);
        expect(screen.getByTestId('menu-dietary-soup-vegan')).toBeInTheDocument();
        expect(screen.getByTestId('menu-dietary-soup-gluten-free')).toBeInTheDocument();
        expect(screen.getByTestId('menu-dietary-bruschetta-vegetarian')).toBeInTheDocument();
        expect(screen.getByTestId('menu-dietary-steak-spicy')).toBeInTheDocument();
    });

    it('renders price right-aligned via class assertion', () => {
        render(<RestaurantMenu testId="menu" sections={SECTIONS} />);
        const price = screen.getByTestId('menu-price-soup');
        expect(price).toHaveClass('restaurant-menu__price');
        expect(price).toHaveTextContent('€6.00');
    });

    it('renders photo only when photoUrl present', () => {
        render(<RestaurantMenu testId="menu" sections={SECTIONS} />);
        expect(screen.getByTestId('menu-photo-bruschetta')).toBeInTheDocument();
        expect(screen.queryByTestId('menu-photo-soup')).toBeNull();
    });

    it('renders details elements when collapsibleOnMobile is true (default)', () => {
        const {container} = render(<RestaurantMenu testId="menu" sections={SECTIONS} />);
        expect(container.querySelectorAll('details').length).toBe(2);
    });

    it('renders sections without <details> when collapsibleOnMobile is false', () => {
        const {container} = render(
            <RestaurantMenu testId="menu" sections={SECTIONS} collapsibleOnMobile={false} />
        );
        expect(container.querySelectorAll('details').length).toBe(0);
        expect(screen.getByTestId('menu-section-starters')).toBeInTheDocument();
    });
});
