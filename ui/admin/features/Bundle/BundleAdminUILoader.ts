import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {useTranslation} from 'react-i18next';
import BundleSettings from './Bundle';

/**
 * BundleSettings still takes a `t` prop (legacy signature). Wrap it in a
 * zero-prop component so the AdminPaneDescriptor can mount it through
 * the registry without prop plumbing. Eventually BundleSettings should
 * use `useTranslation` directly and drop the prop.
 */
const BundleSettingsHost: React.FC = () => {
    const {t} = useTranslation();
    return React.createElement(BundleSettings, {t: t as any});
};

export class BundleAdminUILoader extends AdminUILoader {
    readonly id = 'bundle';
    readonly displayName = 'Bundle';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'release/bundle',
        title: 'Bundle',
        route: '/admin/release/bundle',
        modes: {advanced: BundleSettingsHost},
    };
}
