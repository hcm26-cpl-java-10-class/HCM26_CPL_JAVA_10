import { userApi } from "@/api";
import { departmentApi } from "@/api/features/rbac/department.api";
import { roleApi } from "@/api/features/rbac/role.api";
import { UserCreatePage } from "./pages/UserCreatePage";
import { UserDetailPage } from "./pages/UserDetailPage";
import { UserEditPage } from "./pages/UserEditPage";
import {
  USER_STATUS_BADGE_CLASS,
  USER_STATUS_OPTIONS,
  auditableFieldsSchema,
  type EntityConfig,
  type EntitySchema,
  type FieldSchema,
} from "@/types";

const userSchema: EntitySchema = {
  entityName: "user",
  idField: "id",
  fields: [
    {
      name: "username",
      label: "Username",
      type: "text",
      sortable: true,
    },
    {
      name: "employeeCode",
      label: "Mã nhân viên",
      type: "text",
      sortable: true,
    },
    {
      name: "email",
      label: "Email",
      type: "text",
      sortable: true,
      bold: true,
    },
    {
      name: "firstName",
      label: "First Name",
      type: "text",
      sortable: true,
    },
    {
      name: "lastName",
      label: "Last Name",
      type: "text",
      sortable: true,
    },
    {
      name: "password",
      label: "Password",
      type: "password",
      visible: false,
      hideable: false,
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
    },
    {
      name: "departmentIds",
      label: "Phòng ban",
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
      name: "status",
      label: "Trạng thái",
      type: "select",
      options: USER_STATUS_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
      optionColors: USER_STATUS_BADGE_CLASS,
      // Công tắc: bật = Hoạt động, tắt = Bị khóa (gửi status lên BE).
      toggleValues: { on: "ACTIVE", off: "LOCKED" },
      // Bấm công tắc → PATCH /users/{id}/unlock (bật) hoặc /lock (tắt).
      toggleRequest: (row, value) =>
        value === "ACTIVE" ? userApi.unlock(row.id) : userApi.lock(row.id),
      sortable: false,
      filterable: false,
      editable: false,
    },
    // Bỏ cột Switch isActive: trạng thái do cột "Trạng thái" (ACTIVE/LOCKED/INACTIVE) thể hiện.
    ...(auditableFieldsSchema as FieldSchema[]).filter((f) => f.name !== "isActive"),
  ],
};

export const entityConfig: EntityConfig = {
  name: "User",
  path: "/users",
  api: userApi,
  schema: userSchema,
  actionPages: {
    create: { path: "/users/create", component: UserCreatePage },
    edit: { path: "/users/:id/edit", component: UserEditPage },
    detail: { path: "/users/:id/detail", component: UserDetailPage },
  },
};
