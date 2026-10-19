import { scheduleVersionApi } from "@/api";
import { AutoCrudPage } from "@/pages/management/AutoCrudPage";
import { type EntityConfig, type EntitySchema, auditableFieldsSchema, type FieldSchema } from "@/types";

const statusOptions = [
  { value: "DRAFT", label: "Draft", color: "amber" },
  { value: "ACTIVE", label: "Active", color: "green" },
  { value: "ARCHIVED", label: "Archived", color: "slate" },
];

const scheduleVersionSchema: EntitySchema = {
  entityName: "schedule_version",
  idField: "id",
  fields: [
    {
      name: "classId",
      label: "Class ID",
      type: "number",
      sortable: true,
      filterable: true,
      filterType: "numberRange",
      bold: true,
    },
    {
      name: "versionNumber",
      label: "Version",
      type: "number",
      sortable: true,
      filterable: true,
      filterType: "numberRange",
    },
    {
      name: "status",
      label: "Version Status",
      type: "select",
      options: statusOptions,
      filterOptions: statusOptions,
      sortable: true,
      filterable: true,
      filterType: "select",
    },
    {
      name: "note",
      label: "Note / Reason",
      type: "textarea",
      sortable: false,
    },
    {
      name: "activatedAt",
      label: "Activated At",
      type: "datetime",
      sortable: true,
    },
    ...(auditableFieldsSchema as FieldSchema[]),
  ],
};

export const entityConfig: EntityConfig = {
  name: "Schedule Version",
  path: "/schedule-versions",
  api: scheduleVersionApi,
  schema: scheduleVersionSchema,
};

export default function ScheduleVersionManagementPage() {
  return <AutoCrudPage entity={entityConfig} />;
}
