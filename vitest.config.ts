import {defineConfig} from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
        environmentMatchGlobs: [
            ['src/frontend/**/*.{test,spec}.{ts,tsx}', 'jsdom'],
        ],
        setupFiles: ['vitest.setup.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: ['src/**/*.{ts,tsx}'],
            exclude: [
                'src/**/*.{test,spec}.{ts,tsx}',
                'src/frontend/gqty/**',
                'src/frontend/public/**',
                'src/**/*.d.ts',
            ],
        },
    },
});
