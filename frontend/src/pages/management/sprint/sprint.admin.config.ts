import { sprintApi } from "@/api";
import {
    auditableFieldsSchema,
    type EntityConfig,
    type EntitySchema,
    type FieldSchema,
} from "@/types";
import { sprintStatusOptions } from "./sprint.schema";

/**
 * Admin flavour of the `/sprints` route.
 * <p>
 * Instead of the student workspace, the admin persona gets the generic CRUD
 * data table driven by {@link sprintAdminEntityConfig}. The student workspace
 * stays untouched in `sprint/workspace/SprintWorkspacePage`.
 */

const MAX_NAME_LENGTH = 255;
const MAX_GOAL_LENGTH = 500;

/** New sprints are active by default; boolean fields would otherwise start as false. */
const auditFields = (auditableFieldsSchema as FieldSchema[]).map((field) =>
    field.name === "isActive"
        ? { ...field, defaultValue: true, label: "Active" }
        : field,
);

export const sprintAdminSchema: EntitySchema = {
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
            maxLength: MAX_NAME_LENGTH,
            requiredMessage: "Vui lòng nhập tên Sprint",
            maxLengthMessage: "Tên Sprint không vượt quá 255 ký tự",
            filterable: true,
            filterType: "text",
        },
        {
            name: "sprintGoal",
            label: "Sprint Goal",
            type: "textarea",
            sortable: true,
            required: true,
            minLength: 1,
            maxLength: MAX_GOAL_LENGTH,
            rows: 5,
            requiredMessage: "Vui lòng nhập mục tiêu Sprint",
            maxLengthMessage: "Mục tiêu Sprint không vượt quá 500 ký tự",
            helpText: "Mục tiêu Sprint 1 - 500 ký tự",
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
            defaultValue: "PLANNED",
            required: true,
            requiredMessage: "Vui lòng chọn trạng thái Sprint",
            filterable: true,
            filterType: "select",
            filterOptions: sprintStatusOptions,
            helpText: "Workflow: Planned → Active → Completed / Cancelled",
        },
        {
            name: "projectId",
            label: "Project ID",
            type: "number",
            sortable: true,
            filterable: true,
            filterType: "text",
            helpText: "ID dự án sở hữu Sprint (có thể để trống)",
        },
        ...auditFields,
    ],
    /** Cross-field validation kept in sync with the backend sprint rules. */
    validate: (values) => {
        const errors: Record<string, string[]> = {};

        const name = values.name;
        if (typeof name === "string" && name.trim().length > MAX_NAME_LENGTH) {
            errors.name = ["Tên Sprint không vượt quá 255 ký tự"];
        }

        const goal = values.sprintGoal;
        if (
            typeof goal === "string" &&
            (goal.length < 1 || goal.length > MAX_GOAL_LENGTH)
        ) {
            errors.sprintGoal = ["Mục tiêu Sprint phải từ 1 đến 500 ký tự"];
        }

        /**
         * Values from `datetime-local` are `yyyy-MM-ddTHH:mm` strings so
         * lexical comparison matches chronology.
         */
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

export const sprintAdminEntityConfig: EntityConfig = {
    name: "Sprint",
    path: "/sprints",
    api: sprintApi,
    schema: sprintAdminSchema,
    /** Admins can jump to the student backlog view from the Sprint table. */
    backlogShortcutPath: "/backlogs",
};
