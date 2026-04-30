import React, {useEffect, useState} from 'react';
import {GetServerSideProps} from 'next';
import Link from 'next/link';
import {ConfigProvider, Spin, Table, Typography} from 'antd';
import staticTheme from '@client/features/Themes/themeConfig';
import {requireCustomerSession} from '@client/lib/account/session';
import {myOrders} from '@client/lib/checkout/api';
import {formatMoney} from '@client/lib/checkout/api';

const OrdersHistory = () => {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        myOrders(50).then(setOrders).finally(() => setLoading(false));
    }, []);

    return (
        <ConfigProvider theme={staticTheme}>
            <div style={{maxWidth: 880, margin: '40px auto', padding: 16}}>
                <Typography.Title level={2}>My orders</Typography.Title>
                {loading ? <Spin/> : (
                    <Table
                        rowKey="id"
                        dataSource={orders}
                        pagination={false}
                        columns={[
                            {title: 'Order #', dataIndex: 'orderNumber', render: (n, r: any) => <Link href={`/account/orders/${r.id}`}>{n || r.id.slice(0, 8)}</Link>},
                            {title: 'Status', dataIndex: 'status'},
                            {title: 'Total', dataIndex: 'total', render: (v, r: any) => formatMoney(v, r.currency)},
                            {title: 'Created', dataIndex: 'createdAt', render: v => new Date(v).toLocaleString()},
                        ]}
                    />
                )}
            </div>
        </ConfigProvider>
    );
};

export const getServerSideProps: GetServerSideProps = async (ctx) => {
    const guard = await requireCustomerSession(ctx);
    if (!guard.ok) return {redirect: guard.redirect};
    return {props: {session: guard.session}};
};

export default OrdersHistory;
