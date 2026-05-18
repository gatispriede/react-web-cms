import React from 'react';
import {Switch} from 'antd';
import {useTranslation} from 'react-i18next';
import {BulbFilled, BulbOutlined} from '@client/lib/icons';
import {useAdminDarkMode} from '@admin/lib/adminDarkMode';

/**
 * Top-bar dark/light toggle — lives in the persistent admin top-top nav
 * (visible on every admin route, not just `/admin/build`).
 *
 * State lives in `@admin/lib/adminDarkMode` — a module-scoped store
 * (same pattern as `adminMode.ts`). That store is the single source of
 * truth: it persists to localStorage `admin.darkMode`, stamps
 * `data-admin-theme` on `<html>`, and notifies every subscriber. The
 * key consumer besides this toggle is `AdminApp`'s `ConfigProvider`,
 * which now re-renders its theme algorithm the instant the toggle
 * flips — no page reload needed (the pre-audit bug).
 *
 * Cross-tab sync is handled inside the store via a `storage` listener.
 */
const DarkModeSwitcher: React.FC = () => {
    const {t} = useTranslation();
    const {dark, setDark} = useAdminDarkMode();

    return (
        <Switch
            checked={dark}
            onChange={setDark}
            checkedChildren={<BulbFilled/>}
            unCheckedChildren={<BulbOutlined/>}
            aria-label={t('Toggle dark mode')}
            title={dark ? t('Switch to light mode') : t('Switch to dark mode')}
            data-testid="admin-dark-mode-switch"
            data-state={dark ? 'dark' : 'light'}
        />
    );
};

export default DarkModeSwitcher;
