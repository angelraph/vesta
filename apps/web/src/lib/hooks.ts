"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { accountStore, type Unlocked } from "./account";

export function useAccount() {
  return useSyncExternalStore(accountStore.subscribe, accountStore.get, accountStore.getServer);
}

export function useSession(): Unlocked | null {
  const s = useAccount();
  return s.status === "unlocked" ? s.session : null;
}

/** Load data, refresh on demand, and poll gently while the tab is visible. */
export function useLive<T>(load: (() => Promise<T>) | null, deps: unknown[], pollMs = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;

  const refresh = useCallback(async () => {
    if (!loadRef.current) return;
    try {
      setData(await loadRef.current());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    setData(null);
    refresh();
    if (!pollMs) return;
    const t = setInterval(() => document.visibilityState === "visible" && refresh(), pollMs);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, refresh };
}
