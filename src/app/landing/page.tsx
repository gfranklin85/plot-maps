// Plot's landing page — Plot's surveying field manual.
//
// A single parchment plate styled as Page I of Plot's published
// encyclopedia of surveying. Numbered figures of Plot's instruments,
// each capable of awakening from 2D ink illustration into a full 3D
// crafted artifact. The brass-key figure is the entry — click it and
// the parchment yields to the photoreal 3D map.
//
// See:
//   - memory/project_landing_page_field_manual.md (locked direction)
//   - public/assets/landing/figures/README.md (asset drop-in spec)
//   - src/components/landing/FieldManualPlate.tsx (composition)
//   - src/components/landing/FigureSlot.tsx (per-figure rendering)
//   - src/components/landing/EntrySequence.tsx (transition to /map)

import FieldManualPlate from '@/components/landing/FieldManualPlate';

export const metadata = {
  title: 'Plotmaps — A Modern Practitioner\'s Manual',
  description:
    'Plot is a surveying field manual rendered in real time. Open the page, turn the key, fly your hometown.',
};

export default function LandingPage() {
  return <FieldManualPlate />;
}
