import { Badge } from "@/components/ui/badge";
import type { EntitySchema, MilestoneListItem } from "@/types";
import { cn } from "@/lib/utils";
import { MilestoneStatusBadge } from "./components/MilestoneStatusBadge";
import {
  formatDateTime,
  formatPenalty,
  formatRelativeDeadline,
  isPastDeadline,
} from "./milestone.utils";

export const milestoneListSchema: EntitySchema = {
  entityName: "milestone",
  idField: "id",
  fields: [
    {
      name: "title",
      label: "Milestone",
      type: "text",
      sortable: true,
      bold: true,
      width: 240,
      minWidth: 180,
    },
    {
      name: "projectName",
      label: "Project",
      type: "text",
      width: 200,
      minWidth: 140,
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      sortable: true,
      width: 280,
      minWidth: 180,
    },
    {
      name: "lifecycleStatus",
      label: "Status",
      type: "select",
      sortable: false,
      filterable: true,
      filterType: "select",
      filterOptions: [
        { label: "Planned", value: "PLANNED" },
        { label: "In progress", value: "IN_PROGRESS" },
        { label: "Submitted", value: "SUBMITTED" },
        { label: "Changes requested", value: "CHANGES_REQUESTED" },
        { label: "Accepted", value: "ACCEPTED" },
        { label: "Rejected", value: "REJECTED" },
      ],
      width: 120,
      renderCell: (value) => <MilestoneStatusBadge status={value} />,
    },
    {
      name: "mandatory",
      label: "Requirement",
      type: "boolean",
      sortable: true,
      filterable: true,
      filterType: "boolean",
      booleanLabels: { true: "Mandatory", false: "Optional" },
      width: 120,
      renderCell: (value) => (
        <Badge variant={value ? "secondary" : "outline"}>
          {value ? "Mandatory" : "Optional"}
        </Badge>
      ),
    },
    {
      name: "deadline",
      label: "Deadline",
      type: "date",
      sortable: true,
      filterable: true,
      filterType: "dateRange",
      width: 210,
      minWidth: 180,
      renderCell: (value, row: MilestoneListItem) => {
        const pastDue = isPastDeadline(row);
        return (
          <div className="min-w-0">
            <p className="truncate font-medium">{formatDateTime(value)}</p>
            <p className={cn("truncate text-xs text-muted-foreground", pastDue && "font-medium text-destructive")}>
              {pastDue ? "Past due · " : ""}{formatRelativeDeadline(value)}
            </p>
          </div>
        );
      },
    },
    {
      name: "latePolicyType",
      label: "Late policy",
      type: "select",
      sortable: true,
      filterable: true,
      filterType: "select",
      filterOptions: [
        { label: "No late submissions", value: "NO_LATE" },
        { label: "Allow late submissions", value: "ALLOW_LATE" },
      ],
      width: 210,
      minWidth: 170,
      renderCell: (value, row: MilestoneListItem) => value === "NO_LATE" ? (
        <span className="text-muted-foreground">No late submissions</span>
      ) : (
        <div className="min-w-0">
          <p className="truncate font-medium">Until {formatDateTime(row.lateUntil)}</p>
          <p className="truncate text-xs text-muted-foreground">
            {formatPenalty(row.latePenaltyPercent)} penalty
          </p>
        </div>
      ),
    },
    {
      name: "createdAt",
      label: "Created at",
      type: "date",
      sortable: true,
      width: 180,
      visible: false,
    },
  ],
};
