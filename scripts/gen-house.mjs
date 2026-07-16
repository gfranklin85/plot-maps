// One-off: generate a warm home-at-dusk image for the landing seller band.
import { GoogleGenAI } from '@google/genai';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const key = fs.readFileSync('.env.local', 'utf8')
  .split('\n').find((l) => l.startsWith('GEMINI_API_KEY='))?.split('=')[1]?.trim();
const ai = new GoogleGenAI({ apiKey: key });
const FF = 'node_modules/ffmpeg-static/ffmpeg.exe';
const OUT = 'public/assets/landing';
fs.mkdirSync(OUT, { recursive: true });

const prompt = `A plain, realistic real-estate listing photograph of an ordinary American single-family suburban house on a normal day, front exterior view from the street, natural daylight, slightly overcast neutral sky. Looks like a real MLS listing photo taken by an agent — NOT cinematic, NOT dramatic, NO glowing lights, NO string lights, NO fairy-tale styling. Ordinary, honest, believable. Edge-to-edge FULL-BLEED, fills the ENTIRE frame corner to corner — absolutely NO border, NO matte, NO frame, NO padding. Wide landscape composition, natural color, sharp, no text, no watermark, no people.`;

const r = await ai.models.generateContent({ model: 'gemini-2.5-flash-image', contents: prompt });
const img = (r.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data)?.inlineData?.data;
if (!img) { console.log('NO IMAGE'); process.exit(1); }
const raw = OUT + '/home-dusk.raw.png';
fs.writeFileSync(raw, Buffer.from(img, 'base64'));
execFileSync(FF, ['-y', '-i', raw, '-vf', "crop='min(iw,ih*1.9)':'min(ih,iw/1.9)',scale=380:200", '-q:v', '4', OUT + '/home-dusk.jpg'], { stdio: 'ignore' });
fs.rmSync(raw);
console.log('OK home-dusk', Math.round(fs.statSync(OUT + '/home-dusk.jpg').size / 1024) + 'KB');
