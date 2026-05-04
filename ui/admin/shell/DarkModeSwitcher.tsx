import React, {useEffect, useState} from 'react';
import {Switch} from 'antd';
import {BulbFilled, BulbOutlined} from '@client/lib/icons';

const STORAGE_KEY = 'admin.darkMode';

/**
 * Top-bar dark/light toggle — moved out of the AdminApp secondary
 * header so it lives in the persistent admin top-top nav (visible on
 * every admin route, not just `/admin/build`).
 *
 * Single source of truth: localStorage `admin.darkMode`. The
 * `[data-admin-theme]` attribute on `documentElement` drives both
 * AntD `ConfigProvider` (read by `AdminApp` on mount) and the
 * `AdminDarkMode.scss` overrides for non-AntD chrome.
 *
 * Subscribes to `storage` events so flipping the toggle in one tab
 * propagates to other tabs immediately.
 */
const readSaved = (): boolean => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(STORAGE_KEY) === '1';
};

const apply = (on: boolean): void => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-admin-theme', on ? 'dark' : 'light');
};

const DarkModeSwitcher: React.FC = () => {
    const [dark, setDark] = useState<boolean>(false);

    useEffect(() => {
        const initial = readSaved();
        setDark(initial);
        apply(initial);
        const onStorage = (e: StorageEvent) => {
            if (e.key !== STORAGE_KEY) return;
            const next = e.newValue === '1';
            setDark(next);
            apply(next);
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    const toggle = (next: boolean) => {
        setDark(next);
        apply(next);
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
        }
    };

    return (
        <Switch
            checked={dark}
            onChange={toggle}
            checkedChildren={<BulbFilled/>}
            unCheckedChildren={<BulbOutlined/>}
            data-testid="admin-dark-mode-switch"
        />
    );
};

export default DarkModeSwitcher;
