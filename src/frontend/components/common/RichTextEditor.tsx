'use client'
import { Editor } from 'react-draft-wysiwyg';
import 'react-draft-wysiwyg/dist/react-draft-wysiwyg.css';
import {useEffect, useState} from "react";
import { EditorState, convertToRaw, convertFromRaw, RawDraftContentState } from 'draft-js';

const RichTextEditor = ({value, setValue}: {value: RawDraftContentState, setValue: any}) => {
    const [editorState, setContent] = useState(EditorState.createEmpty());
    useEffect(() => {
        try{
            const contentState = convertFromRaw(value);
            const editorState = EditorState.createWithContent(contentState);
            setContent(editorState)
        }catch(e){
            console.log(e)
        }
    }, []);
    const onContentChanged = (editorState: EditorState) => {
        setContent(editorState)
        setValue(convertToRaw(editorState.getCurrentContent()))
    }
    return (
        <div>
            <Editor
                editorState={editorState}
                wrapperClassName="wrapper-class"
                editorClassName="editor-class"
                toolbarClassName="toolbar-class"
                onEditorStateChange={onContentChanged}
            />
        </div>
    )
}

export default RichTextEditor