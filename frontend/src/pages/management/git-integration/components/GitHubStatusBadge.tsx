import { cn } from "@/lib/utils";
import type { GitInstallationStatus, GitIntegrationSummaryStatus } from "@/types/features/git-integration";
import { STATUS_STYLES } from "./git-integration.styles";

/** Status pill: the label always carries the meaning, colour only reinforces it. */
export function GitHubStatusBadge({ status, className }: {
  status: GitIntegrationSummaryStatus | GitInstallationStatus;
  className?: string;
}) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.NOT_CONNECTED;
  return <span className={cn(
    "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
    style.badge, className)}>
    <span aria-hidden="true" className={cn("size-1.5 rounded-full", style.dot)} />
    {style.label}
  </span>;
}
