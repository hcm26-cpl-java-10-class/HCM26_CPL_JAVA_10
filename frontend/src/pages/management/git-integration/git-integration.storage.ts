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

/**
 * US-GI-06: "Connect GitHub account" started from a workspace. The callback page reads it to
 * know which flow GitHub returned from and to go back to the exact tab the user left.
 */
const ACCOUNT_KEY = "git-integration:account-connect";

export interface PendingAccountConnect {
  projectId: number;
  returnTo: string;
  startedAt: number;
}

/** Only an in-app path: no scheme, no protocol-relative URL (no open redirect). */
export function safeReturnPath(path: string | null | undefined): string | undefined {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return undefined;
  return path;
}

export function savePendingAccountConnect(projectId: number, returnTo: string) {
  try {
    const value: PendingAccountConnect = { projectId, returnTo: safeReturnPath(returnTo) ?? "/", startedAt: Date.now() };
    sessionStorage.setItem(ACCOUNT_KEY, JSON.stringify(value));
  } catch {
    // Storage disabled: the callback still works and falls back to the dashboard.
  }
}

export function readPendingAccountConnect(): PendingAccountConnect | undefined {
  try {
    const raw = sessionStorage.getItem(ACCOUNT_KEY);
    if (!raw) return undefined;
    const value = JSON.parse(raw) as Partial<PendingAccountConnect>;
    if (typeof value.startedAt !== "number" || typeof value.projectId !== "number") return undefined;
    if (Date.now() - value.startedAt > PENDING_MAX_AGE_MS) {
      clearPendingAccountConnect();
      return undefined;
    }
    return { projectId: value.projectId, returnTo: safeReturnPath(value.returnTo) ?? "/", startedAt: value.startedAt };
  } catch {
    return undefined;
  }
}

export function clearPendingAccountConnect() {
  try {
    sessionStorage.removeItem(ACCOUNT_KEY);
  } catch {
    // Ignore.
  }
}

/** US-GI-06: "Not now" on the Connect banner hides it for a week, per master project. */
const BANNER_KEY = "git-integration:connect-banner-dismissed:";
const BANNER_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

export function isConnectBannerSnoozed(masterId: number): boolean {
  try {
    const raw = localStorage.getItem(BANNER_KEY + masterId);
    return !!raw && Date.now() - Number(raw) < BANNER_SNOOZE_MS;
  } catch {
    return false;
  }
}

export function snoozeConnectBanner(masterId: number) {
  try {
    localStorage.setItem(BANNER_KEY + masterId, String(Date.now()));
  } catch {
    // Ignore: the banner simply shows again.
  }
}
