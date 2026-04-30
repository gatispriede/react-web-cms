import React, {useEffect, useState} from 'react';
import {GetServerSideProps} from 'next';
import Link from 'next/link';
import {signOut} from 'next-auth/react';
import {Button, Card, Spin, Typography} from 'antd';
import {requireCustomerSession} from '@client/lib/account/session';
import {gql} from '@client/lib/account/gqlClient';

const {Title, Text} = Typography;

const AccountHome = () => {
    const [me, setMe] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        gql(`query Me { mongo { me { id name email phone shippingAddresses { id name } } } }`)
            .then(d => setMe(d?.mongo?.me))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div style={{maxWidth: 720, margin: '40px auto', padding: 16}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <Title level={2}>My account</Title>
                <Button onClick={() => signOut({callbackUrl: '/'})}>Sign out</Button>
            </div>
            {loading ? <Spin/> : (
                <>
                    <Card title="Profile" style={{marginBottom: 16}} extra={<Link href="/account/profile">Edit</Link>}>
                        <div><Text strong>Name:</Text> {me?.name || '—'}</div>
                        <div><Text strong>Email:</Text> {me?.email}</div>
                        <div><Text strong>Phone:</Text> {me?.phone || '—'}</div>
                    </Card>
                    <Card title="Shipping addresses" extra={<Link href="/account/addresses">Manage</Link>}>
                        {me?.shippingAddresses?.length
                            ? me.shippingAddresses.map((a: any) => <div key={a.id}>{a.name}</div>)
                            : <Text type="secondary">No saved addresses yet.</Text>}
                    </Card>
                </>
            )}
        </div>
    );
};

export const getServerSideProps: GetServerSideProps = async (ctx) => {
    const guard = await requireCustomerSession(ctx);
    if (!guard.ok) return {redirect: guard.redirect};
    return {props: {session: guard.session}};
};

export default AccountHome;
