/**
 * Unit tests for `tools/scripts/testid-coverage.mjs`.
 *
 * Project uses vitest for app tests, but this is a CLI tooling script
 * and shouldn't drag in vitest's runtime for an isolated check.
 * Node's built-in `node:test` runner is enough — invoke via
 * `node --test tools/scripts/testid-coverage.test.mjs`.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scanSource} from './testid-coverage.mjs';

// ─── Fixtures ────────────────────────────────────────────────────────

const BAD_FIXTURE = `
import React from 'react';
import {Button, Input, Modal, Drawer, Select} from 'antd';

export function BadPanel() {
    return (
        <div>
            <button onClick={() => {}}>Reserve</button>
            <Button onClick={() => {}}>Publish</Button>
            <Drawer onClose={() => {}}>contents</Drawer>
            <input onChange={() => {}} />
            <Select onChange={() => {}}><option value="a">A</option></Select>
            <div role="button" onClick={() => {}}>fake button</div>
        </div>
    );
}
`;

const GOOD_FIXTURE = `
import React from 'react';
import {Button, Input, Modal, Drawer, Select} from 'antd';

export function GoodPanel({id}) {
    return (
        <div>
            <button data-testid="listing-card-reserve" onClick={() => {}}>Reserve</button>
            <Button data-testid="release-publish" onClick={() => {}}>Publish</Button>
            <Drawer data-testid="release-detail-drawer" onClose={() => {}} />
            <input data-testid="saved-searches-input" onChange={() => {}} />
            <Select data-testid={\`shell-lang-select-\${id}\`} onChange={() => {}} />
            <div role="button" data-testid="cmdk-trigger" onClick={() => {}}>cmdk</div>
            <div>plain static text — no handler, no role</div>
            <span>also static</span>
        </div>
    );
}
`;

const NAMING_FIXTURE = `
import React from 'react';
export function Naming() {
    return (
        <button data-testid="cmdK-bar" onClick={() => {}}>x</button>
    );
}
`;

// ─── Tests ───────────────────────────────────────────────────────────

test('flags 6 interactive elements missing data-testid', () => {
    const {missing} = scanSource(BAD_FIXTURE);
    assert.equal(missing.length, 6, `expected 6 violations, got ${missing.length}`);
    const tags = missing.map((m) => m.tag).sort();
    assert.deepEqual(tags, ['Button', 'Drawer', 'Select', 'button', 'div', 'input']);
});

test('captures correct line numbers for violations', () => {
    const {missing} = scanSource(BAD_FIXTURE);
    for (const m of missing) {
        assert.ok(typeof m.line === 'number' && m.line > 0, `line is a positive number for <${m.tag}>`);
    }
});

test('does not flag elements that have data-testid (literal or dynamic)', () => {
    const {missing} = scanSource(GOOD_FIXTURE);
    assert.equal(missing.length, 0, `expected 0 violations, got ${missing.length}: ${JSON.stringify(missing)}`);
});

test('does not flag static non-interactive elements', () => {
    const src = `
        export function Static() {
            return (
                <div>
                    <p>just text</p>
                    <span>more text</span>
                    <h1>title</h1>
                    <img src="/x" alt="" />
                </div>
            );
        }
    `;
    const {missing} = scanSource(src);
    assert.equal(missing.length, 0);
});

test('flags role="button" on div even without handler? no — needs role-only', () => {
    const src = `
        export function R() { return <div role="button" data-testid="x-y" />; }
    `;
    const {missing} = scanSource(src);
    assert.equal(missing.length, 0);
});

test('flags role="tab" without data-testid', () => {
    const src = `
        export function R() { return <div role="tab">Tab</div>; }
    `;
    const {missing} = scanSource(src);
    assert.equal(missing.length, 1);
    assert.equal(missing[0].tag, 'div');
});

test('warns on bad naming convention (kebab-case)', () => {
    const {missing, naming} = scanSource(NAMING_FIXTURE);
    assert.equal(missing.length, 0);
    assert.equal(naming.length, 1);
    assert.equal(naming[0].value, 'cmdK-bar');
});

test('accepts well-formed kebab-case ids', () => {
    const src = `
        export function R() {
            return <button data-testid="feature-component-role" onClick={() => {}}>x</button>;
        }
    `;
    const {naming, missing} = scanSource(src);
    assert.equal(missing.length, 0);
    assert.equal(naming.length, 0);
});

test('treats any onXxx handler as interactive', () => {
    const src = `
        export function R() {
            return <CustomThing onSubmit={() => {}}>submit</CustomThing>;
        }
    `;
    const {missing} = scanSource(src);
    assert.equal(missing.length, 1);
    assert.equal(missing[0].tag, 'CustomThing');
});

test('Form.Item (member-expression JSX) is recognised', () => {
    const src = `
        import {Form} from 'antd';
        export function R() { return <Form.Item label="x"/>; }
    `;
    const {missing} = scanSource(src);
    assert.equal(missing.length, 1);
    assert.equal(missing[0].tag, 'Form.Item');
});
