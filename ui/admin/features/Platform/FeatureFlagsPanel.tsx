// eslint-disable-next-line no-restricted-imports -- VM3 migration deferred for this pane.
import React, {useCallback, useEffect, useState} from 'react';
import {Alert, Button, Card, Space, Switch, Table, Tag, Tooltip, Typography, message} from 'antd';
import {useTranslation} from 'react-i18next';
import {LockOutlined} from '@client/lib/icons';
import RestartRequiredBanner from './RestartRequiredBanner';

/**
 * Feature flags panel — `/admin/system/features`.
 *
 * v2 (2026-05-01): editable toggles. Reads `mongo.getFeatureFlags`
 * (resolved state per manifest), writes `mongo.setFeatureFlag` /
 * `clearFeatureFlag` to persist overrides. Resolution precedence is
 *   env var > mongo override > default
 * so an env-pinned feature stays pinned regardless of the toggle state
 * — the UI surfaces both signals.
 *
 * Boot-side caveat: features that are off at boot don't get their
 * services constructed, schema fields composed, or resolvers bound.
 * Toggling those back on via this UI takes effect for runtime gates
 * (route 404s, `isFeatureEnabled` checks) but the underlying schema /
 * services don't reappear until a server restart. The banner at the
 * top makes that clear.
 */

interface FlagRow {
    id: string;
    displayName: string;
    enabled: boolean;
    coreInfrastructure: boolean;
    requires: readonly string[];
    envKey: string;
    envSet: boolean;
    mongoOverride: boolean;
}

async function fetchFlags(): Promise<FlagRow[]> {
    const r = await fetch('/api/graphql', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({query: `{ mongo { getFeatureFlags } }`}),
    });
    const json = await r.json();
    try { return JSON.parse(json?.data?.mongo?.getFeatureFlags ?? '[]'); } catch { return []; }
}

async function setFlag(id: string, enabled: boolean): Promise<{ok: boolean; error?: string}> {
    const r = await fetch('/api/graphql', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            query: `mutation Set($id: String!, $enabled: Boolean!) { mongo { setFeatureFlag(id: $id, enabled: $enabled) } }`,
            variables: {id, enabled},
        }),
    });
    const json = await r.json();
    if (json.errors?.length) return {ok: false, error: json.errors[0].message};
    try {
        const parsed = JSON.parse(json?.data?.mongo?.setFeatureFlag ?? '{}');
        if (parsed?.error) return {ok: false, error: parsed.error};
        return {ok: true};
    } catch { return {ok: false, error: 'invalid response'}; }
}

async function clearFlag(id: string): Promise<{ok: boolean; error?: string}> {
    const r = await fetch('/api/graphql', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            query: `mutation Clear($id: String!) { mongo { clearFeatureFlag(id: $id) } }`,
            variables: {id},
        }),
    });
    const json = await r.json();
    if (json.errors?.length) return {ok: false, error: json.errors[0].message};
    return {ok: true};
}

const FeatureFlagsPanel: React.FC = () => {
    const {t} = useTranslation();
    const [rows, setRows] = useState<FlagRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [savingId, setSavingId] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        try { setRows(await fetchFlags()); } finally { setLoading(false); }
    }, []);

    useEffect(() => { void refresh(); }, [refresh]);

    const onToggle = async (row: FlagRow, next: boolean) => {
        setSavingId(row.id);
        try {
            const res = await setFlag(row.id, next);
            if (!res.ok) { message.error(res.error ?? t('Save failed')); return; }
            message.success(next ? t('{{name}} enabled', {name: row.displayName}) : t('{{name}} disabled', {name: row.displayName}));
            await refresh();
        } finally { setSavingId(null); }
    };

    const onReset = async (row: FlagRow) => {
        setSavingId(row.id);
        try {
            const res = await clearFlag(row.id);
            if (!res.ok) { message.error(res.error ?? t('Reset failed')); return; }
            message.success(t('Reset to default'));
            await refresh();
        } finally { setSavingId(null); }
    };

    const columns = [
        {
            title: t('Feature'),
            dataIndex: 'displayName',
            key: 'displayName',
            render: (name: string, row: FlagRow) => (
                <Space direction="vertical" size={0}>
                    <Space size={6}>
                        <Typography.Text strong>{name}</Typography.Text>
                        {row.coreInfrastructure && (
                            <Tooltip title={t('Always on — platform depends on this feature.')}>
                                <LockOutlined style={{opacity: 0.6}}/>
                            </Tooltip>
                        )}
                    </Space>
                    <Typography.Text type="secondary" style={{fontSize: 11, fontFamily: 'monospace'}}>{row.id}</Typography.Text>
                </Space>
            ),
        },
        {
            title: t('Enabled'),
            dataIndex: 'enabled',
            key: 'enabled',
            width: 110,
            render: (enabled: boolean, row: FlagRow) => (
                <Switch
                    checked={enabled}
                    disabled={row.coreInfrastructure || row.envSet || savingId === row.id}
                    loading={savingId === row.id}
                    onChange={(next) => onToggle(row, next)}
                />
            ),
        },
        {
            title: t('Source'),
            key: 'source',
            width: 200,
            render: (_: unknown, row: FlagRow) => {
                if (row.coreInfrastructure) return <Tag color="default">{t('core (locked)')}</Tag>;
                if (row.envSet) return <Tag color="purple">{t('env')}: {row.envKey}</Tag>;
                if (row.mongoOverride) return <Tag color="blue">{t('admin override')}</Tag>;
                return <Tag>{t('default')}</Tag>;
            },
        },
        {
            title: t('Requires'),
            dataIndex: 'requires',
            key: 'requires',
            render: (reqs: readonly string[]) => reqs?.length ? (
                <Space size={4} wrap>{reqs.map(r => <Tag key={r}>{r}</Tag>)}</Space>
            ) : <Typography.Text type="secondary">—</Typography.Text>,
        },
        {
            title: '',
            key: 'actions',
            width: 100,
            render: (_: unknown, row: FlagRow) => row.mongoOverride && !row.coreInfrastructure ? (
                <Button size="small" onClick={() => onReset(row)} loading={savingId === row.id}>{t('Reset')}</Button>
            ) : null,
        },
    ];

    return (
        <div style={{padding: 16}}>
            <RestartRequiredBanner/>
            <Card
                title={t('Feature flags')}
                extra={<Button onClick={refresh} loading={loading}>{t('Refresh')}</Button>}
            >
                <Alert
                    type="info"
                    showIcon
                    style={{marginBottom: 12}}
                    message={t('Toggles persist immediately and gate runtime checks (route 404s, GraphQL guards). Features that boot off — products / cart / inventory / orders / mcp by default — need a server restart to fully reappear (services, schema fields, resolvers).')}
                />
                <Table<FlagRow>
                    rowKey="id"
                    size="small"
                    loading={loading}
                    dataSource={rows}
                    columns={columns as any}
                    pagination={false}
                />
            </Card>
        </div>
    );
};

export default FeatureFlagsPanel;
