// ElevenLabs TTS client — server-side only
// Used to generate broadcast audio from script text

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL'; // "Rachel"
const API_BASE = 'https://api.elevenlabs.io/v1';

interface TTSOptions {
  text: string;
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
}

/**
 * Generate speech audio from text via ElevenLabs.
 * Returns raw MP3 buffer.
 */
export async function generateSpeech(options: TTSOptions): Promise<Buffer> {
  if (!ELEVENLABS_API_KEY) throw new Error('ELEVENLABS_API_KEY not set');

  const voiceId = options.voiceId || DEFAULT_VOICE_ID;
  const modelId = options.modelId || 'eleven_turbo_v2_5';

  const res = await fetch(`${API_BASE}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text: options.text,
      model_id: modelId,
      voice_settings: {
        stability: options.stability ?? 0.5,
        similarity_boost: options.similarityBoost ?? 0.75,
        style: 0.3,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ElevenLabs TTS failed: ${res.status} ${errText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Estimate speech duration in seconds from text.
 * Average speaking rate: ~150 words/minute = 2.5 words/second.
 */
export function estimateDuration(text: string): number {
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return Math.ceil(wordCount / 2.5);
}

/**
 * Check if text is within broadcast limits (12-20 seconds, 30-45 words).
 */
export function validateBroadcastLength(text: string): { valid: boolean; wordCount: number; estimatedSeconds: number; error?: string } {
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const estimatedSeconds = estimateDuration(text);

  if (wordCount < 15) return { valid: false, wordCount, estimatedSeconds, error: 'Script too short — needs at least 15 words' };
  if (wordCount > 55) return { valid: false, wordCount, estimatedSeconds, error: 'Script too long — keep under 50 words for a 20-second broadcast' };
  if (estimatedSeconds > 22) return { valid: false, wordCount, estimatedSeconds, error: 'Estimated duration exceeds 20 seconds' };

  return { valid: true, wordCount, estimatedSeconds };
}

/**
 * Generate a hash of the script text for caching.
 * If the same script text is used again, we skip re-generation.
 */
export function hashScript(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `script_${Math.abs(hash).toString(36)}`;
}
