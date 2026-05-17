/**
 * SystemPageDispatch `pageProps` channel contract.
 *
 * The pageProps channel was introduced 2026-05-17 so server-resolved
 * data (e.g. `/account/settings`'s customer profile + site flags) can
 * reach a locked smart-wrapper module without a client refetch. These
 * tests pin the wire contract:
 *
 *   1. pageProps is forwarded to every module's Display unchanged.
 *   2. Modules that ignore pageProps stay backwards-compatible (the
 *      original `{item, t, tApp, admin}` shape).
 *   3. Multiple modules in the same page receive the same pageProps
 *      reference (bag-of-properties — modules pick the keys they want).
 *
 * The dispatch is React + JSX so the test renders into the jsdom
 * environment vitest.config.ts pins for ui/client client-side tests.
 */
// @vitest-environment jsdom
import React from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {render, cleanup} from '@testing-library/react';
import {EItemType} from '@enums/EItemType';
import type {ISection} from '@interfaces/ISection';
import type {IItem} from '@interfaces/IItem';
import SystemPageDispatch from './SystemPageDispatch';

// Mock the registry so the test isolates the dispatch contract from
// the real module catalogue. Each registered Display is a vi.fn that
// records the props it received; the assertions then inspect those.
const recordedProps: Array<Record<string, unknown>> = [];

vi.mock('@client/modules/clientItemTypes', () => {
    const Probe: React.FC<Record<string, unknown>> = (props) => {
        recordedProps.push(props);
        return React.createElement('div', {
            'data-testid': 'probe',
            'data-item-type': String((props.item as IItem | undefined)?.type ?? ''),
        });
    };
    return {
        CLIENT_ITEM_TYPES: [
            {key: EItemType.Hero, Display: Probe},
            {key: EItemType.RichText, Display: Probe},
        ],
    };
});

const t: any = (s: string) => s;
const tApp: any = (s: string) => s;

function makeItem(type: EItemType): IItem {
    return {type, content: ''} as IItem;
}

function makeSection(items: IItem[]): ISection {
    return {
        id: `s-${items.map(i => String(i.type)).join('-')}`,
        type: items.length,
        content: items,
    } as ISection;
}

describe('SystemPageDispatch pageProps channel', () => {
    beforeEach(() => {
        recordedProps.length = 0;
        cleanup();
    });

    it('forwards pageProps unchanged to a single module', () => {
        const pageProps = {me: {id: 'u1', email: 'a@b'}, activeTab: 'profile', flag: true};
        render(React.createElement(SystemPageDispatch, {
            sections: [makeSection([makeItem(EItemType.Hero)])],
            t, tApp,
            pageProps,
        }));
        expect(recordedProps).toHaveLength(1);
        expect(recordedProps[0].pageProps).toBe(pageProps);
    });

    it('forwards the same pageProps reference to every module on the page', () => {
        const pageProps = {flag: true};
        render(React.createElement(SystemPageDispatch, {
            sections: [
                makeSection([makeItem(EItemType.Hero), makeItem(EItemType.RichText)]),
                makeSection([makeItem(EItemType.RichText)]),
            ],
            t, tApp,
            pageProps,
        }));
        expect(recordedProps).toHaveLength(3);
        for (const p of recordedProps) expect(p.pageProps).toBe(pageProps);
    });

    it('omits pageProps when the caller does not pass it (back-compat)', () => {
        render(React.createElement(SystemPageDispatch, {
            sections: [makeSection([makeItem(EItemType.Hero)])],
            t, tApp,
        }));
        expect(recordedProps).toHaveLength(1);
        expect(recordedProps[0].pageProps).toBeUndefined();
    });

    it('always passes the {item, t, tApp, admin} base props alongside pageProps', () => {
        const pageProps = {x: 1};
        render(React.createElement(SystemPageDispatch, {
            sections: [makeSection([makeItem(EItemType.Hero)])],
            t, tApp,
            pageProps,
        }));
        expect(recordedProps[0]).toMatchObject({
            t,
            tApp,
            admin: false,
            pageProps,
        });
        expect((recordedProps[0].item as IItem).type).toBe(EItemType.Hero);
    });
});
