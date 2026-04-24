import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@client': path.resolve(__dirname, 'ui/client'),
            '@admin': path.resolve(__dirname, 'ui/admin'),
            '@shared': path.resolve(__dirname, 'shared'),
            '@services': path.resolve(__dirname, 'services'),
            '@interfaces': path.resolve(__dirname, 'shared/types'),
            '@enums': path.resolve(__dirname, 'shared/enums'),
            '@utils': path.resolve(__dirname, 'shared/utils'),
        },
    },
    test: {
        globals: true,
        environment: 'node',
        include: [
            'ui/client/**/*.{test,spec}.{ts,tsx}',
            'ui/admin/**/*.{test,spec}.{ts,tsx}',
            'services/**/*.{test,spec}.{ts,tsx}',
            'shared/**/*.{test,spec}.{ts,tsx}',
        ],
        environmentMatchGlobs: [
            ['ui/client/**/*.{test,spec}.{ts,tsx}', 'jsdom'],
            ['ui/admin/**/*.{test,spec}.{ts,tsx}', 'jsdom'],
        ],
        setupFiles: ['vitest.setup.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: ['ui/**/*.{ts,tsx}', 'services/**/*.{ts,tsx}', 'shared/**/*.{ts,tsx}'],
            exclude: [
                '**/*.{test,spec}.{ts,tsx}',
                'services/api/generated/**',
                'ui/client/public/**',
                '**/*.d.ts',
            ],
        },
    },
});
