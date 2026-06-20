# PlotMaps — DESIGN.md

The look and feel for **PlotMaps**, a spatial real-estate platform (a flyable
3D/2D map + a prospecting toolkit) operated by **Position Realty**. This
document is the single source of truth for every UI. Build to *its* rules — a
clean, light, professional product with one confident blue accent.

---

## 1. Brand & personality

- **Feel:** Clean, light, modern SaaS. The restraint of Linear, Intercom, and
  Vercel. Calm white surfaces, generous whitespace, one blue accent.
- **Tone:** Professional and effortless. Users are real-estate agents, brokers,
  investors, and home buyers — not gamers. Nothing gimmicky or loud.
- **Depth comes from soft shadows, light, and gentle floating elements** — never
  heavy 3D, never dark drama. The screen is always 2D faking depth.
- **Color comes from real content** (property photos, map imagery, illustrated
  icons). The UI chrome itself stays neutral so the content pops.

**Two brands, one system:**
- **PlotMaps** = the consumer platform (the headline voice).
- **Position Realty** = the licensed brokerage inside it (quiet, supporting).
  Position uses a calm slate accent, never competes with PlotMaps blue.

---

## 2. Color

### Primary — PlotMaps Blue (the single accent)
| Token | Hex | Use |
|---|---|---|
| `brand` | `#1349d4` | Primary buttons, links, active states, icons, accents, the highlighted word in a headline |
| `brand-deep` | `#122d8d` | Hover/pressed states, gradient ends |
| `brand-soft` | `#e0e7fb` | Pills, tags, soft fills, icon-tile backgrounds |

### Text
| Token | Hex | Use |
|---|---|---|
| `ink` | `#0c1322` | Headlines, primary text |
| `body` | `#4a5568` | Paragraphs, descriptions |
| `muted` | `#7a8494` | Captions, meta labels, placeholders |

### Surfaces
| Token | Value | Use |
|---|---|---|
| `page` | `#ffffff` | Default page background |
| `page-sky` | the sky gradient below | The signature app background (dashboard, app surfaces) |
| `card` | `#ffffff` (72–90% opacity over sky) | Cards, panels, modals |
| `border` | `rgba(19,73,212,0.08)` | Hairline borders, dividers |
| `border-strong` | `rgba(19,73,212,0.22)` | Card border on hover |

**Signature sky-blue background gradient** (use for app/dashboard surfaces):
```css
background:
  radial-gradient(120% 80% at 82% 0%, #cee4fc, transparent 55%),
  radial-gradient(90% 70% at 10% 2%, #ffffff, transparent 60%),
  linear-gradient(180deg, #e9f2fd 0%, #eef4fc 60%, #e8f0fb 100%);
```

### Position Realty (brokerage) — supporting accent only
| Token | Hex | Use |
|---|---|---|
| `position` | `#334155` (slate) | Position-branded elements ONLY. Quiet, never the primary accent. |

### Status colors
| State | Hex |
|---|---|
| Active / Ready / Success | `#16a34a` (green) |
| In progress / Info | `#1349d4` (blue) |
| Pending / Warning | `#d9a441` (amber) |
| Coming soon / Inactive | `#7a8494` (muted grey) |

### Banned (old/killed themes — never use)
- ❌ Dark navy surfaces (`#0c1324`, `#0E1626`) — the retired dark dashboard
- ❌ Cyan (`#00f2ff`) — the old form-builder accent
- ❌ Cream / parchment (`#F4EAD5`) — the killed vintage theme
- ❌ Coral (`#C8553D`) as a primary — the old indie palette
- ❌ Any second bright color. One accent (blue). Status greens excepted.

---

## 3. Typography

- **Font family:** Geist (preferred). Fallbacks: Inter, Manrope — clean
  geometric sans-serif.
- **Headlines:** weight **800**, tight tracking (`letter-spacing: -0.02em`),
  large. Color `ink`. A headline may flip its key line/word to `brand` blue.
- **Body:** weight 400–500, line-height ~1.5, color `body`.
- **Eyebrow / label:** weight 700, UPPERCASE, wide tracking (`0.1em`), small
  (~12px), color `brand`.
- **Numbers/stats:** weight 800, large, color `ink`.

Type scale (rough): hero 48–68px · h1 34–52px · h2 26–38px · h3 18–22px ·
body 14–17px · label 11–13px.

---

## 4. Components

### Cards
- White surface, **border-radius 16–22px**, hairline `border`.
- Soft shadow: `0 12px 30px -22px rgba(20,50,120,0.4)`.
- **Hover:** lift `translateY(-3px)`, stronger shadow, `border-strong`.
- A **flagship card** (a special/featured one) gets a brighter white→soft-blue
  surface, a crisp blue border, and a filled-blue icon tile.

### Buttons
- **Primary:** `brand` fill, white text, radius 12px, shadow
  `0 10px 22px -10px rgba(19,73,212,0.6)`. Hover → `brand-deep` + lift 1px.
- **Ghost / secondary:** white fill, `ink` text, hairline border. Hover →
  border darkens + lift 1px.
- **Text/link button:** `brand` text, arrow `→` affordance.
- Padding ~12–14px × 22–24px. Font weight 600.

### Pills / tags / badges
- `brand-soft` background, `brand-deep` text, fully rounded, small, weight 700,
  uppercase for labels.

### Icons
- **Material Symbols** in `brand` blue inside a **soft-blue rounded tile**
  (`brand-soft` bg, 16px radius, 56–72px), OR
- **Rich 3D illustrated icons** on transparent backgrounds (the preferred
  premium treatment — floaty, soft-shadowed, can animate/assemble on hover).

### Inputs / forms
- White field, hairline border, radius 10–12px. Focus → blue ring
  `0 0 0 3px rgba(19,73,212,0.15)` + blue border. Placeholder in `muted`.

### Header / nav
- Sticky, white with subtle blur (`rgba(255,255,255,0.82)` + backdrop-blur),
  hairline bottom border.
- Left: **PlotMaps logomark** + **"by position"** (lowercase, dotless i's —
  brand signature). Center/left: nav links (`body` color, hover → `brand`).
  Right: a ghost button + a primary "Get Started" button.

### Motion
- Gentle. Ease-out springs (`cubic-bezier(0.22,1,0.36,1)`).
- Floating elements bob/drift slowly and slightly out of sync (alive, not busy).
- Cards can fly/stagger in on load (rise + settle).
- Honor `prefers-reduced-motion`.

---

## 5. Logo & brand marks

- **PlotMaps logomark:** wordmark "PlotMaps" with a theodolite-reticle in the O.
  Rendered in black/ink on light surfaces.
- **Position wordmark:** lowercase **"position"** — **the i's have NO dots
  (tittles)**. This dotless-i is the deliberate brand signature. NEVER render
  "Position" as plain text where the mark appears (system fonts add the dots
  back). Color is flexible (black or navy).

---

## 6. Layout principles

- Max content width ~1180–1320px, centered, 24px side padding.
- Generous vertical rhythm; let things breathe.
- One clear focal point per screen (a headline, a hero, a primary action).
- On the dashboard/app surfaces, use the **sky-blue background**; on dense data
  screens (tables, forms), white is fine — keep the blue accents consistent.
- Real content (photos, illustrations, the floating land-platform hero) carries
  the visual interest; the chrome stays calm.

---

## 7. Reference: the existing front page (match this)

The front page already embodies the target: a light sky-blue field, a big
two-tone headline ("See every home like never before." in ink + a blue line),
a floating isometric land-platform hero, blue CTAs, white cards with soft
shadows, and the PlotMaps + "by position" logo lockup. Every new screen should
feel like it belongs next to it.
