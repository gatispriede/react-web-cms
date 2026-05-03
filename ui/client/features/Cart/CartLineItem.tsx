import React from 'react';
import {Button, InputNumber, Space, Typography} from 'antd';
import type {CartLineItem as Line} from '@interfaces/ICart';

const formatPrice = (amount: number, currency: string) => {
    try {
        return new Intl.NumberFormat(undefined, {style: 'currency', currency: currency || 'EUR'}).format((amount ?? 0) / 100);
    } catch {
        return `${(amount ?? 0) / 100} ${currency}`;
    }
};

interface Props {
    line: Line;
    onUpdateQty: (qty: number) => void;
    onRemove: () => void;
}

const CartLineItem: React.FC<Props> = ({line, onUpdateQty, onRemove}) => {
    const lineTotal = line.qty * line.priceSnapshot;
    return (
        <div
            data-testid={`cart-item-row-${line.sku}`}
            style={{display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--theme-borderColor, #eee)'}}
        >
            <div style={{flex: 1, minWidth: 0}}>
                <Typography.Text strong style={{display: 'block'}}>{line.sku}</Typography.Text>
                <Typography.Text type="secondary" style={{fontSize: 12}}>
                    {formatPrice(line.priceSnapshot, line.currency)} ea
                </Typography.Text>
            </div>
            <Space>
                <InputNumber
                    data-testid={`cart-item-qty-input-${line.sku}`}
                    min={0}
                    max={999}
                    value={line.qty}
                    onChange={v => onUpdateQty(Number(v) || 0)}
                    style={{width: 72}}
                />
                <Typography.Text>{formatPrice(lineTotal, line.currency)}</Typography.Text>
                <Button data-testid={`cart-item-remove-btn-${line.sku}`} danger type="text" onClick={onRemove}>Remove</Button>
            </Space>
        </div>
    );
};

export default CartLineItem;
