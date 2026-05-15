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
        expect(screen.getByTestId('breadcrumb-0')).toHaveTextContent('Home');
    });

    it('emits a BreadcrumbList JSON-LD by default with absolutised URLs', () => {
        render(<Breadcrumb
            content={{autoFromParentChain: true}}
            origin="https://example.com"
            crumbs={[
                {label: 'Home', href: '/'},
                {label: 'Cars', href: '/cars'},
            ]}
        />);
        const ld = screen.getByTestId('breadcrumb-jsonld');
        const parsed = JSON.parse(ld.innerHTML);
        expect(parsed['@type']).toBe('BreadcrumbList');
        expect(parsed.itemListElement).toHaveLength(2);
        expect(parsed.itemListElement[0]).toMatchObject({position: 1, name: 'Home', item: 'https://example.com/'});
        expect(parsed.itemListElement[1]).toMatchObject({position: 2, name: 'Cars', item: 'https://example.com/cars'});
    });

    it('omits JSON-LD when schemaOrg is false', () => {
        render(<Breadcrumb
            content={{autoFromParentChain: true, schemaOrg: false}}
            crumbs={[{label: 'Home', href: '/'}]}
        />);
        expect(screen.queryByTestId('breadcrumb-jsonld')).toBeNull();
    });

    it('renders mobile back-link to parent crumb under collapse-to-back', () => {
        render(<Breadcrumb
            content={{autoFromParentChain: true, mobileBehavior: 'collapse-to-back'}}
            crumbs={[
                {label: 'Home', href: '/'},
                {label: 'Cars', href: '/cars'},
                {label: 'Used BMW', href: '/cars/used-bmw'},
            ]}
        />);
        const back = screen.getByTestId('breadcrumb-back');
        expect(back.getAttribute('href')).toBe('/cars');
        const current = screen.getByTestId('breadcrumb-current');
        expect(current.textContent).toBe('Used BMW');
    });

    it('omits mobile DOM when mobileBehavior is "full"', () => {
        render(<Breadcrumb
            content={{autoFromParentChain: true, mobileBehavior: 'full'}}
            crumbs={[{label: 'Home', href: '/'}, {label: 'Cars', href: '/cars'}]}
        />);
        expect(screen.queryByTestId('breadcrumb-mobile')).toBeNull();
    });
});
