import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { GitActivityUrlContext } from "./git-activity-url-context";

/** Shared ref preserves multiple filter changes made in the same interaction. */
export function GitActivityUrlState({ children }: { children: ReactNode }) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const latest = useRef(new URLSearchParams(params));
  useLayoutEffect(() => {
    const next = new URLSearchParams(params);
    const section = next.get("gitSection");
    const mergedSection = section === "commit-analytics" ? "commits"
      : section === "pr-analytics" ? "pull-requests" : null;
    if (mergedSection) next.set("gitSection", mergedSection);
    latest.current = next;
    if (mergedSection) setParams(next, { replace: true, state: location.state });
  }, [params, setParams, location.state]);
  const write = (key: string, value: string | null) => {
    const next = new URLSearchParams(latest.current);
    if (value == null || value === "") next.delete(key); else next.set(key, value);
    latest.current = next;
    setParams(next, { replace: !key.endsWith("Detail") && key !== "gitSection", state: location.state });
  };
  return <GitActivityUrlContext.Provider value={{ params, write }}>{children}</GitActivityUrlContext.Provider>;
}
