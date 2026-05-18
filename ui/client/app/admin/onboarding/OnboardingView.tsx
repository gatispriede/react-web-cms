'use client';
/**
 * Client view for `/admin/onboarding` — App Router migration, Batch 6.
 * Direct lift of the visible chrome from `pages/admin/onboarding.tsx`,
 * with `useRouter` swapped from `next/router` to `next/navigation`
 * (same `push(path)` surface — App-Router-native AND works in Pages
 * Router; the B4.5 unification rule).
 */
import React from 'react';
import {useRouter} from 'next/navigation';
import {ConfigProvider} from 'antd';
import OnboardingWizard from '@admin/features/Onboarding/OnboardingWizard';
import staticTheme from '@client/features/Themes/themeConfig';

const OnboardingView: React.FC = () => {
    const router = useRouter();
    return (
        <ConfigProvider theme={staticTheme}>
            <OnboardingWizard onComplete={() => router.push('/admin/build')}/>
        </ConfigProvider>
    );
};

export default OnboardingView;
