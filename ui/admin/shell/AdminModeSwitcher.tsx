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
 *
 * After a successful flip, hard-reload the page. Per-loader `modes`
 * dispatch is read once at component mount (the loader registry maps
 * `pane.modes.simplified ?? pane.modes.advanced` at construction
 * time), so a soft mode change leaves stale variants on screen until
 * the next route navigation. A reload is the simplest path to the
 * correct paint without threading a "remount everything" signal
 * through every loader.
 */
const AdminModeSwitcher: React.FC = () => {
    const {t} = useTranslation();
    const {mode, setMode} = useAdminMode();
    const effective = mode ?? 'advanced';

    const handleChange = async (v: 'simplified' | 'advanced') => {
        if (v === effective) return;
        await setMode(v);
        if (typeof window !== 'undefined') {
            window.location.reload();
        }
    };

    return (
        <Segmented
            size="small"
            value={effective}
            onChange={(v) => { void handleChange(v as 'simplified' | 'advanced'); }}
            options={[
                {value: 'advanced', label: t('Advanced')},
                {value: 'simplified', label: t('Simplified')},
            ]}
            data-testid="admin-mode-switcher"
        />
    );
};

export default AdminModeSwitcher;
