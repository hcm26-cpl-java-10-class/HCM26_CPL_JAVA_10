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
      bold: true,
      width: 240,
      minWidth: 180,
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      width: 280,
      minWidth: 180,
    },
    {
      name: "status",
      label: "Status",
      type: "select",
      filterable: true,
      filterType: "select",
      filterOptions: [
        { label: "Planned", value: "PLANNED" },
        { label: "Open", value: "OPEN" },
        { label: "Closed", value: "CLOSED" },
        { label: "Cancelled", value: "CANCELLED" },
      ],
      width: 120,
      renderCell: (value) => <MilestoneStatusBadge status={value} />,
    },
    {
      name: "mandatory",
      label: "Requirement",
      type: "boolean",
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
      width: 180,
      visible: false,
    },
  ],
};
