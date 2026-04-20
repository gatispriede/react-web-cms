# SkyClimber — Design Specification
> Feed this document to Claude or a design tool to generate visual mockups.

---

## 1. Brand Identity

| Token | Value |
|---|---|
| **Company** | SkyClimber |
| **Tagline** | *Strādājam augstumos — kur citi nespēj sasniegt* |
| **Industry** | Industrial alpinism / rope-access services, Latvia |
| **Tone** | Professional, bold, reliable, technical — not extreme-sport |
| **Locale** | Latvian (LV) |

---

## 2. Color Palette

| Role | Hex | Usage |
|---|---|---|
| Background | `#E8E3D3` | Page background, cards |
| Ink | `#13201A` | Primary text, headers |
| Accent (Sea) | `#1E5A6B` | CTAs, highlights, borders |
| Accent Light | `#7FB7C4` | Hover states, secondary chips |
| Surface | `#F4F1EA` | Card backgrounds, subtle panels |
| Muted | `#6B7C75` | Secondary text, captions |
| White | `#FFFFFF` | Overlays, nav backgrounds |

---

## 3. Typography

| Role | Font | Weight | Size (desktop) |
|---|---|---|---|
| Display / Hero | Fraunces (serif) | 700 | 72–96px |
| Section heading | Fraunces | 600 | 40–56px |
| Body | Geist Sans | 400 | 16–18px |
| Body emphasis | Geist Sans | 500 | 16–18px |
| Label / Chip | Geist Mono | 500 | 11–13px uppercase |
| Caption | Geist Sans | 400 | 13px |

---

## 4. Logo

- Wordmark: **SKY CLIMBER** in Geist Mono, letter-spacing 0.15em
- Icon: stylised carabiner or figure rappelling (single color, works on dark + light)
- Color: Ink `#13201A` on light backgrounds; White on dark/photo backgrounds
- Clear space: 1× cap-height on all sides

---

## 5. Navigation

```
[ SKY CLIMBER logo ]    Sākums   Pakalpojumi   Galerija   Kontakti    [ Sazināties ]
```

- Sticky top bar, translucent blur background on scroll
- Mobile: hamburger → full-screen overlay, links centered, large type
- Active indicator: 2px underline in accent `#1E5A6B`

---

## 6. Pages & Sections

### 6.1 Sākums (Home)

#### Hero
- **Layout**: Full-width, 90vh minimum height
- **Background**: Dark photo — worker on rope against building facade
- **Overlay**: `rgba(19, 32, 26, 0.55)` gradient from bottom
- **Headline**: `Strādājam augstumos —`  
  second line: `kur citi nespēj sasniegt.`
- **Subline**: `Rūpnieciskais alpīnisms un virves piekļuves pakalpojumi visā Latvijā.`
- **CTA buttons**: `Skatīt pakalpojumus` (accent fill) + `Sazināties` (ghost)
- **Animation**: Fade-up for headline, fade-in for subline (200ms stagger)

#### Marquee Gallery Strip
- **Layout**: Full-width infinite scroll strip, height ~220px
- **Content**: 8–10 site images scrolling left, slight gap between images
- **Speed**: ~40s loop, pauses on hover
- **Style**: Images in grayscale, saturate to color on hover

---

### 6.2 Pakalpojumi (Services)

#### Manifesto Banner
- **Layout**: Full-width, centered text, accent background `#1E5A6B`
- **Text (white)**: `Mēs strādājam *augstumos* — ar {{chip:virve:VIRVES PIEKĻUVE}} tehnoloģiju un {{chip:alpin:ALPĪNISMA}} prasmi — kur citi metodes *nespēj sasniegt.*`
- **Addendum**: `SkyClimber komanda — sertificēti augstuma darbu speciālisti ar 10+ gadu pieredzi rūpnieciskajā alpīnismā.`
- **Chips**:
  - `VPK` — gradient `#1E5A6B → #7FB7C4`
  - `SC` — gradient `#13201A → #2C3A30`

#### Services Overview Cards
- **Layout**: 3-column grid on desktop, 1-column on mobile
- **Each card**: Icon + title + 2-line description + "Uzzināt vairāk" link
- **Services list** (see §7 for full copy)

#### Service Sections (×6, alternating image/text columns)

Each section is `type: 2` — two equal columns, 16px gap.

| # | Service | Image side | Animation |
|---|---|---|---|
| 1 | Fasādes darbi | Left | slide-right |
| 2 | Jumta darbi | Right | slide-left |
| 3 | Logu mazgāšana | Left | slide-right |
| 4 | Krāsošana un apkope | Right | slide-left |
| 5 | Koku zāģēšana | Left | slide-right |
| 6 | Metāla konstrukciju montāža | Right | slide-left |

**Image column**: rounded corners (8px), `object-fit: cover`, aspect 4:3  
**Text column**: vertical center, heading (Fraunces 32px), body (Geist 16px), bullet list of 4–5 points, accent CTA link

---

### 6.3 Galerija (Gallery)

- **Layout**: Masonry grid, 3 columns desktop / 2 tablet / 1 mobile
- **Interaction**: Click → lightbox with next/prev navigation
- **Captions**: Shown in lightbox overlay (service name)
- **Animation**: `zoom-in` per item, staggered 110ms

---

### 6.4 Kontakti (Contact)

#### Contact Hero
- **Headline**: `Sazināties ar mums`
- **Subline**: `Atstājiet ziņu vai zvaniet — atbildēsim darba dienās 24h laikā.`
- **Background**: Light surface `#F4F1EA`

#### Contact Details
- **Layout**: Single column, centered
- **Content** (see §8)

---

## 7. Service Copy (Latvian)

### Fasādes darbi
**Heading**: Fasādes darbi  
**Body**: Profesionāla ēku fasāžu tīrīšana, mazgāšana un labošana, izmantojot virves piekļuves metodes. Strādājam ar jebkura augstuma un sarežģītības ēkām — no dzīvojamiem namiem līdz rūpnieciskām būvēm.  
**Bullets**:
- Fasāžu mazgāšana un tīrīšana
- Šuvju hermetizācija un labošana
- Siltumizolācijas uzstādīšana
- Ēkas apskate un diagnostika

### Jumta darbi
**Heading**: Jumta darbi  
**Body**: Droša jumta pārbaude, remonts un apkope bez dārgiem sastatnēm. Mūsu speciālisti piekļūst jebkuram jumta tipam — klajam, leņķainām segumam vai sarežģītām konstrukcijām.  
**Bullets**:
- Jumta seguma pārbaude un remonts
- Notekūdeņu sistēmu tīrīšana
- Sniega un ledus noņemšana
- Antenas un iekārtu uzstādīšana

### Logu mazgāšana
**Heading**: Logu mazgāšana  
**Body**: Augstceltņu un grūti pieejamu logu profesionāla mazgāšana virves piekļuves metodē. Bez traipiem, bez ūdens noplūdēm — tikai spīdīgs rezultāts.  
**Bullets**:
- Logu un stiklojumu mazgāšana
- Fasāžu stikla paneļu tīrīšana
- Jumta jumtiņu un gaismas lūku mazgāšana
- Regulāra apkopes plānošana

### Krāsošana un uzturēšana
**Heading**: Krāsošana un uzturēšana  
**Body**: Ēku ārsienu krāsošana un aizsargpārklājumu uzklāšana. Ilgmūžīgs rezultāts, izmantojot augstvērtīgas krāsas un profesionālu sagatavošanu.  
**Bullets**:
- Ārsienu un fasāžu krāsošana
- Pretkorozijas pārklājumi
- Graffiti noņemšana
- Aizsargkrāsu uzklāšana metālam

### Koku zāģēšana
**Heading**: Koku zāģēšana  
**Body**: Bīstamu vai grūti pieejamu koku zāģēšana un apzāģēšana arborista metodēs. Droša darba izpilde bez kaitējuma apkārtējai videi un ēkām.  
**Bullets**:
- Koku nozāģēšana pa daļām
- Sausu zaru apzāģēšana
- Avārijas darbi vētras bojājumu gadījumā
- Koku fragmentu savākšana un izvešana

### Metāla konstrukciju montāža
**Heading**: Metāla konstrukciju montāža  
**Body**: Metāla elementu uzstādīšana, savienošana un apkope augstumā — no aizsargtīkliem līdz fasādes nesošajām konstrukcijām.  
**Bullets**:
- Metāla balstu un stiprinājumu montāža
- Aizsarg- un drošības tīklu uzstādīšana
- Konstrukciju pārbaude un apkope
- Korozijas skarto elementu nomaiņa

---

## 8. Contact Details

| Field | Value |
|---|---|
| **Telefons** | +371 2X XXX XXX |
| **E-pasts** | info@skyclimber.lv |
| **Adrese** | Rīga, Latvija |
| **Darba laiks** | P–Pk 8:00–18:00 |
| **Licences** | Augstuma darbu sertifikāts Nr. XXXX |

---

## 9. Image Inventory

All images are available at `design-v2/assets/img/` in the following subdirectories:

| Folder | Count | Usage |
|---|---|---|
| `alpinisms/` | ~6 | Hero backgrounds, manifesto banner, alpinism service |
| `fasades/` | ~6 | Fasādes darbi section + gallery |
| `jumta/` | ~6 | Jumta darbi section + gallery |
| `logu/` | ~4 | Logu mazgāšana section + gallery |
| `krasosana/` | ~6 | Krāsošana section + gallery |
| `metala/` | ~4 | Metāla montāža section + gallery |

**Recommended hero image**: `alpinisms/alp1.jpg` or similar — worker in harness against building

---

## 10. Animations

| Context | Animation | Delay |
|---|---|---|
| Hero headline | fade-up | 0ms |
| Hero subline | fade-in | 200ms |
| Hero CTA | fade-up | 350ms |
| Marquee strip | (continuous scroll, no entry anim) | — |
| Manifesto | fade-in | 0ms |
| Service card grid | zoom-in | 110ms × index |
| Image+text sections (image) | slide-right / slide-left | 0ms |
| Image+text sections (text) | slide-left / slide-right | 110ms |
| Gallery items | zoom-in | 110ms × index |
| Contact details | fade-up | 110ms × index |

---

## 11. Spacing & Layout

| Token | Value |
|---|---|
| Page max-width | 1280px |
| Section padding (vertical) | 96px desktop / 64px tablet / 48px mobile |
| Section padding (horizontal) | 48px desktop / 24px tablet / 16px mobile |
| Card gap | 24px |
| Column gap (2-col) | 48px desktop / 24px tablet |
| Border radius (cards) | 8px |
| Border radius (images) | 8px |

---

## 12. Prompt for Claude Design / Figma AI

> **Context**: Design a professional B2B website for **SkyClimber**, a Latvian industrial alpinism and rope-access services company. The site targets building managers, facility teams, and construction contractors.
>
> **Visual direction**: Clean editorial layout inspired by portfolio studios. Forest-ink typography on warm parchment background. Bold Fraunces serif for headings. Sea-teal `#1E5A6B` as the sole accent. Photography-forward — large, full-bleed images of workers on ropes against urban facades.
>
> **Mood**: Precise, confident, industrial — like a technical manual that's also beautiful. Not extreme sports. Not construction company. Think: surgical expertise at height.
>
> **Pages**: Home (hero + gallery strip), Services (manifesto + 6 detailed service sections), Gallery, Contact.
>
> **Key constraint**: Must work in both Latvian and be accessible (WCAG AA contrast ratios).
