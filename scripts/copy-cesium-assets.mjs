#!/usr/bin/env node
// Copies Cesium's static runtime assets (Workers, ThirdParty, Assets,
// Widgets) from node_modules into public/cesium/ so Next.js serves them
// at /cesium/. CesiumJS needs these files at a known URL — they contain
// the web workers that decode tiles, the SVG icons, the credit imagery,
// and the widget CSS.
//
// Runs as part of `npm run dev` and `npm run build` so the assets are
// always present after a fresh checkout or a Vercel build. Idempotent —
// safe to run multiple times.
//
// Why a script instead of a webpack copy plugin: Next.js 14's stable
// build pipeline doesn't expose a clean webpack hook for this without
// ejecting; a small Node script is the cleanest cross-platform way.

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const CESIUM_DIRS = ['Workers', 'ThirdParty', 'Assets', 'Widgets'];
const SOURCE_ROOT = path.join(
  projectRoot,
  'node_modules',
  'cesium',
  'Build',
  'Cesium',
);
const DEST_ROOT = path.join(projectRoot, 'public', 'cesium');

async function copyRecursive(src, dest) {
  const stat = await fs.stat(src);
  if (stat.isDirectory()) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src);
    for (const entry of entries) {
      await copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    await fs.copyFile(src, dest);
  }
}

async function main() {
  // Skip the copy if the source isn't installed — happens during a
  // fresh clone before `npm install`. The build will fail later if
  // Cesium is truly missing, which is the right signal.
  try {
    await fs.access(SOURCE_ROOT);
  } catch {
    console.warn(
      '[copy-cesium-assets] Cesium not installed yet, skipping copy. Run after `npm install`.',
    );
    return;
  }

  await fs.mkdir(DEST_ROOT, { recursive: true });

  for (const dir of CESIUM_DIRS) {
    const src = path.join(SOURCE_ROOT, dir);
    const dest = path.join(DEST_ROOT, dir);
    try {
      await fs.access(src);
    } catch {
      console.warn(`[copy-cesium-assets] Skipping ${dir} — not found in source`);
      continue;
    }
    // Clear destination to avoid stale files surviving across Cesium upgrades
    await fs.rm(dest, { recursive: true, force: true });
    await copyRecursive(src, dest);
    console.log(`[copy-cesium-assets] Copied ${dir}`);
  }

  console.log('[copy-cesium-assets] Done');
}

main().catch((err) => {
  console.error('[copy-cesium-assets] Failed:', err);
  process.exit(1);
});
