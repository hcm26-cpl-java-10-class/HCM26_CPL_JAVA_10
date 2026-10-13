import { subjectApi } from "@/api";
import {
  auditableFieldsSchema,
  type EntityConfig,
  type EntitySchema,
  type FieldSchema,
} from "@/types";

const subjectSchema: EntitySchema = {
  entityName: "subject",
  idField: "id",
  fields: [
    {
      name: "code",
      label: "Subject Code",
      type: "text",
      sortable: true,
      filterable: true,
      filterType: "text",
      bold: true,
    },
    {
      name: "name",
      label: "Subject Name",
      type: "text",
      sortable: true,
      filterable: true,
      filterType: "text",
    },
    {
      name: "credits",
      label: "Credits",
      type: "number",
      sortable: true,
      filterable: true,
      filterType: "numberRange",
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
    },
    ...(auditableFieldsSchema as FieldSchema[]),
  ],
};

export const entityConfig: EntityConfig = {
  name: "Subjects",
  path: "/subjects",
  api: subjectApi,
  schema: subjectSchema,
};
