/**
 * Body of the "Export bookkeeping CSV" modal — two ISO-date pickers
 * + a small reminder of what the export contains. Triggering the
 * actual download is the modal's `onOk` handler in
 * `InvoicesListPane.tsx`.
 */
import React from 'react';
import {DatePicker, Form, Typography} from 'antd';
import dayjs from 'dayjs';

interface Props {
    from: string;
    to: string;
    onFromChange(v: string): void;
    onToChange(v: string): void;
}

const ExportRangeDialog: React.FC<Props> = ({from, to, onFromChange, onToChange}) => {
    return (
        <Form layout="vertical" data-testid="admin-invoices-export-form">
            <Form.Item label="From">
                <DatePicker
                    data-testid="admin-invoices-export-from"
                    style={{width: '100%'}}
                    value={from ? dayjs(from) : null}
                    onChange={(d) => onFromChange(d ? d.format('YYYY-MM-DD') : '')}
                />
            </Form.Item>
            <Form.Item label="To">
                <DatePicker
                    data-testid="admin-invoices-export-to"
                    style={{width: '100%'}}
                    value={to ? dayjs(to) : null}
                    onChange={(d) => onToChange(d ? d.format('YYYY-MM-DD') : '')}
                />
            </Form.Item>
            <Typography.Paragraph type="secondary" style={{margin: 0}}>
                CSV columns: number, docType, issueDate, customer, VAT subtotal/total, grand total, currency, regime, wholesale cost, gross margin, order id, payment method, transaction ref. Credit notes appear as negative rows.
            </Typography.Paragraph>
        </Form>
    );
};

export default ExportRangeDialog;
