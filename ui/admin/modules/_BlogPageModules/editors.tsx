/**
 * all-pages-module-composed — Blog batch admin editor.
 *
 * `BlogPost` renders a single post end-to-end from the post record
 * (title / cover / body / author / date / tags) — there is no
 * operator-editable copy, the content is entirely post-driven. The
 * editor is therefore an explanatory placeholder, mirroring the
 * `_ProductPageModules` auto-injected-module editors.
 */
import React from 'react';
import type {IInputContent} from '@interfaces/IInputContent';

export const BlogPostEditor: React.FC<IInputContent> = () => (
    <div className="blog-editor blog-editor--blog-post" data-testid="editor-blog-post">
        <p style={{fontSize: 12, opacity: 0.8, margin: 0}}>
            This module renders the post for the current <code>/blog/[slug]</code> URL —
            title, cover, body, author, date and tags all come from the post record.
            Nothing to configure here.
        </p>
    </div>
);
