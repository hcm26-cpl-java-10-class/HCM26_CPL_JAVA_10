import { userApi } from "@/api";
import { departmentApi } from "@/api/features/rbac/department.api";
import { roleApi } from "@/api/features/rbac/role.api";
import {
  auditableFieldsSchema,
  type EntityConfig,
  type EntitySchema,
  type FieldSchema,
} from "@/types";
import { validatePasswordStrength } from "@/utils/password.utils";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_PATTERN = /^[\p{L}][\p{L}\s.'-]*$/u;
const PHONE_PATTERN = /^\+?\d{8,15}$/;

const USER_SAMPLE_ID_MAP: Record<string, string> = {
  "admin@example.com": "USR001",
  "student@example.com": "USR012",
  "teacher@example.com": "USR026",
};

const formatUserId = (row: any, index: number) => {
  if (row?.email && USER_SAMPLE_ID_MAP[row.email]) {
    return USER_SAMPLE_ID_MAP[row.email];
  }
  if (row?.id === 1 || row?.id === "1") return "USR001";
  if (row?.id === 2 || row?.id === "2") return "USR012";
  if (row?.id === 3 || row?.id === "3") return "USR026";
  if (row?.id && !isNaN(Number(row.id))) {
    return `USR${String(row.id).padStart(3, "0")}`;
  }
  if (index === 0) return "USR001";
  if (index === 1) return "USR012";
  if (index === 2) return "USR026";
  return `USR${String(index + 1).padStart(3, "0")}`;
};

const userSchema: EntitySchema = {
  entityName: "user",
  idField: "id",
  indexColumnTitle: "ID",
  indexColumnWidth: 85,
  renderIndex: formatUserId,
  fields: [
    {
      name: "email",
      label: "Email",
      type: "text",
      sortable: true,
      bold: true,
      validation: {
        required: true,
        maxLength: 100,
        pattern: EMAIL_PATTERN,
        patternMessage: "Enter a valid email address, e.g. name@company.com.",
        inputFilter: (v) => v.replace(/\s/g, ""),
        placeholder: "name@company.com",
      },
    },
    {
      name: "fullName",
      label: "Full Name",
      type: "text",
      sortable: true,
      editable: false,
    },
    {
      name: "firstName",
      label: "First Name",
      type: "text",
      visible: false,
      hideable: false,
      sortable: true,
      validation: {
        required: true,
        maxLength: 100,
        pattern: NAME_PATTERN,
        patternMessage: "Use letters, spaces, dots, apostrophes or hyphens only.",
        inputFilter: (v) => v.replace(/[^\p{L}\s.'-]/gu, ""),
      },
    },
    {
      name: "lastName",
      label: "Last Name",
      type: "text",
      visible: false,
      hideable: false,
      sortable: true,
      validation: {
        maxLength: 100,
        pattern: NAME_PATTERN,
        patternMessage: "Use letters, spaces, dots, apostrophes or hyphens only.",
        inputFilter: (v) => v.replace(/[^\p{L}\s.'-]/gu, ""),
      },
    },
    {
      name: "phone",
      label: "Phone",
      type: "text",
      visible: false,
      validation: {
        maxLength: 16,
        pattern: PHONE_PATTERN,
        patternMessage: "Enter 8-15 digits, optionally starting with +.",
        inputFilter: (v) => v.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, ""),
        placeholder: "0901234567",
      },
    },
    {
      name: "password",
      label: "Password",
      type: "password",
      visible: false,
      hideable: false,
      validation: {
        requiredOnCreate: true,
        maxLength: 64,
        passwordRules: true,
        hint: "No email is sent: give this initial password to the user. When editing, leave blank to keep the current password.",
        validate: (value) =>
          value ? validatePasswordStrength(String(value)) : undefined,
      },
    },
    {
      name: "confirmPassword",
      label: "Confirm Password",
      type: "password",
      visible: false,
      hideable: false,
      transient: true,
      validation: {
        requiredOnCreate: true,
        maxLength: 64,
        placeholder: "Re-enter the password",
        validate: (value, form) => {
          const password = String(form.password ?? "");
          const confirm = String(value ?? "");
          if (password && !confirm) return "Please re-enter the password to confirm it.";
          if (confirm && confirm !== password) return "Passwords do not match.";
          return undefined;
        },
      },
    },
    {
      name: "roleIds",
      label: "Role",
      type: "relation",
      relation: {
        api: roleApi,
        valueField: "id",
        labelField: "name",
        multiple: true,
      },
      filterable: true,
      filterType: "select",
      validation: { required: true },
    },
    {
      name: "departmentIds",
      label: "Department",
      type: "relation",
      relation: {
        api: departmentApi,
        valueField: "id",
        labelField: "name",
        multiple: true,
      },
      filterable: true,
      filterType: "select",
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      visible: false,
      validation: { maxLength: 500 },
    },
    ...(auditableFieldsSchema as FieldSchema[]),
  ],
};

export const entityConfig: EntityConfig = {
  name: "User",
  path: "/users",
  api: userApi,
  schema: userSchema,
};
