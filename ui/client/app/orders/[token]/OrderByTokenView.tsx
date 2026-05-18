'use client';
/**
 * Client view for `/orders/[token]` — App Router migration, Batch 5.
 */
import React from 'react';
import {Alert} from 'antd';
import {useT} from 'next-i18next/client';
import {type ISystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import SystemPageDispatch from '@client/lib/systemPage/SystemPageDispatch';

interface OrderByTokenViewProps {
    systemPage: ISystemPageSnapshot | null;
    error: 'rate' | 'not-found' | null;
}

const OrderByTokenView: React.FC<OrderByTokenViewProps> = ({systemPage, error}) => {
    const {t} = useT('common');
    const {t: tApp} = useT('app');
    if (error) {
        return (
            <div style={{maxWidth: 720, margin: '40px auto', padding: 16}}>
                <Alert
                    type="error"
                    showIcon
                    message={error === 'rate' ? 'Too many lookups' : 'Order not found'}
                    description={error === 'rate'
                        ? 'Try again in a minute.'
                        : 'Double-check the link from your receipt email, or sign in to /account if you have a customer account.'}
                    data-testid="public-order-error"
                />
            </div>
        );
    }
    return (
        <main data-testid="page-order-by-token" style={{maxWidth: 720, margin: '40px auto', padding: 16}}>
            {systemPage
                ? <SystemPageDispatch systemKey="order-by-token" sections={systemPage.defaultSections} t={t} tApp={tApp}/>
                : null}
        </main>
    );
};

export default OrderByTokenView;
