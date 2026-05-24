// Plot's landing page.
//
// Current state (2026-05-23): the page renders the PlotMaps wordmark
// alone, centered on a parchment field, as the first iteration of the
// logo-first treatment. The full FieldManualPlate (figure grid, brass
// key, headline cartouche) re-integrates around this once the logo
// presentation is locked.
//
// See:
//   - memory/project_landing_page_field_manual.md (overall landing direction)
//   - memory/project_master_logomark_locked.md (locked logo spec)
//   - src/components/landing/PlotMapsHero.tsx (current logo-first treatment)
//   - src/components/landing/FieldManualPlate.tsx (re-integration target)
//   - src/components/landing/EntrySequence.tsx (transition to /map)

import type { Metadata } from 'next';
import PlotMapsHero from '@/components/landing/PlotMapsHero';

export const metadata: Metadata = {
  title: "Plotmaps — A Modern Practitioner's Manual",
  description:
    'Plot is a surveying field manual rendered in real time. Open the page, turn the key, fly your hometown.',
};

export default function LandingPage() {
  return <PlotMapsHero />;
}
