// Flat config — ESLint v9. Initial rollout intent: most rules emit
// **warnings** so the wider codebase doesn't gate CI on day one. The
// only **error**-level rule is VM4 (no `useState` in
// `ui/admin/features/**`) — see `docs/features/platform/view-model-classes.md`.
//
// We intentionally keep the config small (one parser + a couple of
// targeted plugins) instead of pulling in `next/core-web-vitals`'s legacy
// shareable config; the latter is geared toward the eslintrc resolver and
// fights with flat config under TypeScript 6 + Next 16. Whatever is left
// out from `next/core-web-vitals` here is either covered by Next's own
// dev-server warnings or by the per-PR review surface.

import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

const SHARED_GLOBS = [
    'ui/**/*.{ts,tsx,js,jsx,mjs,cjs}',
    'services/**/*.{ts,tsx,js,jsx,mjs,cjs}',
    'shared/**/*.{ts,tsx,js,jsx,mjs,cjs}',
    'tests/**/*.{ts,tsx,js,jsx,mjs,cjs}',
    'tools/**/*.{ts,tsx,js,jsx,mjs,cjs}',
    'scripts/**/*.{ts,tsx,js,jsx,mjs,cjs}',
];

const IGNORES = [
    'node_modules/**',
    '.next/**',
    'ui/client/.next/**',
    'services/api/generated/**',
    'tests/e2e/visual/__snapshots__/**',
    'mongo_data/**',
    'uploads/**',
    'public/**',
    'var/**',
    'test-results/**',
    '**/*.min.js',
    '**/dist/**',
    '**/build/**',
];

// --- Flatten typescript-eslint's recommended rules to **warn** so the
// initial rollout doesn't gate CI on legacy violations. We pull the
// canonical recommended ruleset from the plugin's own config object.
function asWarnings(rulesObj) {
    const out = {};
    for (const [k, v] of Object.entries(rulesObj ?? {})) {
        if (Array.isArray(v)) {
            const [, ...rest] = v;
            out[k] = ['warn', ...rest];
        } else if (v === 'error' || v === 2) {
            out[k] = 'warn';
        } else if (v === 'off' || v === 0) {
            out[k] = 'off';
        } else {
            // Already 'warn' or unknown — pass through.
            out[k] = v;
        }
    }
    return out;
}

const tsRecommendedRules = asWarnings(tsPlugin.configs?.recommended?.rules ?? {});
const reactRecommendedRules = asWarnings(reactPlugin.configs?.recommended?.rules ?? {});
const reactHooksRecommendedRules = asWarnings(reactHooksPlugin.configs?.recommended?.rules ?? {});

export default [
    {ignores: IGNORES},
    {
        files: SHARED_GLOBS,
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                ecmaFeatures: {jsx: true},
            },
            globals: {
                window: 'readonly',
                document: 'readonly',
                console: 'readonly',
                process: 'readonly',
                Buffer: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                module: 'readonly',
                require: 'readonly',
                exports: 'readonly',
                global: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                fetch: 'readonly',
                URL: 'readonly',
                URLSearchParams: 'readonly',
            },
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
            react: reactPlugin,
            'react-hooks': reactHooksPlugin,
        },
        settings: {
            react: {version: 'detect'},
        },
        rules: {
            ...tsRecommendedRules,
            ...reactRecommendedRules,
            ...reactHooksRecommendedRules,
            // React 17+ JSX transform — no need to import React in scope.
            'react/react-in-jsx-scope': 'off',
            // Class-based VMs use property initializers + Proxy auto-bind;
            // prop-types are TS-typed.
            'react/prop-types': 'off',
            // Project preference — `any` shows up enough in legacy code that
            // erroring would explode the warning count above the noise floor.
            '@typescript-eslint/no-explicit-any': 'off',
            // Same — unused vars are common in WIP and partial migrations.
            '@typescript-eslint/no-unused-vars': 'warn',
            // Carry forward the icon-consolidation bans from the legacy
            // package.json eslintConfig — see docs/roadmap/icon-consolidation.md.
            // Demoted to warn during the flat-config migration so the wider
            // codebase doesn't gate CI on day one.
            'no-restricted-imports': ['warn', {
                paths: [
                    {
                        name: 'styled-icons',
                        message: 'styled-icons was dropped — pick a lucide-react equivalent. See roadmap/icon-consolidation.md.',
                    },
                    {
                        name: '@ant-design/icons',
                        message: 'Direct imports from @ant-design/icons are forbidden — import the same name from ui/client/lib/icons (lucide adapter). See docs/roadmap/icon-consolidation.md.',
                    },
                    {
                        name: 'antd',
                        importNames: ['message'],
                        message: 'AntD `message` is banned — use the Sonner wrappers in ui/admin/lib/notify.ts (notifySuccess / notifyError / notifyPromise / notifyDestructive). See docs/roadmap/admin/admin-toast-system-sonner.md.',
                    },
                ],
                patterns: [
                    {
                        group: ['styled-icons/*', '@styled-icons/*'],
                        message: 'styled-icons was dropped — pick a lucide-react equivalent. See roadmap/icon-consolidation.md.',
                    },
                    {
                        group: ['@ant-design/icons/*'],
                        message: 'Direct imports from @ant-design/icons are forbidden — import the same name from ui/client/lib/icons (lucide adapter). See docs/roadmap/icon-consolidation.md.',
                    },
                ],
            }],
        },
    },
    // VM4 — error-level rule banning `useState` in admin feature panes.
    // The expectation (per `docs/features/platform/view-model-classes.md`)
    // is that every pane owns a `<Feature>ViewModel.ts` instead. AntD
    // `Form.useForm` and other hooks are unaffected; only `useState` from
    // `react` is banned.
    {
        files: ['ui/admin/features/**/*.{ts,tsx}'],
        rules: {
            'no-restricted-imports': ['error', {
                paths: [
                    {
                        name: 'react',
                        importNames: ['useState'],
                        message: 'useState is banned in admin features. Use a <Feature>ViewModel.ts wrapped with observable() instead. See docs/features/platform/view-model-classes.md.',
                    },
                    {
                        name: 'antd',
                        importNames: ['message'],
                        message: 'AntD `message` is banned — use the Sonner wrappers in ui/admin/lib/notify.ts (notifySuccess / notifyError / notifyPromise / notifyDestructive). See docs/roadmap/admin/admin-toast-system-sonner.md.',
                    },
                ],
            }],
        },
    },
    // AUI hierarchy (2026-05-07) — simplified base must NOT depend on
    // advanced. Lazy-load + one-way composition lets simplified-mode
    // users skip the advanced bundle entirely. Re-states VM4's bans
    // (useState, AntD `message`) because this block overrides
    // `no-restricted-imports` for `*SimplifiedView.{ts,tsx}` and ESLint
    // rule entries don't merge — the last config wins, in full.
    // See `docs/architecture/aui-mode.md`.
    {
        files: ['ui/admin/features/**/*SimplifiedView.{ts,tsx}'],
        rules: {
            'no-restricted-imports': ['error', {
                paths: [
                    {
                        name: 'react',
                        importNames: ['useState'],
                        message: 'useState is banned in admin features. Use a <Feature>ViewModel.ts wrapped with observable() instead. See docs/features/platform/view-model-classes.md.',
                    },
                    {
                        name: 'antd',
                        importNames: ['message'],
                        message: 'AntD `message` is banned — use the Sonner wrappers in ui/admin/lib/notify.ts (notifySuccess / notifyError / notifyPromise / notifyDestructive). See docs/roadmap/admin/admin-toast-system-sonner.md.',
                    },
                ],
                patterns: [
                    {
                        group: ['**/*AdvancedView', '**/*AdvancedView.tsx', '**/*AdvancedView.ts'],
                        message: 'Simplified views must NOT import Advanced views — the dependency is one-way (advanced composes simplified). See docs/architecture/aui-mode.md.',
                    },
                ],
            }],
        },
    },
];
