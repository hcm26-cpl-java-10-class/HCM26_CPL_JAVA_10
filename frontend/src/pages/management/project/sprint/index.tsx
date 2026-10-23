import { projectApi, sprintApi } from "@/api";
import {
  auditableFieldsSchema,
  type EntityConfig,
  type EntitySchema,
  type FieldSchema,
} from "@/types";

const statusOptions = [
  { label: "Planned", value: "PLANNED" },
  { label: "Active", value: "ACTIVE" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
];

/** New sprints are active by default; boolean fields would otherwise start as false. */
const auditFields = (auditableFieldsSchema as FieldSchema[]).map((field) =>
  field.name === "isActive" ? { ...field, defaultValue: true } : field,
);

const sprintSchema: EntitySchema = {
  entityName: "sprint",
  idField: "id",
  fields: [
    {
      name: "projectId",
      label: "Project",
      type: "relation",
      relation: {
        api: projectApi,
        valueField: "id",
        labelField: "name",
      },
      // Used by the form; the table renders the human-readable projectName.
      visible: false,
      required: true,
      requiredMessage: "Vui lòng chọn Project cho Sprint",
    },
    {
      name: "projectName",
      label: "Project",
      type: "text",
      sortable: true,
      editable: false,
    },
    {
      name: "name",
      label: "Tên Sprint",
      type: "text",
      sortable: true,
      bold: true,
      required: true,
      maxLength: 255,
      requiredMessage: "Vui lòng nhập tên Sprint",
      maxLengthMessage: "Tên Sprint không vượt quá 255 ký tự",
    },
    {
      name: "sprintGoal",
      label: "Mục tiêu Sprint",
      type: "textarea",
      sortable: true,
      required: true,
      minLength: 1,
      maxLength: 500,
      rows: 5,
      requiredMessage: "Vui lòng nhập mục tiêu Sprint",
      maxLengthMessage: "Mục tiêu sprint không vượt quá 500 ký tự",
      width: 320,
    },
    {
      name: "startDate",
      label: "Ngày bắt đầu",
      type: "date",
      sortable: true,
      required: true,
      requiredMessage: "Vui lòng chọn ngày bắt đầu",
    },
    {
      name: "endDate",
      label: "Ngày kết thúc",
      type: "date",
      sortable: true,
      required: true,
      requiredMessage: "Vui lòng chọn ngày kết thúc",
    },
    {
      name: "status",
      label: "Trạng thái",
      type: "select",
      sortable: true,
      options: statusOptions,
      defaultValue: "PLANNED",
      required: true,
      requiredMessage: "Vui lòng chọn trạng thái Sprint",
      filterable: true,
      filterType: "select",
      filterOptions: statusOptions,
    },
    ...auditFields,
  ],
  /**
   * Cross-field validation (AC02). Dates are `yyyy-MM-dd` strings so the
   * lexical comparison matches the chronological one.
   */
  validate: (values) => {
    const errors: Record<string, string[]> = {};

    if (values.startDate && values.endDate && values.endDate <= values.startDate) {
      errors.endDate = ["Ngày kết thúc phải sau ngày bắt đầu"];
    }

    return errors;
  },
};

export const entityConfig: EntityConfig = {
  name: "Sprint",
  path: "/sprints",
  api: sprintApi,
  schema: sprintSchema,
};
