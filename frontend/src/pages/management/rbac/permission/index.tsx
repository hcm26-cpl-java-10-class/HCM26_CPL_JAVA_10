import { permissionApi } from "@/api";
import {
  auditableFieldsSchema,
  type EntityConfig,
  type EntitySchema,
  type FieldSchema,
} from "@/types";

const permissionSchema: EntitySchema = {
  entityName: "permission",
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
      name: "resource",
      label: "Resource",
      type: "text",
      sortable: true,
      filterable: true,
    },
    {
      name: "action",
      label: "Action",
      type: "text",
      sortable: true,
      filterable: true,
    },
    ...(auditableFieldsSchema as FieldSchema[]),
  ],
};

export const entityConfig: EntityConfig = {
  name: "Permission",
  path: "/permissions",
  api: permissionApi,
  schema: permissionSchema,
};
