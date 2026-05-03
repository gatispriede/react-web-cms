import type {Db} from 'mongodb';
import {log} from '@services/infra/logger';

/**
 * One-shot i18n grant migration — switches the site from the legacy
 * `siteFlags.inlineTranslationEdit` boolean to per-user `translator`
 * functional-role assignments.
 *
 * Per `docs/features/platform/edit-levels.md` (decision 8): the global
 * flag is replaced by a per-user role so an admin can grant or revoke
 * inline-translation rights without flipping it for every editor at
 * once. The migration is idempotent — already-translator users are
 * skipped, and once the flag is dropped the next boot's call short-
 * circuits with no work.
 *
 * Runs from `LanguagesServiceLoader.onBoot` in registry order so the
 * migration completes before request serving begins. Failures are
 * logged but do NOT abort boot — translation editing simply continues
 * to gate on the legacy flag until an operator looks at the logs.
 */

const SITE_FLAGS_KEY = 'siteFlags';
const TRANSLATOR_ROLE = 'translator';

interface UserDocLike {
    _id?: unknown;
    role?: string;
    functionalRoles?: string[];
}

/**
 * @returns the count of users that received the role on this run (0 if
 * the flag was already off, or every editor was already a translator).
 */
export async function runI18nGrantMigration(db: Db): Promise<number> {
    const settings = db.collection('SiteSettings');
    const flagsDoc = await settings.findOne({key: SITE_FLAGS_KEY});
    const flags = (flagsDoc as any)?.value as {inlineTranslationEdit?: boolean} | undefined;
    if (!flags || flags.inlineTranslationEdit !== true) {
        // Flag off (or absent) → nothing to migrate. Idempotent re-run path.
        return 0;
    }

    const users = db.collection<UserDocLike>('User');
    const editors = await users.find({role: 'editor'}).toArray();

    let granted = 0;
    for (const user of editors) {
        const current: string[] = Array.isArray(user.functionalRoles) ? user.functionalRoles : [];
        if (current.includes(TRANSLATOR_ROLE)) continue;
        const next = [...current, TRANSLATOR_ROLE];
        await users.updateOne(
            {_id: user._id},
            {$set: {functionalRoles: next}},
        );
        granted += 1;
    }

    // Drop the legacy flag once every editor is migrated. Done last so a
    // crash mid-loop leaves the flag ON and the next boot retries from
    // the top — deterministic recovery.
    await settings.updateOne(
        {key: SITE_FLAGS_KEY},
        {$set: {'value.inlineTranslationEdit': false}},
    );

    log.info(
        {scope: 'languages.i18nGrantMigration', granted, totalEditors: editors.length},
        'i18n grant migration applied — translator role granted, inlineTranslationEdit flag dropped',
    );
    return granted;
}
