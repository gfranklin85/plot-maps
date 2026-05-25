// Ambient declaration for window.Cesium — the global the Cesium CDN
// script writes when it loads. Both CesiumGlobe (landing) and
// MapViewCesium (work map) read from window.Cesium; this is the
// single canonical type so the two components don't fight over it.
//
// We intentionally use a loose `unknown`-typed shape here. Cesium's
// real types aren't installed (we don't ship the npm package), and
// importing typed stubs would pull the whole tree back in. Each
// consumer narrows the shape it cares about locally with type
// assertions.

declare global {
  interface Window {
    Cesium?: Record<string, unknown>;
  }
}

export {};
