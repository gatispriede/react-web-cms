import TranslationManager from "../TranslationManager";
import React, {use, useEffect, useState} from "react";
import {Input} from "antd";

export const ContentLoader = ({translationManager, currentLanguageKey, dataPromise, i18n, setTranslation, t, tApp}: {
    translationManager: TranslationManager,
    currentLanguageKey: string,
    dataPromise: any,
    setTranslation: any,
    i18n: any,
    t: (data: string) => string,
    tApp: (data: string) => string
}) => {

    use(dataPromise);

    const [translations] = useState(translationManager.getTranslations())

    const keys = Object.keys(translations);
    const newTranslations: any = {};

    useEffect(() => {
        // eslint-disable-next-line array-callback-return
        keys.map(key => {
            newTranslations[key] = t(key)
        })
    }, [currentLanguageKey]);

    const translationChange = (key: string, event: any) => {
        newTranslations[key] = event.target.value
        setTranslation(newTranslations);
    }

    return <div style={{
        padding: 24,
        minHeight: 360,
        background: '#fff',
        borderRadius: '2px',
    }}>
        {
            currentLanguageKey === 'default' ?
                keys.map(key => {
                    return (
                        <div key={key}>
                            <p>{translations[key]}</p>
                        </div>
                    )
                })
                :
                <div>
                    {
                        keys.map(key => {
                            return (
                                <div key={key}>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'flex-start',
                                        alignItems: 'center'
                                    }}>
                                        <label style={{
                                            width: '30px',
                                            margin: '0 10px 0 0',
                                        }}>{'Key'}:</label>
                                        <p style={{
                                            border: '1px solid #f3f3f3'
                                        }}>{translations[key]}</p>
                                    </div>
                                    <div>
                                        <label>{'Translation'}:</label>
                                        <Input key={t(key)} defaultValue={t(key)} onChange={(event) => {
                                            translationChange(key, event)
                                        }}/>
                                    </div>

                                    <hr/>
                                </div>
                            )
                        })
                    }
                </div>
        }
    </div>;
}