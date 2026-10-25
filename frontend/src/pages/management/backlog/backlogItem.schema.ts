import type { EntitySchema } from "@/types";
import { SPRINT_BACKLOG_PRIORITY_OPTIONS } from "../sprint-backlog/sprintBacklog.constants";

/** Shared with `/sprint-backlogs` so both create forms accept the same values. */
const priorityOptions = SPRINT_BACKLOG_PRIORITY_OPTIONS;

/**
 * Form used by the inline "Create" row of the `/backlogs` page.
 * <p>
 * The page creates the item in the product backlog first and assigns it to the
 * selected sprint right afterwards, so `sprintId` / `status` stay server side
 * decisions and are not exposed here.
 */
export const backlogItemSchema: EntitySchema = {
  entityName: "backlog-item",
  idField: "id",
  fields: [
    {
      name: "title",
      label: "Summary",
      type: "text",
      required: true,
      bold: true,
      maxLength: 250,
      requiredMessage: "Vui lòng nhập tên Backlog item",
      maxLengthMessage: "Tên Backlog item không vượt quá 250 ký tự",
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      maxLength: 2000,
      rows: 4,
      maxLengthMessage: "Mô tả không được vượt quá 2000 ký tự",
    },
    {
      name: "priority",
      label: "Priority",
      type: "select",
      options: priorityOptions,
      defaultValue: "MEDIUM",
      required: true,
      requiredMessage: "Vui lòng chọn độ ưu tiên",
    },
    {
      name: "estimatedHours",
      label: "Estimate (hours)",
      type: "number",
      helpText: "Số giờ ước tính, phải lớn hơn hoặc bằng 0",
    },
  ],
  validate: (values) => {
    const errors: Record<string, string[]> = {};
    const hours = values.estimatedHours;

    if (
      hours !== undefined &&
      hours !== null &&
      hours !== "" &&
      Number(hours) < 0
    ) {
      errors.estimatedHours = ["Số giờ ước tính phải lớn hơn hoặc bằng 0"];
    }

    return errors;
  },
};
