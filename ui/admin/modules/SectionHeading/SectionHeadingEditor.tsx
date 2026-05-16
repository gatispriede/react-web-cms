import React from "react";
import {Input, Select, Space} from "antd";
import {IInputContent} from "@interfaces/IInputContent";
import {EItemType} from "@enums/EItemType";
import {ISectionHeading, SectionHeadingContent} from "@client/modules/SectionHeading";

/**
 * SectionHeading admin form. Operator authors:
 *   - eyebrow (optional small label above the heading; e.g. "§ 01 · Capability matrix")
 *   - heading (required H2)
 *   - subtitle (optional)
 *   - align (optional override of variant default)
 *
 * Variant (editorial / tech-modern / centered-marquee) is picked via
 * the standard Style dropdown on the parent dialog, not in this form.
 */
const SectionHeadingEditor: React.FC<IInputContent> = ({content, setContent, t}) => {
    const mgr = new SectionHeadingContent(EItemType.SectionHeading, content);
    const data = mgr.data;
    const commit = (n: ISectionHeading) => { mgr.data = n; setContent(mgr.stringData); };

    return (
        <Space direction="vertical" style={{width: '100%'}} size={6}>
            <Input
                value={data.eyebrow ?? ''}
                onChange={e => commit({...data, eyebrow: e.target.value || undefined})}
                placeholder={t('Eyebrow (optional, e.g. § 01 · Section name)')}
                data-testid="sh-eyebrow-input"
            />
            <Input
                value={data.heading}
                onChange={e => commit({...data, heading: e.target.value})}
                placeholder={t('Heading')}
                data-testid="module-editor-primary-text-input"
            />
            <Input
                value={data.subtitle ?? ''}
                onChange={e => commit({...data, subtitle: e.target.value || undefined})}
                placeholder={t('Subtitle (optional)')}
                data-testid="sh-subtitle-input"
            />
            <Select
                value={data.align ?? 'default'}
                onChange={v => commit({...data, align: v === 'default' ? undefined : (v as 'left' | 'center')})}
                options={[
                    {value: 'default', label: t('Alignment — follow variant')},
                    {value: 'left', label: t('Align left')},
                    {value: 'center', label: t('Align center')},
                ]}
                style={{width: '100%'}}
                data-testid="sh-align-select"
            />
        </Space>
    );
};

export {SectionHeadingEditor};
export default SectionHeadingEditor;
