// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import SiteFooter, {rewriteForScrollMode} from './SiteFooter';

/**
 * F6 site-mode-toggle: SiteFooter mode-aware rewrite.
 *
 * In scroll mode the footer's page-shaped URLs flip to `#<slug>` so
 * every nav entry stays inside the single scrolling page. External
 * URLs, hash-anchors-already, and unknown page names pass through.
 * Default tabs mode keeps legacy behavior.
 */

const PAGES = [
    {page: 'Home'},
    {page: 'Contact'},
    {page: 'Services'},
];

describe('rewriteForScrollMode', () => {
    it('rewrites page-shaped URL to #anchor when the page is known', () => {
        expect(rewriteForScrollMode('/contact', PAGES)).toBe('#contact');
    });

    it('matches case-insensitively + handles spaces', () => {
        expect(rewriteForScrollMode('/Contact', PAGES)).toBe('#contact');
    });

    it('only takes the first segment when the URL is nested', () => {
        // First segment matches Services → rewrite to its anchor.
        expect(rewriteForScrollMode('/services/cleaning', PAGES)).toBe('#services');
    });

    it('passes hash-anchors through unchanged', () => {
        expect(rewriteForScrollMode('#about', PAGES)).toBe('#about');
    });

    it('passes external URLs through unchanged', () => {
        expect(rewriteForScrollMode('https://example.com', PAGES)).toBe('https://example.com');
        expect(rewriteForScrollMode('mailto:hi@example.com', PAGES)).toBe('mailto:hi@example.com');
        expect(rewriteForScrollMode('tel:+1', PAGES)).toBe('tel:+1');
    });

    it('passes unknown page names through unchanged', () => {
        expect(rewriteForScrollMode('/blog', PAGES)).toBe('/blog');
        expect(rewriteForScrollMode('/blog/some-post', PAGES)).toBe('/blog/some-post');
    });

    it('handles empty / root URLs gracefully', () => {
        expect(rewriteForScrollMode('', PAGES)).toBe('');
        expect(rewriteForScrollMode('/', PAGES)).toBe('/');
    });
});

describe('<SiteFooter> in scroll mode', () => {
    const config = {
        enabled: true,
        bottom: '',
        columns: [
            {
                title: 'Site',
                entries: [
                    {label: 'Contact', url: '/contact'},
                    {label: 'Services', url: '/services'},
                    {label: 'Blog', url: '/blog'},
                    {label: 'External', url: 'https://example.com'},
                ],
            },
        ],
    } as any;

    it('rewrites page entries to #anchor when layoutMode="scroll"', () => {
        render(<SiteFooter config={config} pages={PAGES} hasPosts={false} layoutMode="scroll"/>);
        // Page-shaped URLs become anchors.
        const contact = screen.getByText('Contact').closest('a')!;
        expect(contact.getAttribute('href')).toBe('#contact');
        const services = screen.getByText('Services').closest('a')!;
        expect(services.getAttribute('href')).toBe('#services');
        // Unknown page (Blog) passes through.
        const blog = screen.getByText('Blog').closest('a')!;
        expect(blog.getAttribute('href')).toBe('/blog');
        // External URL passes through.
        const external = screen.getByText('External').closest('a')!;
        expect(external.getAttribute('href')).toBe('https://example.com');
    });

    it('leaves URLs untouched in tabs mode (default)', () => {
        render(<SiteFooter config={config} pages={PAGES} hasPosts={false} layoutMode="tabs"/>);
        const contact = screen.getByText('Contact').closest('a')!;
        expect(contact.getAttribute('href')).toBe('/contact');
    });

    it('treats `auto` like tabs (no rewrite)', () => {
        render(<SiteFooter config={config} pages={PAGES} hasPosts={false} layoutMode="auto"/>);
        const contact = screen.getByText('Contact').closest('a')!;
        expect(contact.getAttribute('href')).toBe('/contact');
    });

    it('treats omitted layoutMode like tabs (no rewrite)', () => {
        render(<SiteFooter config={config} pages={PAGES} hasPosts={false}/>);
        const contact = screen.getByText('Contact').closest('a')!;
        expect(contact.getAttribute('href')).toBe('/contact');
    });

    it('returns null when footer is disabled regardless of mode', () => {
        const {container} = render(
            <SiteFooter
                config={{...config, enabled: false}}
                pages={PAGES}
                hasPosts={false}
                layoutMode="scroll"
            />,
        );
        expect(container).toBeEmptyDOMElement();
    });
});
