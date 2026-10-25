import type { EntitySchema, RubricListItem } from "@/types";
import { RubricStatusBadge } from "./components/RubricStatusBadge";

export const rubricListSchema: EntitySchema = {
  entityName: "rubric",
  idField: "id",
  fields: [
    {
      name: "name",
      label: "Rubric",
      type: "text",
      sortable: true,
      bold: true,
      width: 240,
      minWidth: 180,
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
      name: "latestStatus",
      label: "Latest version",
      type: "select",
      sortable: true,
      filterable: true,
      filterType: "select",
      filterMultiple: false,
      filterOptions: [
        { label: "Draft", value: "DRAFT" },
        { label: "Published", value: "PUBLISHED" },
      ],
      width: 170,
      minWidth: 145,
      renderCell: (value, row: RubricListItem) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">v{row.latestVersionNumber}</span>
            <RubricStatusBadge status={value} />
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {row.versionCount} version{row.versionCount === 1 ? "" : "s"}
          </p>
        </div>
      ),
    },
    {
      name: "criteriaCount",
      label: "Criteria",
      type: "number",
      sortable: true,
      width: 100,
    },
    {
      name: "totalMaxScore",
      label: "Max score",
      type: "number",
      sortable: true,
      width: 110,
    },
    {
      name: "milestoneUsageCount",
      label: "Milestone usage",
      type: "number",
      sortable: true,
      width: 140,
    },
    {
      name: "updatedAt",
      label: "Updated at",
      type: "date",
      sortable: true,
      width: 180,
    },
  ],
};
