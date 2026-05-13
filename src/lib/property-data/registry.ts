// Phase D1: Source registry.
//
// Single import point for the resolver and the admin panel. When we add
// Hanford / Visalia / etc. in Phase D2, they get added here. Nothing else
// changes downstream.

import type { PropertyDataSource } from './types';
import { LEMOORE_GIS_LIVE, LEMOORE_GIS_SNAPSHOT } from './sources/lemoore-gis';

export const REGISTERED_SOURCES: PropertyDataSource[] = [
  LEMOORE_GIS_LIVE,
  LEMOORE_GIS_SNAPSHOT,
];

export function getSourceById(id: string): PropertyDataSource | null {
  return REGISTERED_SOURCES.find(s => s.id === id) ?? null;
}

// Live sources that the resolver consults on DB miss. Snapshot-kind
// sources don't run per-point; they're invoked by the admin panel.
export function getLiveSources(): PropertyDataSource[] {
  return REGISTERED_SOURCES.filter(s => s.kind === 'arcgis_live');
}
