// @vitest-environment jsdom
import React from 'react';
import {render} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import SchemaOrgInjector from './SchemaOrgInjector';
import {SchemaOrgEntry} from './SchemaOrgInjector.types';

function scripts(container: HTMLElement): HTMLScriptElement[] {
    return Array.from(container.querySelectorAll('script[type="application/ld+json"]'));
}

function parsed(el: Element): any {
    return JSON.parse(el.innerHTML);
}

describe('SchemaOrgInjector', () => {
    it('renders no DOM when entries is empty', () => {
        const {container} = render(<SchemaOrgInjector entries={[]} />);
        expect(scripts(container)).toHaveLength(0);
        expect(container.innerHTML).toBe('');
    });

    it('renders one script per entry, in order', () => {
        const entries: SchemaOrgEntry[] = [
            {kind: 'organization', name: 'A', url: 'https://a.test'},
            {kind: 'faqPage', questions: [{question: 'Q', answer: 'A'}]},
            {kind: 'breadcrumbList', items: [{name: 'Home', item: '/'}]},
        ];
        const {container} = render(<SchemaOrgInjector entries={entries} />);
        const tags = scripts(container);
        expect(tags).toHaveLength(3);
        expect(parsed(tags[0])['@type']).toBe('Organization');
        expect(parsed(tags[1])['@type']).toBe('FAQPage');
        expect(parsed(tags[2])['@type']).toBe('BreadcrumbList');
    });

    it('organization entry maps correctly + preserves sameAs', () => {
        const {container} = render(<SchemaOrgInjector entries={[{
            kind: 'organization',
            name: 'Acme',
            url: 'https://acme.test',
            logo: 'https://acme.test/logo.png',
            sameAs: ['https://twitter.com/acme', 'https://fb.com/acme'],
        }]} />);
        const obj = parsed(scripts(container)[0]);
        expect(obj['@context']).toBe('https://schema.org');
        expect(obj['@type']).toBe('Organization');
        expect(obj.name).toBe('Acme');
        expect(obj.url).toBe('https://acme.test');
        expect(obj.logo).toBe('https://acme.test/logo.png');
        expect(obj.sameAs).toEqual(['https://twitter.com/acme', 'https://fb.com/acme']);
    });

    it('organization omits sameAs when absent', () => {
        const {container} = render(<SchemaOrgInjector entries={[{
            kind: 'organization', name: 'Acme', url: 'https://acme.test',
        }]} />);
        const obj = parsed(scripts(container)[0]);
        expect(obj).not.toHaveProperty('sameAs');
        expect(obj).not.toHaveProperty('logo');
    });

    it('product offer wraps with @type Offer and prefixes availability with schema URL', () => {
        const {container} = render(<SchemaOrgInjector entries={[{
            kind: 'product',
            name: 'Widget',
            offers: {priceCurrency: 'EUR', price: 19.99, availability: 'InStock', url: 'https://shop.test/w'},
        }]} />);
        const obj = parsed(scripts(container)[0]);
        expect(obj['@type']).toBe('Product');
        expect(obj.offers['@type']).toBe('Offer');
        expect(obj.offers.priceCurrency).toBe('EUR');
        expect(obj.offers.price).toBe(19.99);
        expect(obj.offers.availability).toBe('https://schema.org/InStock');
        expect(obj.offers.url).toBe('https://shop.test/w');
    });

    it('article wires Person author and ImageObject publisher.logo', () => {
        const {container} = render(<SchemaOrgInjector entries={[{
            kind: 'article',
            headline: 'Hello',
            datePublished: '2026-01-01',
            dateModified: '2026-01-02',
            author: {name: 'Jane', url: 'https://jane.test'},
            publisher: {name: 'Acme', logo: 'https://acme.test/logo.png'},
        }]} />);
        const obj = parsed(scripts(container)[0]);
        expect(obj['@type']).toBe('Article');
        expect(obj.author['@type']).toBe('Person');
        expect(obj.author.name).toBe('Jane');
        expect(obj.author.url).toBe('https://jane.test');
        expect(obj.publisher['@type']).toBe('Organization');
        expect(obj.publisher.logo['@type']).toBe('ImageObject');
        expect(obj.publisher.logo.url).toBe('https://acme.test/logo.png');
        expect(obj.dateModified).toBe('2026-01-02');
    });

    it('localBusiness emits PostalAddress + GeoCoordinates + OpeningHoursSpecification array', () => {
        const {container} = render(<SchemaOrgInjector entries={[{
            kind: 'localBusiness',
            name: 'Cafe',
            address: {
                streetAddress: '1 Main St',
                addressLocality: 'Riga',
                postalCode: 'LV-1010',
                addressCountry: 'LV',
            },
            geo: {latitude: 56.95, longitude: 24.1},
            openingHoursSpecification: [
                {dayOfWeek: ['Monday', 'Tuesday'], opens: '09:00', closes: '18:00'},
                {dayOfWeek: ['Saturday'], opens: '10:00', closes: '14:00'},
            ],
        }]} />);
        const obj = parsed(scripts(container)[0]);
        expect(obj['@type']).toBe('LocalBusiness');
        expect(obj.address['@type']).toBe('PostalAddress');
        expect(obj.address.streetAddress).toBe('1 Main St');
        expect(obj.geo['@type']).toBe('GeoCoordinates');
        expect(obj.geo.latitude).toBe(56.95);
        expect(Array.isArray(obj.openingHoursSpecification)).toBe(true);
        expect(obj.openingHoursSpecification).toHaveLength(2);
        expect(obj.openingHoursSpecification[0]['@type']).toBe('OpeningHoursSpecification');
        expect(obj.openingHoursSpecification[0].dayOfWeek).toEqual(['Monday', 'Tuesday']);
        expect(obj.openingHoursSpecification[0].opens).toBe('09:00');
    });

    it('event with virtual location gets VirtualLocation type', () => {
        const {container} = render(<SchemaOrgInjector entries={[{
            kind: 'event',
            name: 'Webinar',
            startDate: '2026-06-01T10:00:00Z',
            location: {url: 'https://zoom.test/abc'},
            offers: {url: 'https://shop.test/t', price: 0, priceCurrency: 'EUR', availability: 'InStock'},
        }]} />);
        const obj = parsed(scripts(container)[0]);
        expect(obj['@type']).toBe('Event');
        expect(obj.location['@type']).toBe('VirtualLocation');
        expect(obj.location.url).toBe('https://zoom.test/abc');
        expect(obj.offers['@type']).toBe('Offer');
        expect(obj.offers.availability).toBe('https://schema.org/InStock');
    });

    it('event with physical location uses Place', () => {
        const {container} = render(<SchemaOrgInjector entries={[{
            kind: 'event',
            name: 'Meetup',
            startDate: '2026-06-01',
            location: {name: 'HQ', address: '1 Main St'},
        }]} />);
        const obj = parsed(scripts(container)[0]);
        expect(obj.location['@type']).toBe('Place');
        expect(obj.location.name).toBe('HQ');
        expect(obj.location.address).toBe('1 Main St');
    });

    it('breadcrumbList items get position i+1 (1-indexed)', () => {
        const {container} = render(<SchemaOrgInjector entries={[{
            kind: 'breadcrumbList',
            items: [
                {name: 'Home', item: '/'},
                {name: 'Cars', item: '/cars'},
                {name: 'BMW', item: '/cars/bmw'},
            ],
        }]} />);
        const obj = parsed(scripts(container)[0]);
        expect(obj['@type']).toBe('BreadcrumbList');
        expect(obj.itemListElement).toHaveLength(3);
        expect(obj.itemListElement[0]).toEqual({'@type': 'ListItem', position: 1, name: 'Home', item: '/'});
        expect(obj.itemListElement[1].position).toBe(2);
        expect(obj.itemListElement[2].position).toBe(3);
    });

    it('faqPage maps questions to Question + Answer types', () => {
        const {container} = render(<SchemaOrgInjector entries={[{
            kind: 'faqPage',
            questions: [
                {question: 'How?', answer: 'Like so.'},
                {question: 'Why?', answer: 'Because.'},
            ],
        }]} />);
        const obj = parsed(scripts(container)[0]);
        expect(obj['@type']).toBe('FAQPage');
        expect(obj.mainEntity).toHaveLength(2);
        expect(obj.mainEntity[0]['@type']).toBe('Question');
        expect(obj.mainEntity[0].name).toBe('How?');
        expect(obj.mainEntity[0].acceptedAnswer['@type']).toBe('Answer');
        expect(obj.mainEntity[0].acceptedAnswer.text).toBe('Like so.');
    });

    it('testId scheme is `${prefix}-${kind}-${index}` on each script', () => {
        const {container} = render(<SchemaOrgInjector
            testId="seo"
            entries={[
                {kind: 'organization', name: 'A', url: 'https://a.test'},
                {kind: 'breadcrumbList', items: [{name: 'Home', item: '/'}]},
            ]}
        />);
        const tags = scripts(container);
        expect(tags[0].getAttribute('data-testid')).toBe('seo-organization-0');
        expect(tags[1].getAttribute('data-testid')).toBe('seo-breadcrumbList-1');
    });

    it('uses default testId prefix when not supplied', () => {
        const {container} = render(<SchemaOrgInjector entries={[
            {kind: 'organization', name: 'A', url: 'https://a.test'},
        ]} />);
        expect(scripts(container)[0].getAttribute('data-testid')).toBe('schema-org-injector-organization-0');
    });
});
