// Ambient declaration for @mkkellogg/gaussian-splats-3d.
//
// The library ships no .d.ts. We narrow to the runtime surface we
// actually call in SplatHUDLayer (see that file's local interface),
// and let everything else through as `unknown`.

declare module '@mkkellogg/gaussian-splats-3d' {
  export const Viewer: unknown;
}
