# Plot landing-page figure assets

Drop hand-crafted figure assets here as they're finished. The landing
page picks them up automatically from these paths — no code change
required to swap a typographic placeholder for the real artifact.

## Naming convention

Each figure has a `key` (lowercase identifier) used in both file paths:

- 2D (resting state, hand-engraved ink illustration):
  `public/assets/landing/figures/2d/<key>.svg` (preferred) or `.png`
- 3D (awakened state, full Plot artifact in dimensional form):
  `public/assets/landing/figures/3d/<key>.glb`

If a `2d` file exists but no `3d` file exists, the slot renders the
2D illustration and skips the awaken-on-hover transformation. No
broken state.

## Figures planned for v1

The landing page declares slots for these figures in
`src/app/landing/page.tsx`. Drop assets matching these keys as
they're finished:

| Key | Figure label | Brief |
|---|---|---|
| `compass` | Fig. I — Compass | Brass surveyor's compass with patina. Plot coral signature accent on the N marker. |
| `transit` | Fig. II — Transit | Brass surveyor's transit on tripod, lens facing toward viewer. |
| `chain` | Fig. III — Chain | Surveyor's chain with brass links, partially coiled. |
| `level` | Fig. IV — Air Level | Brass air-level instrument on stand. |
| `quadrant` | Fig. V — Quadrant | Brass quadrant with engraved scale. |
| `plat` | Fig. VI — Plat of Survey | Hand-drawn parcel diagram showing boundaries, monuments, scale. |
| `brass-key` | Fig. VII — Master Key | **THE ENTRY AFFORDANCE.** Antique brass skeleton key with Plot star cut through the bow, coral backing on the star opening. |
| `ledger` | Fig. VIII — Field Ledger | Leather-bound surveyor's field notebook, half-open showing hand-written notation. |
| `lantern` | Fig. IX — Field Lantern | Period brass lantern with visible warm glow. |
| `theodolite` | Fig. X — Theodolite | Brass theodolite, modern surveyor's primary instrument. |
| `plotmaps-mark` | Fig. XI — Plotmaps | The Plot wordmark treated as a printer's signature mark. |
| `parcels` | Fig. XII — Surveyed Parcels | Tiny illustrated map showing a few parcels with hand-drawn boundary lines. |

## Plot proprietary signature reminder

Every figure carries the dual signature per
`memory/project_plot_proprietary_signature.md`:
1. ONE coral accent element per artifact (visible at small size)
2. A tiny Plot hallmark stamped at a consistent location (visible
   on close inspection in the 3D version)

## Motion brief reminder

Every 3D figure should be modeled so it can be slowly rotated by the
runtime (typically a quiet idle rotation) without breaking. Avoid
backside detail that would look wrong on rotation; the runtime can
also lock the camera to a flattering angle if needed. See
`docs/landing-page-design.md` (when written) for motion specifics.

## How to add a new figure later

1. Pick a new key (lowercase, hyphenated).
2. Add the entry to `FIGURES` in `src/app/landing/page.tsx`.
3. Drop the 2D file at `2d/<key>.svg` and (optionally) the 3D at `3d/<key>.glb`.
4. Reload — the figure appears.
