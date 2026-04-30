import React from "react";
import {Input, Space} from "antd";
import {IInputContent} from "@interfaces/IInputContent";
import {EItemType} from "@enums/EItemType";
import {ArchitectureTiersContent, IArchitectureTiers} from "@client/modules/ArchitectureTiers";

const {TextArea} = Input;

/**
 * Minimal editor — exposes the top-level identity fields and a JSON
 * textarea for the rest of the structure (tiers / shared / lifecycle).
 * Stub-level on purpose: the inline JSON edit is fast enough for content
 * authoring through the bundle generator path; we'll graduate this to
 * a structured form when authoring shifts into the admin UI.
 */
const ArchitectureTiersEditor: React.FC<IInputContent> = ({content, setContent, t}) => {
    const mgr = new ArchitectureTiersContent(EItemType.ArchitectureTiers, content);
    const data = mgr.data;
    const commit = (n: IArchitectureTiers) => { mgr.data = n; setContent(mgr.stringData); };
    const update = (p: Partial<IArchitectureTiers>) => commit({...data, ...p});
    const json = JSON.stringify({tiers: data.tiers ?? [], sharedTitle: data.sharedTitle, sharedDescription: data.sharedDescription, sharedPills: data.sharedPills, lifecycleLabel: data.lifecycleLabel, lifecycleNote: data.lifecycleNote, lifecycleSteps: data.lifecycleSteps ?? []}, null, 2);
    const replaceFromJson = (raw: string) => {
        try {
            const parsed = JSON.parse(raw);
            commit({...data, ...parsed});
        } catch {/* keep editing — only commit on valid JSON */}
    };

    return (
        <Space direction="vertical" style={{width: '100%'}} size={6}>
            <label>{t('Eyebrow')}</label>
            <Input value={data.eyebrow ?? ''} onChange={e => update({eyebrow: e.target.value})}/>
            <label>{t('Title')}</label>
            <Input data-testid="module-editor-primary-text-input" value={data.title ?? ''} onChange={e => update({title: e.target.value})}/>
            <label>{t('Subtitle')}</label>
            <Input value={data.subtitle ?? ''} onChange={e => update({subtitle: e.target.value})}/>
            <label>{t('Intro paragraph')}</label>
            <TextArea value={data.intro ?? ''} onChange={e => update({intro: e.target.value})} rows={3}/>
            <label>{t('Tiers / shared / lifecycle (JSON)')}</label>
            <TextArea defaultValue={json} onChange={e => replaceFromJson(e.target.value)} rows={14}/>
        </Space>
    );
};

export {ArchitectureTiersEditor};
export default ArchitectureTiersEditor;
