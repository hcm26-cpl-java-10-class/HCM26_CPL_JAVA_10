import type { MilestoneLifecycleStatus } from "@/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { milestoneStatusStyles } from "../milestone-status.styles";

export function MilestoneStatusBadge({ status }: { status: MilestoneLifecycleStatus }) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", milestoneStatusStyles[status].badge)}>
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", milestoneStatusStyles[status].dot)} />
      {milestoneStatusStyles[status].label}
    </Badge>
  );
}
