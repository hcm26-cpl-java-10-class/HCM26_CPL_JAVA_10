import { Badge } from "@/components/ui/badge";
import type { MilestoneExecutionStatus, SubmissionStatus } from "@/types";

const labels: Record<SubmissionStatus, string> = {
  DRAFT: "Draft", SUBMITTED: "Submitted", ACCEPTED: "Accepted",
  REJECTED: "Rejected", CHANGES_REQUESTED: "Changes requested",
};

export function SubmissionStatusBadge({ status }: { status: SubmissionStatus }) {
  const colors: Record<SubmissionStatus, string> = {
    DRAFT: "border-slate-300 bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-300",
    SUBMITTED: "border-sky-300 bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200",
    ACCEPTED: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
    REJECTED: "border-rose-300 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200",
    CHANGES_REQUESTED: "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  };
  return <Badge variant="outline" className={colors[status]}>{labels[status]}</Badge>;
}

export function ExecutionStatusBadge({ status }: { status: MilestoneExecutionStatus }) {
  const colors = status === "DONE" ? "border-emerald-300 text-emerald-700 dark:text-emerald-300" : status === "FAILED" ? "border-rose-300 text-rose-700 dark:text-rose-300" : "";
  return <Badge variant="outline" className={colors}>{status.replace("_", " ")}</Badge>;
}
