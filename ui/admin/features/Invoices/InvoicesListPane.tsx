/**
 * Invoices admin pane — list + detail drawer + export-range modal.
 * Mounted at `/admin/commerce/invoices`.
 *
 * Data flows through `/api/admin/invoices` (the REST mirror of the
 * `invoice.*` MCP tools). PDF + CSV export endpoints are hit directly
 * from the VM; no GraphQL plumbing because invoicing is read-only from
 * the human surface (issuance is automatic + audit-grade).
 */
import React, {useEffect} from 'react';
import {Button, DatePicker, Drawer, Modal, Select, Space, Switch, Table, Tag, Typography} from 'antd';
import type {ColumnsType} from 'antd/es/table';
import EmptyState from '@admin/shell/EmptyState';
import PaneHeader from '@admin/shell/PaneHeader';
import {useViewModel} from '@client/lib/state/observable';
import type {IInvoice, InvoiceStatus} from '@interfaces/IInvoice';
import {InvoicesViewModel} from './InvoicesViewModel';
import ExportRangeDialog from './ExportRangeDialog';
import InvoiceDetailPane from './InvoiceDetailPane';

const STATUS_FILTERS: Array<{value: InvoiceStatus | 'all'; label: string}> = [
    {value: 'all', label: 'All'},
    {value: 'issued', label: 'Issued'},
    {value: 'voided', label: 'Voided'},
];

const formatMoney = (amount: number, currency: string): string => {
    try {
        return new Intl.NumberFormat(undefined, {style: 'currency', currency: currency || 'EUR'}).format((amount ?? 0) / 100);
    } catch { return `${(amount ?? 0) / 100} ${currency || ''}`; }
};

const statusColor = (s: InvoiceStatus): string => s === 'voided' ? 'red' : 'green';

const InvoicesListPane: React.FC = () => {
    const vm = useViewModel(() => new InvoicesViewModel());

    useEffect(() => { void vm.refresh(); }, [vm]);

    const baseColumns: ColumnsType<IInvoice> = [
        {
            title: 'Number',
            dataIndex: 'number',
            render: (n: string, r: IInvoice) => (
                <a data-testid={`admin-invoices-row-link-${r.id}`} onClick={() => vm.selectDetail(r)}>{n}</a>
            ),
        },
        {title: 'Issued', dataIndex: 'issueDate'},
        {title: 'Customer', dataIndex: ['customer', 'name'], render: (_: unknown, r: IInvoice) => r.customer?.name ?? '—'},
        {title: 'Total', dataIndex: 'grandTotal', render: (v: number, r: IInvoice) => formatMoney(v, r.currency)},
        {title: 'Regime', dataIndex: ['vatRegime', 'kind'], render: (_: unknown, r: IInvoice) => <Tag>{r.vatRegime?.kind ?? '—'}</Tag>},
        {title: 'Status', dataIndex: 'status', render: (s: InvoiceStatus) => <Tag color={statusColor(s)}>{s}</Tag>},
    ];

    const cogsColumns: ColumnsType<IInvoice> = vm.showCogsColumn ? [
        {title: 'Wholesale', dataIndex: ['cogs', 'totalWholesale'], render: (_: unknown, r: IInvoice) =>
            r.cogs ? formatMoney(r.cogs.totalWholesale, r.currency) : <Typography.Text type="secondary">—</Typography.Text>},
        {title: 'Margin', dataIndex: ['cogs', 'grossMargin'], render: (_: unknown, r: IInvoice) =>
            r.cogs ? formatMoney(r.cogs.grossMargin, r.currency) : <Typography.Text type="secondary">—</Typography.Text>},
    ] : [];

    const columns: ColumnsType<IInvoice> = [...baseColumns, ...cogsColumns];

    return (
        <div data-testid="admin-invoices-pane" style={{padding: 'var(--admin-rhythm-md, 16px)'}}>
            <PaneHeader
                testId="admin-invoices-header"
                eyebrow="Commerce"
                title="Invoices"
                description="EU-compliant invoices issued automatically when an order is paid."
                actions={
                    <Space>
                        <Select
                            data-testid="admin-invoices-filter-status"
                            style={{width: 160}}
                            value={vm.statusFilter}
                            onChange={vm.setStatusFilter}
                            options={STATUS_FILTERS.map(f => ({value: f.value, label: f.label}))}
                        />
                        <DatePicker.RangePicker
                            data-testid="admin-invoices-filter-range"
                            onChange={(vals) => {
                                const f = vals?.[0]?.format?.('YYYY-MM-DD') ?? null;
                                const t = vals?.[1]?.format?.('YYYY-MM-DD') ?? null;
                                vm.setDateRange(f, t);
                            }}
                        />
                        <Switch
                            data-testid="admin-invoices-toggle-cogs"
                            checkedChildren="COGS on"
                            unCheckedChildren="COGS off"
                            checked={vm.showCogsColumn}
                            onChange={vm.toggleCogs}
                        />
                        <Button data-testid="admin-invoices-export-btn" type="primary" onClick={vm.openExport}>
                            Export period
                        </Button>
                    </Space>
                }
            />
            <Table<IInvoice>
                data-testid="admin-invoices-table"
                rowKey="id"
                columns={columns}
                dataSource={vm.rows}
                loading={vm.loading}
                pagination={{pageSize: 50, total: vm.total}}
                locale={{emptyText: (
                    <EmptyState
                        testId="admin-invoices-empty"
                        title="No invoices yet"
                        description="Once a customer pays, the invoice will appear here."
                    />
                )}}
            />

            <Drawer
                data-testid="admin-invoices-detail-drawer"
                width={720}
                title={vm.detail ? `Invoice ${vm.detail.number}` : ''}
                open={!!vm.detail}
                onClose={() => vm.selectDetail(null)}
            >
                {vm.detail && (
                    <InvoiceDetailPane
                        invoice={vm.detail}
                        onDownloadPdf={() => vm.downloadPdf(vm.detail!.id)}
                        onVoid={(reason, detail) => vm.voidInvoice(vm.detail!.id, reason, detail)}
                    />
                )}
            </Drawer>

            <Modal
                data-testid="admin-invoices-export-modal"
                title="Export bookkeeping CSV"
                open={vm.exportOpen}
                onCancel={vm.closeExport}
                onOk={() => void vm.runExport()}
                okText="Export"
            >
                <ExportRangeDialog
                    from={vm.exportFrom}
                    to={vm.exportTo}
                    onFromChange={vm.setExportFrom}
                    onToChange={vm.setExportTo}
                />
            </Modal>
        </div>
    );
};

export default InvoicesListPane;
