import { userApi } from "@/api";
import { departmentApi } from "@/api/features/rbac/department.api";
import { roleApi } from "@/api/features/rbac/role.api";
import { UserCreatePage } from "./pages/UserCreatePage";
import { UserDetailPage } from "./pages/UserDetailPage";
import { UserEditPage } from "./pages/UserEditPage";
import {
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
      name: "userCode",
      label: "Mã sinh viên",
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
    ...(auditableFieldsSchema as FieldSchema[]),
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
