import {DeleteOutlined} from "./icons";
import {Button, Popconfirm} from 'antd';
import React, {JSX, useRef} from "react";
import {TFunction} from "i18next";
import {getCachedMode} from "@admin/lib/adminMode";

interface PropsEditWrapper {
    children: React.ReactNode,
    deleteAction?: () => Promise<void>,
    editAction?: () => void,
    editContent?: JSX.Element,
    edit?: boolean,
    del?: boolean,
    admin: boolean,
    wrapperClass?: string,
    t: TFunction<"translation", undefined>
}

const EditWrapper = (
    {
        admin,
        wrapperClass,
        children,
        editAction,
        editContent,
        deleteAction,
        edit = false,
        del = true,
        t
    }: PropsEditWrapper) => {
    const wrapperRef = useRef<HTMLDivElement>(null);
    // Simplified-mode authoring: clicking anywhere on the rendered module
    // body opens the edit drawer. We trigger the existing edit Button
    // via querySelector inside our own DOM subtree (the AddNewSectionItem
    // tags it with `section-module-edit-<type>-btn`). Falls through to
    // explicit edit-button click in advanced mode.
    const simplified = admin && getCachedMode() === 'simplified';
    const onBodyClick = (e: React.MouseEvent) => {
        if (!simplified) return;
        const tag = (e.target as HTMLElement)?.closest?.('button, a, input, .ant-popconfirm');
        if (tag) return;  // don't hijack clicks on inner controls
        const btn = wrapperRef.current?.querySelector<HTMLButtonElement>(
            'button[data-testid^="section-module-edit-"]',
        );
        if (btn) {
            e.stopPropagation();
            btn.click();
        }
    };
    return (
        <div className={wrapperClass} ref={wrapperRef}>
            {
                admin ?
                    <div className={'edit-wrapper'}>
                        {(edit && editContent) && (
                            simplified
                                ? <div style={{display: 'none'}} aria-hidden>{editContent}</div>
                                : <div className={'edit-button-container edit-container'}>
                                    <div className={'edit-button'}>{editContent}</div>
                                </div>
                        )}
                        {
                            children && <div onClick={onBodyClick} style={simplified ? {cursor: 'pointer'} : undefined}>{children}</div>
                        }
                        {
                            (del && deleteAction) && <div className={'edit-button-container delete-container'}>
                                <Popconfirm
                                    title={t("Delete")}
                                    description={t("Are you sure to delete?")}
                                    onConfirm={async () => {
                                        await deleteAction()
                                    }}
                                    okText={t("Delete")}
                                    cancelText={t("Cancel")}
                                >
                                    <Button danger>
                                        <DeleteOutlined/>
                                    </Button>
                                </Popconfirm>
                            </div>
                        }

                    </div>
                    :
                    <div>{children}</div>
            }
        </div>
    )
}
export default EditWrapper