import { useEffect, useRef, useCallback } from 'react';

const POLL_INTERVAL = 30000; // 30 seconds
const SEEN_KEY = 'pm_auto_target_seen';

function getSeenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function markSeen(id: string) {
  const seen = getSeenIds();
  seen.add(id);
  localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(seen)));
}

interface AutoTargetRequest {
  id: string;
  status: string;
  completed_at: string | null;
  reference_address: string;
  prospects_created: number;
}

export function useAutoTargetStatus(onCompleted?: (req: AutoTargetRequest) => void) {
  const onCompletedRef = useRef(onCompleted);
  onCompletedRef.current = onCompleted;

  const check = useCallback(async () => {
    try {
      const res = await fetch('/api/auto-target');
      if (!res.ok) return;
      const data = await res.json();
      const requests: AutoTargetRequest[] = data.requests || [];

      const seen = getSeenIds();
      const oneHourAgo = Date.now() - 3600000;

      for (const req of requests) {
        if (
          req.status === 'completed' &&
          req.completed_at &&
          new Date(req.completed_at).getTime() > oneHourAgo &&
          !seen.has(req.id)
        ) {
          markSeen(req.id);
          onCompletedRef.current?.(req);
        }
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    check();
    const interval = setInterval(check, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [check]);
}
