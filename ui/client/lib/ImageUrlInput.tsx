import React from 'react';
import {Input} from 'antd';
import {TFunction} from 'i18next';
import ImageUpload from '@admin/lib/ImageUpload';
import {PUBLIC_IMAGE_PATH} from '@utils/imgPath';
import ImageDropTarget from '@client/lib/ImageDropTarget';

interface Props {
    value?: string;
    onChange?: (val: string) => void;
    placeholder?: string;
    t: TFunction<'translation', undefined>;
}

/**
 * Compact `url + upload + drop` trio used by small editors (Hero CTA image,
 * Stats icon, etc). The drop wrapper accepts the same sources as the bigger
 * module editors (OS file, picker tile, URL drag) so behaviour is
 * consistent across the admin — see `ImageDropTarget`.
 */
const ImageUrlInput: React.FC<Props> = ({value, onChange, placeholder, t}) => {
    return (
        <ImageDropTarget
            filled={!!value}
            onImage={img => onChange?.(PUBLIC_IMAGE_PATH + img.name)}
        >
            <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                <Input
                    style={{flex: 1}}
                    value={value ?? ''}
                    onChange={e => onChange?.(e.target.value)}
                    placeholder={placeholder}
                />
                <ImageUpload t={t} setFile={f => onChange?.(PUBLIC_IMAGE_PATH + f.name)}/>
            </div>
        </ImageDropTarget>
    );
};

export default ImageUrlInput;
