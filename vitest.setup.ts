import '@testing-library/jest-dom/vitest';

// jsdom doesn't ship ResizeObserver. antd v6 / rc-component pull it in
// through layout-effect hooks (Space.Compact, Form items, dropdowns), so a
// polyfill is required for any component test that mounts antd chrome.
if (typeof globalThis.ResizeObserver === 'undefined') {
    class ResizeObserverStub {
        observe() {}
        unobserve() {}
        disconnect() {}
    }
    // @ts-expect-error — minimal stub, sufficient for layout-effect bail-outs.
    globalThis.ResizeObserver = ResizeObserverStub;
}

// rc-virtual-list / rc-overflow query matchMedia at mount time.
if (typeof globalThis.matchMedia === 'undefined') {
    // @ts-expect-error — minimal stub.
    globalThis.matchMedia = (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    });
}
