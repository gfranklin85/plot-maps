import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getAuthUser } from '@/lib/auth';

// POST /api/listings/upload — upload a listing photo to the public
// listing-photos bucket and return its public URL. multipart/form-data with a
// `file`. Gated to signed-in users (listings require Google sign-in). Same
// storage pattern as /api/commercials (supabaseAdmin.storage). Greg 2026-07-13.

export const dynamic = 'force-dynamic';

const MAX_BYTES = 12 * 1024 * 1024; // 12MB/photo
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export async function POST(req: Request) {
  let userId: string | null = null;
  try { userId = (await getAuthUser())?.id ?? null; } catch { userId = null; }
  if (!userId) return NextResponse.json({ error: 'sign in required' }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'expected multipart/form-data' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'no file' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'file too large (max 12MB)' }, { status: 400 });
  const type = file.type || 'image/jpeg';
  if (!OK_TYPES.includes(type)) return NextResponse.json({ error: 'unsupported image type' }, { status: 400 });

  const ext = type.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  // per-user folder + timestamp-ish random via the file name to avoid clashes
  const rand = Math.abs((file.name + file.size + type).split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7));
  const path = `${userId}/${rand}-${file.size}.${ext}`;

  const buf = new Uint8Array(await file.arrayBuffer());
  const { error } = await supabaseAdmin.storage
    .from('listing-photos')
    .upload(path, buf, { contentType: type, upsert: true });
  if (error) {
    console.error('listing photo upload error:', error.message);
    return NextResponse.json({ error: 'upload failed' }, { status: 500 });
  }
  const { data } = supabaseAdmin.storage.from('listing-photos').getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
