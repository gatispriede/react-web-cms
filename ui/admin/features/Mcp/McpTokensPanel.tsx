import React, {useEffect, useMemo} from "react";
import {Alert, Button, Checkbox, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Typography} from "antd";
import {useTranslation} from "react-i18next";
import {ALL_MCP_SCOPES, IMcpTokenSummary, McpScope} from "@interfaces/IMcp";
import {useViewModel} from "@client/lib/state/observable";
import {McpTokensViewModel} from "./McpTokensViewModel";

/**
 * Render-only MCP tokens panel — VM3 (2026-05-02). State + actions on
 * `McpTokensViewModel`. Secret-shown-once UX matches GitHub PATs:
 * issuance modal → reveal modal with copy button → close = unrecoverable.
 */
const McpTokensPanel: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new McpTokensViewModel());

    useEffect(() => { void vm.refresh(); }, [vm]);

    const columns = useMemo(() => [
        {title: 'Name', dataIndex: 'name', key: 'name'},
        {title: 'Scopes', dataIndex: 'scopes', key: 'scopes',
            render: (s: McpScope[]) => <Space wrap size={[4, 4]}>{(s ?? []).map(sc => <Tag key={sc}>{sc}</Tag>)}</Space>},
        {title: 'Created', dataIndex: 'createdAt', key: 'createdAt'},
        {title: 'Last used', dataIndex: 'lastUsedAt', key: 'lastUsedAt', render: (v?: string) => v ?? '—'},
        {title: 'Expires', dataIndex: 'expiresAt', key: 'expiresAt', render: (v?: string) => v ?? 'never'},
        {title: 'Status', dataIndex: 'status', key: 'status',
            render: (s: string) => {
                const color = s === 'active' ? 'green' : (s === 'expired' ? 'orange' : 'red');
                return <Tag color={color}>{s}</Tag>;
            }},
        {title: 'Actions', key: 'actions',
            render: (_: unknown, row: IMcpTokenSummary) => row.status === 'active' ? (
                <Popconfirm title="Revoke this token? Active MCP clients will be cut off."
                            okText="Revoke" okButtonProps={{danger: true, loading: vm.revokePending, 'data-testid': 'mcp-revoke-confirm-btn'} as any}
                            onConfirm={() => vm.revoke(row.id)}>
                    <Button data-testid="mcp-revoke-btn" danger size="small" loading={vm.revokePending}>Revoke</Button>
                </Popconfirm>
            ) : null},
    ], [vm]);

    return (
        <div>
            <Space style={{marginBottom: 16}}>
                <Button data-testid="mcp-issue-btn" type="primary" onClick={vm.openIssueDialog}>{t('Issue token')}</Button>
                <Button data-testid="mcp-refresh-button" onClick={vm.refresh} loading={vm.loading}>{t('Refresh')}</Button>
            </Space>

            <Table<IMcpTokenSummary>
                rowKey="id"
                loading={vm.loading}
                dataSource={vm.tokens}
                columns={columns as any}
                size="small"
                pagination={false}
                onRow={(r: IMcpTokenSummary) => ({'data-testid': `mcp-row-${r.id}`} as any)}
            />

            <Modal
                data-testid="mcp-issue-modal"
                title={t('Issue MCP token')}
                open={vm.issueOpen}
                onOk={vm.issue}
                onCancel={vm.closeIssueDialog}
                okText={t('Issue')}
                okButtonProps={{'data-testid': 'mcp-issue-submit-btn'} as any}
            >
                <Form layout="vertical">
                    <Form.Item label={t('Name')} required>
                        <Input data-testid="mcp-issue-name-input" value={vm.name} onChange={e => vm.setName(e.target.value)}
                               placeholder="e.g. Claude Code laptop"/>
                    </Form.Item>
                    <Form.Item label={t('Preset')}>
                        <Select data-testid="mcp-issue-preset-select" value={vm.preset} onChange={vm.setPreset}
                                options={[
                                    {value: 'read-only', label: 'Read-only'},
                                    {value: 'translations-only', label: 'Translations only'},
                                    {value: 'full-access', label: 'Full access'},
                                    {value: 'custom', label: 'Custom (pick below)'},
                                ]}/>
                    </Form.Item>
                    <Form.Item label={t('Scopes')}>
                        <Checkbox.Group
                            value={vm.scopes}
                            onChange={(v) => vm.setScopes(v as McpScope[])}
                            options={ALL_MCP_SCOPES.map(s => ({label: s, value: s}))}
                        />
                    </Form.Item>
                    <Form.Item label={t('Expires in')}>
                        <Select<number | null>
                            data-testid="mcp-issue-ttl-select"
                            value={vm.ttlDays}
                            onChange={(v) => vm.setTtlDays(v)}
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
                data-testid="mcp-reveal-modal"
                title={t('Token issued')}
                open={Boolean(vm.issuedSecret)}
                onCancel={vm.closeIssuedSecret}
                footer={[
                    <Button data-testid="mcp-reveal-copy-button" key="copy" onClick={vm.copySecret}>{t('Copy secret')}</Button>,
                    <Button key="done" data-testid="mcp-reveal-close-btn" type="primary" onClick={vm.closeIssuedSecret}>{t('Done')}</Button>,
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
                    {vm.issuedSecret?.secret}
                </Typography.Paragraph>
                <Typography.Text type="secondary">
                    Scopes: {(vm.issuedSecret?.scopes ?? []).join(', ') || '—'}
                </Typography.Text>
            </Modal>
        </div>
    );
};

export default McpTokensPanel;
