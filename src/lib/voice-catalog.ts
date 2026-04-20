// Curated ElevenLabs voice shortlist for the commercial builder.
// Voice IDs correspond to ElevenLabs' default public voices so any account
// with an API key can use them without uploading custom voices first.

export interface Voice {
  id: string;
  label: string;
  tagline: string;
  gender: 'female' | 'male';
  accent: string;
  sampleText: string;
}

export const VOICE_CATALOG: Voice[] = [
  {
    id: 'EXAVITQu4vr4xnSDxMaL',
    label: 'Rachel',
    tagline: 'Warm, friendly narrator',
    gender: 'female',
    accent: 'American',
    sampleText: 'Hi, this is a quick note from your local agent about a recent sale on your street.',
  },
  {
    id: '21m00Tcm4TlvDq8ikWAM',
    label: 'Sarah',
    tagline: 'Calm, professional',
    gender: 'female',
    accent: 'American',
    sampleText: 'A home just sold nearby for a strong price — curious what yours is worth today?',
  },
  {
    id: 'AZnzlk1XvdvUeBnXmlld',
    label: 'Domi',
    tagline: 'Upbeat, youthful',
    gender: 'female',
    accent: 'American',
    sampleText: 'Big news on your block — let me give you the quick rundown in 20 seconds.',
  },
  {
    id: 'MF3mGyEYCl7XYWbV9V6O',
    label: 'Elli',
    tagline: 'Emotive, empathetic',
    gender: 'female',
    accent: 'American',
    sampleText: 'I thought you would want to know about something exciting happening in your neighborhood.',
  },
  {
    id: 'TxGEqnHWrfWFTfGW9XjX',
    label: 'Josh',
    tagline: 'Confident, trustworthy',
    gender: 'male',
    accent: 'American',
    sampleText: 'Hey neighbor — quick update on home values in your area from a local agent.',
  },
  {
    id: 'VR6AewLTigWG4xSOukaG',
    label: 'Arnold',
    tagline: 'Deep, authoritative',
    gender: 'male',
    accent: 'American',
    sampleText: 'This is an important market update for homeowners on your street.',
  },
  {
    id: 'pNInz6obpgDQGcFmaJgB',
    label: 'Adam',
    tagline: 'Conversational, approachable',
    gender: 'male',
    accent: 'American',
    sampleText: 'Hey — a house two doors down just sold, and I wanted to share what that means for you.',
  },
  {
    id: 'yoZ06aMxZJJ28mfd3POQ',
    label: 'Sam',
    tagline: 'Casual, modern',
    gender: 'male',
    accent: 'American',
    sampleText: 'Got a sec? Quick update on what is happening with home prices near you.',
  },
];

export function getVoice(id: string): Voice | undefined {
  return VOICE_CATALOG.find(v => v.id === id);
}
