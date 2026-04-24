import React, {useEffect, useState} from 'react';
import {Select, Space, Typography} from 'antd';
import ThemeApi from '@services/api/client/ThemeApi';
import {applyThemeCssVars} from '@client/features/Themes/applyThemeCssVars';
import {ITheme} from '@interfaces/ITheme';

/**
 * Dropdown that swaps the active theme **client-side only** (no mutation).
 *
 * The admin modules-preview page uses this so an operator can eyeball every
 * module under every theme without a page reload — the whole point of the
 * preview matrix. It writes the selected theme's tokens via
 * `applyThemeCssVars` (same helper the public app uses on boot) so
 * `[data-theme-name="<slug>"]`-scoped SCSS kicks in instantly.
 *
 * On unmount we intentionally *don't* reset tokens — if the operator navigates
 * elsewhere the normal theme-load effect will pick up the server-side active
 * theme and replace whatever we left in place. Keeping state simple > a reset
 * that could flicker the page.
 */
export default function ThemeSwitcher({onThemeChange}: {
    onThemeChange?: (theme: ITheme | null) => void;
}) {
    const [themes, setThemes] = useState<ITheme[]>([]);
    const [selectedId, setSelectedId] = useState<string | undefined>();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const api = new ThemeApi();
        void (async () => {
            const [list, active] = await Promise.all([api.listThemes(), api.getActive()]);
            setThemes(list);
            if (active?.id) {
                setSelectedId(active.id);
                applyThemeCssVars(active.tokens);
                onThemeChange?.(active);
            }
            setLoading(false);
        })();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleChange = (id: string) => {
        const theme = themes.find((t) => t.id === id) ?? null;
        setSelectedId(id);
        applyThemeCssVars(theme?.tokens);
        onThemeChange?.(theme);
    };

    return (
        <Space align="center">
            <Typography.Text style={{fontSize: 12, opacity: 0.7}}>Theme</Typography.Text>
            <Select
                loading={loading}
                value={selectedId}
                onChange={handleChange}
                style={{minWidth: 220}}
                options={themes.map((t) => ({
                    value: t.id,
                    label: `${t.name}${t.custom ? ' (custom)' : ''}`,
                }))}
                placeholder="Pick a theme"
            />
        </Space>
    );
}
