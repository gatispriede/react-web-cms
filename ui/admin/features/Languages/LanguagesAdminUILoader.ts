import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {useTranslation} from 'react-i18next';
import TranslationManager from '@admin/shell/TranslationManager';
import AdminSettingsLanguages from './Languages';

/**
 * Translations pane — registered through L4 with a thin host wrapper
 * that builds the `TranslationManager` + i18n props the underlying
 * component still expects. VM3 migration is a follow-up; the host
 * shape lets the registry own the route now.
 */
const TranslationsHost: React.FC = () => {
    const {t, i18n} = useTranslation('common');
    return React.createElement(AdminSettingsLanguages, {
        translationManager: new TranslationManager(),
        i18n,
        tAdmin: t as any,
    });
};

export class LanguagesAdminUILoader extends AdminUILoader {
    readonly id = 'translations';
    readonly displayName = 'Translations';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'content/translations',
        title: 'Translations',
        route: '/admin/content/translations',
        modes: {advanced: TranslationsHost},
    };
}
