import type { MilestoneStatus } from "@/types";
import { formatMilestoneStatus } from "../milestone.utils";

export function MilestoneStatusBadge({ status, executionStatus }: { status: MilestoneStatus; executionStatus?: string | null }) {
  return (
    <span className="uppercase text-foreground">
      {status === "OPEN" && executionStatus ? executionStatus.replaceAll("_", " ") : formatMilestoneStatus(status)}
    </span>
  );
}
