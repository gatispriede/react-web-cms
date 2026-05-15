import React from 'react';
import {Input} from 'antd';
import {TFunction} from 'i18next';
import LinkTargetPicker from '@admin/lib/LinkTargetPicker';
import {ILinkRef} from '@interfaces/ILinkRef';

interface Props {
    value: ILinkRef;
    onChange: (next: ILinkRef) => void;
    t: TFunction<'translation', undefined>;
    placeholder?: string;
    label?: string;
    /** When true, hide the label row — useful for Gallery tile `href` where
     *  the image itself is the affordance. */
    hideLabel?: boolean;
    /** Forwarded to `<LinkTargetPicker>` — drives testid namespace so
     *  e2e specs can target picker children unambiguously. */
    hostId?: string;
}

const LinkRefInput: React.FC<Props> = ({value, onChange, t, placeholder, label, hideLabel, hostId}) => {
    const patch = (p: Partial<ILinkRef>) => onChange({...value, ...p});
    return (
        <div data-testid={hostId ? `link-ref-input-${hostId}` : undefined}>
            {label && <label>{label}</label>}
            <LinkTargetPicker
                value={value.url}
                onChange={(url) => patch({url})}
                placeholder={placeholder}
                hostId={hostId}
            />
            {!hideLabel && (
                <Input
                    data-testid={hostId ? `link-ref-input-${hostId}-label` : undefined}
                    style={{marginTop: 4}}
                    placeholder={t('Label')}
                    value={value.label ?? ''}
                    onChange={(e) => patch({label: e.target.value || undefined})}
                />
            )}
        </div>
    );
};

export default LinkRefInput;
