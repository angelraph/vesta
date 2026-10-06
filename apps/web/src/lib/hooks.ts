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

const noop = () => () => {};
/** True once running in the browser. */
export function useMounted() {
  return useSyncExternalStore(noop, () => true, () => false);
}

/**
 * Load data, refresh on demand, and poll gently while the tab is visible.
 * Results are tied to `deps`, so stale data never shows for a new key.
 */
export function useLive<T>(load: (() => Promise<T>) | null, deps: unknown[], pollMs = 0) {
  const key = deps.map(String).join("|");
  const [state, setState] = useState<{ key: string; data: T | null; error: string | null }>({ key, data: null, error: null });
  const loadRef = useRef(load);
  const keyRef = useRef(key);

  useEffect(() => {
    loadRef.current = load;
    keyRef.current = key;
  });

  const refresh = useCallback(async () => {
    const fn = loadRef.current;
    const k = keyRef.current;
    if (!fn) return;
    try {
      const data = await fn();
      setState({ key: k, data, error: null });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      setState((prev) => ({ key: k, data: prev.key === k ? prev.data : null, error }));
    }
  }, []);

  useEffect(() => {
    refresh();
    if (!pollMs) return;
    const t = setInterval(() => document.visibilityState === "visible" && refresh(), pollMs);
    return () => clearInterval(t);
  }, [key, pollMs, refresh]);

  const fresh = state.key === key;
  return { data: fresh ? state.data : null, error: fresh ? state.error : null, refresh };
}
