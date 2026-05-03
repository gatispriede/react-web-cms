import React, {useState} from 'react';
import {Button, Input} from 'antd';
import {TFunction} from 'i18next';
import ImageUrlInput from '@client/lib/ImageUrlInput';
import {IImageRef} from '@interfaces/IImageRef';
import {normalizeCssDimension} from '@utils/stringFunctions';

interface Props {
    value: IImageRef;
    onChange: (next: IImageRef) => void;
    t: TFunction<'translation', undefined>;
    placeholder?: string;
    label?: string;
    'data-testid'?: string;
    /** Hide the alt-text row when the surrounding module already exposes a
     *  separate caption / description for the image. */
    hideAlt?: boolean;
}

const dimToString = (v: IImageRef['width']): string =>
    v === undefined || v === null ? '' : String(v);

const ImageRefInput: React.FC<Props> = ({value, onChange, t, placeholder, label, hideAlt, ...rest}) => {
    const testid = (rest as {'data-testid'?: string})['data-testid'];
    const hasAdvanced = !!(value.alt || value.width || value.height);
    const [showAdvanced, setShowAdvanced] = useState<boolean>(hasAdvanced);
    const patch = (p: Partial<IImageRef>) => onChange({...value, ...p});
    return (
        <div>
            {label && <label>{label}</label>}
            <ImageUrlInput
                t={t}
                value={value.src}
                onChange={(src) => patch({src})}
                placeholder={placeholder}
                data-testid={testid}
            />
            <div style={{marginTop: 6}}>
                <Button
                    type="link"
                    size="small"
                    style={{padding: 0}}
                    onClick={() => setShowAdvanced((v) => !v)}
                    aria-expanded={showAdvanced}
                >
                    {showAdvanced ? t('Show less') : t('Show more')}
                </Button>
            </div>
            {showAdvanced && (
                <div style={{marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6}}>
                    {!hideAlt && (
                        <Input
                            placeholder={t('Alt text')}
                            value={value.alt ?? ''}
                            onChange={(e) => patch({alt: e.target.value || undefined})}
                        />
                    )}
                    <Input
                        placeholder={t('Image width')}
                        value={dimToString(value.width)}
                        onChange={(e) => patch({width: e.target.value || undefined})}
                        onBlur={(e) => {
                            const norm = normalizeCssDimension(e.target.value);
                            if (norm !== e.target.value) patch({width: norm || undefined});
                        }}
                    />
                    <Input
                        placeholder={t('Image height')}
                        value={dimToString(value.height)}
                        onChange={(e) => patch({height: e.target.value || undefined})}
                        onBlur={(e) => {
                            const norm = normalizeCssDimension(e.target.value);
                            if (norm !== e.target.value) patch({height: norm || undefined});
                        }}
                    />
                </div>
            )}
        </div>
    );
};

export default ImageRefInput;
