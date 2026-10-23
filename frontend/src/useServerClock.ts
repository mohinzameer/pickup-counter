import { useCallback, useRef } from 'react';

/**
 * Tracks the offset between the server clock and the browser clock.
 * Both returned functions are referentially stable (useCallback + ref),
 * so they are safe to use in effect dependency arrays.
 */
export function useServerClock() {
  const offsetMs = useRef(0);

  const sync = useCallback((serverNowIso?: string) => {
    if (!serverNowIso) return;
    const serverMs = Date.parse(serverNowIso);
    if (Number.isNaN(serverMs)) return;
    offsetMs.current = serverMs - Date.now();
  }, []);

  const secondsUntil = useCallback((targetIso?: string): number => {
    if (!targetIso) return 0;
    const targetMs = Date.parse(targetIso);
    if (Number.isNaN(targetMs)) return 0;
    const nowMs = Date.now() + offsetMs.current;
    return Math.max(0, Math.ceil((targetMs - nowMs) / 1000));
  }, []);

  return { sync, secondsUntil };
}