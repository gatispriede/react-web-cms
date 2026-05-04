import React from 'react';
import {Segmented} from 'antd';
import {useTranslation} from 'react-i18next';
import {useAdminMode} from '@admin/lib/adminMode';

/**
 * Top-bar admin UI mode switcher — visible on every admin route. Both
 * modes can flip back to the other side (the older "advanced-only"
 * gate hid the toggle from simplified users, which left them stuck;
 * user feedback 2026-05-03: "simplified version feature ... need to
 * go to to very top top").
 *
 * Defaults to `advanced` while the initial fetch is in flight so the
 * toggle paints immediately instead of flashing in late.
 */
const AdminModeSwitcher: React.FC = () => {
    const {t} = useTranslation();
    const {mode, setMode} = useAdminMode();
    const effective = mode ?? 'advanced';

    return (
        <Segmented
            size="small"
            value={effective}
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
