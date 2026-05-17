# Affinity Source Files

> The `.afdesign` (Vector / Layout) and `.afphoto` (Pixel) source files for hand-crafted Plot brand assets. Always save the source here when exporting a production asset to `/public/`.

## Folder organization (populate as we build)

```
source-affinity-files/
  ├── textures/          ← grain, noise, paper, ink overlays
  ├── icons/             ← custom icon set (eventually replacing Material Symbols)
  ├── pins/              ← map pin family (surveyor's stakes, brass medallions)
  ├── objects/           ← brass compass, pencil, folding rule, notebook, etc.
  ├── logo/              ← Plot wordmark + pin mark variants
  ├── dividers/          ← hand-drawn ink rules, decorative cartouches
  ├── stamps/            ← wax seals, county clerk stamps, "Plot Action Permit"
  ├── hero/              ← landing-page hero compositions
  └── postcard/          ← Lob direct-mail templates
```

## Discipline rules

- **Always save the source file** with the production export. If you export `paper-grain.png` to `/public/textures/`, save `paper-grain.afphoto` here.
- **Version files explicitly** (`logo-pin-v1.afdesign`, `logo-pin-v2.afdesign`) when iterating. Don't overwrite v1 — keep history.
- **Color values come from `brand/colors-and-type/PLOT_BRAND_PALETTE.md`** — set up an Affinity Swatch document with the Plat Book palette so you click instead of typing hex codes.
- **Every asset obeys the canonical light** (see memory `project_visual_rendering_language.md` — warm light from upper-left at ~30°).
- **Match the vintage cartography aesthetic** — when in doubt, look at the source-references mood board.

## Currently in this folder

Empty — about to populate. First asset: brass surveyor's compass for the dashboard.
