/** DownloadInvoiceButton — Phase 1.D. Composable VAT-invoice download. */
import React from 'react';
import type {IItem} from '@interfaces/IItem';
import type {IDownloadInvoiceButton} from './DownloadInvoiceButton.types';
import './DownloadInvoiceButton.scss';
export interface DownloadInvoiceButtonProps { item: IItem; orderId?: string; }
function parseContent(raw: string|object|undefined): IDownloadInvoiceButton {
    if (!raw) return {} as IDownloadInvoiceButton;
    if (typeof raw === 'string') { try { return JSON.parse(raw) as IDownloadInvoiceButton; } catch { return {} as IDownloadInvoiceButton; } }
    return raw as IDownloadInvoiceButton;
}
const DownloadInvoiceButton: React.FC<DownloadInvoiceButtonProps> = ({item, orderId}) => {
    const c = parseContent(item.content);
    const href = orderId ? `/api/orders/${encodeURIComponent(orderId)}/invoice.pdf` : '#';
    return (
        <a className="download-invoice-button" href={href} data-testid="module-download-invoice-button">
            {c.label ?? 'Download invoice (PDF)'}
        </a>
    );
};
export default DownloadInvoiceButton;
export {DownloadInvoiceButton};
export {EDownloadInvoiceButtonStyle, type IDownloadInvoiceButton} from './DownloadInvoiceButton.types';
