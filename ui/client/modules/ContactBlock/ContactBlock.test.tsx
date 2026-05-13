// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import ContactBlock from './ContactBlock';

describe('ContactBlock', () => {
    it('renders nothing when all fields absent', () => {
        const {container} = render(<ContactBlock testId="cb" />);
        expect(container.firstChild).toBeNull();
    });

    it('renders phone as a tel: link', () => {
        render(<ContactBlock testId="cb" phone="+37120000000" />);
        const a = screen.getByTestId('cb-phone');
        expect(a).toHaveAttribute('href', 'tel:+37120000000');
    });

    it('uses phoneDisplay when provided', () => {
        render(<ContactBlock testId="cb" phone="+37120000000" phoneDisplay="+371 20 000 000" />);
        expect(screen.getByTestId('cb-phone')).toHaveTextContent('+371 20 000 000');
    });

    it('wraps address in mapUrl anchor', () => {
        render(
            <ContactBlock
                testId="cb"
                addressLines={['1 Brivibas', 'Riga']}
                mapUrl="https://maps.example/q=1+Brivibas"
            />,
        );
        const map = screen.getByTestId('cb-map');
        expect(map).toHaveAttribute('href', 'https://maps.example/q=1+Brivibas');
        expect(screen.getByTestId('cb-address')).toHaveTextContent('1 Brivibas');
        expect(screen.getByTestId('cb-address')).toHaveTextContent('Riga');
    });

    it('renders address without mapUrl', () => {
        render(<ContactBlock testId="cb" addressLines={['1 Brivibas']} />);
        expect(screen.getByTestId('cb-address')).toBeInTheDocument();
        expect(screen.queryByTestId('cb-map')).toBeNull();
    });

    it('renders email as mailto link', () => {
        render(<ContactBlock testId="cb" email="hello@example.com" />);
        const a = screen.getByTestId('cb-email');
        expect(a).toHaveAttribute('href', 'mailto:hello@example.com');
    });

    it('renders social platforms with correct hrefs', () => {
        render(
            <ContactBlock
                testId="cb"
                social={[
                    {platform: 'facebook', url: 'https://facebook.com/x'},
                    {platform: 'instagram', url: 'https://instagram.com/x'},
                ]}
            />,
        );
        expect(screen.getByTestId('cb-social-facebook')).toHaveAttribute('href', 'https://facebook.com/x');
        expect(screen.getByTestId('cb-social-instagram')).toHaveAttribute('href', 'https://instagram.com/x');
    });
});
