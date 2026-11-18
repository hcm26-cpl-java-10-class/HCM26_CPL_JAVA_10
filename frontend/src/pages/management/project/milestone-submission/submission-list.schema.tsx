import { Badge } from "@/components/ui/badge";
import type { EntitySchema, SubmissionListItem } from "@/types";
import { ExecutionStatusBadge, SubmissionStatusBadge } from "./components/SubmissionStatusBadge";

const date = (value?: string | null) => value ? new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium", timeStyle: "short",
}).format(new Date(value)) : "—";

export const submissionListSchema: EntitySchema = {
  entityName: "milestone submission",
  idField: "id",
  fields: [
    { name: "milestoneTitle", label: "Milestone", type: "text", sortable: true, bold: true, width: 240, minWidth: 190 },
    { name: "teamName", label: "Team", type: "text", sortable: true, width: 150 },
    { name: "studentName", label: "Submitted by", type: "text", sortable: true, width: 160 },
    {
      name: "status", label: "Submission", type: "select", sortable: true, filterable: true,
      filterType: "select", width: 155,
      filterOptions: ["DRAFT", "SUBMITTED", "ACCEPTED", "REJECTED", "CHANGES_REQUESTED"]
        .map((value) => ({ label: value.replace("_", " "), value })),
      renderCell: (value) => <SubmissionStatusBadge status={value} />,
    },
    {
      name: "executionStatus", label: "Milestone state", type: "select", sortable: true, filterable: true,
      filterType: "select", width: 145, visible: false,
      filterOptions: ["TODO", "IN_PROGRESS", "REVIEW", "DONE", "FAILED"]
        .map((value) => ({ label: value.replace("_", " "), value })),
      renderCell: (value) => <ExecutionStatusBadge status={value} />,
    },
    {
      name: "mandatory", label: "Requirement", type: "boolean", filterable: true,
      filterType: "boolean", booleanLabels: { true: "Mandatory", false: "Optional" }, width: 120,
      renderCell: (value) => <Badge variant={value ? "secondary" : "outline"}>{value ? "Mandatory" : "Optional"}</Badge>,
    },
    {
      name: "currentVersionNumber", label: "Version", type: "number", width: 95,
      renderCell: (value, row: SubmissionListItem) => <span className="font-medium">v{value} · {row.submissionAttempts} attempt(s)</span>,
    },
    {
      name: "checklistCompleted", label: "Checklist", type: "number", width: 105,
      renderCell: (_value, row: SubmissionListItem) => <span className="font-medium">{row.checklistCompleted}/{row.checklistTotal}</span>,
    },
    {
      name: "late", label: "Timing", type: "boolean", filterable: true, filterType: "boolean",
      booleanLabels: { true: "Late", false: "On time" }, width: 110,
      renderCell: (value, row: SubmissionListItem) => value
        ? <Badge variant="destructive">Late · {row.penaltyPercent}%</Badge>
        : <Badge variant="outline">On time</Badge>,
    },
    { name: "submittedAt", label: "Submitted at", type: "date", sortable: true, width: 180, renderCell: (value) => date(value) },
    { name: "deadline", label: "Deadline", type: "date", sortable: true, width: 180, renderCell: (value) => date(value) },
  ],
};
