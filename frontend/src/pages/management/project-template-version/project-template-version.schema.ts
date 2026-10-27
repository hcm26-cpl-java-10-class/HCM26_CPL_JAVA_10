import {
  auditableFieldsSchema,
  type EntitySchema,
  type FieldSchema,
} from "@/types";

const MAX_VERSION_LENGTH = 50;

/** Lifecycle values accepted by the backend (`ProjectTemplateVersionStatus`). */
export const PROJECT_TEMPLATE_VERSION_STATUS_OPTIONS = [
  { label: "Draft", value: "DRAFT" },
  { label: "Published", value: "PUBLISHED" },
  { label: "Archived", value: "ARCHIVED" },
] as const;

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

/**
 * Project Template Version form schema. Shared by the workspace dialogs
 * (Create / Edit version) and by the entity config registered for the
 * `/project-template-versions` route.
 * <p>
 * Validation mirrors `ProjectTemplateSnapshotServiceImpl`: template id,
 * version (1..50 chars) and a JSON payload are mandatory, and the version is
 * unique per template (enforced by the backend with a 409 conflict).
 * <p>
 * `status` defaults to `DRAFT` (US-07) and `parentTemplateId` is read-only: it
 * is written by the server when a new version is derived from an existing one.
 */
export const projectTemplateVersionSchema: EntitySchema = {
  entityName: "project_template_version",
  idField: "id",
  fields: [
    {
      name: "templateId",
      label: "Template ID",
      type: "number",
      sortable: true,
      bold: true,
      required: true,
      requiredMessage: "Vui lòng nhập Project Template ID",
      filterable: true,
      filterType: "text",
      helpText: "ID của Project Template sở hữu phiên bản này",
    },
    {
      name: "version",
      label: "Version",
      type: "text",
      sortable: true,
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
      name: "parentTemplateId",
      label: "Parent Version ID",
      type: "number",
      sortable: true,
      filterable: true,
      filterType: "text",
      // Traceability only: the parent is set by the server when a new version
      // is derived, so it is never editable in the form.
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
    } else if (
      typeof contentJson === "string" &&
      !isValidJson(contentJson)
    ) {
      errors.contentJson = ["Nội dung snapshot không phải JSON hợp lệ"];
    }

    return errors;
  },
};
