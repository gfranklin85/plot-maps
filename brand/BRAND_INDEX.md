# Plot Brand — Index

> Single entry point for everything related to Plot's brand identity, visual world, and asset pipeline. Bookmark this file.

**Last updated**: 2026-05-16

---

## The brand in one sentence

**Plot looks like vintage cartography rendered in stylized realism.**

- **Subject matter**: vintage cartography — plat books, USGS topo maps, hand-inked surveyor's drawings, 1890-1950 atlas pages, brass surveying instruments, leather field notebooks, county clerk stamps.
- **Rendering technique**: stylized realism — looks real, intentionally rendered, warm canonical light, holds up over time. Death Stranding / Things 3 / Bear / Monument Valley tier.
- **Tone**: soft and serious, never one without the other. Tech-capable on top.

---

## The brand documents

### 🎨 Colors & Type
**[colors-and-type/PLOT_BRAND_PALETTE.md](colors-and-type/PLOT_BRAND_PALETTE.md)** — Complete brand palette with hex, RGB, CMYK, Pantone, embroidery thread numbers, vinyl decal codes, business card stock recommendations, social media usage. Use this for **all** brand work: web, app, merch, print, signage.

Quick reference:
- Canvas (cream): `#F4EAD5`
- Primary action (coral): `#C8553D`
- Stake accent (safety orange): `#F26B1F` — reserved for "mark this parcel" moments
- Blueprint navy (data ink): `#1D3557`
- Ink primary (text): `#1A1F2E`
- Typography: Geist Sans (body/headlines) + Geist Mono (data/coordinates)

### 📸 Source References & Mood Board
**[source-references/](source-references/)** — AI-generated and real-world reference images that establish the visual destination. **These are mood-board only — never ship as production assets.**

Currently:
- `mockup-survey-table-dashboard.png` — Direction for the dashboard
- `mockup-plat-book-activity.png` — Direction for an activity / ledger view

When adding more references, save them here with descriptive names. Include their source in this index.

### 🧱 Source Files
**[source-affinity-files/](source-affinity-files/)** — `.afdesign` and `.afphoto` source files for hand-crafted brand assets. Organized by asset type as we build them.

---

## Asset organization (per the design roadmap)

Plot follows this folder structure across the repo:

```
/brand/                         ← THIS DIRECTORY
  ├── BRAND_INDEX.md            ← you are here
  ├── colors-and-type/          ← palette + typography spec
  ├── source-affinity-files/    ← Affinity .afdesign source files
  └── source-references/        ← mood-board / AI gens / inspiration

/public/textures/               ← production-ready raster textures (paper grain, etc.)
/public/svg/                    ← production-ready SVG assets (will populate)
/public/icons/                  ← app icons and favicons
/public/hero/                   ← landing-page hero compositions
/public/3d/                     ← Spline / Blender exports (GLB)

/src/components/motion/         ← Framer Motion reusable components
/src/app/globals.css            ← brand tokens (palette, shadows, textures)
/tailwind.config.ts             ← Tailwind brand color / shadow exposure
```

---

## The canonical memories (Claude's instructions)

All brand-related decisions live in Claude's memory system at `C:\Users\gregf\.claude\projects\c--dev-plot-maps\memory\`. The brand-relevant memories:

| Memory | What it covers |
|---|---|
| `project_design_roadmap_spatial_product_world.md` | Top-level design ambition. 4-pillar tool stack (Affinity/Framer Motion/Spline/Blender), phased execution, 3D map-layer system as moat |
| `project_brand_voice_analog_digital_fusion.md` | Two-layer thesis: vintage cartography (subject) + stylized realism (technique). The two anchor mockups |
| `project_visual_rendering_language.md` | Canonical warm light from upper-left at ~30°. Every rendered asset obeys. Map base stays photoreal |
| `project_brand_palette_direction.md` | The Plat Book palette decision rationale |
| `project_design_backlog_and_pipeline.md` | The 26-item asset backlog with execution sequence |
| `feedback_lead_with_destination.md` | Lead with the destination + reference points, don't fragment direction-setting |

These are loaded into context automatically when Claude is helping with Plot work. They don't need to be referenced manually.

---

## What's currently shipped

As of 2026-05-16, the brand foundation is live in production:

- ✅ Plat Book palette (cream + coral + safety orange + blueprint navy + zoning-legend status colors)
- ✅ Geist Sans + Geist Mono typography
- ✅ Paper grain texture overlay (`/textures/paper-grain.png`)
- ✅ Blueprint grid SVG (`/textures/blueprint-grid.svg`)
- ✅ Warm paper-shadow elevation system (`shadow-paper-sm/md/lg/xl`)
- ✅ Framer Motion ambient drift animation on the blueprint grid
- ✅ Staggered card reveals + hover lift on dashboard
- ✅ Light theme as default (dark theme still works via toggle)

What's next:
- Real hand-crafted assets to replace AI mockups: brass compass, surveyor's pencil, folding rule, leather notebook corner, paper-permit card treatment
- Custom Plot wordmark (replacing the generic indigo gradient pin logo)
- Pin family for the map (surveyor's stakes with colored flags)

---

## Where to start (for future-you, or anyone helping with brand work)

1. **Read this file** (you just did)
2. **Read [PLOT_BRAND_PALETTE.md](colors-and-type/PLOT_BRAND_PALETTE.md)** for color specs
3. **Look at the source-references** to see the visual destination
4. **Check the design roadmap memory** for what's planned and what's been built
5. **Start building** — Affinity for assets, Spline for 3D, Framer Motion for behavior, Blender for cinematic work
