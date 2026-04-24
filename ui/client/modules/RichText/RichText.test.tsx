// @vitest-environment jsdom
import React from 'react';
import {describe, it, expect} from 'vitest';
import {render, waitFor} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import RichText from './RichText';
import {EItemType} from '@enums/EItemType';
import type {IRichText} from './RichText.types';

const t = ((k: string) => k) as any;

describe('RichText render', () => {
    it('injects sanitized translated HTML into the content ref', async () => {
        const fixture: IRichText = {value: '<p>Hello <b>world</b></p>'};
        const {container} = render(
            <RichText
                item={{type: EItemType.RichText, content: JSON.stringify(fixture), style: 'default'}}
                t={t}
                tApp={t}
            />,
        );
        const wrapper = container.querySelector('.rich-text');
        expect(wrapper).not.toBeNull();
        // useEffect injects innerHTML — wait for the DOM to reflect it.
        await waitFor(() => {
            const inner = wrapper!.querySelector('div');
            expect(inner?.innerHTML).toContain('<b>world</b>');
        });
    });

    it('empty value: renders wrapper without inner markup', async () => {
        const fixture: IRichText = {value: ''};
        const {container} = render(
            <RichText
                item={{type: EItemType.RichText, content: JSON.stringify(fixture)}}
                t={t}
                tApp={t}
            />,
        );
        const wrapper = container.querySelector('.rich-text');
        expect(wrapper).not.toBeNull();
        await waitFor(() => {
            const inner = wrapper!.querySelector('div');
            expect(inner).not.toBeNull();
            expect(inner!.innerHTML).toBe('');
        });
    });

    it('sanitizes script tags from authored HTML', async () => {
        const fixture: IRichText = {value: '<p>ok</p><script>alert(1)</script>'};
        const {container} = render(
            <RichText
                item={{type: EItemType.RichText, content: JSON.stringify(fixture)}}
                t={t}
                tApp={t}
            />,
        );
        await waitFor(() => {
            const inner = container.querySelector('.rich-text div');
            expect(inner?.innerHTML ?? '').not.toMatch(/<script/i);
        });
    });
});
