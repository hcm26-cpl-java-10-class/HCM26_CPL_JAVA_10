import {
  auditableFieldsSchema,
  type EntitySchema,
  type FieldSchema,
} from "@/types";

export const sprintStatusOptions = [
  { label: "Planned", value: "PLANNED" },
  { label: "Active", value: "ACTIVE" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
];

/**
 * A new sprint always starts as Planned, so the create form only offers that
 * status (the backend enforces the same rule).
 */
export const sprintCreateStatusOptions = sprintStatusOptions.filter(
  (option) => option.value === "PLANNED",
);

/**
 * Editing can only move the sprint forward to Active or Cancelled (Completed is
 * reached with "Complete sprint"). The current status is always kept in the
 * list by the form modal, so a Planned sprint still shows "Planned".
 */
export const sprintEditStatusOptions = sprintStatusOptions.filter((option) =>
  ["ACTIVE", "CANCELLED"].includes(option.value),
);

/** New sprints are active by default; boolean fields would otherwise start as false. */
const auditFields = (auditableFieldsSchema as FieldSchema[]).map((field) =>
  field.name === "isActive"
    ? { ...field, defaultValue: true, label: "Active" }
    : field,
);

/**
 * Sprint form schema. Shared by the workspace dialogs (Create Sprint / Edit
 * Sprint Scope) and by the entity config registered for the `/sprints` route.
 */
export const sprintSchema: EntitySchema = {
  entityName: "sprint",
  idField: "id",
  fields: [
    {
      name: "name",
      label: "Sprint Name",
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
      label: "Sprint Goal",
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
      label: "Start Time",
      type: "datetime",
      sortable: true,
      required: true,
      requiredMessage: "Vui lòng chọn thời gian bắt đầu",
    },
    {
      name: "endDate",
      label: "End Time",
      type: "datetime",
      sortable: true,
      required: true,
      requiredMessage: "Vui lòng chọn thời gian kết thúc",
    },
    {
      name: "status",
      label: "Sprint Status",
      type: "select",
      sortable: true,
      options: sprintStatusOptions,
      createOptions: sprintCreateStatusOptions,
      editOptions: sprintEditStatusOptions,
      defaultValue: "PLANNED",
      required: true,
      requiredMessage: "Vui lòng chọn trạng thái Sprint",
      helpText:
        "Sprint mới luôn ở trạng thái Planned. Khi cập nhật, chỉ có thể chuyển sang Active hoặc Cancelled.",
      filterable: true,
      filterType: "select",
      filterOptions: sprintStatusOptions,
    },
    ...auditFields,
  ],
  /**
   * Cross-field validation (AC02). Values from `datetime-local` are
   * `yyyy-MM-ddTHH:mm` strings so lexical comparison matches chronology.
   */
  validate: (values) => {
    const errors: Record<string, string[]> = {};

    if (
      values.startDate &&
      values.endDate &&
      values.endDate <= values.startDate
    ) {
      errors.endDate = ["Thời gian kết thúc phải sau thời gian bắt đầu"];
    }

    return errors;
  },
};
