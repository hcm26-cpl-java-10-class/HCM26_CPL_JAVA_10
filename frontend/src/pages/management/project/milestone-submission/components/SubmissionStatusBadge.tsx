import { Badge } from "@/components/ui/badge";
import type { MilestoneExecutionStatus, SubmissionStatus } from "@/types";

const labels: Record<SubmissionStatus, string> = {
  DRAFT: "Draft", SUBMITTED: "Submitted", ACCEPTED: "Accepted",
  REJECTED: "Rejected", CHANGES_REQUESTED: "Changes requested",
};

export function SubmissionStatusBadge({ status }: { status: SubmissionStatus }) {
  const variant = status === "ACCEPTED" ? "default" : status === "REJECTED" ? "destructive" :
    status === "SUBMITTED" ? "secondary" : "outline";
  return <Badge variant={variant}>{labels[status]}</Badge>;
}

export function ExecutionStatusBadge({ status }: { status: MilestoneExecutionStatus }) {
  const variant = status === "DONE" ? "default" : status === "FAILED" ? "destructive" : "outline";
  return <Badge variant={variant}>{status.replace("_", " ")}</Badge>;
}
