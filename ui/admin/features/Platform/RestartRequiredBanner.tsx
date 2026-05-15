import React, {useEffect, useRef} from 'react';
import {Alert, Button, Modal, Space, Typography} from 'antd';
import {toast} from 'sonner';
import {notifyError} from '@admin/lib/notify';
import {useTranslation} from 'react-i18next';
import {useViewModel} from '@client/lib/state/observable';
import {RestartRequiredBannerViewModel, postRestart, waitForRestart} from './RestartRequiredBannerViewModel';

/**
 * Restart-required banner — surfaces the runtime restart-reason registry
 * (`services/infra/restartRequired.ts`) and offers a one-click restart
 * when the server is supervised.
 *
 * Per `docs/features/platform/server-restart.md`:
 *   - Reads `mongo.getRestartStatus` on mount + after every flag flip.
 *   - When `reasons.length > 0`, renders the banner.
 *   - When `supervised && restartEnabled`, the button is active. Otherwise
 *     it's swapped for a manual-restart hint.
 *   - Click flow: confirm modal → `requestServerRestart` → poll
 *     `/api/health` until `bootId` changes → reload the admin page.
 */

const RestartRequiredBanner: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new RestartRequiredBannerViewModel());
    const pollRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        void vm.refresh();
        // Light polling — pick up restart-required marks made by other
        // tabs / MCP without a manual refresh.
        pollRef.current = setInterval(() => { void vm.refresh(); }, 15_000);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [vm]);

    const status = vm.status;
    if (!status || status.reasons.length === 0) return null;

    const onRestart = () => {
        Modal.confirm({
            title: t('Restart server?'),
            content: (
                <Space direction="vertical" size={8}>
                    <Typography.Text>{t('The server will cycle. Existing requests drain (~5s); new requests queue until the new process is up.')}</Typography.Text>
                    <Typography.Text strong>{t('Pending reasons:')}</Typography.Text>
                    {(status.reasons ?? []).map(r => (
                        <Typography.Text key={`${r.source}:${r.key ?? r.detail}`} type="secondary">
                            • [{r.source}] {r.detail}
                        </Typography.Text>
                    ))}
                </Space>
            ),
            okText: t('Restart now'),
            okButtonProps: {danger: true},
            cancelText: t('Cancel'),
            onOk: async () => {
                vm.setRestarting(true);
                const result = await postRestart();
                if (!result.ok || !result.bootId) {
                    notifyError(result.error ?? t('Restart failed'));
                    vm.setRestarting(false);
                    return;
                }
                const oldBootId = result.bootId;
                const toastId = toast.loading(t('Restarting…'));
                const back = await waitForRestart(oldBootId);
                if (back) {
                    toast.success(t('Server restarted — reloading'), {id: toastId, duration: 2000});
                    setTimeout(() => window.location.reload(), 800);
                } else {
                    toast.error(t('Server did not return within 60 seconds — check the server logs'), {id: toastId, duration: 6000});
                    vm.setRestarting(false);
                }
            },
        });
    };

    const headline = t('Restart required to apply pending changes.');
    const subline = status.reasons
        .map(r => r.detail)
        .filter(Boolean)
        .slice(0, 4)
        .join(' · ');

    if (!status.supervised || !status.restartEnabled) {
        return (
            <Alert
                type="warning"
                showIcon
                style={{marginBottom: 12}}
                message={headline}
                description={
                    <Space direction="vertical" size={4}>
                        <Typography.Text>{subline}</Typography.Text>
                        <Typography.Text type="secondary">
                            {!status.supervised
                                ? t('Server is not running under a supervisor — restart manually (re-run `npm run dev` or your process manager).')
                                : t('Restart-from-UI is disabled (SERVER_RESTART_ENABLED=false). Restart the process directly.')}
                        </Typography.Text>
                    </Space>
                }
            />
        );
    }

    return (
        <Alert
            type="warning"
            showIcon
            style={{marginBottom: 12}}
            message={headline}
            description={<Typography.Text>{subline}</Typography.Text>}
            action={
                <Button danger loading={vm.restarting} onClick={onRestart}>
                    {t('Restart server')}
                </Button>
            }
        />
    );
};

export default RestartRequiredBanner;
