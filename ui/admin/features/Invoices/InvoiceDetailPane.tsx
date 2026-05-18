/**
 * Invoice detail drawer body — HTML preview of the IInvoice plus the
 * "Download PDF" + "Issue credit note" actions. The credit-note action
 * surfaces a simple reason selector; the heavier reason-detail form
 * lives in a follow-up (`creditNote.create` MCP already accepts the
 * extra fields).
 */
import React, {useState} from 'react';
import {Alert, Button, Descriptions, Modal, Select, Space, Table, Tag, Typography} from 'antd';
import type {ColumnsType} from 'antd/es/table';
import type {IInvoice, IInvoiceLine} from '@interfaces/IInvoice';

const fmt = (minor: number, currency: string): string => {
    try { return new Intl.NumberFormat(undefined, {style: 'currency', currency: currency || 'EUR'}).format((minor ?? 0) / 100); }
    catch { return `${(minor ?? 0) / 100} ${currency || ''}`; }
};

interface Props {
    invoice: IInvoice;
    onDownloadPdf(): void;
    onVoid(reason: 'refund' | 'cancellation' | 'correction', detail?: string): Promise<void> | void;
}

const InvoiceDetailPane: React.FC<Props> = ({invoice, onDownloadPdf, onVoid}) => {
    const [voidOpen, setVoidOpen] = useState(false);
    const [voidReason, setVoidReason] = useState<'refund' | 'cancellation' | 'correction'>('refund');

    const lineCols: ColumnsType<IInvoiceLine> = [
        {title: 'Description', dataIndex: 'description'},
        {title: 'Qty', dataIndex: 'qty', align: 'right'},
        {title: 'Unit net', dataIndex: 'unitNet', align: 'right', render: (v: number) => fmt(v, invoice.currency)},
        {title: 'VAT%', dataIndex: 'vatRatePct', align: 'right', render: (v: number) => `${v}%`},
        {title: 'Gross', dataIndex: 'lineGross', align: 'right', render: (v: number) => fmt(v, invoice.currency)},
    ];

    return (
        <div>
            <Space style={{marginBottom: 16}}>
                <Button data-testid="admin-invoice-detail-download" type="primary" onClick={onDownloadPdf}>Download PDF</Button>
                {invoice.status === 'issued' && (
                    <Button
                        data-testid="admin-invoice-detail-void"
                        danger
                        onClick={() => setVoidOpen(true)}
                    >
                        Issue credit note
                    </Button>
                )}
                <Tag color={invoice.status === 'voided' ? 'red' : 'green'}>{invoice.status}</Tag>
            </Space>

            <Descriptions size="small" bordered column={2} style={{marginBottom: 16}}>
                <Descriptions.Item label="Number">{invoice.number}</Descriptions.Item>
                <Descriptions.Item label="Order">{invoice.orderId}</Descriptions.Item>
                <Descriptions.Item label="Issued">{invoice.issueDate}</Descriptions.Item>
                <Descriptions.Item label="Due">{invoice.dueDate}</Descriptions.Item>
                <Descriptions.Item label="Regime">{invoice.vatRegime?.kind}</Descriptions.Item>
                <Descriptions.Item label="Currency">{invoice.currency}</Descriptions.Item>
            </Descriptions>

            <Descriptions title="From (operator)" size="small" column={1} style={{marginBottom: 16}}>
                <Descriptions.Item label="Name">{invoice.operator.name}</Descriptions.Item>
                <Descriptions.Item label="VAT">{invoice.operator.vatId ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="Address">
                    {invoice.operator.address.line1}, {invoice.operator.address.postalCode} {invoice.operator.address.city}, {invoice.operator.address.country}
                </Descriptions.Item>
            </Descriptions>

            <Descriptions title="Bill to (customer)" size="small" column={1} style={{marginBottom: 16}}>
                <Descriptions.Item label="Name">{invoice.customer.name}</Descriptions.Item>
                <Descriptions.Item label="VAT">{invoice.customer.vatId ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="Address">
                    {invoice.customer.address.line1}, {invoice.customer.address.postalCode} {invoice.customer.address.city}, {invoice.customer.address.country}
                </Descriptions.Item>
            </Descriptions>

            <Table<IInvoiceLine>
                data-testid="admin-invoice-detail-lines"
                rowKey={(_l, i) => String(i)}
                columns={lineCols}
                dataSource={invoice.lines}
                size="small"
                pagination={false}
                style={{marginBottom: 16}}
            />

            <Descriptions size="small" column={1} bordered>
                <Descriptions.Item label="Subtotal net">{fmt(invoice.subtotalNet, invoice.currency)}</Descriptions.Item>
                <Descriptions.Item label="VAT total">{fmt(invoice.vatTotal, invoice.currency)}</Descriptions.Item>
                <Descriptions.Item label={<strong>Grand total</strong>}>
                    <strong>{fmt(invoice.grandTotal, invoice.currency)}</strong>
                </Descriptions.Item>
            </Descriptions>

            {invoice.reverseChargeNote && (
                <Alert
                    style={{marginTop: 16}}
                    type="info"
                    message="Reverse charge"
                    description={invoice.reverseChargeNote}
                    showIcon
                />
            )}

            {invoice.cogs && (
                <Alert
                    style={{marginTop: 16}}
                    type="warning"
                    message="Operator-only (COGS)"
                    description={
                        <>
                            <div>Wholesale: {fmt(invoice.cogs.totalWholesale, invoice.currency)}</div>
                            <div>Gross margin: {fmt(invoice.cogs.grossMargin, invoice.currency)}</div>
                            <Typography.Text type="secondary">Source: {invoice.cogs.sourceAdapter}</Typography.Text>
                        </>
                    }
                />
            )}

            <Modal
                data-testid="admin-invoice-void-modal"
                title="Issue credit note"
                open={voidOpen}
                onCancel={() => setVoidOpen(false)}
                onOk={async () => { await onVoid(voidReason); setVoidOpen(false); }}
                okText="Issue credit note"
                okButtonProps={{danger: true}}
            >
                <p>This emits a credit note that mirrors every line negative + flips the invoice to <Tag color="red">voided</Tag>. Numbering is gap-free; the original invoice number stays on the books.</p>
                <Space direction="vertical" style={{width: '100%'}}>
                    <label>Reason</label>
                    <Select<'refund' | 'cancellation' | 'correction'>
                        data-testid="admin-invoice-void-reason"
                        style={{width: '100%'}}
                        value={voidReason}
                        onChange={setVoidReason}
                        options={[
                            {value: 'refund', label: 'Refund'},
                            {value: 'cancellation', label: 'Cancellation'},
                            {value: 'correction', label: 'Correction'},
                        ]}
                    />
                </Space>
            </Modal>
        </div>
    );
};

export default InvoiceDetailPane;
