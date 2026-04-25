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
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof globalThis.ResizeObserver;
}

// rc-virtual-list / rc-overflow query matchMedia at mount time.
if (typeof globalThis.matchMedia === 'undefined') {
    globalThis.matchMedia = ((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    })) as typeof globalThis.matchMedia;
}
