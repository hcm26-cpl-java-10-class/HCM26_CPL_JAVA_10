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
      label: "Code",
      type: "text",
      sortable: true,
      bold: true,
      validation: {
        required: true,
        minLength: 2,
        maxLength: 50,
        pattern: /^[A-Za-z0-9._-]{2,50}$/,
        patternMessage: "2-50 characters: letters, digits, dot, underscore or hyphen.",
        inputFilter: (v) => v.replace(/[^A-Za-z0-9._-]/g, ""),
        hint: "Letters, digits, dot, underscore and hyphen only.",
      },
    },
    {
      name: "name",
      label: "Name",
      type: "text",
      sortable: true,
      validation: { required: true, maxLength: 150 },
    },
    {
      name: "parentDepartmentId",
      label: "Parent Department",
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
      label: "Description",
      type: "textarea",
      sortable: true,
      validation: { maxLength: 500 },
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
