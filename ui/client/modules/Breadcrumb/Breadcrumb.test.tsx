// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import Breadcrumb from './Breadcrumb';

describe('Breadcrumb', () => {
    it('renders empty state when no crumbs', () => {
        render(<Breadcrumb content={{autoFromParentChain: true}} crumbs={[]} />);
        expect(screen.getByTestId('breadcrumb-empty')).toBeInTheDocument();
    });

    it('renders N-deep injected chain with last crumb as current', () => {
        render(<Breadcrumb content={{autoFromParentChain: true}} crumbs={[
            {label: 'Products', href: '/products'},
            {label: 'Cars', href: '/products/cars'},
            {label: 'Used', href: '/products/cars/used'},
            {label: 'Sedan', href: '/products/cars/used/sedan'},
            {label: 'BMW', href: '/products/cars/used/sedan/bmw'},
        ]} />);
        expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
        const last = screen.getByTestId('breadcrumb-4');
        expect(last.querySelector('[aria-current="page"]')).not.toBeNull();
    });

    it('honours operator override crumbs when autoFromParentChain=false', () => {
        render(<Breadcrumb content={{autoFromParentChain: false, crumbs: [{label: 'Home', href: '/'}]}} />);
        expect(screen.getByText('Home')).toBeInTheDocument();
    });
});
