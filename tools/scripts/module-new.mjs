#!/usr/bin/env node
/**
 * Scaffold a new CMS module — generates the 6 files + 4 registry edits
 * + 2 SCSS imports + sample-fixture entry that a manual port of an
 * existing module would have to author by hand.
 *
 *   npm run module:new <PascalName> [--label "<UI label>"] [--desc "<short description>"]
 *
 * Example:
 *   npm run module:new SectionHeading --label "Section heading" --desc "Eyebrow + heading + subtitle"
 *
 * What this generates:
 *
 *   ui/client/modules/<Name>/<Name>.tsx
 *   ui/client/modules/<Name>/<Name>.types.ts
 *   ui/client/modules/<Name>/<Name>.scss
 *   ui/client/modules/<Name>/index.ts
 *   ui/admin/modules/<Name>/<Name>Editor.tsx
 *   ui/admin/modules/<Name>/index.ts
 *
 * What this edits (idempotent — re-runs are safe):
 *
 *   shared/enums/EItemType.ts                   → add <Name> = "<SNAKE_NAME>"
 *   ui/client/modules/clientItemTypes.ts        → import + registration entry
 *   ui/admin/modules/adminItemTypeEditors.ts    → imports + registration entry
 *   ui/client/lib/preview/samples.ts            → minimal + full samples
 *   ui/client/pages/_app.tsx                    → SCSS import (alphabetical)
 *   ui/client/app/layout.tsx                    → SCSS import (alphabetical)
 *
 * The generated module renders a single text slot at first — author
 * the design-step-derived JSX over the top. The scaffolder is about
 * boilerplate, not about guessing what the module should DO.
 */
import {readFileSync, writeFileSync, existsSync, mkdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

// --- args ---
const args = process.argv.slice(2);
const positional = args.filter(a => !a.startsWith('--'));
const Name = positional[0];
if (!Name || !/^[A-Z][A-Za-z0-9]+$/.test(Name)) {
    console.error('Usage: module-new <PascalName> [--label "X"] [--desc "Y"]');
    console.error('  Name must be PascalCase, e.g. SectionHeading');
    process.exit(2);
}
function flag(name, fallback) {
    const i = args.indexOf(name);
    return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}
const label = flag('--label', spaceCamel(Name));
const desc = flag('--desc', `${spaceCamel(Name)} module — slot-driven content block.`);

const snake = Name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase(); // SectionHeading → SECTION_HEADING
const kebab = Name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase(); // SectionHeading → section-heading
const cssPrefix = Name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase(); // same as kebab

console.log(`Scaffolding ${Name} (${snake} / ${kebab})…`);

// --- generate files ---

const clientDir = path.join(REPO_ROOT, 'ui', 'client', 'modules', Name);
const adminDir = path.join(REPO_ROOT, 'ui', 'admin', 'modules', Name);
mkdirSync(clientDir, {recursive: true});
mkdirSync(adminDir, {recursive: true});

writeIfAbsent(path.join(clientDir, `${Name}.types.ts`), `\
/**
 * ${Name} — TODO: describe the content shape this module represents.
 *
 * Scaffolded by \`npm run module:new\`; design pulled from the Stitch /
 * Claude design step. See docs/roadmap/_meta/stitch-design-pipeline.md.
 */

export interface I${Name} {
    /** Single-text-slot starter — replace with the real fields. */
    text?: string;
}

export enum E${Name}Style {
    Default = "default",
}
`);

writeIfAbsent(path.join(clientDir, `${Name}.tsx`), `\
import React from "react";
import {EItemType} from "@enums/EItemType";
import {IItem} from "@interfaces/IItem";
import ContentManager from "@client/lib/ContentManager";
import {TFunction} from "i18next";
import {InlineTranslatable} from "@client/lib/InlineTranslatable";
import RevealOnScroll from "@client/lib/RevealOnScroll";
import {inlineEditAttr} from "@client/lib/inlineEditAttr";
import type {I${Name}} from "./${Name}.types";
export type {I${Name}} from "./${Name}.types";
export {E${Name}Style} from "./${Name}.types";

const defaults: I${Name} = {};

export class ${Name}Content extends ContentManager {
    public _parsedContent: I${Name} = {...defaults};
    get data(): I${Name} {
        this.parse();
        return {...defaults, ...this._parsedContent};
    }
    set data(v: I${Name}) { this._parsedContent = v; }
    setField<K extends keyof I${Name}>(k: K, v: I${Name}[K]) { this._parsedContent[k] = v; }
}

const ${Name} = ({item, tApp, admin}: {
    item: IItem;
    t: TFunction<"translation", undefined>;
    tApp: TFunction<string, undefined>;
    admin?: boolean;
}) => {
    const c = new ${Name}Content(EItemType.${Name}, item.content).data;
    const tr = (v: string) => <InlineTranslatable tApp={tApp as any} source={v}/>;
    const editId = item.name || EItemType.${Name};
    const variant = item.style || 'default';
    if (!c.text) return null;

    return (
        <RevealOnScroll className={\`${cssPrefix} \${variant}\`}>
            <section data-variant={variant} data-testid="${kebab}">
                <div className="${cssPrefix}__root" {...inlineEditAttr(admin, editId, 'text')}>
                    {tr(c.text)}
                </div>
            </section>
        </RevealOnScroll>
    );
};

export default ${Name};
`);

writeIfAbsent(path.join(clientDir, `${Name}.scss`), `\
/**
 * ${Name} — module styles. Author the design-step-derived CSS here.
 * All colours via theme tokens (--theme-colorBgBase etc.); per-theme
 * variant overrides live in services/themes/<slug>/module-styles.scss.
 */
.${cssPrefix} {
  --${cssPrefix}-surface: var(--theme-colorBgBase, #fff);
  --${cssPrefix}-ink: var(--theme-colorTextBase, #1a1a1a);
  --${cssPrefix}-accent: var(--theme-colorAccent, var(--theme-colorPrimary, #c65a2a));

  &__root {
    background: var(--${cssPrefix}-surface);
    color: var(--${cssPrefix}-ink);
    padding: 1rem 1.5rem;
  }
}
`);

writeIfAbsent(path.join(clientDir, `index.ts`), `\
// ${Name} module barrel.
import ${Name} from './${Name}';

export default ${Name};
export {${Name}Content} from './${Name}';
export {E${Name}Style, type I${Name}} from './${Name}.types';
`);

writeIfAbsent(path.join(adminDir, `${Name}Editor.tsx`), `\
import React from "react";
import {Input} from "antd";
import {IInputContent} from "@interfaces/IInputContent";
import {EItemType} from "@enums/EItemType";
import {I${Name}, ${Name}Content} from "@client/modules/${Name}";

/** ${Name} admin form — author the real fields per the design-step slots. */
const ${Name}Editor: React.FC<IInputContent> = ({content, setContent, t}) => {
    const mgr = new ${Name}Content(EItemType.${Name}, content);
    const data = mgr.data;
    const commit = (n: I${Name}) => { mgr.data = n; setContent(mgr.stringData); };

    return (
        <Input.TextArea
            rows={3}
            value={data.text ?? ''}
            onChange={e => commit({...data, text: e.target.value})}
            placeholder={t('Text')}
            data-testid="module-editor-primary-text-input"
        />
    );
};

export {${Name}Editor};
export default ${Name}Editor;
`);

writeIfAbsent(path.join(adminDir, `index.ts`), `export {${Name}Editor, default} from './${Name}Editor';\n`);

// --- registry edits ---

editFile(path.join(REPO_ROOT, 'shared', 'enums', 'EItemType.ts'),
    (s) => s.includes(`${Name} =`) ? s :
        s.replace(/(\s+Empty\s*=\s*'EMPTY',)/,
            `\n    /** ${spaceCamel(Name)} — scaffolded by module:new. */\n    ${Name} = "${snake}",$1`));

editFile(path.join(REPO_ROOT, 'ui', 'client', 'modules', 'clientItemTypes.ts'), (s) => {
    if (s.includes(`from '@client/modules/${Name}'`)) return s;
    s = s.replace(
        /(import StatsStrip from '@client\/modules\/StatsStrip';\n)/,
        `$1import ${Name} from '@client/modules/${Name}';\n`,
    );
    s = s.replace(
        /(\s+\{key: EItemType\.StatsStrip, Display: StatsStrip\},\n)/,
        `$1    {key: EItemType.${Name}, Display: ${Name}},\n`,
    );
    return s;
});

editFile(path.join(REPO_ROOT, 'ui', 'admin', 'modules', 'adminItemTypeEditors.ts'), (s) => {
    if (s.includes(`E${Name}Style`)) return s;
    s = s.replace(
        /(import \{EStatsStripStyle\} from '@client\/modules\/StatsStrip';\n)/,
        `$1import {E${Name}Style} from '@client/modules/${Name}';\n`,
    );
    s = s.replace(
        /(import \{StatsStripEditor\} from '@admin\/modules\/StatsStrip\/StatsStripEditor';\n)/,
        `$1import {${Name}Editor} from '@admin/modules/${Name}';\n`,
    );
    // Add the registration row right after StatsStrip's.
    s = s.replace(
        /(\s+\{key: EItemType\.StatsStrip,[^\n]+\n)/,
        `$1    {key: EItemType.${Name},      Editor: ${Name}Editor,           styleEnum: asEnum(E${Name}Style),         defaultContent: '{}',                                                                                                                                                              labelKey: '${label}',          descriptionKey: '${desc.replace(/'/g, "\\'")}', category: 'content'},\n`,
    );
    return s;
});

editFile(path.join(REPO_ROOT, 'ui', 'client', 'lib', 'preview', 'samples.ts'), (s) => {
    if (s.includes(`[EItemType.${Name}]`)) return s;
    // Append after the StatsStrip block. The outer block's closing
    // bracket is at exactly 4 spaces of indent; nested arrays (like
    // StatsStrip's `cells: [...]`) close at 16+ spaces. Anchor to the
    // 4-space indent so the non-greedy match doesn't bail on the
    // first inner array close. (Earlier version used `\s*\],\n` which
    // matched the inner `cells` array close instead of the outer block.)
    return s.replace(
        /(\[EItemType\.StatsStrip\]: \[[\s\S]+?\n    \],\n)/,
        `$1    [EItemType.${Name}]: [
        {label: 'minimal', content: s({text: 'Sample text'})},
        {label: 'full',    content: s({text: 'Sample text — replace with the real shape\\'s fields'})},
    ],\n`,
    );
});

// SCSS imports — add to BOTH routers. Insert alphabetically after a known anchor.
const scssLine = (sep) => `import '../modules/${Name}/${Name}.scss'${sep}`;
editFile(path.join(REPO_ROOT, 'ui', 'client', 'pages', '_app.tsx'),
    (s) => insertScssImport(s, Name, scssLine('')));
editFile(path.join(REPO_ROOT, 'ui', 'client', 'app', 'layout.tsx'),
    (s) => insertScssImport(s, Name, scssLine(';')));

console.log(`\n✅ ${Name} scaffolded.

Next steps:
  1. Replace the single \`text\` slot in ${Name}.types.ts with the real fields from your design-step output
  2. Author the JSX + SCSS in ${Name}.tsx + ${Name}.scss
  3. Mirror the slots in ${Name}Editor.tsx
  4. Update the sample fixture in ui/client/lib/preview/samples.ts
  5. Visit http://localhost/dev/visual?type=${snake}&sample=1 to eyeball
  6. Migrate any live RichText usages via:  npm run module:migrate <sectionId> <at> <jsonFile>
`);

// --- helpers ---

function spaceCamel(s) { return s.replace(/([a-z0-9])([A-Z])/g, '$1 $2'); }

function writeIfAbsent(p, body) {
    if (existsSync(p)) {
        console.log(`  skip (exists): ${path.relative(REPO_ROOT, p)}`);
        return;
    }
    writeFileSync(p, body);
    console.log(`  wrote: ${path.relative(REPO_ROOT, p)}`);
}

function editFile(p, mutator) {
    if (!existsSync(p)) {
        console.error(`  miss (not found): ${path.relative(REPO_ROOT, p)} — skipping`);
        return;
    }
    const before = readFileSync(p, 'utf8');
    const after = mutator(before);
    if (after === before) {
        console.log(`  noop (already wired): ${path.relative(REPO_ROOT, p)}`);
        return;
    }
    writeFileSync(p, after);
    console.log(`  edited: ${path.relative(REPO_ROOT, p)}`);
}

function insertScssImport(src, name, line) {
    if (src.includes(line)) return src;
    // Find module-SCSS import block. Each line looks like
    //   import '../modules/<Foo>/<Foo>.scss'
    // Insert this one in alphabetical position by module name.
    const lines = src.split(/\r?\n/);
    const importRe = /^import '\.\.\/modules\/([A-Z][^/]+)\//;
    let insertAt = -1;
    for (let i = 0; i < lines.length; i++) {
        const m = importRe.exec(lines[i]);
        if (!m) continue;
        if (name.localeCompare(m[1]) < 0) { insertAt = i; break; }
        insertAt = i + 1;
    }
    if (insertAt < 0) {
        console.error(`  miss: couldn't find module SCSS import block; manual insert needed`);
        return src;
    }
    lines.splice(insertAt, 0, line);
    return lines.join('\n');
}
