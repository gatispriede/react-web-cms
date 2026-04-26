"""
Fill in / override the `lv` column of `public/translations/translations-2026-04-26.csv`
with Latvian translations.

Strategy per row:
  1. If `lv` is already filled AND differs from `source`, leave it alone
     (operator hand-edited it).
  2. If `lv` is empty or `lv == source` (echo pattern from a CSV-export
     that defaults the placeholder to source), and the source is in our
     LV dictionary → write the LV value.
  3. If `lv` is empty / echo and the source is an unchanged-in-Latvian
     token (number, year, brand name, abbreviation), set `lv = source`.
  4. Otherwise leave the row alone and report it as unmapped at the end.

Run:
  python scripts/translateCsvLv.py
"""

import csv
import sys
from pathlib import Path

SRC = Path(r"D:/Work/redis-node-js-cloud/public/translations/translations-2026-04-26.csv")
OUT = SRC.with_name(SRC.stem + "-lv.csv")

# Translations indexed by SOURCE column. For unchanged-in-Latvian tokens
# we still record an entry (mapped to itself) so the importer treats it
# as a deliberate "same as source" cell.
LV: dict[str, str] = {
    # ─── numbers / years (unchanged) ───
    "10": "10",
    "2009": "2009",
    "2013": "2013",
    "2014": "2014",
    "2015": "2015",
    "2017": "2017",
    "2019": "2019",
    "2023": "2023",
    "2024": "2024",
    "2 weeks": "2 nedēļas",
    "Windows 11": "Windows 11",
    "60 s": "60 s",
    "~$13 / mo": "~$13 / mēn.",
    "17 reusable": "17 atkārtoti lietojami",

    # ─── brand / proper nouns (unchanged) ───
    "Gatis": "Gatis",
    "LegalStableSure": "LegalStableSure",
    "Legal Stable": "Legal Stable",
    "JF": "JF",
    "SciChart": "SciChart",
    "Sapiens": "Sapiens",
    "Accenture": "Accenture",
    "Microsoft": "Microsoft",
    "SIA Booking Group": "SIA Booking Group",
    "Performance Horizon": "Performance Horizon",
    "University of Latvia": "Latvijas Universitāte",
    "Vidzemes augstskola · UAS": "Vidzemes augstskola · UAS",

    # ─── locations / addresses ───
    "LATVIA, RIGA": "LATVIJA, RĪGA",
    "RIGA, LATVIA": "RĪGA, LATVIJA",
    "NEWCASTLE, UK": "NEWCASTLE, AK",
    "UK / USA · REMOTE": "AK / ASV · ATTĀLINĀTI",
    "Sigulda, Latvia · EET": "Sigulda, Latvija · EET",
    "Remote / Hybrid, Full-time": "Attālināti / hibrīds, pilna slodze",

    # ─── short labels / nav ───
    "Home": "Sākums",
    "Contact": "Kontakti",
    "CMS": "CMS",
    "Email": "E-pasts",
    "LinkedIn": "LinkedIn",
    "GitHub": "GitHub",
    "Location": "Atrašanās",
    "Mode": "Režīms",
    "Driving": "Vadītāja apl.",
    "B category": "B kategorija",
    "Traits": "Īpašības",
    "Preferred": "Vēlamais",
    "Watching": "Vēroju",
    "Interests": "Intereses",
    "OS": "OS",
    "Notice": "Piezīme",
    "Travel": "Komandējumi",
    "NDA": "NDA",
    "JS": "JS",
    "Framework": "Karkass",
    "UI runtime": "UI izpildvide",
    "Language": "Valoda",
    "Database": "Datubāze",
    "Auth": "Autentifikācija",
    "Process": "Process",
    "Container": "Konteineris",
    "i18n": "i18n",
    "Icons": "Ikonas",
    "References": "Atsauces",
    "Production": "Produkcija",
    "Themes": "Tēmas",
    "State": "Stāvoklis",
    "ORM": "ORM",
    "Hashing": "Jaukšana",
    "Billing": "Norēķini",
    "AI": "AI",
    "Live": "Tiešraidē",
    "Marketing": "Mārketings",
    "API": "API",
    "Stores": "Veikali",
    "Mobile": "Mobilais",
    "Schema": "Shēma",
    "Shared": "Koplietots",
    "Docs": "Dokumenti",
    "CI": "CI",
    "PRESENT": "ŠOBRĪD",
    "Consultant": "Konsultants",
    "CERTIFICATE": "SERTIFIKĀTS",
    "Reverse proxy": "Apgrieztais starpniekserveris",
    "Drag-and-drop": "Vilkt un nomest",
    "Mobile runtime": "Mobilā izpildvide",
    "Server runtime": "Servera izpildvide",
    "Component lib": "Komponentu bibl.",
    "On-device DB": "Ierīces DB",
    "Web app": "Web lietotne",
    "Mobile app": "Mobilā lietotne",
    "Android app": "Android lietotne",
    "API routes": "API maršruti",
    "Source paths": "Avotu ceļi",
    "Item types": "Vienumu tipi",
    "Mongo collections": "Mongo kolekcijas",
    "Quick facts": "Īsi fakti",
    "Get in": "Sazinies",
    "Day rate": "Dienas likme",
    "Min engagement": "Min iesaiste",
    "On-device DB": "Ierīces DB",
    "Engagement terms": "Iesaistes nosacījumi",
    "Signals & interests": "Signāli & intereses",
    "Data layer": "Datu slānis",
    "Core delivery": "Pamatpiegāde",
    "Leadership & delivery": "Vadība & piegāde",
    "Own work": "Pašu darbi",
    "Quick facts": "Īsi fakti",
    "What's interesting here": "Kas šeit interesants",
    "Self-reported · 0–10 scale": "Pašu vērtējums · 0–10 skala",

    # ─── role titles ───
    "Technical Project Manager": "Tehniskā projekta vadītājs",
    "Senior Software Engineer": "Vecākais programmatūras inženieris",
    "Senior Front-end Developer": "Vecākais Front-end izstrādātājs",
    "Analyst Web Developer": "Analītiķis & Web izstrādātājs",

    # ─── headings (preserve `§` markers) ───
    "§ 01 · Capability matrix": "§ 01 · Spēju matrica",
    "§ 02 · Career record": "§ 02 · Karjeras vēsture",
    "§ 03 · Dossier appendix": "§ 03 · Dosjē pielikums",
    "§ 04.1 · Channels": "§ 04.1 · Kanāli",
    "§ 04.2 · Send a brief": "§ 04.2 · Nosūtīt īsu aprakstu",
    "§ 04.3 · Engagement terms": "§ 04.3 · Iesaistes nosacījumi",
    "§ 0 · Built for AI to use as a CMS language": "§ 0 · Veidots, lai AI to izmantotu kā CMS valodu",
    "§ A · Architecture": "§ A · Arhitektūra",
    "§ B · Key technologies": "§ B · Galvenās tehnoloģijas",
    "§ C · Data model": "§ C · Datu modelis",
    "§ D · Infrastructure": "§ D · Infrastruktūra",
    "§ E · Repository": "§ E · Repozitorijs",
    "§ F · Continuous deployment": "§ F · Nepārtraukta izvietošana",
    "§ G · Closing notes": "§ G · Noslēguma piezīmes",
    "Education · contact · signals": "Izglītība · kontakti · signāli",

    # ─── short prose ───
    "react-web-cms": "react-web-cms",
    "Custom solution standardisation": "Pielāgotu risinājumu standartizēšana",
    "Backbone → React migration": "Migrācija no Backbone uz React",
    "Migration from Drupal to React": "Migrācija no Drupal uz React",
    "Built a new application from scratch": "Lietotne uzbūvēta no nulles",
    "Best-practice introduction · team morale":
        "Labās prakses ieviešana · komandas morāle",
    "Grew as a professional in web UI / UX":
        "Profesionāla izaugsme web UI / UX jomā",
    "Programming Scientist — Quantum Computers":
        "Programmēšanas zinātnieks — kvantu datori",
    "Paused: will return when a real-world app runs on a quantum computer.":
        "Pauzēts: atgriezīšos, kad reāla lietotne darbosies uz kvantu datora.",
    "Programmer — computer & network architecture, project management, functional & OO programming":
        "Programmētājs — datoru un tīklu arhitektūra, projektu vadība, funkcionālā un OO programmēšana",
    "Installing & configuring Windows 7 client":
        "Windows 7 klienta uzstādīšana un konfigurēšana",
    "Reply within 24 hours, EET working hours.":
        "Atbilde 24 stundu laikā, EET darba laikā.",
    "Pick your preferred surface.": "Izvēlies sev ērtāko kanālu.",
    "Topic, two lines, expect a reply within one working day.":
        "Tēma, divas rindas, atbilde vienas darba dienas laikā.",
    "On request · IR35 outside": "Pēc pieprasījuma · IR35 outside",
    "4 weeks (current contracts)": "4 nedēļas (esošie līgumi)",
    "Quarterly on-site OK": "Reizi ceturksnī uz vietas OK",
    "Standard mutual NDA on request": "Standarta savstarpējs NDA pēc pieprasījuma",
    "Accuracy · logical · intuitive · flexible · optimistic":
        "Precizitāte · loģisks · intuitīvs · elastīgs · optimistisks",
    "Clean, high-performant code · TDD · SSR · SPA":
        "Tīrs, augstas veiktspējas kods · TDD · SSR · SPA",
    "DIY builds · winter sports · table games · music · science · space & time":
        "DIY projekti · ziemas sporta veidi · galda spēles · mūzika · zinātne · telpa un laiks",
    "AI · quantum · VR · robotics · RPA": "AI · kvantu · VR · robotika · RPA",
    "Pioneered AI-augmented workflows — authored Claude Code skills and team-wide CLAUDE.md standards":
        "Aizsācis AI-papildinātu darbplūsmu izmantošanu — autors Claude Code prasmēm un komandas mēroga CLAUDE.md standartiem",
    "WebAssembly build pipeline (Emscripten) · memory test harnesses · cross-platform release tooling":
        "WebAssembly būves konveijers (Emscripten) · atmiņas testu ietvari · starpplatformu izlaides rīki",
    "Delivered 3 client engagements end-to-end in regulated insurance domain":
        "Pilns cikls 3 klientu projektos regulētā apdrošināšanas jomā",
    "Surfaced risks ahead of schedule slippage via RAID logs and change-control gates":
        "Riskus identificēju pirms termiņu kavējumiem, izmantojot RAID žurnālus un izmaiņu kontroles vārtus",
    "JS framework / library — archived early-career project":
        "JS karkass / bibliotēka — arhivēts agra karjeras posma projekts",
    "Mobile app — in market — legalstablesure.com ↗":
        "Mobilā lietotne — tirgū — legalstablesure.com ↗",
    "Mobile app — in market · legalstablesure.com ↗":
        "Mobilā lietotne — tirgū · legalstablesure.com ↗",
    "Active — powers funisimo.pro · designed AI-friendly: typed schemas, single-bundle export, role-gated mutations":
        "Aktīvs — darbina funisimo.pro · veidots AI-draudzīgs: tipētas shēmas, viena pakas eksports, lomu kontrolētas mutācijas",
    "Languages — spoken & written": "Valodas — runā un rakstos",
    "Latvian10 / 10 · nativeEnglish9 / 9 · proficient (C1)Russian5 / 3 · conversationalGerman3 / 4 · basic":
        "Latviešu10 / 10 · dzimtāAngļu9 / 9 · brīvi (C1)Krievu5 / 3 · sarunvalodāVācu3 / 4 · pamatlīmenis",
    "BasedSigulda, Latvia (EU)Years15+ in digitalModeRemote-first · Contract or permanentStackTypeScript · React · Next.js · .NET · gRPC · Claude Code":
        "AtrašanāsSigulda, Latvija (ES)Pieredze15+ digitālajāRežīmsPrioritāte attālināti · Līgums vai pastāvīgsTehnoloģijasTypeScript · React · Next.js · .NET · gRPC · Claude Code",
    "Platforms · tooling · other": "Platformas · rīki · cits",
    "Cloud & infraAWS · Azure · Docker · Kubernetes · Terraform · HAProxy · LinuxDataPostgreSQL · MongoDB · Redis · SQLite · MySQL · Elasticsearch · KafkaAuthKeycloak (OAuth / OIDC) · NextAuth · SSO · RBAC · progressive lockoutAI toolingClaude (API + Code) · MCP · context engineering · agentic workflows · RAG · LLMOps / AgentOpsLanguagesTypeScript · JavaScript · Node · C# / .NET · Python · Bash · SQL · PHP · Java · Go · C++Build & testWebpack · Vite · Vitest · Jest · React Testing Library · PlaywrightObservabilityPrometheus · Grafana · structured logging · dashboarding · alertingSpecialistWebGL · WebAssembly (Emscripten) · SciChart 2D / 3D · charting library dev":
        "Mākonis & infraAWS · Azure · Docker · Kubernetes · Terraform · HAProxy · LinuxDatiPostgreSQL · MongoDB · Redis · SQLite · MySQL · Elasticsearch · KafkaAutentifikācijaKeycloak (OAuth / OIDC) · NextAuth · SSO · RBAC · progresīva bloķēšanaAI rīkiClaude (API + Code) · MCP · konteksta inženierija · aģentu darbplūsmas · RAG · LLMOps / AgentOpsValodasTypeScript · JavaScript · Node · C# / .NET · Python · Bash · SQL · PHP · Java · Go · C++Būve & testiWebpack · Vite · Vitest · Jest · React Testing Library · PlaywrightUzraudzībaPrometheus · Grafana · strukturēta žurnālošana · dashboardi · brīdinājumiSpeciālistsWebGL · WebAssembly (Emscripten) · SciChart 2D / 3D · diagrammu bibl. izstrāde",
    "2013 — present · 05 entries": "2013 — šobrīd · 05 ieraksti",
    "12 entries · production-shipping": "12 ieraksti · produkcijā",
    "Three concerns · one repo · zero shared imports between client and admin":
        "Trīs jomas · viens repozitorijs · nulle koplietotu importu starp klientu un admin",
    "One concern per folder. \"Where do I render a module?\" → ui/client/modules/. \"Edit it?\" → ui/admin/modules/. \"Add a resolver?\" → services/features/<name>/. Every question has exactly one answer.":
        "Viena joma vienā mapē. \"Kur attēlot moduli?\" → ui/client/modules/. \"Rediģēt to?\" → ui/admin/modules/. \"Pievienot resolver?\" → services/features/<vārds>/. Katram jautājumam tieši viena atbilde.",
    "Client and admin never import each other's code — they share only the generic ISection / IItem types from shared/types/. Removing a module = drop two folders + unregister.":
        "Klients un admin nekad neimportē viens otra kodu — tie koplieto tikai ģeneriskos ISection / IItem tipus no shared/types/. Moduļa noņemšana = nodzēst divas mapes + atreģistrēt.",
    "Next.js 15 · getStaticProps + getStaticPaths · ISR for index/slug · SSR for blog · SPA for admin":
        "Next.js 15 · getStaticProps + getStaticPaths · ISR sākumlapai/slug · SSR blogam · SPA admin daļai",
    "React 19 · concurrent renderer · admin is single-page · public site hydrates islands from preloaded JSON":
        "React 19 · konkurrents renderētājs · admin ir viena lapa · publiskā vietne hidrē salas no priekšielādēta JSON",
    "TypeScript · strict end-to-end · frontend, backend, codegen all share shared/types":
        "TypeScript · strict no gala līdz galam · frontend, backend, codegen koplieto shared/types",
    "GraphQL · Apollo Server in Next + standalone Express twin · schema.graphql is the contract · GQty client":
        "GraphQL · Apollo Server iekš Next + atsevišķs Express dvīnis · schema.graphql ir līgums · GQty klients",
    "MongoDB 7 · 10 collections + keyed-singleton settings · singleton pool · daily mongodump":
        "MongoDB 7 · 10 kolekcijas + atslēgu-singletona iestatījumi · singletona pūls · ikdienas mongodump",
    "NextAuth · Credentials + optional Google OAuth · Bcrypt admin seed · mustChangePassword on first login":
        "NextAuth · Credentials + neobligāts Google OAuth · Bcrypt admin sēkla · mustChangePassword pirmajā pieslēgumā",
    "Caddy · auto Let's Encrypt · HSTS + security headers · long-cache for /_next/static/*":
        "Caddy · automātisks Let's Encrypt · HSTS + drošības galvenes · ilgs kešs /_next/static/*",
    "PM2 · two processes (web · gql) · systemd-bootstrapped on reboot":
        "PM2 · divi procesi (web · gql) · systemd-bootstrapēts pārstartējoties",
    "Docker · compose stack ships server + Mongo + Caddy as a unit · GQL container shares Mongo volume":
        "Docker · compose steks piegādā serveri + Mongo + Caddy kā vienību · GQL konteineris koplieto Mongo apjomu",
    "@dnd-kit · section reorder + intra-section sort · native dataTransfer for image-rail drops":
        "@dnd-kit · sekciju pārkārtošana + sadaļas iekšēja kārtošana · vietējais dataTransfer attēlu joslas nomešanai",
    "i18next · public + decoupled admin instance · inline Alt+click translation editor · hot-reloads":
        "i18next · publiska + atdalīta admin instance · iekšējs Alt+klikšķa tulkojumu redaktors · hot-reload",
    "lucide-react · sole icon library · ESLint bans the rest · IconBase normalises size + weight":
        "lucide-react · vienīgā ikonu bibl. · ESLint aizliedz pārējās · IconBase normalizē izmēru + svaru",
    "10 collections · audit triplet on every doc": "10 kolekcijas · audita trīsvienība uz katra doc",
    "2 droplets · same code · isolated content": "2 droplets · viens kods · izolēts saturs",
    "Feature-sliced · click any node": "Funkciju-šķēlēts · klikšķini jebkuru mezglu",
    "GitHub Actions · push → master · ~3 min": "GitHub Actions · push → master · ~3 min",
    "Handoff · references · back to dossier": "Nodošana · atsauces · atpakaļ uz dosjē",
    "One repo, three concerns. Delete-by-folder on every module.":
        "Viens repozitorijs, trīs jomas. Dzēšana pa mapēm katram modulim.",
    "Optimistic concurrency end-to-end — no silent overwrites.":
        "Optimistiska konkurence no gala līdz galam — bez klusām pārrakstīšanām.",
    "Schema-first GraphQL with a generated typed client (GQty).":
        "Shēma vispirms — GraphQL ar ģenerētu tipētu klientu (GQty).",
    "Two droplets, one codebase. Tenant isolation via .env, not code branches.":
        "Divi droplets, viena koda bāze. Klientu izolācija caur .env, nevis koda zariem.",
    "Audit triplet (editedBy/editedAt/version) on every doc. No \"who changed this?\" tickets.":
        "Audita trīsvienība (editedBy/editedAt/version) uz katra doc. Nav \"kas to izmainīja?\" pieprasījumu.",
    "Single-droplet cost": "Viena droplet izmaksas",
    "ISR fallback window": "ISR rezerves logs",
    "8 · editorial + a11y": "8 · redakcijas + a11y",
    "A content-composable portfolio & marketing CMS — multilingual pages, 17 reusable item types, 8 themes, versioned snapshots with rollback, all on a single $12 droplet.":
        "Saturu kombinējama portfolio un mārketinga CMS — daudzvalodu lapas, 17 atkārtoti lietojami vienumu tipi, 8 tēmas, versionēti momentuzņēmumi ar atgriešanu, viss uz viena $12 droplet.",
    "Codenamefunisimo · monorepo · TypeScriptStatusIn development · live at funisimo.proFootprintTwo droplets · same code · isolated contentPipelinePush → CI → SSH deploy · ~3 min p95AuditEvery write stamps editedBy + version":
        "Kodēšanas vārdsfunisimo · monorepo · TypeScriptStatussIzstrādē · darbojas vietnē funisimo.proPēdaDivi droplets · viens kods · izolēts satursKonveijersPush → CI → SSH izvietošana · ~3 min p95AuditsKatra rakstīšana atstāj editedBy + versiju",
    "A small, declarative grammar — pages, sections, items, styles — that an LLM can compose end-to-end. The output is a beautiful, complex, fully editable site, generated within minutes from a single prompt or bundle.":
        "Maza, deklaratīva gramatika — lapas, sekcijas, vienumi, stili — ko LLM var saliktu no gala līdz galam. Rezultāts ir skaista, sarežģīta, pilnībā rediģējama vietne, ģenerēta minūtēs no viena uzdevuma vai pakas.",
    "Each item type carries a strict schema, a renderer, and an editor. Hand the AI the registry, hand it a brief, and it returns a complete bundle — type-checked, theme-aware, and immediately publishable. The same admin surface a human uses to edit a page is the surface the AI writes against.":
        "Katrs vienuma tips nes stingru shēmu, renderētāju un redaktoru. Iedod AI reģistru, iedod īsu aprakstu, un tā atgriež pilnu paku — tipa-pārbaudītu, tēmas-apzinīgu un nekavējoties publicējamu. Tā pati admin virsma, ko cilvēks lieto lapas rediģēšanai, ir virsma, pret kuru AI raksta.",
    "17 reusable types · 8 themes · 5 locales · one prompt → one site, in minutes.":
        "17 atkārtoti lietojami tipi · 8 tēmas · 5 lokales · viens uzdevums → viena vietne, dažās minūtēs.",
    "device-first · server is a thin shim": "ierīce-vispirms · serveris ir plāns apvalks",
    "The phone owns the data. Every CRUD entity — bookings, clients, invoices, expenses, cases — lives in expo-sqlite on the device. The app is fully usable offline; the server exists only for things the phone genuinely cannot do alone.":
        "Telefonam pieder dati. Katra CRUD entītija — rezervācijas, klienti, rēķini, izdevumi, lietas — atrodas expo-sqlite ierīcē. Lietotne pilnībā darbojas bezsaistē; serveris pastāv tikai lietām, ko telefons patiešām nevar veikt viens.",
    "The Fastify backend handles only auth, legal-content sync, the AI proxy, Stripe webhooks, and crash reports. Three apps share one TypeScript contract via packages/shared — types and constants both sides agree on.":
        "Fastify backend apstrādā tikai autentifikāciju, juridiskā satura sinhronizāciju, AI starpniekserveri, Stripe webhook un avāriju ziņojumus. Trīs lietotnes koplieto vienu TypeScript līgumu caur packages/shared — tipus un konstantes, par kurām abas puses vienojas.",
    "Expo 52 · bare-friendly · expo prebuild in CI generates the Android project · APK + AAB by GitHub workflow":
        "Expo 52 · bare-draudzīgs · expo prebuild CI ģenerē Android projektu · APK + AAB caur GitHub workflow",
    "React Native 0.76 · Hermes · new architecture opt-in · one Paper family · one navigation library":
        "React Native 0.76 · Hermes · jaunā arhitektūra pēc izvēles · viena Paper saime · viena navigācijas bibl.",
    "RN Paper · Material Design 3 · one PaperProvider at root · dark mode (PRO) flips a single token":
        "RN Paper · Material Design 3 · viens PaperProvider saknē · tumšais režīms (PRO) pārslēdz vienu marķieri",
    "expo-sqlite · all CRUD entities · singleton connection + per-entity repository · web swaps in in-memory mock":
        "expo-sqlite · visas CRUD entītijas · singletona savienojums + repozitorijs uz katru entītiju · web aizvieto ar atmiņā esošu maketu",
    "Zustand · tiny stores for cross-screen UI only — auth, theme, language, ad bonuses":
        "Zustand · sīki stori tikai starp-ekrāna UI — autentifikācija, tēma, valoda, reklāmu bonusi",
    "Fastify 4 · plugin tree mirrors route tree · Pino + central error handler maps Zod / ApiError / 500":
        "Fastify 4 · spraudņu koks atspoguļo maršrutu koku · Pino + centrālais kļūdu apstrādātājs kartē Zod / ApiError / 500",
    "Prisma 5 · SQLite in dev and prod · 13 models · single schema.prisma · dev DB checked in for shape":
        "Prisma 5 · SQLite dev un prod · 13 modeļi · viens schema.prisma · dev DB pievienota repo formas dēļ",
    "Argon2id · sane defaults · password reset uses a Resend HTTP send — no SMTP cred on the box":
        "Argon2id · saprātīgi noklusējumi · paroles atjaunošana izmanto Resend HTTP sūtīšanu — bez SMTP credentials uz mašīnas",
    "Stripe · checkout + customer portal via expo-web-browser · webhook is truth for tier · verify-session UX only":
        "Stripe · checkout + klienta portāls caur expo-web-browser · webhook ir patiesība līmenim · verify-session tikai UX",
    "OpenRouter · single proxy endpoint · PII stripped before logging · tier limits + ad bonuses checked here":
        "OpenRouter · viens starpniekservera punkts · PII noņemts pirms žurnālošanas · līmeņa limiti + reklāmu bonusi pārbaudīti šeit",
    "i18next · 7 hand-translated locales (EN · DE · FR · ES · NL · LV · RU) · country sets default at signup":
        "i18next · 7 ar roku tulkotas lokales (EN · DE · FR · ES · NL · LV · RU) · valsts iestata noklusējumu reģistrējoties",
    "Resend · HTTP API only · three templates — password reset, welcome, account-deletion confirmation":
        "Resend · tikai HTTP API · trīs veidnes — paroles atjaunošana, sveiciens, konta dzēšanas apstiprinājums",
    "13 Prisma models · device SQLite mirrors a subset":
        "13 Prisma modeļi · ierīces SQLite atspoguļo apakškopu",
    "single droplet · SQLite on disk · stores publish on tag":
        "viens droplet · SQLite uz diska · veikali publicē pēc taga",
    "~600 source files · feature-sliced · click any node":
        "~600 avota faili · funkciju-šķēlēti · klikšķini jebkuru mezglu",
    "GitHub Actions · server on push · stores on tag":
        "GitHub Actions · serveris pēc push · veikali pēc taga",
    "handoff · references · back to dossier":
        "nodošana · atsauces · atpakaļ uz dosjē",
    "Device-first data model. Practice data never reaches the server.":
        "Ierīce-vispirms datu modelis. Prakses dati nekad nesasniedz serveri.",
    "One TypeScript contract — packages/shared — binds 3 apps.":
        "Viens TypeScript līgums — packages/shared — saista 3 lietotnes.",
    "Tier enforcement only at the JWT-issuing edge; webhook is truth.":
        "Līmeņa izpilde tikai JWT izsniegšanas malā; webhook ir patiesība.",
    "EU-region SQLite + Prisma — $13/mo all-in for the backend.":
        "ES reģiona SQLite + Prisma — $13/mēn. viss iekšā par backend.",
    "OTA channel ships JS-only fixes without a store round-trip.":
        "OTA kanāls piegādā tikai-JS labojumus bez veikala apkārtceļa.",
    "Codenamepeaches · monorepo · pnpm + TurborepoStatusv1.7 in market · legalstablesure.com · Play StoreFootprintAndroid APK + AAB · Fastify API · static landingPipelineManual Android workflow · path-triggered website deployAuditCrash reports, AI usage caps, Stripe-driven tier state":
        "Kodēšanas vārdspeaches · monorepo · pnpm + TurborepoStatussv1.7 tirgū · legalstablesure.com · Play StorePēdaAndroid APK + AAB · Fastify API · statiska sākumlapaKonveijersManuāls Android workflow · ceļa-iniciēta vietnes izvietošanaAuditsAvāriju ziņojumi, AI lietojuma limiti, Stripe vadīts līmenis",
    "A device-first legal-compliance app for European freelancers and small firms. Bookings, clients, invoices, expenses and country-specific legal alerts — in 7 languages, on a single $13 droplet, with the entire data set living in SQLite on your phone.":
        "Ierīce-vispirms juridiskās atbilstības lietotne Eiropas pašnodarbinātajiem un maziem uzņēmumiem. Rezervācijas, klienti, rēķini, izdevumi un valstij specifiski juridiski brīdinājumi — 7 valodās, uz viena $13 droplet, ar visiem datiem SQLite jūsu telefonā.",
    "api.peaches.legal · JWT-gated": "api.peaches.legal · JWT aizsargāts",
    "Play closed test · TestFlight": "Play slēgts tests · TestFlight",

    # ─── unchanged tokens / paths / urls ───
    "support@funisimo.pro": "support@funisimo.pro",
    "in/gatis-priede ↗": "in/gatis-priede ↗",
    "gatispriede ↗": "gatispriede ↗",
    "in/gatis-priede": "in/gatis-priede",
    "github.com/gatispriede": "github.com/gatispriede",
    "funisimo.pro ↗": "funisimo.pro ↗",
    "peaches.legal ↗": "peaches.legal ↗",
    "app.peaches.legal ↗": "app.peaches.legal ↗",
    "legalstablesure.com ↗": "legalstablesure.com ↗",
    "apps/mobile/src/": "apps/mobile/src/",
    "apps/api/src/routes/": "apps/api/src/routes/",
    "apps/api/prisma/schema.prisma": "apps/api/prisma/schema.prisma",
    "packages/shared/src/types/": "packages/shared/src/types/",
    "docs/architecture/": "docs/architecture/",
    ".github/workflows/ci.yml": ".github/workflows/ci.yml",
    "—": "—",
    "·": "·",
    # encoding-corrupted middle dots
    "�": "·",
}


def main() -> int:
    with SRC.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames or ["key", "source", "lv"]
        rows = list(reader)

    overridden = 0          # had echo lv == source, replaced with real LV
    filled_empty = 0        # was blank, filled
    same_as_source = 0      # mapped to itself (number / brand / token)
    skipped_real = 0        # operator hand-edited, leave alone
    missing: list[str] = []

    for r in rows:
        source = r.get("source", "")
        current_lv = (r.get("lv", "") or "").strip()
        is_echo = current_lv == source.strip()
        is_empty = current_lv == ""

        # Operator-edited (and not just an echo) — never override.
        if current_lv and not is_echo:
            skipped_real += 1
            continue

        if source in LV:
            r["lv"] = LV[source]
            if LV[source] == source:
                same_as_source += 1
            elif is_empty:
                filled_empty += 1
            else:
                overridden += 1
        else:
            missing.append(source)

    with OUT.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {OUT}")
    print(f"  filled empty:           {filled_empty}")
    print(f"  overrode echo lv:       {overridden}")
    print(f"  same-as-source mapping: {same_as_source}")
    print(f"  operator-edited (kept): {skipped_real}")
    print(f"  unmapped:               {len(missing)}")
    if missing:
        print()
        print("  --- entries not yet in LV dictionary ---")
        for s in missing[:30]:
            print(f"    {s!r}")
        if len(missing) > 30:
            print(f"    ... and {len(missing) - 30} more")
    return 0


if __name__ == "__main__":
    sys.exit(main())
