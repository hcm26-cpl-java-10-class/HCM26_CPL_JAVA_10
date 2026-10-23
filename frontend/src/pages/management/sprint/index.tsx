import { sprintApi } from "@/api";
import {
  auditableFieldsSchema,
  type EntityConfig,
  type EntitySchema,
  type FieldSchema,
} from "@/types";
import { SprintCard } from "./components/SprintCard";

const statusOptions = [
  { label: "Planned", value: "PLANNED" },
  { label: "Active", value: "ACTIVE" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
];

/** New sprints are active by default; boolean fields would otherwise start as false. */
const auditFields = (auditableFieldsSchema as FieldSchema[]).map((field) =>
  field.name === "isActive"
    ? { ...field, defaultValue: true, label: "Active" }
    : field,
);

const sprintSchema: EntitySchema = {
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
   * Cross-field validation (AC02). Values from `datetime-local` are
   * `yyyy-MM-ddTHH:mm` strings so lexical comparison matches chronology.
   */
  validate: (values) => {
    const errors: Record<string, string[]> = {};

    if (values.startDate && values.endDate && values.endDate <= values.startDate) {
      errors.endDate = ["Thời gian kết thúc phải sau thời gian bắt đầu"];
    }

    return errors;
  },
};

export const entityConfig: EntityConfig = {
  name: "Sprint",
  path: "/sprints",
  api: sprintApi,
  schema: sprintSchema,
  /**
   * Sprints are rendered as stacked full-width rows so status, start time and
   * end time stay readable for the student browse view.
   */
  cardRenderer: (props) => <SprintCard {...props} />,
  cardLayout: "list",
  /**
   * UFR-PRJ-003-01 is owned by the student persona: let students browse in the
   * read-only card layout, but keep full CRUD on the sprint they can see
   * (create via the inline form modal, plus edit / delete / active toggle).
   * Each action stays gated by the matching SPRINT_* permission.
   */
  browseModeCreate: true,
  browseModeActions: true,
};
