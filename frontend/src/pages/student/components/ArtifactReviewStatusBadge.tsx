import { Badge } from "@/components/ui/badge";

const statuses: Record<string, { label: string; color: string }> = {
  CHANGES_REQUESTED: { label: "Changes requested", color: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200" },
  SUBMITTED: { label: "Awaiting review", color: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200" },
  ACCEPTED: { label: "Accepted", color: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" },
  REJECTED: { label: "Rejected", color: "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200" },
  OPEN: { label: "Open for submissions", color: "bg-muted/50" },
  IN_PROGRESS: { label: "In progress", color: "bg-muted/50" },
  PLANNED: { label: "Planned", color: "bg-muted/50" },
  DRAFT: { label: "Draft", color: "bg-muted/50" },
};

export function ArtifactReviewStatusBadge({ status }: { status: string }) {
  const display = statuses[status];
  return <Badge variant="outline" className={display?.color ?? "bg-muted/50"}>{display?.label ?? status.replaceAll("_", " ").toLowerCase()}</Badge>;
}
