import '@testing-library/jest-dom/vitest';

// Phase C.3 — feature manifests now own their authz/SDL contributions,
// and `composedAuthz()` only includes ENABLED features. Several
// e-commerce features (`products`, `cart`, `inventory`, `orders`,
// `mcp`) are default-OFF in `featureFlags.ts` so production deploys
// opt in explicitly. Unit tests for those features need them flipped
// ON before any module under test imports the feature registry —
// otherwise their `authz` blocks never reach `MUTATION_REQUIREMENTS`
// and authz integration tests see undefined entries.
process.env.FEATURE_PRODUCTS ??= 'true';
process.env.FEATURE_CART ??= 'true';
process.env.FEATURE_INVENTORY ??= 'true';
process.env.FEATURE_ORDERS ??= 'true';
process.env.FEATURE_MCP ??= 'true';

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
