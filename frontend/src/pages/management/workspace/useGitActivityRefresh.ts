import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

/** Follow the existing GitHub screen's polling cadence while real activity is visible. */
export function useGitActivityRefresh(enabled: boolean, syncStatus?: string | null) {
  const client = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void client.invalidateQueries({ queryKey: ["git-activity"] });
      }
    }, syncStatus === "SYNCING" ? 5000 : 30000);
    return () => window.clearInterval(timer);
  }, [client, enabled, syncStatus]);
}
