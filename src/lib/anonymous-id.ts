const COOKIE_NAME = 'pm_anon_id';
const MAX_AGE = 365 * 24 * 60 * 60; // 1 year

export function getAnonymousId(): string | null {
  if (typeof document === 'undefined') return null;

  // Read existing
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  if (match) return match[1];

  // Generate new
  const id = crypto.randomUUID();
  document.cookie = `${COOKIE_NAME}=${id}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
  return id;
}

export function readAnonymousId(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  return match ? match[1] : null;
}

export function clearAnonymousId(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
}
