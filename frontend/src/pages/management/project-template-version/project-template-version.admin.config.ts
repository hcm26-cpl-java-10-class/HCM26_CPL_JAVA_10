import { projectTemplateApi, projectTemplateVersionApi } from "@/api";
import {
    auditableFieldsSchema,
    type EntityConfig,
    type EntitySchema,
    type FieldSchema,
} from "@/types";
import { PROJECT_TEMPLATE_VERSION_STATUS_OPTIONS } from "./project-template-version.schema";

/**
 * Admin flavour of the `/project-template-versions` route.
 * <p>
 * Cloned from the sprint admin config: the admin persona gets the generic CRUD
 * data table driven by {@link projectTemplateVersionAdminEntityConfig}, while
 * every other persona gets the workspace page.
 */

const MAX_VERSION_LENGTH = 50;

/** New versions are active by default; boolean fields would otherwise start as false. */
const auditFields = (auditableFieldsSchema as FieldSchema[]).map((field) =>
    field.name === "isActive"
        ? { ...field, defaultValue: true, label: "Active" }
        : field,
);

const isValidJson = (value: string) => {
    try {
        JSON.parse(value);
        return true;
    } catch {
        return false;
    }
};

export const projectTemplateVersionAdminSchema: EntitySchema = {
    entityName: "project_template_version",
    idField: "id",
    fields: [
        {
            name: "templateId",
            label: "Project Template",
            type: "relation",
            relation: {
                api: projectTemplateApi,
                valueField: "id",
                labelField: "name",
            },
            sortable: true,
            bold: true,
            required: true,
            requiredMessage: "Vui lòng chọn Project Template",
            filterable: true,
            filterType: "select",
            renderCell: (value, row) =>
                row?.templateName?.trim() ||
                (value != null ? `TPL-${value}` : "—"),
            helpText: "Project Template sở hữu phiên bản này (chọn theo tên)",
        },
        {
            name: "version",
            label: "Version",
            type: "text",
            sortable: true,
            bold: true,
            required: true,
            maxLength: MAX_VERSION_LENGTH,
            requiredMessage: "Vui lòng nhập phiên bản",
            maxLengthMessage: "Phiên bản không vượt quá 50 ký tự",
            filterable: true,
            filterType: "text",
            helpText: "Nhãn phiên bản, ví dụ v1.0 - duy nhất trong mỗi template",
        },
        {
            name: "projectId",
            label: "Project ID",
            type: "number",
            sortable: true,
            filterable: true,
            filterType: "text",
            helpText: "ID dự án gắn với snapshot (có thể để trống)",
        },
        {
            name: "projectName",
            label: "Project Name",
            type: "text",
            // Resolved by the backend from `projectId`; never part of create/edit.
            editable: false,
            sortable: false,
            helpText: "Tên dự án được resolve từ Project ID (chỉ đọc)",
        },
        {
            name: "parentTemplateId",
            label: "Parent Version ID",
            type: "number",
            sortable: true,
            filterable: true,
            filterType: "text",
            // Set by the server when a version is derived; never editable.
            editable: false,
            helpText: "ID của phiên bản gốc mà phiên bản này được tạo ra từ đó",
        },
        {
            name: "status",
            label: "Status",
            type: "select",
            sortable: true,
            filterable: true,
            filterType: "select",
            options: [...PROJECT_TEMPLATE_VERSION_STATUS_OPTIONS],
            filterOptions: [...PROJECT_TEMPLATE_VERSION_STATUS_OPTIONS],
            defaultValue: "DRAFT",
            helpText: "Phiên bản mới luôn được tạo ở trạng thái DRAFT",
        },
        {
            name: "contentJson",
            label: "Content JSON",
            type: "textarea",
            required: true,
            rows: 10,
            requiredMessage: "Vui lòng nhập nội dung snapshot",
            width: 360,
            helpText: "Nội dung snapshot dưới dạng JSON hợp lệ",
        },
        ...auditFields,
    ],
    /** Cross-field validation kept in sync with the backend snapshot rules. */
    validate: (values) => {
        const errors: Record<string, string[]> = {};

        const version = values.version;
        if (typeof version === "string" && version.trim().length === 0) {
            errors.version = ["Vui lòng nhập phiên bản"];
        } else if (
            typeof version === "string" &&
            version.trim().length > MAX_VERSION_LENGTH
        ) {
            errors.version = ["Phiên bản không vượt quá 50 ký tự"];
        }

        const contentJson = values.contentJson;
        if (typeof contentJson === "string" && contentJson.trim().length === 0) {
            errors.contentJson = ["Vui lòng nhập nội dung snapshot"];
        } else if (typeof contentJson === "string" && !isValidJson(contentJson)) {
            errors.contentJson = ["Nội dung snapshot không phải JSON hợp lệ"];
        }

        return errors;
    },
};

export const projectTemplateVersionAdminEntityConfig: EntityConfig = {
    name: "ProjectTemplateVersion",
    path: "/project-template-versions",
    api: projectTemplateVersionApi,
    schema: projectTemplateVersionAdminSchema,
};
