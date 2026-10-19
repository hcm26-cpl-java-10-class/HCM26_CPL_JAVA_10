import { subjectApi } from "@/api";
import { AutoCrudPage } from "@/pages/management/AutoCrudPage";
import {
  auditableFieldsSchema,
  type EntityConfig,
  type EntitySchema,
  type FieldSchema,
} from "@/types";

const technicalGroupOptions = [
  { label: "Backend", value: "Backend" },
  { label: "Frontend", value: "Frontend" },
  { label: "Database", value: "Database" },
  { label: "DevOps", value: "DevOps" },
  { label: "Testing", value: "Testing" },
  { label: "General", value: "General" },
];

const subjectSchema: EntitySchema = {
  entityName: "subject",
  idField: "id",
  fields: [
    {
      name: "code",
      label: "Subject Code",
      label: "Code",
      type: "text",
      sortable: true,
      filterable: true,
      filterType: "text",
      bold: true,
    },
    {
      name: "name",
      label: "Subject Name",
      label: "Name",
      type: "text",
      sortable: true,
      filterable: true,
      filterType: "text",
      bold: true,
    },
    {
      name: "version",
      label: "Version",
      type: "text",
      sortable: true,
      filterable: true,
      filterType: "text",
    },
    {
      name: "technicalGroup",
      label: "Technical Group",
      type: "text",
      sortable: true,
      filterable: true,
      filterType: "text",
      type: "select",
      options: technicalGroupOptions,
      sortable: true,
      filterable: true,
      filterType: "select",
      filterOptions: technicalGroupOptions,
    },
    {
      name: "durationHours",
      label: "Duration (Hours)",
      type: "number",
      sortable: true,
    },
    {
      name: "status",
      label: "Status",
      type: "select",
      sortable: true,
      filterable: true,
      filterType: "select",
      options: [
        { label: "Active", value: "ACTIVE" },
        { label: "Inactive", value: "INACTIVE" },
        { label: "Draft", value: "DRAFT" },
      ],
      filterOptions: [
        { label: "Active", value: "ACTIVE" },
        { label: "Inactive", value: "INACTIVE" },
        { label: "Draft", value: "DRAFT" },
      ],
      filterable: true,
      filterType: "numberRange",
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      sortable: false,
    },
    ...(auditableFieldsSchema as FieldSchema[]),
    {
      name: "isActive",
      label: "Status",
      type: "boolean",
      sortable: true,
      filterable: true,
      filterType: "boolean",
      booleanLabels: {
        true: "Active",
        false: "Inactive",
        trueColor: "green",
        falseColor: "gray",
      },
    },
    ...((auditableFieldsSchema as FieldSchema[]).filter((f) => f.name !== "isActive")),
  ],
};

export const entityConfig: EntityConfig = {
  name: "Subject",
  name: "Subjects",
  path: "/subjects",
  api: subjectApi,
  schema: subjectSchema,
};

export default function SubjectManagementPage() {
  return <AutoCrudPage entity={entityConfig} />;
}
