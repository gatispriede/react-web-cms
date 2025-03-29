import DataLoader from "../DataLoader";
import React, {use} from "react";
import {Input} from "antd";

export const ContentLoader = ({dataLoader, currentLanguageKey, dataPromise, i18n}: {
    dataLoader: DataLoader,
    currentLanguageKey: string,
    dataPromise: any,
    i18n: any
}) => {

    use(dataPromise);

    const translations = dataLoader.getTranslations()
    const keys = Object.keys(translations);

    const translationChange = (event: any) => {
        console.log(event.target.value);

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
                                        <Input onChange={translationChange}/>
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