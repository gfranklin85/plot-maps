// Generate destination chip thumbnails in-house via Gemini image gen
// (gemini-2.5-flash-image), then crop+resize to a small square with ffmpeg.
// Run: node scripts/gen-destination-thumbs.mjs
import { GoogleGenAI } from '@google/genai';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const key = fs.readFileSync('.env.local', 'utf8')
  .split('\n').find((l) => l.startsWith('GEMINI_API_KEY='))?.split('=')[1]?.trim();
const ai = new GoogleGenAI({ apiKey: key });
const FF = 'node_modules/ffmpeg-static/ffmpeg.exe';
const OUT = 'public/assets/destinations';
fs.mkdirSync(OUT, { recursive: true });

// slug → subject prompt. Aerial/iconic, photoreal, cinematic — reads at chip size.
const SUBJECTS = {
  'lemoore': 'aerial view of a sunny Central Valley California town with tree-lined streets and farmland',
  'son-doong': 'the vast Sơn Đoòng cave in Vietnam, a giant cavern with a shaft of sunlight and jungle',
  'pyramids-giza': 'the Pyramids of Giza at golden hour, aerial',
  'petra': 'the rose-red carved facade of Petra, Jordan, warm light',
  'stonehenge': 'the ancient stone circle of Stonehenge on a green plain, dramatic sky',
  'machu-picchu': 'Machu Picchu ancient ruins in the misty Andes mountains, aerial',
  'colosseum': 'the Roman Colosseum from above at golden hour',
  'grand-canyon': 'the Grand Canyon vast layered cliffs at sunset, aerial',
  'acapulco': 'Acapulco bay, turquoise water and beach hotels, aerial, sunny',
  'new-york': 'Manhattan skyline with skyscrapers, aerial, golden hour',
  'tokyo': 'Tokyo cityscape at dusk with Tokyo Tower and neon, aerial',
  'paris': 'the Eiffel Tower and Paris rooftops, warm evening light, aerial',
  'dubai': 'the Dubai skyline with Burj Khalifa, aerial, golden hour',
  'san-francisco': 'the Golden Gate Bridge and San Francisco bay, aerial, warm light',
  'las-vegas': 'the Las Vegas Strip at night, glowing lights, aerial',
  'los-angeles': 'the Los Angeles skyline with palm trees and mountains, aerial, sunset',
  'london': 'London skyline with Big Ben and the Thames, aerial, warm light',
  'sydney': 'the Sydney Opera House and Harbour Bridge, aerial, sunny',
  'taj-mahal': 'the Taj Mahal white marble mausoleum with its reflecting pool, aerial, golden light',
  'angkor-wat': 'the Angkor Wat temple complex in the Cambodian jungle, aerial, misty morning',
  'christ-redeemer': 'the Christ the Redeemer statue atop Corcovado overlooking Rio de Janeiro, aerial',
  'great-wall': 'the Great Wall of China snaking over green mountain ridges, aerial, dramatic',
  'chichen-itza': 'the Chichén Itzá Maya pyramid El Castillo in the Yucatan jungle, aerial',
  'santorini': 'Santorini white-and-blue cliffside village over the blue Aegean sea, aerial, sunset',
  'mount-fuji': 'snow-capped Mount Fuji rising above the landscape, aerial, clear sky',
  'venice': 'Venice Italy canals and rooftops with the Grand Canal, aerial, warm light',
};

const only = process.argv[2]; // optional: generate just one slug
const entries = Object.entries(SUBJECTS).filter(([s]) => !only || s === only);

for (const [slug, subject] of entries) {
  const finalPath = path.join(OUT, `${slug}.jpg`);
  if (fs.existsSync(finalPath) && !only) { console.log('skip (exists):', slug); continue; }
  const prompt = `A photorealistic, cinematic photograph of ${subject}. Square composition, centered subject, vivid but natural color, sharp, high detail, no text, no watermark, no borders.`;
  try {
    const r = await ai.models.generateContent({ model: 'gemini-2.5-flash-image', contents: prompt });
    const parts = r.candidates?.[0]?.content?.parts || [];
    const img = parts.find((p) => p.inlineData?.data)?.inlineData?.data;
    if (!img) { console.log('NO IMAGE:', slug); continue; }
    const raw = path.join(OUT, `${slug}.raw.png`);
    fs.writeFileSync(raw, Buffer.from(img, 'base64'));
    // center-crop to square + resize to 128px + jpg compress → tiny chip
    execFileSync(FF, ['-y', '-i', raw,
      '-vf', "crop='min(iw,ih)':'min(iw,ih)',scale=128:128",
      '-q:v', '4', finalPath], { stdio: 'ignore' });
    fs.rmSync(raw);
    const kb = Math.round(fs.statSync(finalPath).size / 1024);
    console.log('OK', slug, `${kb}KB`);
  } catch (e) {
    console.log('ERROR', slug, e.message?.slice(0, 120));
  }
}
console.log('done.');
