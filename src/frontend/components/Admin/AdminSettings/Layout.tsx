import React, {useCallback, useEffect, useState} from "react";
import {Alert, Card, Radio, Space, Typography, message} from "antd";
import {useTranslation} from "next-i18next";
import SiteFlagsApi from "../../../api/SiteFlagsApi";

const siteFlagsApi = new SiteFlagsApi();

/**
 * Site settings → Layout tab. Switches the public render between the
 * classic tabs layout and a single-page scroll layout where every page
 * becomes an anchored `<section>` on `/`.
 */
const AdminSettingsLayout: React.FC = () => {
    const {t} = useTranslation('common');
    const [mode, setMode] = useState<'tabs' | 'scroll'>('tabs');
    const [loading, setLoading] = useState(false);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const flags = await siteFlagsApi.get();
            setMode((flags as any).layoutMode === 'scroll' ? 'scroll' : 'tabs');
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { void refresh(); }, [refresh]);

    const change = async (next: 'tabs' | 'scroll') => {
        const prev = mode;
        setMode(next);
        const result = await siteFlagsApi.save({layoutMode: next} as any);
        if ((result as any).error) {
            setMode(prev);
            message.error((result as any).error);
        } else {
            message.success(t('Layout mode saved'));
        }
    };

    return (
        <div style={{padding: 16, maxWidth: 720}}>
            <Alert
                type="info"
                showIcon
                style={{marginBottom: 16}}
                message={t('Pick how visitors move between pages. Both modes share the same content — only the render differs.')}
            />
            <Radio.Group value={mode} onChange={e => change(e.target.value)} disabled={loading} style={{width: '100%'}}>
                <Space direction="vertical" style={{width: '100%'}}>
                    <Card hoverable style={{border: mode === 'tabs' ? '2px solid var(--theme-colorPrimary, #1677ff)' : undefined}}>
                        <Radio value="tabs">
                            <Typography.Text strong>{t('Tabs')}</Typography.Text>
                            <div style={{marginTop: 4}}>
                                <Typography.Text type="secondary">
                                    {t('Classic layout — clicking a nav item loads that page as its own URL.')}
                                </Typography.Text>
                            </div>
                        </Radio>
                    </Card>
                    <Card hoverable style={{border: mode === 'scroll' ? '2px solid var(--theme-colorPrimary, #1677ff)' : undefined}}>
                        <Radio value="scroll">
                            <Typography.Text strong>{t('Single-page scroll')}</Typography.Text>
                            <div style={{marginTop: 4}}>
                                <Typography.Text type="secondary">
                                    {t('All pages stacked on one URL. Clicking a nav item smooth-scrolls to the matching section; hash URLs stay shareable.')}
                                </Typography.Text>
                            </div>
                        </Radio>
                    </Card>
                </Space>
            </Radio.Group>
        </div>
    );
};

export default AdminSettingsLayout;
