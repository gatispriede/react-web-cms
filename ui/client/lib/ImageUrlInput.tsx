import React from 'react';
import {Input} from 'antd';
import {TFunction} from 'i18next';
import ImageUpload from '@admin/lib/ImageUpload';
import {PUBLIC_IMAGE_PATH} from '@utils/imgPath';
import {useImageDrop} from './useImageDrop';

interface Props {
    value?: string;
    onChange?: (val: string) => void;
    placeholder?: string;
    t: TFunction<'translation', undefined>;
}

const DROP_OVER_STYLE: React.CSSProperties = {
    outline: '2px dashed var(--theme-colorPrimary, #1677ff)',
    outlineOffset: 2,
    borderRadius: 4,
};

const ImageUrlInput: React.FC<Props> = ({value, onChange, placeholder, t}) => {
    const {dropHandlers, isDragOver} = useImageDrop(
        img => onChange?.(PUBLIC_IMAGE_PATH + img.name)
    );

    return (
        <div {...dropHandlers} style={isDragOver ? DROP_OVER_STYLE : undefined}>
            <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                <Input
                    style={{flex: 1}}
                    value={value ?? ''}
                    onChange={e => onChange?.(e.target.value)}
                    placeholder={placeholder}
                />
                <ImageUpload t={t} setFile={f => onChange?.(PUBLIC_IMAGE_PATH + f.name)}/>
            </div>
        </div>
    );
};

export default ImageUrlInput;
