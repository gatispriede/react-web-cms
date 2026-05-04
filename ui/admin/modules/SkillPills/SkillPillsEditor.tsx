import React from "react";
import {Input, Select} from "antd";
import {IInputContent} from "@interfaces/IInputContent";
import {EItemType} from "@enums/EItemType";
import {SkillPillsContent} from "@client/modules/SkillPills";

const SkillPillsEditor = ({content, setContent, t}: IInputContent) => {
    const pills = new SkillPillsContent(EItemType.SkillPills, content);
    const data = pills.data;
    return (
        <div className={'skill-pills-editor'}>
            <label>{t('Category label')}</label>
            <Input
                data-testid="module-editor-primary-text-input"
                value={data.category}
                onChange={e => { pills.setField('category', e.target.value); setContent(pills.stringData); }}
                placeholder="e.g. Tech stack"
            />
            <label style={{marginTop: 12, display: 'block'}}>{t('Skills (press Enter after each)')}</label>
            <Select
                mode="tags"
                style={{width: '100%'}}
                value={data.items}
                onChange={v => { pills.setField('items', v); setContent(pills.stringData); }}
                tokenSeparators={[',', ';']}
                placeholder="React, Node.js, GraphQL…"
            />
        </div>
    );
};

export {SkillPillsEditor};
export default SkillPillsEditor;
