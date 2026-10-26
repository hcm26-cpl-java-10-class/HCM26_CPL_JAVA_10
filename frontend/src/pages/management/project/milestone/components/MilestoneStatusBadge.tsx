import type { MilestoneStatus } from "@/types";
import { formatMilestoneStatus } from "../milestone.utils";

export function MilestoneStatusBadge({ status }: { status: MilestoneStatus }) {
  return (
    <span className="uppercase text-foreground">
      {formatMilestoneStatus(status)}
    </span>
  );
}
