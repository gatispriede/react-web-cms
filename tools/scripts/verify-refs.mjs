#!/usr/bin/env node
import {readFile, readdir, stat} from 'node:fs/promises';
import path from 'node:path';
import {existsSync} from 'node:fs';

const ROOT = 'D:/Work/redis-node-js-cloud/docs';

async function walk(dir) {
    const out = [];
    for (const name of await readdir(dir)) {
        const p = path.join(dir, name);
        const s = await stat(p);
        if (s.isDirectory()) out.push(...(await walk(p)));
        else if (name.endsWith('.md')) out.push(p);
    }
    return out;
}

const broken = [];
for (const f of await walk(ROOT)) {
    const text = await readFile(f, 'utf8');
    const srcDir = path.dirname(f);
    for (const m of text.matchAll(/\]\(([^)\s#]+\.(?:md|html))(?:#[^)]*)?\)/g)) {
        const url = m[1];
        if (url.startsWith('http') || url.startsWith('//')) continue;
        const target = path.resolve(srcDir, url);
        if (!existsSync(target)) {
            broken.push({file: path.relative(ROOT, f), url, resolvedTo: path.relative(ROOT, target)});
        }
    }
}
if (broken.length === 0) console.log('All markdown refs resolve.');
else {
    console.log(`${broken.length} broken refs:`);
    for (const b of broken) console.log(`  ${b.file}: [${b.url}] -> ${b.resolvedTo}`);
}
