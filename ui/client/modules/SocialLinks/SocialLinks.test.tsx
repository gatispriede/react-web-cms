// @vitest-environment jsdom
import React from 'react';
import {describe, it, expect} from 'vitest';
import {render} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import SocialLinks from './SocialLinks';
import {EItemType} from '@enums/EItemType';
import type {ISocialLinks} from './SocialLinks.types';

const t = ((k: string) => k) as any;

const fixture: ISocialLinks = {
    links: [
        {platform: 'github', url: 'https://github.com/example', label: 'GitHub'},
        {platform: 'email', url: 'hi@example.com', label: 'Email'},
        {platform: 'phone', url: '+371 20 000 000', label: 'Call'},
        {platform: 'linkedin', url: 'https://linkedin.com/in/x'},
    ],
};

describe('SocialLinks render', () => {
    it('renders one anchor per link, with platform-specific href scheme', () => {
        const {container} = render(
            <SocialLinks
                item={{type: EItemType.SocialLinks, content: JSON.stringify(fixture), style: 'default'}}
                t={t}
                tApp={t}
            />,
        );
        const anchors = container.querySelectorAll('.social-links a');
        expect(anchors).toHaveLength(4);
        const hrefs = Array.from(anchors).map((a) => a.getAttribute('href'));
        expect(hrefs[0]).toBe('https://github.com/example');
        expect(hrefs[1]).toBe('mailto:hi@example.com');
        expect(hrefs[2]).toBe('tel:+37120000000'); // whitespace stripped
        expect(hrefs[3]).toBe('https://linkedin.com/in/x');
    });

    it('adds target=_blank + rel=noopener for external platforms, not for mail/tel', () => {
        const {container} = render(
            <SocialLinks
                item={{type: EItemType.SocialLinks, content: JSON.stringify(fixture)}}
                t={t}
                tApp={t}
            />,
        );
        const anchors = container.querySelectorAll('.social-links a');
        expect(anchors[0].getAttribute('target')).toBe('_blank');
        expect(anchors[0].getAttribute('rel')).toBe('noopener noreferrer');
        expect(anchors[1].getAttribute('target')).toBeNull();
        expect(anchors[2].getAttribute('target')).toBeNull();
        expect(anchors[3].getAttribute('target')).toBe('_blank');
    });

    it('empty links: renders wrapper with no anchors', () => {
        const empty: ISocialLinks = {links: []};
        const {container} = render(
            <SocialLinks
                item={{type: EItemType.SocialLinks, content: JSON.stringify(empty)}}
                t={t}
                tApp={t}
            />,
        );
        expect(container.querySelector('.social-links')).not.toBeNull();
        expect(container.querySelectorAll('.social-links a')).toHaveLength(0);
    });
});
