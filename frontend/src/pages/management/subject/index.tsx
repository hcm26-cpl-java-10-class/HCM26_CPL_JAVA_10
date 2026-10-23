import { subjectApi } from "@/api";
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
      label: "Code",
      type: "text",
      sortable: true,
      filterable: true,
      filterType: "text",
      bold: true,
    },
    {
      name: "name",
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
      filterable: true,
      filterType: "numberRange",
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      sortable: false,
    },
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
  name: "Subjects",
  path: "/subjects",
  api: subjectApi,
  schema: subjectSchema,
};
