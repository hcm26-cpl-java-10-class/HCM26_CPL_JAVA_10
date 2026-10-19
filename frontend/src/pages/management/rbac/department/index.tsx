import { departmentApi } from "@/api";
import {
  auditableFieldsSchema,
  type EntityConfig,
  type EntitySchema,
  type FieldSchema,
} from "@/types";

const departmentSchema: EntitySchema = {
  entityName: "department",
  idField: "id",
  fields: [
    {
      name: "code",
      label: "Mã phòng ban",
      type: "text",
      sortable: true,
      bold: true,
    },
    {
      name: "name",
      label: "Tên phòng ban",
      type: "text",
      sortable: true,
    },
    {
      name: "parentDepartmentId",
      label: "Phòng ban cha",
      type: "relation",
      editable: true,
      relation: {
        api: departmentApi,
        valueField: "id",
        labelField: "name",
        multiple: false,
      },
      filterable: true,
      filterType: "select",
    },
    {
      name: "description",
      label: "Mô tả",
      type: "textarea",
      sortable: true,
    },
    ...(auditableFieldsSchema as FieldSchema[]),
  ],
};

export const entityConfig: EntityConfig = {
  name: "Department",
  path: "/departments",
  api: departmentApi,
  schema: departmentSchema,
};
