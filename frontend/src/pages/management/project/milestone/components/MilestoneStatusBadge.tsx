import { Badge } from "@/components/ui/badge";
import type { MilestoneStatus } from "@/types";
import { cn } from "@/lib/utils";
import { formatMilestoneStatus } from "../milestone.utils";

const statusClasses: Record<MilestoneStatus, string> = {
  PLANNED: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
  OPEN: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  CLOSED: "border-border bg-muted text-muted-foreground",
  CANCELLED: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function MilestoneStatusBadge({ status }: { status: MilestoneStatus }) {
  return (
    <Badge variant="outline" className={cn("font-semibold", statusClasses[status])}>
      {formatMilestoneStatus(status)}
    </Badge>
  );
}
