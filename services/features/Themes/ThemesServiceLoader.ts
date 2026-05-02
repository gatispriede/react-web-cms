import {ServiceLoader} from '@services/infra/ServiceLoader';
import type {FeatureAuthzContribution, FeatureContext} from '@services/infra/featureManifest';
import {ThemeService} from './ThemeService';
import {log} from '@services/infra/logger';

/**
 * Themes Loader — Class Loader L3 migration of `themesFeature`.
 *
 * Owns `ThemeService` (Themes + SiteSettings collections). Seeds defaults
 * via the `onBoot` hook so the seed lifecycle stays co-located with the
 * service. ThemeService has its own static-flag idempotency guard so
 * `onBoot` is safe to run repeatedly (e.g. on a `setupClient` reconnect).
 */
export class ThemesServiceLoader extends ServiceLoader {
    readonly id = 'themes';
    readonly displayName = 'Themes';
    readonly coreInfrastructure = true;

    buildServices(ctx: FeatureContext): Record<string, unknown> {
        return {themes: new ThemeService(ctx.db)};
    }

    readonly schemaSDL = `extend type QueryMongo {
    getThemes: String!
    getActiveTheme: String
}
extend type MutationMongo {
    saveTheme(theme: JSON!, expectedVersion: Int): String!
    deleteTheme(id: String!): String!
    setActiveTheme(id: String!): String!
    resetPreset(id: String!): String!
}`;

    readonly authz: FeatureAuthzContribution = {
        mutationRequirements: {
            saveTheme: 'editor',
            deleteTheme: 'editor',
            setActiveTheme: 'editor',
            resetPreset: 'editor',
        },
        sessionInjected: [
            'saveTheme',
            'deleteTheme',
            'setActiveTheme',
            'resetPreset',
        ],
    };

    async onBoot(ctx: FeatureContext): Promise<void> {
        const themes = ctx.services.themes as ThemeService | undefined;
        if (!themes) return;
        try {
            await themes.seedIfEmpty();
        } catch (err) {
            log.error({scope: 'themes.seed', err}, 'theme seed failed');
        }
    }
}
