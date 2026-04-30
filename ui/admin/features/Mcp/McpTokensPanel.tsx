import React, {useCallback, useEffect, useMemo, useState} from "react";
import {Alert, Button, Checkbox, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message} from "antd";
import {useTranslation} from "react-i18next";
import McpTokenApi from "@services/api/client/McpTokenApi";
import {ALL_MCP_SCOPES, IMcpIssuedToken, IMcpTokenSummary, McpScope} from "@interfaces/IMcp";

/**
 * Admin panel — issue + revoke MCP tokens.
 *
 * Secret UX matches GitHub PATs: shown ONCE on creation in a copy-to-clipboard
 * box with a clear warning. After dismiss, the secret is unrecoverable; the
 * admin must revoke + re-issue if they lose it.
 *
 * Scope presets cover the three common shapes; the explicit checkbox grid
 * stays so a power user can mix-and-match (e.g., `read:audit` + `write:i18n`).
 */

const api = new McpTokenApi();

type Preset = 'read-only' | 'translations-only' | 'full-access' | 'custom';

const PRESET_SCOPES: Record<Exclude<Preset, 'custom'>, McpScope[]> = {
    'read-only': ['read:content', 'read:i18n', 'read:themes', 'read:products', 'read:inventory', 'read:site', 'read:audit'],
    'translations-only': ['read:i18n', 'write:i18n', 'read:content'],
    'full-access': [...ALL_MCP_SCOPES] as McpScope[],
};

const McpTokensPanel: React.FC = () => {
    const {t} = useTranslation();
    const [tokens, setTokens] = useState<IMcpTokenSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [issueOpen, setIssueOpen] = useState(false);
    const [issuedSecret, setIssuedSecret] = useState<IMcpIssuedToken | null>(null);
    const [name, setName] = useState('');
    const [preset, setPreset] = useState<Preset>('full-access');
    const [scopes, setScopes] = useState<McpScope[]>(PRESET_SCOPES['full-access']);
    const [ttlDays, setTtlDays] = useState<number | null>(90);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            setTokens(await api.list());
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void refresh(); }, [refresh]);

    const onPresetChange = (next: Preset) => {
        setPreset(next);
        if (next !== 'custom') setScopes(PRESET_SCOPES[next]);
    };

    const onIssue = async () => {
        if (!name.trim()) { void message.error('Token name is required'); return; }
        if (!scopes.length) { void message.error('Pick at least one scope'); return; }
        const res = await api.issue(name.trim(), scopes, ttlDays);
        if ('error' in res && res.error) {
            void message.error(res.error);
            return;
        }
        setIssuedSecret(res as IMcpIssuedToken);
        setIssueOpen(false);
        setName('');
        void refresh();
    };

    const onRevoke = async (id: string) => {
        const res = await api.revoke(id);
        if ('error' in res && res.error) { void message.error(res.error); return; }
        void message.success('Revoked');
        void refresh();
    };

    const copySecret = async () => {
        if (!issuedSecret) return;
        try {
            await navigator.clipboard.writeText(issuedSecret.secret);
            void message.success('Secret copied');
        } catch {
            void message.error('Copy failed — select the text manually');
        }
    };

    const columns = useMemo(() => [
        {title: 'Name', dataIndex: 'name', key: 'name'},
        {
            title: 'Scopes', dataIndex: 'scopes', key: 'scopes',
            render: (s: McpScope[]) => <Space wrap size={[4, 4]}>{(s ?? []).map(sc => <Tag key={sc}>{sc}</Tag>)}</Space>,
        },
        {title: 'Created', dataIndex: 'createdAt', key: 'createdAt'},
        {title: 'Last used', dataIndex: 'lastUsedAt', key: 'lastUsedAt', render: (v?: string) => v ?? '—'},
        {title: 'Expires', dataIndex: 'expiresAt', key: 'expiresAt', render: (v?: string) => v ?? 'never'},
        {
            title: 'Status', dataIndex: 'status', key: 'status',
            render: (s: string) => {
                const color = s === 'active' ? 'green' : (s === 'expired' ? 'orange' : 'red');
                return <Tag color={color}>{s}</Tag>;
            },
        },
        {
            title: 'Actions', key: 'actions',
            render: (_: unknown, row: IMcpTokenSummary) => row.status === 'active' ? (
                <Popconfirm title="Revoke this token? Active MCP clients will be cut off."
                            okText="Revoke" okButtonProps={{danger: true}}
                            onConfirm={() => onRevoke(row.id)}>
                    <Button danger size="small">Revoke</Button>
                </Popconfirm>
            ) : null,
        },
    ], []);

    return (
        <div>
            <Space style={{marginBottom: 16}}>
                <Button type="primary" onClick={() => setIssueOpen(true)}>{t('Issue token')}</Button>
                <Button onClick={() => void refresh()} loading={loading}>{t('Refresh')}</Button>
            </Space>

            <Table<IMcpTokenSummary>
                rowKey="id"
                loading={loading}
                dataSource={tokens}
                columns={columns as any}
                size="small"
                pagination={false}
            />

            <Modal
                title={t('Issue MCP token')}
                open={issueOpen}
                onOk={onIssue}
                onCancel={() => setIssueOpen(false)}
                okText={t('Issue')}
            >
                <Form layout="vertical">
                    <Form.Item label={t('Name')} required>
                        <Input value={name} onChange={e => setName(e.target.value)}
                               placeholder="e.g. Claude Code laptop"/>
                    </Form.Item>
                    <Form.Item label={t('Preset')}>
                        <Select value={preset} onChange={onPresetChange}
                                options={[
                                    {value: 'read-only', label: 'Read-only'},
                                    {value: 'translations-only', label: 'Translations only'},
                                    {value: 'full-access', label: 'Full access'},
                                    {value: 'custom', label: 'Custom (pick below)'},
                                ]}/>
                    </Form.Item>
                    <Form.Item label={t('Scopes')}>
                        <Checkbox.Group
                            value={scopes}
                            onChange={(v) => { setPreset('custom'); setScopes(v as McpScope[]); }}
                            options={ALL_MCP_SCOPES.map(s => ({label: s, value: s}))}
                        />
                    </Form.Item>
                    <Form.Item label={t('Expires in')}>
                        <Select<number | null>
                            value={ttlDays}
                            onChange={(v) => setTtlDays(v)}
                            options={[
                                {value: 30, label: '30 days'},
                                {value: 90, label: '90 days'},
                                {value: 180, label: '180 days'},
                                {value: null as any, label: 'Never'},
                            ]}
                        />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title={t('Token issued')}
                open={Boolean(issuedSecret)}
                onCancel={() => setIssuedSecret(null)}
                footer={[
                    <Button key="copy" onClick={copySecret}>{t('Copy secret')}</Button>,
                    <Button key="done" type="primary" onClick={() => setIssuedSecret(null)}>{t('Done')}</Button>,
                ]}
                width={600}
            >
                <Alert
                    type="warning"
                    showIcon
                    message={t('This is the only time you will see this secret. Copy it now and store it somewhere safe — close this dialog and it is gone.')}
                    style={{marginBottom: 12}}
                />
                <Typography.Paragraph copyable style={{fontFamily: 'monospace', wordBreak: 'break-all'}}>
                    {issuedSecret?.secret}
                </Typography.Paragraph>
                <Typography.Text type="secondary">
                    Scopes: {(issuedSecret?.scopes ?? []).join(', ') || '—'}
                </Typography.Text>
            </Modal>
        </div>
    );
};

export default McpTokensPanel;
