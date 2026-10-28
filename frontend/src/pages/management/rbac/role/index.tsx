import { permissionApi, roleApi } from "@/api";
import {
  auditableFieldsSchema,
  type EntityConfig,
  type EntitySchema,
  type FieldSchema,
} from "@/types";

const roleSchema: EntitySchema = {
  entityName: "role",
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
      name: "isSystem",
      label: "System Role",
      type: "boolean",
      sortable: true,
      editable: false,
      booleanLabels: { true: "System", false: "Custom" },
    },
    {
      name: "userCount",
      label: "Users",
      type: "number",
      sortable: true,
      editable: false,
    },
    {
      name: "permissionIds",
      label: "Permissions",
      type: "relation",
      editable: true,
      relation: {
        api: permissionApi,
        valueField: "id",
        labelField: "name",
        multiple: true,
      },
      filterable: true,
      filterType: "select",
    },
    ...(auditableFieldsSchema as FieldSchema[]),
  ],
};

export const entityConfig: EntityConfig = {
  name: "Role",
  path: "/roles",
  api: roleApi,
  schema: roleSchema,
};
