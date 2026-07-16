// One-off: a faint blueprint/line-art house to ghost behind the buyer
// constellation (the GOAL you're building a team to reach). White thin lines on
// pure black so it sits behind cards at low opacity, edge-to-edge, no fill.
import { GoogleGenAI } from '@google/genai';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const key = fs.readFileSync('.env.local', 'utf8')
  .split('\n').find((l) => l.startsWith('GEMINI_API_KEY='))?.split('=')[1]?.trim();
const ai = new GoogleGenAI({ apiKey: key });
const FF = 'node_modules/ffmpeg-static/ffmpeg.exe';
const OUT = 'public/assets/landing';
fs.mkdirSync(OUT, { recursive: true });

const prompt = `A minimalist architectural BLUEPRINT line drawing of a simple single-family house, front elevation, drawn with thin clean WHITE lines on a solid PURE BLACK background. Wireframe / technical-drawing style — only delicate outlines, NO fill, NO color, NO shading, NO text, NO dimensions, NO people. Just the elegant white line-art silhouette of a house (roof, walls, door, a few windows, a chimney). Edge-to-edge full-bleed, wide landscape composition, lots of black negative space around the house. Sharp, high detail, no watermark.`;

const r = await ai.models.generateContent({ model: 'gemini-2.5-flash-image', contents: prompt });
const img = (r.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data)?.inlineData?.data;
if (!img) { console.log('NO IMAGE'); process.exit(1); }
const raw = OUT + '/blueprint-house.raw.png';
fs.writeFileSync(raw, Buffer.from(img, 'base64'));
// wide band, keep as PNG so black can be treated as transparent-ish via blend
execFileSync(FF, ['-y', '-i', raw, '-vf', "crop='min(iw,ih*2.4)':'min(ih,iw/2.4)',scale=1000:416", OUT + '/blueprint-house.png'], { stdio: 'ignore' });
fs.rmSync(raw);
console.log('OK blueprint-house', Math.round(fs.statSync(OUT + '/blueprint-house.png').size / 1024) + 'KB');
