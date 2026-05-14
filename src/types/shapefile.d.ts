// Ambient module declaration for the 'shapefile' npm package
// (https://github.com/mbostock/shapefile). The package does not ship its
// own types and there's no @types/shapefile on the DefinitelyTyped
// registry. We only consume the streaming open() API in our adapters, so
// the declared surface is intentionally minimal.

declare module 'shapefile' {
  interface ShapefileFeature {
    type: 'Feature';
    geometry: {
      type: string;
      coordinates: unknown;
    };
    properties: Record<string, unknown>;
  }

  interface ShapefileSource {
    read(): Promise<{ done: boolean; value: ShapefileFeature }>;
  }

  export function open(
    shp: string | ArrayBuffer | Uint8Array,
    dbf?: string | ArrayBuffer | Uint8Array | null,
    options?: { encoding?: string },
  ): Promise<ShapefileSource>;
}
