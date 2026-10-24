import { milestoneApi, backlogItemApi } from "@/api";
import {
    auditableFieldsSchema,
    type EntityConfig,
    type EntitySchema,
    type FieldSchema,
} from "@/types";

const priorityOptions = [
    { label: "Low", value: "LOW" },
    { label: "Medium", value: "MEDIUM" },
    { label: "High", value: "HIGH" },
    { label: "Urgent", value: "URGENT" },
];

/**
 * Workflow of a backlog item (UFR-PRJ-003-02):
 * Backlog -> Sprint Backlog -> In Progress -> Done.
 */
const statusOptions = [
    { label: "Backlog", value: "BACKLOG" },
    { label: "Sprint Backlog", value: "SPRINT_BACKLOG" },
    { label: "In Progress", value: "IN_PROGRESS" },
    { label: "Done", value: "DONE" },
];

/** New backlog items are active by default; boolean fields would otherwise start as false. */
const auditFields = (auditableFieldsSchema as FieldSchema[]).map((field) =>
    field.name === "isActive"
        ? { ...field, defaultValue: true, label: "Active" }
        : field,
);

const MAX_TITLE_LENGTH = 250;
const MAX_DESCRIPTION_LENGTH = 2000;

const taskSchema: EntitySchema = {
    entityName: "task",
    idField: "id",
    fields: [
        {
            name: "title",
            label: "Backlog Item Title",
            type: "text",
            sortable: true,
            bold: true,
            required: true,
            maxLength: MAX_TITLE_LENGTH,
            requiredMessage: "Vui lòng nhập tên Backlog item",
            maxLengthMessage: "Tên Backlog item không vượt quá 250 ký tự",
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
            maxLengthMessage: "Mô tả không được vượt quá 2000 ký tự",
            helpText: "Mô tả chi tiết 1 - 2000 ký tự",
            width: 320,
        },
        {
            name: "milestoneId",
            label: "Milestone",
            type: "relation",
            relation: {
                api: milestoneApi,
                valueField: "id",
                labelField: "label",
            },
            sortable: true,
            filterable: true,
            filterType: "select",
            helpText:
                "Chỉ hiển thị các Milestone còn hiệu lực của dự án được chọn",
        },
        {
            name: "projectId",
            label: "Project ID",
            type: "number",
            sortable: true,
            required: true,
            requiredMessage: "Vui lòng nhập Project ID",
        },
        {
            name: "sprintId",
            label: "Sprint ID",
            type: "number",
            sortable: true,
        },
        {
            name: "priority",
            label: "Priority",
            type: "select",
            sortable: true,
            options: priorityOptions,
            defaultValue: "MEDIUM",
            required: true,
            requiredMessage: "Vui lòng chọn độ ưu tiên",
            filterable: true,
            filterType: "select",
            filterOptions: priorityOptions,
        },
        {
            name: "status",
            label: "Backlog Status",
            type: "select",
            sortable: true,
            options: statusOptions,
            defaultValue: "BACKLOG",
            required: true,
            requiredMessage: "Vui lòng chọn trạng thái Backlog item",
            filterable: true,
            filterType: "select",
            filterOptions: statusOptions,
            helpText: "Workflow: Backlog → Sprint Backlog → In Progress → Done",
        },
        {
            name: "estimatedHours",
            label: "Estimated Hours",
            type: "number",
            sortable: true,
            width: 150,
            helpText: "Số giờ ước tính, phải lớn hơn hoặc bằng 0",
        },
        {
            name: "assigneeProjectMemberId",
            label: "Assignee ID",
            type: "number",
            sortable: true,
        },
        ...auditFields,
    ],
    /** Cross-field validation kept in sync with the backend rules (AC02). */
    validate: (values) => {
        const errors: Record<string, string[]> = {};

        const title = values.title;
        if (
            typeof title === "string" &&
            title.trim().length > MAX_TITLE_LENGTH
        ) {
            errors.title = ["Tên Backlog item không vượt quá 250 ký tự"];
        }

        const description = values.description;
        if (
            typeof description === "string" &&
            description.length > MAX_DESCRIPTION_LENGTH
        ) {
            errors.description = ["Mô tả không được vượt quá 2000 ký tự"];
        }

        if (values.status === "SPRINT_BACKLOG" && !values.sprintId) {
            errors.sprintId = [
                "Vui lòng chọn Sprint khi chuyển sang Sprint Backlog",
            ];
        }

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

export const entityConfig: EntityConfig = {
    name: "Backlog Item",
    path: "/taskstemp",
    api: backlogItemApi,
    schema: taskSchema,
};
