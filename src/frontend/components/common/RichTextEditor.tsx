'use client'
import {CKEditor} from '@ckeditor/ckeditor5-react';

import {
    Alignment,
    Autoformat,
    Base64UploadAdapter,
    BlockQuote,
    Bold,
    ClassicEditor,
    CloudServices,
    Essentials,
    FindAndReplace,
    FontBackgroundColor,
    FontColor,
    FontFamily,
    FontSize,
    Heading,
    HorizontalLine,
    Indent,
    IndentBlock,
    Italic,
    Link,
    List,
    ListProperties,
    MediaEmbed,
    Mention,
    Paragraph,
    PasteFromOffice,
    PictureEditing,
    RemoveFormat,
    SpecialCharacters,
    SpecialCharactersEssentials,
    Strikethrough,
    Subscript,
    Superscript,
    Table,
    TableToolbar,
    TextTransformation,
    Underline
} from 'ckeditor5';
import 'ckeditor5/ckeditor5.css';


const RichTextEditor = ({value, setValue}: { value: any, setValue: any }) => {
    const plugins = [
        Alignment,
        Autoformat,
        BlockQuote,
        Bold,
        CloudServices,
        Essentials,
        FindAndReplace,
        FontBackgroundColor,
        FontColor,
        FontFamily,
        FontSize,
        Heading,
        HorizontalLine,
        Base64UploadAdapter,
        Indent,
        IndentBlock,
        Italic,
        Link,
        List,
        ListProperties,
        MediaEmbed,
        Mention,
        Paragraph,
        PasteFromOffice,
        PictureEditing,
        RemoveFormat,
        SpecialCharacters,
        SpecialCharactersEssentials,
        Strikethrough,
        Subscript,
        Superscript,
        Table,
        TableToolbar,
        TextTransformation,
        Underline,

    ]
    const toolbar = [
        'undo',
        'redo',
        '|',
        'heading',
        '|',
        'bold',
        'italic',
        'underline',
        'removeFormat',
        'alignment',
        '|',
        'link',
        'insertTable',
        'blockQuote',
        '|',
        'bulletedList',
        'numberedList',
        '|',
        'outdent',
        'indent'
    ]

    return (
        <CKEditor
            editor={ClassicEditor}
            data={value}
            config={{
                licenseKey: 'GPL',
                plugins: plugins,
                toolbar: toolbar,
            }}
            /*onReady={(editor) => {
                // You can store the "editor" and use when it is needed.
                // console.log("Editor is ready to use!", editor);
            }}*/
            onChange={(event, editor) => {
                const data = editor.getData();
                setValue(data)
            }}
        />
    )

}

export default RichTextEditor