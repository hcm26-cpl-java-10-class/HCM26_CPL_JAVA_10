import type { MilestoneLifecycleStatus } from "@/types";

export function MilestoneStatusBadge({ status }: { status: MilestoneLifecycleStatus }) {
  return (
    <span className="uppercase text-foreground">
      {status.replaceAll("_", " ")}
    </span>
  );
}
