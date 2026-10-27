import { permissionApi, roleApi } from "@/api";
import {
  type EntityConfig,
  type EntitySchema,
} from "@/types";

// Role page fields are intentionally limited to the columns shown in the UI:
// Name, Description, Permissions, Status, and Created At.
const roleSchema: EntitySchema = {
  entityName: "role",
  idField: "id",
  fields: [
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
      name: "description",
      label: "Description",
      type: "textarea",
      sortable: true,
      filterable: true,
      filterType: "text",
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
    {
      name: "isActive",
      label: "Status",
      type: "boolean",
      booleanLabels: {
        true: "Active",
        false: "Inactive",
        trueColor: "bg-blue-500 text-white",
        falseColor: "bg-red-500 text-white",
      },
      filterable: true,
      filterType: "boolean",
    },
    {
      name: "createdAt",
      label: "Created At",
      type: "date",
      sortable: true,
      editable: false,
    },
  ],
};

export const entityConfig: EntityConfig = {
  name: "Role",
  path: "/roles",
  api: roleApi,
  schema: roleSchema,
};
