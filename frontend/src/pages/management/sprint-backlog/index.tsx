import { sprintApi, sprintBacklogApi } from "@/api";
import {
    auditableFieldsSchema,
    type EntityConfig,
    type EntitySchema,
    type FieldSchema,
} from "@/types";

/**
 * Sprint Backlog route (`/sprint-backlogs`).
 * <p>
 * Cloned from the temporary task page (`/taskstemp`) and adapted to the
 * `sprint_backlog` backend module: the generic CRUD data table is enough, the
 * schema only keeps the fields and the rules enforced by
 * `SprintBacklogServiceImpl`.
 *
 * Business rules mirrored on the client (the backend stays authoritative and
 * answers 422 with the same field keys):
 * - owning sprint mandatory and must exist
 * - title mandatory, 1..200 characters
 * - description optional, at most 2000 characters
 * - start / end date optional but both-or-none, start strictly before end
 * - status one of {@link SprintBacklogStatus}
 * - assignee id, when provided, must be a positive number
 */

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;

/** Lifecycle of a Sprint Backlog item: To do -> In progress -> Review -> Done. */
const statusOptions = [
    { label: "To do", value: "TODO" },
    { label: "In progress", value: "IN_PROGRESS" },
    { label: "Review", value: "REVIEW" },
    { label: "Done", value: "DONE" },
];

/** New backlog items are active by default; boolean fields would otherwise start as false. */
const auditFields = (auditableFieldsSchema as FieldSchema[]).map((field) =>
    field.name === "isActive"
        ? { ...field, defaultValue: true, label: "Active" }
        : field,
);

const sprintBacklogSchema: EntitySchema = {
    entityName: "sprint-backlog",
    idField: "id",
    fields: [
        {
            name: "title",
            label: "Sprint Backlog Title",
            type: "text",
            sortable: true,
            bold: true,
            required: true,
            maxLength: MAX_TITLE_LENGTH,
            requiredMessage: "Vui lòng nhập tiêu đề Sprint Backlog",
            maxLengthMessage: "Tiêu đề Sprint Backlog không vượt quá 200 ký tự",
            filterable: true,
            filterType: "text",
        },
        {
            name: "description",
            label: "Description",
            type: "textarea",
            sortable: true,
            maxLength: MAX_DESCRIPTION_LENGTH,
            rows: 5,
            maxLengthMessage:
                "Mô tả Sprint Backlog không vượt quá 2000 ký tự",
            helpText: "Mô tả chi tiết, tối đa 2000 ký tự",
            width: 320,
        },
        {
            name: "sprintId",
            label: "Sprint",
            type: "relation",
            relation: {
                api: sprintApi,
                valueField: "id",
                labelField: "name",
            },
            sortable: true,
            required: true,
            requiredMessage: "Vui lòng chọn Sprint cho Sprint Backlog",
            filterable: true,
            filterType: "select",
            helpText: "Mỗi Sprint Backlog luôn thuộc về một Sprint đang tồn tại",
        },
        {
            name: "assigneeProjectMemberId",
            label: "Assignee ID",
            type: "number",
            sortable: true,
            filterable: true,
            filterType: "text",
            helpText:
                "ID thành viên dự án phụ trách (có thể để trống, phải là số dương)",
        },
        {
            name: "startDate",
            label: "Start Time",
            type: "datetime",
            sortable: true,
            helpText: "Thời gian bắt đầu, phải trước thời gian kết thúc",
        },
        {
            name: "endDate",
            label: "End Time",
            type: "datetime",
            sortable: true,
            helpText: "Thời gian kết thúc, phải sau thời gian bắt đầu",
        },
        {
            name: "status",
            label: "Backlog Status",
            type: "select",
            sortable: true,
            options: statusOptions,
            defaultValue: "TODO",
            required: true,
            requiredMessage: "Vui lòng chọn trạng thái Sprint Backlog",
            filterable: true,
            filterType: "select",
            filterOptions: statusOptions,
            helpText: "Workflow: To do → In progress → Review → Done",
        },
        ...auditFields,
    ],
    /** Cross-field validation kept in sync with the backend rules. */
    validate: (values) => {
        const errors: Record<string, string[]> = {};

        const title = values.title;
        if (typeof title === "string") {
            const trimmed = title.trim();

            if (!trimmed) {
                errors.title = ["Vui lòng nhập tiêu đề Sprint Backlog"];
            } else if (trimmed.length > MAX_TITLE_LENGTH) {
                errors.title = [
                    "Tiêu đề Sprint Backlog không vượt quá 200 ký tự",
                ];
            }
        }

        const description = values.description;
        if (
            typeof description === "string" &&
            description.length > MAX_DESCRIPTION_LENGTH
        ) {
            errors.description = [
                "Mô tả Sprint Backlog không vượt quá 2000 ký tự",
            ];
        }

        if (!values.sprintId) {
            errors.sprintId = ["Vui lòng chọn Sprint cho Sprint Backlog"];
        }

        const assignee = values.assigneeProjectMemberId;
        if (
            assignee !== undefined &&
            assignee !== null &&
            assignee !== "" &&
            Number(assignee) <= 0
        ) {
            errors.assigneeProjectMemberId = ["Người phụ trách không hợp lệ"];
        }

        /**
         * Start and end date are optional, but when one of them is provided the
         * other one is required. Values from `datetime-local` are
         * `yyyy-MM-ddTHH:mm` strings so lexical comparison matches chronology.
         */
        const startDate = values.startDate;
        const endDate = values.endDate;

        if (startDate || endDate) {
            if (!startDate) {
                errors.startDate = ["Vui lòng chọn thời gian bắt đầu"];
            }

            if (!endDate) {
                errors.endDate = ["Vui lòng chọn thời gian kết thúc"];
            }

            if (startDate && endDate && endDate <= startDate) {
                errors.endDate = [
                    "Thời gian kết thúc phải sau thời gian bắt đầu",
                ];
            }
        }

        return errors;
    },
};

export const entityConfig: EntityConfig = {
    name: "Sprint Backlog",
    path: "/sprint-backlogs",
    api: sprintBacklogApi,
    schema: sprintBacklogSchema,
};
