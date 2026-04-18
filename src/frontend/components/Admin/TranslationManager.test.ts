import {describe, it, expect} from 'vitest';
import TranslationManager from './TranslationManager';
import EItemType from '../../../enums/EItemType';

// Stamp a TranslationManager with hand-crafted sections/pages and run the
// private-in-practice extraction so the test doesn't need Mongo or the gqty
// client. The extractor writes into `defaultTranslations` — that's the
// source of truth for the admin translation grid.
const seed = (sections: any[], pages: any[]) => {
    const tm = new TranslationManager();
    (tm as any).sections = sections;
    (tm as any).pages = pages;
    return tm;
};

describe('TranslationManager.extractContentTranslations — newer item modules', () => {
    it('extracts strings from Hero (headline/subtitle/tagline) but not from image/color fields', () => {
        const tm = seed([{
            id: 's1', type: 1, page: 'Home',
            content: [{
                type: EItemType.Hero,
                content: JSON.stringify({
                    headline: 'Gatis Priede',
                    subtitle: 'Digital Solutions Architect',
                    tagline: 'Everything is possible.',
                    bgImage: 'api/hero.jpg',
                    accent: '#1677ff',
                }),
            }],
        }], []);
        const t = tm.getTranslations();
        expect(t['Gatis Priede']).toBe('Gatis Priede');
        expect(t['Digital solutions architect']).toBeUndefined(); // not this exact form
        expect(t['Digital Solutions Architect']).toBe('Digital Solutions Architect');
        expect(t['Everything is possible.']).toBe('Everything is possible.');
        // Image and colour are not translatable.
        expect(Object.values(t)).not.toContain('api/hero.jpg');
        expect(Object.values(t)).not.toContain('#1677ff');
    });

    it('extracts strings from ProjectCard (title, description, tags, link labels)', () => {
        const tm = seed([{
            id: 's1', type: 1, page: 'Projects',
            content: [{
                type: EItemType.ProjectCard,
                content: JSON.stringify({
                    title: 'SciChart',
                    description: 'High-performance charts',
                    image: 'api/sc.png',
                    tags: ['TypeScript', 'WebGL'],
                    primaryLink: {url: 'https://scichart.com', label: 'Visit site'},
                    secondaryLink: {url: 'https://github.com/abc', label: 'Source'},
                }),
            }],
        }], []);
        const t = tm.getTranslations();
        expect(t['SciChart']).toBe('SciChart');
        expect(t['High-performance charts']).toBe('High-performance charts');
        expect(t['TypeScript']).toBe('TypeScript');
        expect(t['WebGL']).toBe('WebGL');
        expect(t['Visit site']).toBe('Visit site');
        expect(t['Source']).toBe('Source');
    });

    it('extracts category + items from SkillPills', () => {
        const tm = seed([{
            id: 's1', type: 1, page: 'Home',
            content: [{
                type: EItemType.SkillPills,
                content: JSON.stringify({category: 'Tech stack', items: ['AI', 'Azure', 'AWS']}),
            }],
        }], []);
        const t = tm.getTranslations();
        expect(t['Tech stack']).toBe('Tech stack');
        expect(t['AI']).toBe('AI');
        expect(t['Azure']).toBe('Azure');
        expect(t['AWS']).toBe('AWS');
    });

    it('extracts entry fields + achievements from Timeline', () => {
        const tm = seed([{
            id: 's1', type: 1, page: 'Home',
            content: [{
                type: EItemType.Timeline,
                content: JSON.stringify({
                    entries: [{
                        start: '1/2024', end: 'present', company: 'SciChart', role: 'Consultant',
                        location: 'Latvia, Riga',
                        achievements: ['Extensive AI knowledge', 'Custom architecture'],
                    }],
                }),
            }],
        }], []);
        const t = tm.getTranslations();
        expect(t['SciChart']).toBe('SciChart');
        expect(t['Consultant']).toBe('Consultant');
        expect(t['present']).toBe('present');
        expect(t['Latvia, Riga']).toBe('Latvia, Riga');
        expect(t['Extensive AI knowledge']).toBe('Extensive AI knowledge');
        expect(t['Custom architecture']).toBe('Custom architecture');
    });

    it('extracts SocialLinks labels (platform + url ignored)', () => {
        const tm = seed([{
            id: 's1', type: 1, page: 'Contacts',
            content: [{
                type: EItemType.SocialLinks,
                content: JSON.stringify({
                    links: [
                        {platform: 'linkedin', url: 'https://linkedin.com/in/x', label: 'LinkedIn profile'},
                        {platform: 'email', url: 'mailto:x@y.com'},
                    ],
                }),
            }],
        }], []);
        const t = tm.getTranslations();
        expect(t['LinkedIn profile']).toBe('LinkedIn profile');
        // URLs and platform ids must never be registered.
        expect(Object.values(t)).not.toContain('https://linkedin.com/in/x');
        expect(Object.values(t)).not.toContain('mailto:x@y.com');
        expect(Object.values(t)).not.toContain('linkedin');
    });

    it('extracts BlogFeed heading', () => {
        const tm = seed([{
            id: 's1', type: 1, page: 'Home',
            content: [{
                type: EItemType.BlogFeed,
                content: JSON.stringify({heading: 'Latest writing', limit: 3, tag: ''}),
            }],
        }], []);
        const t = tm.getTranslations();
        expect(t['Latest writing']).toBe('Latest writing');
        expect(Object.values(t)).not.toContain(3);
    });
});
