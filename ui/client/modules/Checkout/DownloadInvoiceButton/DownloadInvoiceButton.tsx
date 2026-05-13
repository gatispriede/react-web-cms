/** DownloadInvoiceButton — Phase 1.D. Composable VAT-invoice download. */
import React from 'react';
import type {IItem} from '@interfaces/IItem';
import {useCheckoutMachine} from '@client/lib/checkout/useCheckoutMachine';
import type {IDownloadInvoiceButton} from './DownloadInvoiceButton.types';
import './DownloadInvoiceButton.scss';

export interface DownloadInvoiceButtonProps { item: IItem; orderId?: string; }

function parseContent(raw: string|object|undefined): IDownloadInvoiceButton {
    if (!raw) return {} as IDownloadInvoiceButton;
    if (typeof raw === 'string') { try { return JSON.parse(raw) as IDownloadInvoiceButton; } catch { return {} as IDownloadInvoiceButton; } }
    return raw as IDownloadInvoiceButton;
}

const DownloadInvoiceButton: React.FC<DownloadInvoiceButtonProps> = ({item, orderId: propOrderId}) => {
    const c = parseContent(item.content);
    const {orderId: machineOrderId} = useCheckoutMachine();
    const id = propOrderId ?? machineOrderId;
    const href = id ? `/api/orders/${encodeURIComponent(id)}/invoice.pdf` : '#';
    return (
        <a
            className="download-invoice-button"
            href={href}
            data-testid="module-download-invoice-button"
            aria-disabled={!id}
            onClick={e => { if (!id) e.preventDefault(); }}
            target="_blank"
            rel="noopener noreferrer"
        >
            {c.label ?? 'Download invoice (PDF)'}
        </a>
    );
};
export default DownloadInvoiceButton;
export {DownloadInvoiceButton};
export {EDownloadInvoiceButtonStyle, type IDownloadInvoiceButton} from './DownloadInvoiceButton.types';
