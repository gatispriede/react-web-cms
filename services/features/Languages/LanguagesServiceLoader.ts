import {ServiceLoader} from '@services/infra/ServiceLoader';
import type {FeatureAuthzContribution, FeatureContext} from '@services/infra/featureManifest';
import type {FunctionalRoleDescriptor} from '@interfaces/IPermission';
import {LanguageService} from './LanguageService';
import {TranslationMetaService} from './TranslationMetaService';

/**
 * Languages Loader — Class Loader L3 migration of `languagesFeature`.
 *
 * Owns BOTH services in the `Languages/` folder. Same folder, same domain,
 * one loader. Each service is exposed under its own key on `featureServices`
 * so legacy getters on `MongoDBConnection` keep their semantics.
 *
 * `LanguageService` takes a `Collection` (not a `Db`) plus a `reconnect`
 * callback supplied via `ctx.reconnect` when `bootFeaturesSync` runs from
 * inside the connection's `setupClient`. Reaching back to
 * `getMongoConnection()` here would re-enter the still-running constructor.
 */
export class LanguagesServiceLoader extends ServiceLoader {
    readonly id = 'languages';
    readonly displayName = 'Languages & translations';
    readonly coreInfrastructure = true;

    buildServices(ctx: FeatureContext): Record<string, unknown> {
        return {
            languages: new LanguageService(ctx.db.collection('Languages'), ctx.reconnect),
            translationMeta: new TranslationMetaService(ctx.db),
        };
    }

    readonly schemaSDL = `extend type QueryMongo {
    getLanguages: [INewLanguage]
    getTranslationMeta: String!
}
extend type MutationMongo {
    addUpdateLanguage(language: InLanguage, translations: JSON, expectedVersion: Int): String!
    deleteLanguage(language: InLanguage): String!
    saveTranslationMeta(meta: JSON!, expectedVersion: Int): String!
}`;

    readonly authz: FeatureAuthzContribution = {
        mutationRequirements: {
            addUpdateLanguage: 'editor',
            deleteLanguage: 'editor',
            saveTranslationMeta: 'editor',
        },
        sessionInjected: [
            'addUpdateLanguage',
            'deleteLanguage',
            'saveTranslationMeta',
        ],
    };

    /**
     * `translator` functional role — assignable, scopes the user to
     * translation edits only (read-only across the rest of the system).
     * Per `docs/features/platform/edit-levels.md` (decision 4 + 8).
     *
     * The grant map is a hint surface for the admin UI; the actual
     * gating is implemented by `guardMethods` consulting this role plus
     * any resource-scoped `Permissions` rows. Existing
     * `siteFlags.inlineTranslationEdit` flag is replaced by a one-shot
     * migration that grants `translator` to every editor-rank user
     * (decision 8) — migration code lives in a follow-up commit.
     */
    readonly functionalRoles: readonly FunctionalRoleDescriptor[] = [
        {
            id: 'translator',
            displayName: 'Translator',
            assignable: true,
            grants: {
                translations: 'edit',
                'everything-else': 'read-only',
            },
        },
    ];
}
