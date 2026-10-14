import { moduleGroupApi } from "@/api";
import {
  auditableFieldsSchema,
  type EntityConfig,
  type EntitySchema,
  type FieldSchema,
} from "@/types";

const moduleGroupSchema: EntitySchema = {
  entityName: "module-group",
  idField: "id",
  fields: [
    {
      name: "name",
      label: "Name",
      type: "text",
      sortable: true,
      bold: true,
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      sortable: true,
    },
    {
      name: "displayOrder",
      label: "Display Order",
      type: "number",
      sortable: true,
    },
    ...(auditableFieldsSchema as FieldSchema[]),
  ],
};

export const entityConfig: EntityConfig = {
  name: "Module Group",
  path: "/menu-groups",
  api: moduleGroupApi,
  schema: moduleGroupSchema,
};
