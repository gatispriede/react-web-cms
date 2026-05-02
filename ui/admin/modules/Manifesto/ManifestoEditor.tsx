import React, {useMemo} from "react";
import {Button, Input, Space, Typography} from "antd";
import {DeleteOutlined, PlusOutlined} from "@client/lib/icons";
import {LabeledInput} from "@client/lib/LabeledInput";
import {IInputContent} from "@interfaces/IInputContent";
import {EItemType} from "@enums/EItemType";
import {IManifesto, IManifestoChip, ManifestoContent} from "@client/modules/Manifesto";
import {SortableHandleItem, SortableList, arrayMove} from "@client/lib/SortableList";

const ManifestoEditor: React.FC<IInputContent> = ({content, setContent, t}) => {
    const mgr = new ManifestoContent(EItemType.Manifesto, content);
    const data = mgr.data;

    const commit = (next: IManifesto) => {
        mgr.data = next;
        setContent(mgr.stringData);
    };
    const update = (patch: Partial<IManifesto>) => commit({...data, ...patch});

    const chips: IManifestoChip[] = Array.isArray(data.chips) ? data.chips : [];
    const patchChip = (i: number, patch: Partial<IManifestoChip>) =>
        update({chips: chips.map((c, j) => j === i ? {...c, ...patch} : c)});
    const addChip = () => update({chips: [...chips, {key: '', thumb: '', color: ''}]});
    const removeChip = (i: number) => update({chips: chips.filter((_, j) => j !== i)});
    const reorderChips = (from: number, to: number) => update({chips: arrayMove(chips, from, to)});
    const chipIds = useMemo(() => chips.map((_, i) => `chip-${i}`), [chips.length]);

    return (
        <div className={'admin-manifesto'} style={{display: 'flex', flexDirection: 'column', gap: 14}}>
            <div>
                <label>{t('Body — supports *italic* and {{chip:KEY:LABEL}} tokens')}</label>
                <Input.TextArea
                    data-testid="module-editor-primary-text-input"
                    value={data.body}
                    onChange={e => update({body: e.target.value})}
                    rows={6}
                    placeholder="From bold {{chip:react:brands}} to everyday {{chip:teams:teams,}} I architect {{chip:code:software}} for *people,* {{chip:cloud:products}} and {{chip:3d:platforms}} that have a problem worth solving."
                />
                <Typography.Text type="secondary" style={{fontSize: 12, display: 'block', marginTop: 4}}>
                    {t('Each {{chip:KEY:LABEL}} renders as a pill; KEY matches a chip defined below (for thumb + colour), LABEL becomes the visible text.')}
                </Typography.Text>
            </div>

            <div>
                <label>{t('Addendum (optional secondary paragraph)')}</label>
                <Input.TextArea
                    value={data.addendum ?? ''}
                    onChange={e => update({addendum: e.target.value})}
                    rows={3}
                    placeholder="Fifteen years turning vision into running code…"
                />
            </div>

            <div>
                <div style={{marginBottom: 6, fontWeight: 500}}>{t('Chip definitions')}</div>
                <Typography.Text type="secondary" style={{fontSize: 12, display: 'block', marginBottom: 6}}>
                    {t('Thumb background — any CSS background value. Click an example to insert it:')}
                </Typography.Text>
                {/* CSS example chips. Clicking one would patch every chip with the
                    same value, which we don't want — so the only behaviour is
                    "show me what works". Operators copy by selecting the text. */}
                <div style={{display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10}}>
                    {[
                        '#1677ff',
                        'crimson',
                        'linear-gradient(135deg, #61DAFB, #0D1117)',
                        'radial-gradient(circle, #61DAFB22, #0D1117)',
                        'url(/images/react.svg) center/cover',
                    ].map(ex => (
                        <code
                            key={ex}
                            style={{
                                fontSize: 11,
                                padding: '2px 8px',
                                borderRadius: 4,
                                background: '#f5f5f5',
                                border: '1px solid #e0e0e0',
                                userSelect: 'all',
                                cursor: 'text',
                            }}
                            title={t('Click to select, then copy')}
                        >
                            {ex}
                        </code>
                    ))}
                </div>
                <SortableList ids={chipIds} onReorder={reorderChips}>
                <Space orientation="vertical" style={{width: '100%'}} size={6}>
                    {chips.map((c, i) => (
                        <SortableHandleItem key={chipIds[i]} id={chipIds[i]}>
                            <LabeledInput value={c.key} onChange={e => patchChip(i, {key: e.target.value})} placeholder="react" label={t('Key')} wrapperStyle={{width: 220}}/>
                            <LabeledInput value={c.thumb} onChange={e => patchChip(i, {thumb: e.target.value})} placeholder="REACT" label={t('Thumb')} wrapperStyle={{width: 200}}/>
                            <LabeledInput value={c.color ?? ''} onChange={e => patchChip(i, {color: e.target.value})} placeholder="linear-gradient(135deg, #61DAFB, #0D1117)" label={t('Thumb background (CSS)')} wrapperStyle={{flex: 1, minWidth: 280}}/>
                            {/* Live swatch — same `background` rule the renderer
                                uses, so invalid values silently render as the
                                default and valid ones preview instantly. */}
                            <span
                                aria-label={t('Background preview') as string}
                                style={{
                                    display: 'inline-block',
                                    width: 28,
                                    height: 28,
                                    borderRadius: 4,
                                    border: '1px solid #d9d9d9',
                                    background: c.color || undefined,
                                }}
                            />
                            <Button danger size="small" icon={<DeleteOutlined/>} onClick={() => removeChip(i)}/>
                        </SortableHandleItem>
                    ))}
                </Space>
                </SortableList>
                <Button type="dashed" icon={<PlusOutlined/>} onClick={addChip} block style={{marginTop: 8}}>
                    {t('Add chip definition')}
                </Button>
            </div>
        </div>
    );
};

export {ManifestoEditor};
export default ManifestoEditor;
