import React from 'react';
import {Segmented} from 'antd';
import {useTranslation} from 'react-i18next';
import {useAdminMode} from '@admin/lib/adminMode';

/**
 * Top-bar admin UI mode switcher. Visible only to advanced-mode users
 * — simplified-mode users don't see the toggle (per
 * `docs/features/platform/admin-ui-modes.md`).
 *
 * Renders nothing while the initial fetch is in flight (mode === null).
 * Once resolved, advanced-mode users get a two-segment selector;
 * flipping to simplified hides the switcher on next render so the user
 * needs to either stay advanced or have an admin reset their preference.
 */
const AdminModeSwitcher: React.FC = () => {
    const {t} = useTranslation();
    const {mode, setMode} = useAdminMode();

    if (mode === null) return null;
    if (mode !== 'advanced') return null;

    return (
        <Segmented
            size="small"
            value={mode}
            onChange={(v) => setMode(v as 'simplified' | 'advanced')}
            options={[
                {value: 'advanced', label: t('Advanced')},
                {value: 'simplified', label: t('Simplified')},
            ]}
            data-testid="admin-mode-switcher"
        />
    );
};

export default AdminModeSwitcher;
