import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const GUARD_STATE_KEY = "__unsavedChangesGuard";

type PendingNavigation = { kind: "link"; to: string } | { kind: "back" };

function isGuardEntry(state: unknown) {
  return typeof state === "object" && state !== null && (state as Record<string, unknown>)[GUARD_STATE_KEY] === true;
}

/**
 * Asks for confirmation before leaving a page with unsaved changes through in-app links
 * (sidebar, breadcrumbs, any <a href>) or the browser Back button.
 *
 * The app uses <BrowserRouter>, so react-router's `useBlocker` is unavailable. Instead:
 * - link clicks are intercepted in the capture phase, before react-router's <Link> handler;
 * - Back is caught with a sentinel history entry pushed while the page is dirty.
 *
 * Programmatic `navigate()` calls (e.g. after a successful save) are not intercepted.
 * Reload / tab close must still be handled with `beforeunload`.
 */
export function useUnsavedChangesGuard(when: boolean) {
  const navigate = useNavigate();
  const [pending, setPending] = useState<PendingNavigation | null>(null);
  const bypassRef = useRef(false);

  useEffect(() => {
    if (!when) return;

    if (!isGuardEntry(window.history.state)) {
      const current = (window.history.state ?? {}) as Record<string, unknown>;
      window.history.pushState({ ...current, [GUARD_STATE_KEY]: true }, "", window.location.href);
    }

    const onClick = (event: MouseEvent) => {
      if (bypassRef.current || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const to = `${url.pathname}${url.search}${url.hash}`;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      event.preventDefault();
      event.stopPropagation();
      setPending({ kind: "link", to });
    };

    const onPopState = (event: PopStateEvent) => {
      if (bypassRef.current || isGuardEntry(event.state)) return;
      // The user went back past the sentinel: restore it and ask first.
      const current = (window.history.state ?? {}) as Record<string, unknown>;
      window.history.pushState({ ...current, [GUARD_STATE_KEY]: true }, "", window.location.href);
      setPending({ kind: "back" });
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [when]);

  const confirm = useCallback(() => {
    const target = pending;
    setPending(null);
    if (!target) return;
    bypassRef.current = true;
    if (target.kind === "link") navigate(target.to);
    // Skip the sentinel and the guarded page itself.
    else window.history.go(-2);
  }, [navigate, pending]);

  const cancel = useCallback(() => setPending(null), []);

  return { pending: pending !== null, confirm, cancel };
}
