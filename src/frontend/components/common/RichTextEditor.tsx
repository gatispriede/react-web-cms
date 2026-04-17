'use client'
import {CKEditor} from '@ckeditor/ckeditor5-react';
import React from 'react';

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

// Define prop types for better type safety
interface RichTextEditorProps {
    value: string;
    setValue: (data: string) => void;
}

// Move plugins and toolbar outside the component to avoid re-creation
const editorPlugins = [
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
    Underline
];

const editorToolbar = [
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
    'fontbackgroundcolor',
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
];

const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, setValue }) => {
    // Add error handling for onChange
    const handleChange = (_event: any, editor: any) => {
        try {
            const data = editor.getData();
            setValue(data);
        } catch (error) {
            // Optionally log or handle error
            console.error('Error updating editor data:', error);
        }
    };

    return (
        <CKEditor
            editor={ClassicEditor}
            data={value}
            config={{
                licenseKey: 'GPL',
                plugins: editorPlugins,
                toolbar: editorToolbar
            }}
            onChange={handleChange}
        />
    );
}

export default RichTextEditor