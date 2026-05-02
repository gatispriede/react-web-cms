import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Alert, Button, Modal, Space, Typography, message} from 'antd';
import {useTranslation} from 'react-i18next';

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

interface RestartReason {
    source: string;
    detail: string;
    since: string;
    key?: string;
}

interface RestartStatus {
    bootId: string;
    uptimeMs: number;
    supervised: boolean;
    restartEnabled: boolean;
    reasons: RestartReason[];
}

async function fetchStatus(): Promise<RestartStatus | null> {
    try {
        const r = await fetch('/api/graphql', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({query: `{ mongo { getRestartStatus } }`}),
        });
        const json = await r.json();
        const raw = json?.data?.mongo?.getRestartStatus;
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

async function postRestart(): Promise<{ok: boolean; bootId?: string; error?: string}> {
    try {
        const r = await fetch('/api/graphql', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({query: `mutation { mongo { requestServerRestart } }`}),
        });
        const json = await r.json();
        if (json.errors?.length) return {ok: false, error: json.errors[0].message};
        const raw = json?.data?.mongo?.requestServerRestart;
        return raw ? JSON.parse(raw) : {ok: false, error: 'invalid response'};
    } catch (err) {
        return {ok: false, error: String(err)};
    }
}

/** Poll `/api/health` until `bootId` differs from `oldBootId` or timeout. */
async function waitForRestart(oldBootId: string, timeoutMs = 60_000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        await new Promise(r => setTimeout(r, 1000));
        try {
            const r = await fetch('/api/health', {cache: 'no-store'});
            if (r.ok) {
                const j = await r.json();
                if (j?.bootId && j.bootId !== oldBootId) return true;
            }
        } catch {
            // 503 / network drop while shutdown is in progress — keep polling.
        }
    }
    return false;
}

const RestartRequiredBanner: React.FC = () => {
    const {t} = useTranslation();
    const [status, setStatus] = useState<RestartStatus | null>(null);
    const [restarting, setRestarting] = useState(false);
    const pollRef = useRef<NodeJS.Timeout | null>(null);

    const refresh = useCallback(async () => {
        const s = await fetchStatus();
        setStatus(s);
    }, []);

    useEffect(() => {
        void refresh();
        // Light polling — pick up restart-required marks made by other
        // tabs / MCP without a manual refresh.
        pollRef.current = setInterval(() => { void refresh(); }, 15_000);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [refresh]);

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
                setRestarting(true);
                const result = await postRestart();
                if (!result.ok || !result.bootId) {
                    message.error(result.error ?? t('Restart failed'));
                    setRestarting(false);
                    return;
                }
                const oldBootId = result.bootId;
                message.loading({content: t('Restarting…'), key: 'restart', duration: 0});
                const back = await waitForRestart(oldBootId);
                if (back) {
                    message.success({content: t('Server restarted — reloading'), key: 'restart', duration: 2});
                    setTimeout(() => window.location.reload(), 800);
                } else {
                    message.error({content: t('Server did not return within 60 seconds — check the server logs'), key: 'restart', duration: 6});
                    setRestarting(false);
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
                <Button danger loading={restarting} onClick={onRestart}>
                    {t('Restart server')}
                </Button>
            }
        />
    );
};

export default RestartRequiredBanner;
