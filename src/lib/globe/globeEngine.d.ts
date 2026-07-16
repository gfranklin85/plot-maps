// Types for the vendored D3 polygon globe engine (globeEngine.js).
// The canvas globe: clickable country/state shapes, our colors, cinematic
// drill world → country → US states, callbacks the React wrapper consumes.

export interface GlobePalette {
  ocean?: string;
  sphere?: string;
  land?: string;
  landStroke?: string;
  highlight?: string;
  highlightStroke?: string;
  graticule?: string;
  marker?: string;
}

export interface GlobeMarket {
  id: string;
  name: string;
  sub?: string;
  lon: number;
  lat: number;
  country?: string;
  state?: string;
}

export interface GlobeOpts {
  palette?: GlobePalette;
  onHover?: (name: string | null) => void;
  onLevelChange?: (level: number, name: string | null) => void;
  onEnterArea?: (name: string | null, market: GlobeMarket | null) => void;
}

export interface GlobeData {
  countries: unknown; // GeoJSON FeatureCollection
  land: unknown;
  states: unknown;
}

export declare class GlobeApp {
  constructor(canvas: HTMLCanvasElement, opts?: GlobeOpts);
  setData(data: GlobeData): void;
  start(): void;
  destroy(): void;
  resize(): void;
  static MARKETS: GlobeMarket[];
}

export default GlobeApp;
