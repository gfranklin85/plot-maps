// Ambient declaration for @mkkellogg/gaussian-splats-3d.
// The library ships no .d.ts; we treat its exports as unknown and
// narrow inside the calling components.

declare module '@mkkellogg/gaussian-splats-3d' {
  export const Viewer: unknown;
  export const DropInViewer: unknown;
}
