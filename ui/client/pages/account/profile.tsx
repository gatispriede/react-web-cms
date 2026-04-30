import React, {useEffect, useState} from 'react';
import {GetServerSideProps} from 'next';
import Link from 'next/link';
import {Alert, Button, Card, Form, Input, Spin, Typography} from 'antd';
import {requireCustomerSession} from '@client/lib/account/session';
import {gql, parseEnvelope} from '@client/lib/account/gqlClient';

const {Title} = Typography;

const ProfilePage = () => {
    const [loading, setLoading] = useState(true);
    const [profileForm] = Form.useForm();
    const [pwForm] = Form.useForm();
    const [profileMsg, setProfileMsg] = useState<{type: 'success' | 'error'; text: string} | null>(null);
    const [pwMsg, setPwMsg] = useState<{type: 'success' | 'error'; text: string} | null>(null);
    const [savingProfile, setSavingProfile] = useState(false);
    const [savingPw, setSavingPw] = useState(false);

    useEffect(() => {
        gql(`query Me { mongo { me { name email phone } } }`)
            .then(d => {
                const me = d?.mongo?.me;
                if (me) profileForm.setFieldsValue(me);
            })
            .finally(() => setLoading(false));
    }, [profileForm]);

    const saveProfile = async (values: {name?: string; email?: string; phone?: string}) => {
        setSavingProfile(true);
        setProfileMsg(null);
        try {
            const data = await gql(
                `mutation Update($customer: InUser!) { mongo { updateMyProfile(customer: $customer) } }`,
                {customer: values},
            );
            const env = parseEnvelope(data?.mongo?.updateMyProfile);
            if (env.error) setProfileMsg({type: 'error', text: env.error});
            else setProfileMsg({type: 'success', text: 'Profile updated'});
        } catch (e: any) {
            setProfileMsg({type: 'error', text: e?.message || 'Update failed'});
        } finally {
            setSavingProfile(false);
        }
    };

    const changePassword = async (values: {oldPassword: string; newPassword: string}) => {
        setSavingPw(true);
        setPwMsg(null);
        try {
            const data = await gql(
                `mutation Pw($oldPassword: String!, $newPassword: String!) { mongo { changeMyPassword(oldPassword: $oldPassword, newPassword: $newPassword) } }`,
                values,
            );
            const env = parseEnvelope(data?.mongo?.changeMyPassword);
            if (env.error) setPwMsg({type: 'error', text: env.error});
            else { setPwMsg({type: 'success', text: 'Password changed'}); pwForm.resetFields(); }
        } catch (e: any) {
            setPwMsg({type: 'error', text: e?.message || 'Change failed'});
        } finally {
            setSavingPw(false);
        }
    };

    return (
        <div style={{maxWidth: 720, margin: '40px auto', padding: 16}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <Title level={2}>Profile</Title>
                <Link href="/account">Back</Link>
            </div>
            {loading ? <Spin/> : (
                <>
                    <Card title="Personal details" style={{marginBottom: 16}}>
                        {profileMsg && <Alert style={{marginBottom: 12}} type={profileMsg.type} showIcon message={profileMsg.text}/>}
                        <Form form={profileForm} layout="vertical" onFinish={saveProfile}>
                            <Form.Item label="Name" name="name"><Input/></Form.Item>
                            <Form.Item label="Email" name="email" rules={[{type: 'email'}]}><Input/></Form.Item>
                            <Form.Item label="Phone" name="phone"><Input/></Form.Item>
                            <Button type="primary" htmlType="submit" loading={savingProfile}>Save</Button>
                        </Form>
                    </Card>
                    <Card title="Change password">
                        {pwMsg && <Alert style={{marginBottom: 12}} type={pwMsg.type} showIcon message={pwMsg.text}/>}
                        <Form form={pwForm} layout="vertical" onFinish={changePassword}>
                            <Form.Item label="Current password" name="oldPassword" rules={[{required: true}]}>
                                <Input.Password autoComplete="current-password"/>
                            </Form.Item>
                            <Form.Item label="New password" name="newPassword" rules={[{required: true, min: 8}]}>
                                <Input.Password autoComplete="new-password"/>
                            </Form.Item>
                            <Button type="primary" htmlType="submit" loading={savingPw}>Change password</Button>
                        </Form>
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

export default ProfilePage;
