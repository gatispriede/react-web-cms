/**
 * admin-module-composed — `AdminWizard` view shape.
 *
 * Generic multi-step surface: an AntD `<Steps>` indicator + the active
 * step's body in `children` + a Back/Next footer. Pure view capacity —
 * the bridge owns the per-step forms + the step-advance logic in its
 * ViewModel; this module is just the stepper chrome.
 */
import React from 'react';
import {Button, Card, Space, Steps} from 'antd';

export interface AdminWizardStep {
    key: string;
    title: string;
    description?: string;
}

export interface AdminWizardModuleProps {
    testId: string;
    title?: string;
    steps: AdminWizardStep[];
    /** Zero-based index of the active step. */
    currentStep: number;
    /** The active step's body. */
    children: React.ReactNode;
    onBack?: () => void;
    onNext?: () => void;
    backLabel?: string;
    nextLabel?: string;
    /** Disable the Next button (e.g. the active step is incomplete). */
    nextDisabled?: boolean;
    nextLoading?: boolean;
    backTestId?: string;
    nextTestId?: string;
    /** Replaces the Next button on the final step (e.g. "Finish"). */
    finishSlot?: React.ReactNode;
}

const AdminWizardModule: React.FC<AdminWizardModuleProps> = ({
    testId,
    title,
    steps,
    currentStep,
    children,
    onBack,
    onNext,
    backLabel = 'Back',
    nextLabel = 'Next',
    nextDisabled,
    nextLoading,
    backTestId,
    nextTestId,
    finishSlot,
}) => {
    const isLast = currentStep >= steps.length - 1;
    return (
        <div data-testid={testId} style={{padding: 16}}>
            <Card title={title}>
                <Steps
                    current={currentStep}
                    items={steps.map(s => ({title: s.title, description: s.description}))}
                    style={{marginBottom: 24}}
                />
                <div data-testid={`${testId}-step-body`}>{children}</div>
                <Space style={{marginTop: 24}}>
                    <Button
                        data-testid={backTestId}
                        onClick={onBack}
                        disabled={!onBack || currentStep === 0}
                    >{backLabel}</Button>
                    {isLast && finishSlot
                        ? finishSlot
                        : (
                            <Button
                                data-testid={nextTestId}
                                type="primary"
                                onClick={onNext}
                                disabled={!onNext || nextDisabled}
                                loading={nextLoading}
                            >{nextLabel}</Button>
                        )}
                </Space>
            </Card>
        </div>
    );
};

export default AdminWizardModule;
export {AdminWizardModule};
