import React, {useEffect} from 'react';
import {Alert, Button, Card, Space, Switch, Table, Tag, Tooltip, Typography} from 'antd';
import {useTranslation} from 'react-i18next';
import {LockOutlined} from '@client/lib/icons';
import RestartRequiredBanner from './RestartRequiredBanner';
import {useViewModel} from '@client/lib/state/observable';
import {FeatureFlagsPanelViewModel, type FlagRow} from './FeatureFlagsPanelViewModel';

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

const FeatureFlagsPanel: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new FeatureFlagsPanelViewModel(t));

    useEffect(() => { void vm.refresh(); }, [vm]);

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
                    disabled={row.coreInfrastructure || row.envSet || vm.savingId === row.id}
                    loading={vm.savingId === row.id}
                    onChange={(next) => vm.toggle(row, next)}
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
                <Button size="small" onClick={() => vm.reset(row)} loading={vm.savingId === row.id}>{t('Reset')}</Button>
            ) : null,
        },
    ];

    return (
        <div style={{padding: 16}}>
            <RestartRequiredBanner/>
            <Card
                title={t('Feature flags')}
                extra={<Button onClick={() => void vm.refresh()} loading={vm.loading}>{t('Refresh')}</Button>}
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
                    loading={vm.loading}
                    dataSource={vm.rows}
                    columns={columns as any}
                    pagination={false}
                />
            </Card>
        </div>
    );
};

export default FeatureFlagsPanel;
