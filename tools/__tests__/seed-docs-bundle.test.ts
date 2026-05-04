import {describe, it, expect} from 'vitest';
 
const {mdToHtml, buildBundle} = require('../seed-docs-bundle.js');

describe('seed-docs-bundle: mdToHtml', () => {
    it('preserves headings, paragraphs, and bullet lists in a round-trip-recoverable form', () => {
        const md = [
            '# Title',
            '',
            'A short paragraph with `code` and **bold**.',
            '',
            '## Subhead',
            '',
            '- one',
            '- two',
            '- three',
            '',
            'Another paragraph.',
        ].join('\n');
        const html = mdToHtml(md);
        // Heading levels recoverable
        expect(html).toMatch(/<h1>Title<\/h1>/);
        expect(html).toMatch(/<h2>Subhead<\/h2>/);
        // Paragraphs intact
        expect(html).toMatch(/<p>A short paragraph with <code>code<\/code> and <strong>bold<\/strong>\.<\/p>/);
        expect(html).toMatch(/<p>Another paragraph\.<\/p>/);
        // Bulleted list with all items
        expect(html).toMatch(/<ul><li>one<\/li><li>two<\/li><li>three<\/li><\/ul>/);
    });

    it('escapes raw HTML so authored angle brackets do not break the renderer', () => {
        const html = mdToHtml('A `<script>` tag should be escaped.');
        expect(html).not.toMatch(/<script>/);
        expect(html).toMatch(/&lt;script&gt;/);
    });

    it('emits fenced code blocks with language class', () => {
        const html = mdToHtml('```js\nconst x = 1;\n```');
        expect(html).toMatch(/<pre><code class="language-js">const x = 1;<\/code><\/pre>/);
    });
});

describe('seed-docs-bundle: buildBundle', () => {
    it('produces a v1 bundle with one page, one section and one RichText item per input page', () => {
        const bundle = buildBundle([
            {slug: 'setup', page: 'Docs Setup', title: 'Setup', html: '<h1>Setup</h1><p>x</p>'},
        ]);
        expect(bundle.manifest.version).toBe(1);
        expect(bundle.site.navigation).toHaveLength(1);
        expect(bundle.site.sections).toHaveLength(1);

        const nav = bundle.site.navigation[0];
        expect(nav.page).toBe('Docs Setup');
        expect(nav.sections).toEqual(['docs-sec-setup']);

        const section = bundle.site.sections[0];
        expect(section.id).toBe('docs-sec-setup');
        expect(section.type).toBe(1);
        expect(section.slots).toEqual([1]);
        expect(section.content).toHaveLength(1);
        expect(section.content[0].type).toBe('RICH_TEXT');
        const parsed = JSON.parse(section.content[0].content);
        expect(parsed.value).toBe('<h1>Setup</h1><p>x</p>');
    });
});
