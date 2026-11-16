/**
 * Remembers that "Connect GitHub" was started while the browser is on
 * github.com, so the Git Integration page can notice an install the user
 * abandoned (GitHub does not redirect back when Install is cancelled).
 * Stored per tab; every access is guarded because storage can be unavailable.
 */
const PENDING_KEY = "git-integration:pending";
const PENDING_MAX_AGE_MS = 15 * 60 * 1000;

export interface PendingConnect {
  startedAt: number;
}

export function savePendingConnect() {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ startedAt: Date.now() } satisfies PendingConnect));
  } catch {
    // Storage disabled: the flow still works, only the "not completed" hint is lost.
  }
}

export function readPendingConnect(): PendingConnect | undefined {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return undefined;
    const value = JSON.parse(raw) as Partial<PendingConnect>;
    if (typeof value.startedAt !== "number") return undefined;
    if (Date.now() - value.startedAt > PENDING_MAX_AGE_MS) {
      clearPendingConnect();
      return undefined;
    }
    return { startedAt: value.startedAt };
  } catch {
    return undefined;
  }
}

export function clearPendingConnect() {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // Ignore: nothing to clean up when storage is unavailable.
  }
}
