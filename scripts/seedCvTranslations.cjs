#!/usr/bin/env node
// One-shot helper: read public/design-v7/cv-bundle.bundle.json, derive translation
// keys for every translatable string in section content, and write entries into
// ui/client/public/locales/{en,lv}/app.json. EN gets identity (key → source),
// LV gets the curated Latvian translation from TRANSLATIONS below. Re-run safely
// — existing keys are preserved, only missing entries are added.

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const BUNDLE = path.join(REPO, 'public/design-v7/cv-bundle.bundle.json');
const EN_FILE = path.join(REPO, 'ui/client/public/locales/en/app.json');
const LV_FILE = path.join(REPO, 'ui/client/public/locales/lv/app.json');

// Inline (no `import`) port of shared/utils/stringFunctions.ts:sanitizeKey.
const MAX_LEN = 30, HASH_LEN = 6, HEAD_LEN = MAX_LEN - HASH_LEN - 1;
function hash36(input) {
    let h = 5381;
    for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
    return h.toString(36).padStart(HASH_LEN, '0').slice(-HASH_LEN);
}
function sanitizeKey(key) {
    if (typeof key !== 'string') return key;
    const stripped = key.replace(/[~`\s!@#$%^&*()+={}\[\];:'"<>.,/\\\-_]/g, '');
    if (stripped.length <= MAX_LEN) return stripped;
    return `${stripped.slice(0, HEAD_LEN)}_${hash36(stripped)}`;
}

// Translations for every user-facing prose string in the CV bundle.
// Technical tokens, proper nouns, and labels that already read naturally
// in Latvian (e.g. "JavaScript / TypeScript") map to themselves. Anything
// that isn't a valid translation pair is omitted — the LV file only carries
// strings that genuinely differ from English.
const TRANSLATIONS = {
    "DOSSIER № 001 / SIGULDA, LATVIA / EST. 2009": "DOSJEJS № 001 / SIGULDA, LATVIJA / DIB. 2009",
    "Gatis": "Gatis",
    "Priede.": "Priede.",
    "Everything is possible.": "Viss ir iespējams.",
    "— personal motto": "— personīgs moto",
    "View work ↘": "Skatīt darbus ↘",
    "Get in touch": "Sazināties",
    "Core delivery": "Pamatprasmes",
    "08 entries": "08 ieraksti",
    "Test-driven development": "Testa virzīta izstrāde",
    "Thinking out of the box while shipping stable, performant code.": "Domāt netradicionāli, vienlaikus piegādājot stabilu un veiktspējīgu kodu.",
    "Project Manager / Senior Software Engineer": "Projektu vadītājs / Vecākais programmatūras inženieris",
    "Senior Software Engineer": "Vecākais programmatūras inženieris",
    "Senior Front-end Developer": "Vecākais Front-end izstrādātājs",
    "Analyst Web Developer": "Analītiķis tīmekļa izstrādātājs",
    "University of Latvia": "Latvijas Universitāte",
    "Programming Scientist — Quantum Computers": "Programmēšanas zinātnieks — Kvantu datori",
    "Vidzemes augstskola · UAS": "Vidzemes Augstskola · UAS",
    "Programmer — computer & network architecture, project management": "Programmētājs — datoru un tīkla arhitektūra, projektu vadība",
    "Installing & configuring Windows 7 client": "Windows 7 klienta instalēšana un konfigurēšana",
    "Consultant / Senior Software Engineer": "Konsultants / Vecākais programmatūras inženieris",
    "Contact": "Kontakti",
    "E-mail": "E-pasts",
    "Location": "Atrašanās vieta",
    "Sigulda, Latvia · EET": "Sigulda, Latvija · EET",
    "Mode": "Režīms",
    "Remote / Hybrid, Full-time": "Attālināti / Hibrīds, pilna slodze",
    "Signals & interests": "Signāli un intereses",
    "Traits": "Iezīmes",
    "Accuracy · logical · intuitive · flexible · optimistic": "Precizitāte · loģika · intuīcija · elastība · optimisms",
    "Preferred": "Vēlamais",
    "Clean, performant code · TDD · SSR · SPA": "Tīrs, veiktspējīgs kods · TDD · SSR · SPA",
    "Watching": "Sekoju",
    "Interests": "Intereses",
    "DIY builds · winter sports · table games · music · science": "DIY projekti · ziemas sports · galda spēles · mūzika · zinātne",
    "§ 04 / CONTACT / DOSSIER № 001": "§ 04 / KONTAKTI / DOSJEJS № 001",
    "Get in": "Sazinies",
    "touch.": "ar mani.",
    "Reply within 24 hours, EET working hours.": "Atbilde 24 stundu laikā, EET darba laiks.",
    "— current SLA": "— pašreizējais SLA",
    "Send a brief ↘": "Nosūtīt īsu aprakstu ↘",
    "Email directly": "Rakstīt uz e-pastu",
    "§ 04.1 / SEND A BRIEF": "§ 04.1 / NOSŪTĪT APRAKSTU",
    "Inquiry form": "Pieprasījuma forma",
    "Pick a topic, leave a few lines, expect a response within one working day.": "Izvēlies tēmu, atstāj dažas rindiņas, atbilde — viena darba diena.",
    "Engagement terms": "Sadarbības noteikumi",
    "Day rate": "Dienas likme",
    "On request · IR35 outside": "Pēc pieprasījuma · IR35 outside",
    "Min engagement": "Min. iesaiste",
    "2 weeks": "2 nedēļas",
    "Notice": "Brīdinājuma termiņš",
    "4 weeks (current contracts)": "4 nedēļas (pašreizējiem līgumiem)",
    "Travel": "Komandējumi",
    "Quarterly on-site OK": "Reizi ceturksnī klātienē — labi",
    "NDA": "NDA",
    "Standard mutual NDA on request": "Standarta abpusēja NDA pēc pieprasījuma",
    "§ 05 / CASE STUDY / DOSSIER № 001": "§ 05 / GADĪJUMA IZPĒTE / DOSJEJS № 001",
    "Bespoke": "Pielāgots",
    "CMS.": "CMS.",
    "From a typed schema to live droplets in 30 minutes.": "No tipizētas shēmas līdz produkcijas pilieniem 30 minūtēs.",
    "— delivery loop": "— piegādes cikls",
    "View repo ↘": "Skatīt repo ↘",
    "Pipeline": "Konveijers",
    "Architecture tiers": "Arhitektūras līmeņi",
    "Edge": "Mala",
    "Next.js SSR + ISR": "Next.js SSR + ISR",
    "Service": "Serviss",
    "Storage": "Glabātava",
    "§ 05.1 / SCHEMA": "§ 05.1 / SHĒMA",
    "Data model": "Datu modelis",
    "Mongo collections backing the editorial layer.": "Mongo kolekcijas, kas balsta redakcionālo slāni.",
    "Schema validation": "Shēmas validācija",
    "Per-type validators in shared/utils/contentSchemas.ts; bundle import is atomic.": "Tipizēti validatori failā shared/utils/contentSchemas.ts; importēšana ir atomāra.",
    "Round-trip": "Apļa pārbaude",
    "Export/import preserves shape after stripping _id.": "Eksports/imports saglabā formu pēc _id noņemšanas.",
    "Image assets": "Attēlu resursi",
    "Local images travel as data URIs in bundle.assets, capped at 25 MB.": "Lokālie attēli ceļo kā data URI sadaļā bundle.assets, līdz 25 MB.",
    "§ 05.2 / TOPOLOGY": "§ 05.2 / TOPOLOĢIJA",
    "Infra topology": "Infrastruktūras topoloģija",
    "Two-droplet stack: edge + service. TLS terminates at HAProxy on the edge node.": "Divu pilienu steks: mala + serviss. TLS noslēdzas pie HAProxy uz malas mezgla.",
    "EDGE": "MALA",
    "SERVICE": "SERVISS",
    "Internal traffic over private VPC; TLS terminates at edge.": "Iekšējā satiksme caur privātu VPC; TLS noslēdzas uz malas.",
    "§ 05.3 / DELIVERY": "§ 05.3 / PIEGĀDE",
    "CI / CD pipeline": "CI / CD konveijers",
    "GitHub Actions → SSH deploy. Five stages, ~6 min cold.": "GitHub Actions → SSH izvietošana. Pieci posmi, ~6 min auksti.",
    "eslint + tsc --noEmit": "eslint + tsc --noEmit",
    "vitest, parallel shards": "vitest, paralēlas daļas",
    "next build (production)": "next build (produkcija)",
    "rsync over SSH, atomic symlink swap": "rsync caur SSH, atomāra simbolisko saišu nomaiņa",
    "Curl-based health check, retries 3×": "Veselības pārbaude ar curl, 3× atkārtojumi",
    "§ 05.4 / REPO": "§ 05.4 / REPO",
    "Repository tree": "Repozitorija koks",
    "Click a node to inspect.": "Klikšķini mezglu, lai apskatītu.",
    "Monorepo root": "Monorepo sakne",
    "Yarn workspaces. Pages router app + Node services + shared utilities.": "Yarn darbtelpas. Pages router lietotne + Node servisi + koplietojamas utilītas.",
    "Frontend workspaces": "Frontend darbtelpas",
    "Two workspaces: client (public site) and admin (CMS editor).": "Divas darbtelpas: klients (publiskā vietne) un admin (CMS redaktors).",
    "Public site": "Publiskā vietne",
    "Next.js Pages Router. Modules under modules/.": "Next.js Pages Router. Moduļi mapē modules/.",
    "Display modules": "Attēlošanas moduļi",
    "One folder per module: types, component, scss, barrel.": "Viena mape katram modulim: tipi, komponente, scss, barrel.",
    "Admin editor": "Admin redaktors",
    "AntD-driven editor surface. Mirrors modules/ tree.": "AntD virzīta redaktora virsma. Atspoguļo modules/ koku.",
    "Node services": "Node servisi",
    "Express + Mongo. Bundle import/export, themes, auth.": "Express + Mongo. Komplektu imports/eksports, tēmas, autentifikācija.",
    "Shared": "Koplietojams",
    "Enums, schema validators, contracts shared across workspaces.": "Enum, shēmu validatori, līgumi, kas tiek koplietoti starp darbtelpām.",
};

// Strings that should be excluded from translation entirely (proper nouns,
// technical brands, paths, identifiers — they read identically in any locale).
const SKIP = new Set([
    "JavaScript / TypeScript",
    "React · Next.js · SSR / SPA",
    "Node.js & backend architecture",
    "GraphQL · REST · data layer",
    "UI / UX · responsive · fluid",
    "3D & WebGL · SciChart · large data",
    "CI/CD · Docker · HAProxy",
    "SciChart", "Sapiens", "SIA Booking Group", "Performance Horizon", "Accenture", "Microsoft",
    "support@funisimo.pro", "in/gatis-priede", "github.com/gatispriede", "in/gatis-priede ↗",
    "LinkedIn", "AI · quantum · VR · robotics · RPA",
    "Node API · Mongo · Redis", "MongoDB primary · Redis cache",
    "redis-node-js-cloud", "redis-node-js-cloud/ui", "redis-node-js-cloud/ui/client",
    "redis-node-js-cloud/ui/client/modules", "redis-node-js-cloud/ui/admin",
    "redis-node-js-cloud/services", "redis-node-js-cloud/shared",
]);

// Walk content collecting source strings.
const SKIP_KEYS = new Set(['url','href','platform','name','symbol','flag','liveTime','default','primary','featured','tag','status','contractType','domain','start','end','location','specs','services','collections','count','svg','submitLabel','successMessage','sideNote','sideNotes','topicsLabel','topics','fields','kind','required','meta','coords','accent','bgImage','portraitImage','portraitLabel','portraitOpacity','blogEnabled','layoutMode','custom','tokens','id','type','contentPadding','fontMono','fontSans','fontDisplay','themeSlug']);
const sources = new Set();
function walk(v) {
    if (v == null) return;
    if (Array.isArray(v)) return v.forEach(walk);
    if (typeof v === 'object') {
        for (const [k, vv] of Object.entries(v)) {
            if (SKIP_KEYS.has(k)) continue;
            if (typeof vv === 'string') {
                const t = vv.trim();
                if (!t || /^[\d\s.\-+]+$/.test(t)) continue;
                if (t.startsWith('http') || t.startsWith('mailto:') || t.startsWith('tel:') || t.startsWith('/images/') || t.startsWith('#')) continue;
                sources.add(t);
            } else walk(vv);
        }
    }
}
const bundle = JSON.parse(fs.readFileSync(BUNDLE, 'utf8'));
for (const sec of bundle.site.sections) for (const c of sec.content) {
    try { walk(JSON.parse(c.content)); } catch {}
}

const en = JSON.parse(fs.readFileSync(EN_FILE, 'utf8'));
const lv = JSON.parse(fs.readFileSync(LV_FILE, 'utf8'));

let added = {en: 0, lv: 0};
for (const src of sources) {
    if (SKIP.has(src)) continue;
    const key = sanitizeKey(src);
    if (!key) continue;
    if (!(key in en)) { en[key] = src; added.en++; }
    const lvText = TRANSLATIONS[src];
    if (lvText && !(key in lv)) { lv[key] = lvText; added.lv++; }
}

fs.writeFileSync(EN_FILE, JSON.stringify(en, null, 2) + '\n');
fs.writeFileSync(LV_FILE, JSON.stringify(lv, null, 2) + '\n');
console.log(`[seed-cv-translations] sources collected: ${sources.size}, en added: ${added.en}, lv added: ${added.lv}`);
