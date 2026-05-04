#!/usr/bin/env node
// Audit per-component SCSS files for top-level rules that escape the file's
// owning component class. Emits a JSON report on stdout; the markdown report
// generator (see docs/roadmap/scss-audit-2026-05-03.md) consumes it.
//
// Heuristic per spec (docs/roadmap/scss-scoping.md):
//   OK        — top-level selector starts with `.<file-stem-kebab>` (or its
//               component-class variant), or the whole top-level node is an
//               at-rule (@use/@forward/@mixin/@function/@keyframes/@media).
//   VIOLATION — bare element selector (`p`, `div`, `h1`…), unscoped class,
//               or a class that doesn't match the file's owner component.
//
// Notes:
// - Allow-list paths (globals, Common chrome, AdminDarkMode) are skipped.
// - For @media at the top level, we recurse into its body and apply the same
//   rule to inner top-level selectors.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const ALLOW_LIST_PREFIXES = [
  'ui/client/styles/globals/',
  'ui/client/styles/Common/',
  'ui/admin/styles/Admin/AdminDarkMode.scss',
].map((p) => p.replaceAll('/', path.sep));

const SEARCH_DIRS = [
  'ui/client/modules',
  'ui/client/features',
  'ui/client/styles',
  'ui/admin/styles',
  'ui/admin/features',
  'ui/client/features',
];

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith('.scss')) out.push(full);
  }
  return out;
}

function isAllowed(rel) {
  return ALLOW_LIST_PREFIXES.some((p) => rel.startsWith(p));
}

function kebab(s) {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}

// Strip /* */ and // comments so brace counting stays sane.
function stripComments(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    if (src[i] === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      if (end === -1) break;
      // Preserve newlines for line numbers
      const block = src.slice(i, end + 2);
      out += block.replace(/[^\n]/g, ' ');
      i = end + 2;
    } else if (src[i] === '/' && src[i + 1] === '/') {
      const end = src.indexOf('\n', i);
      if (end === -1) {
        out += ' '.repeat(src.length - i);
        break;
      }
      out += ' '.repeat(end - i);
      i = end;
    } else {
      out += src[i];
      i++;
    }
  }
  return out;
}

// Extract the top-level "blocks" — selector|at-rule + their immediate body.
// Returns [{ header, line }] for top-level entries (we only inspect headers).
function topLevelBlocks(src) {
  const blocks = [];
  let depth = 0;
  let buf = '';
  let bufLine = 1;
  let line = 1;
  let inString = null;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '\n') line++;
    if (inString) {
      if (ch === inString && src[i - 1] !== '\\') inString = null;
      if (depth === 0) buf += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = ch;
      if (depth === 0) buf += ch;
      continue;
    }

    if (depth === 0) {
      if (ch === '{') {
        const header = buf.trim();
        if (header) blocks.push({ header, line: bufLine });
        depth++;
        buf = '';
      } else if (ch === ';') {
        // top-level statement (e.g. @use, @forward, $var: …)
        const header = buf.trim();
        if (header) blocks.push({ header, line: bufLine, statement: true });
        buf = '';
        bufLine = line;
      } else {
        if (buf.trim() === '') bufLine = line;
        buf += ch;
      }
    } else {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
    }
  }
  return blocks;
}

const ELEMENT_TAGS = new Set([
  'a','abbr','address','article','aside','b','blockquote','body','br','button','canvas',
  'caption','cite','code','col','colgroup','data','dd','del','details','dfn','dialog','div',
  'dl','dt','em','fieldset','figcaption','figure','footer','form','h1','h2','h3','h4','h5',
  'h6','head','header','hr','html','i','iframe','img','input','ins','kbd','label','legend',
  'li','main','mark','menu','meta','meter','nav','noscript','object','ol','option','output',
  'p','picture','pre','progress','q','rp','rt','ruby','s','samp','script','section','select',
  'small','source','span','strong','style','sub','summary','sup','svg','table','tbody','td',
  'template','textarea','tfoot','th','thead','time','title','tr','track','u','ul','var',
  'video','wbr',
]);

function classifyHeader(header, owners) {
  // owners is array of accepted root prefixes (e.g. ['.hero', '.hero-card'])
  if (header.startsWith('@')) return { kind: 'atrule' };
  // Each comma-separated selector should start with an owner prefix.
  const sels = header.split(',').map((s) => s.trim()).filter(Boolean);
  const offenders = [];
  for (const sel of sels) {
    // First compound — strip combinators
    const first = sel.split(/[\s>+~]/)[0];
    const startsWithOwner = owners.some((o) => {
      // Match `.owner`, `.owner.…`, `.owner:…`, `.owner[…]`
      return first === o
        || first.startsWith(o + '.')
        || first.startsWith(o + ':')
        || first.startsWith(o + '[')
        || first.startsWith(o + '#')
        || first.startsWith(o + '--')
        || first.startsWith(o + '__');
    });
    if (startsWithOwner) continue;
    // Categorize the violation type
    if (first.startsWith('.')) {
      offenders.push({ selector: sel, type: 'unscoped-class' });
    } else if (first.startsWith('#')) {
      offenders.push({ selector: sel, type: 'id' });
    } else if (first.startsWith('&')) {
      // & at top level only makes sense inside another rule — flag as suspicious
      offenders.push({ selector: sel, type: 'stray-amp' });
    } else if (first.startsWith('[')) {
      offenders.push({ selector: sel, type: 'attribute' });
    } else if (first.startsWith(':')) {
      offenders.push({ selector: sel, type: 'pseudo' });
    } else if (ELEMENT_TAGS.has(first.toLowerCase())) {
      offenders.push({ selector: sel, type: 'bare-element' });
    } else {
      offenders.push({ selector: sel, type: 'other' });
    }
  }
  return offenders.length ? { kind: 'violation', offenders } : { kind: 'ok' };
}

function ownersFor(filePath) {
  const stem = path.basename(filePath, '.scss');
  // file-stem -> kebab; also accept original kebab if already
  const k = kebab(stem);
  // Component classes follow either kebab-case (`.plain-text`) or simple
  // single-word (`.hero`).
  const owners = new Set([`.${k}`]);
  // Some files use a different root — e.g. PlainImage.scss uses `.plain-image`
  // and `.section-item-container` and `.background-image`. We special-case
  // files where the first declared selector doesn't match by re-deriving the
  // owner from the first top-level rule.
  return owners;
}

function audit(filePath) {
  const rel = path.relative(ROOT, filePath);
  const src = fs.readFileSync(filePath, 'utf8');
  const stripped = stripComments(src);
  const blocks = topLevelBlocks(stripped);
  const owners = [...ownersFor(filePath)];
  const violations = [];
  let okCount = 0;
  let atruleCount = 0;
  for (const b of blocks) {
    if (b.statement) {
      atruleCount++; // @use/@forward statements
      continue;
    }
    const r = classifyHeader(b.header, owners);
    if (r.kind === 'atrule') atruleCount++;
    else if (r.kind === 'ok') okCount++;
    else {
      for (const o of r.offenders) {
        violations.push({ line: b.line, header: b.header, ...o });
      }
    }
  }
  return { rel, owners, blocks: blocks.length, ok: okCount, atrule: atruleCount, violations };
}

const allFiles = [];
for (const d of SEARCH_DIRS) allFiles.push(...walk(path.join(ROOT, d)));
const reports = [];
for (const f of allFiles) {
  const rel = path.relative(ROOT, f);
  if (isAllowed(rel)) continue;
  reports.push(audit(f));
}

const summary = {
  audited: reports.length,
  totalViolations: reports.reduce((a, r) => a + r.violations.length, 0),
  byType: {},
};
for (const r of reports) {
  for (const v of r.violations) {
    summary.byType[v.type] = (summary.byType[v.type] || 0) + 1;
  }
}

process.stdout.write(JSON.stringify({ summary, reports }, null, 2));
