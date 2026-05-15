import React from 'react';
import OrderProgressTimeline from '@client/modules/OrderProgressTimeline/OrderProgressTimeline';
import type {OrderAddress, OrderDetailModuleProps} from './OrderDetailModule.types';

function formatAddress(a: OrderAddress): string[] {
    const parts: string[] = [a.name, a.line1];
    if (a.line2) parts.push(a.line2);
    parts.push([a.postalCode, a.city, a.region].filter(Boolean).join(' '));
    parts.push(a.country);
    return parts;
}

const OrderDetailModule: React.FC<OrderDetailModuleProps> = ({
    testId,
    orderNumber,
    progressVariant,
    progressSteps,
    lineItems,
    shippingAddress,
    billingAddress,
    payment,
    statusHistory,
    actions,
}) => {
    const a = actions ?? {};
    return (
        <article className="order-detail-module" data-testid={testId} data-order-number={orderNumber}>
            <header className="order-detail-module__head">
                <h2 className="order-detail-module__title" data-testid={`${testId}-title`}>Order #{orderNumber}</h2>
            </header>

            <OrderProgressTimeline
                testId={`${testId}-progress`}
                variant={progressVariant}
                steps={progressSteps}
            />

            <section className="order-detail-module__section">
                <h3>Items</h3>
                <ul className="order-detail-module__lines" data-testid={`${testId}-lines`}>
                    {lineItems.map(line => (
                        <li key={line.sku} className="order-detail-module__line" data-testid={`${testId}-line-${line.sku}`}>
                            {line.thumbUrl && <img className="order-detail-module__line-thumb" src={line.thumbUrl} alt="" loading="lazy" />}
                            <span className="order-detail-module__line-title">{line.title}</span>
                            <span className="order-detail-module__line-qty">× {line.quantity}</span>
                            <span className="order-detail-module__line-total">{line.lineTotalFormatted}</span>
                        </li>
                    ))}
                </ul>
            </section>

            {(shippingAddress || billingAddress) && (
                <section className="order-detail-module__section order-detail-module__addresses">
                    {shippingAddress && (
                        <div className="order-detail-module__address" data-testid={`${testId}-shipping`}>
                            <h4>Shipping</h4>
                            <address>
                                {formatAddress(shippingAddress).map((line, i) => (
                                    <div key={i}>{line}</div>
                                ))}
                            </address>
                        </div>
                    )}
                    {billingAddress && (
                        <div className="order-detail-module__address" data-testid={`${testId}-billing`}>
                            <h4>Billing</h4>
                            <address>
                                {formatAddress(billingAddress).map((line, i) => (
                                    <div key={i}>{line}</div>
                                ))}
                            </address>
                        </div>
                    )}
                </section>
            )}

            <section className="order-detail-module__section">
                <h3>Payment</h3>
                <dl className="order-detail-module__payment" data-testid={`${testId}-payment`}>
                    <div><dt>Subtotal</dt><dd data-testid={`${testId}-subtotal`}>{payment.subtotalFormatted}</dd></div>
                    <div><dt>Shipping</dt><dd data-testid={`${testId}-shipping-total`}>{payment.shippingFormatted}</dd></div>
                    <div><dt>VAT</dt><dd data-testid={`${testId}-tax`}>{payment.taxFormatted}</dd></div>
                    <div className="order-detail-module__total"><dt>Total</dt><dd data-testid={`${testId}-total`}>{payment.totalFormatted}</dd></div>
                    {payment.method && <div><dt>Method</dt><dd data-testid={`${testId}-method`}>{payment.method}</dd></div>}
                </dl>
            </section>

            {statusHistory.length > 0 && (
                <section className="order-detail-module__section">
                    <h3>Status history</h3>
                    <ol className="order-detail-module__history" data-testid={`${testId}-history`}>
                        {statusHistory.map((entry, i) => (
                            <li key={`${entry.status}-${entry.at}-${i}`} data-testid={`${testId}-history-${i}`}>
                                <span className="order-detail-module__history-status">{entry.status}</span>
                                <small className="order-detail-module__history-at">{entry.at}</small>
                                {entry.note && <small className="order-detail-module__history-note">{entry.note}</small>}
                            </li>
                        ))}
                    </ol>
                </section>
            )}

            <div className="order-detail-module__actions">
                {a.canReorder && (
                    <button type="button" className="order-detail-module__btn order-detail-module__btn--primary" data-testid={`${testId}-reorder`} onClick={() => { void a.onReorder?.(); }}>
                        {a.reorderLabel ?? 'Reorder'}
                    </button>
                )}
                {a.canCancel && (
                    <button type="button" className="order-detail-module__btn order-detail-module__btn--danger" data-testid={`${testId}-cancel`} onClick={() => { void a.onCancel?.(); }}>
                        {a.cancelLabel ?? 'Cancel order'}
                    </button>
                )}
                {a.onContactSupport && (
                    <button type="button" className="order-detail-module__btn" data-testid={`${testId}-support`} onClick={a.onContactSupport}>
                        {a.supportLabel ?? 'Contact support'}
                    </button>
                )}
            </div>
        </article>
    );
};

export default OrderDetailModule;
export {OrderDetailModule};
export type {OrderDetailModuleProps, OrderLineItem, OrderAddress, OrderPaymentSummary, OrderStatusHistoryEntry, OrderDetailActions} from './OrderDetailModule.types';
