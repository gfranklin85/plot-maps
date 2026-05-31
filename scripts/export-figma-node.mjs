#!/usr/bin/env node
// export-figma-node.mjs
//
// Render any Figma node to a PNG on disk via Figma's REST API.
// Reusable for every future asset export — beam, slab, icons, etc.
//
// Usage:
//   node scripts/export-figma-node.mjs <fileKey> <nodeId> <outPath> [scale]
//
// Example:
//   node scripts/export-figma-node.mjs gWtc7VDjRuFx5oYgU8FTvw 32:2 \
//     public/assets/markers/card-active.png 2
//
// Reads FIGMA_PAT from .env.local (NOT .env — that file is for runtime).
// The PAT must have File Content: Read scope.

import fs from 'node:fs/promises';
import path from 'node:path';

const ENV_PATH = new URL('../.env.local', import.meta.url);

async function loadFigmaPat() {
  const txt = await fs.readFile(ENV_PATH, 'utf8');
  const line = txt.split('\n').find(l => /^FIGMA_PAT=/.test(l));
  if (!line) throw new Error('FIGMA_PAT not found in .env.local');
  return line.replace(/^FIGMA_PAT=/, '').trim();
}

async function main() {
  const [fileKey, nodeId, outPath, scaleArg] = process.argv.slice(2);
  if (!fileKey || !nodeId || !outPath) {
    console.error('Usage: node scripts/export-figma-node.mjs <fileKey> <nodeId> <outPath> [scale=2]');
    process.exit(1);
  }
  const scale = scaleArg ? Number(scaleArg) : 2;

  const pat = await loadFigmaPat();

  // 1. Ask Figma to render the node → returns a CDN URL
  const renderUrl = `https://api.figma.com/v1/images/${fileKey}` +
    `?ids=${encodeURIComponent(nodeId)}` +
    `&format=png&scale=${scale}`;

  console.log(`Requesting render: ${nodeId} @ scale ${scale} from ${fileKey}`);
  const renderRes = await fetch(renderUrl, {
    headers: { 'X-Figma-Token': pat },
  });
  if (!renderRes.ok) {
    const body = await renderRes.text();
    throw new Error(`Figma render request failed: ${renderRes.status} ${body}`);
  }
  const renderJson = await renderRes.json();
  if (renderJson.err) throw new Error(`Figma error: ${renderJson.err}`);

  const cdnUrl = renderJson.images?.[nodeId];
  if (!cdnUrl) {
    throw new Error(`No image URL returned for node ${nodeId}: ${JSON.stringify(renderJson)}`);
  }
  console.log(`CDN URL: ${cdnUrl}`);

  // 2. Download the PNG from the CDN URL
  const pngRes = await fetch(cdnUrl);
  if (!pngRes.ok) {
    throw new Error(`PNG download failed: ${pngRes.status}`);
  }
  const buf = Buffer.from(await pngRes.arrayBuffer());

  // 3. Write to disk
  const absOut = path.resolve(outPath);
  await fs.mkdir(path.dirname(absOut), { recursive: true });
  await fs.writeFile(absOut, buf);
  console.log(`Wrote ${buf.length.toLocaleString()} bytes to ${absOut}`);
}

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
