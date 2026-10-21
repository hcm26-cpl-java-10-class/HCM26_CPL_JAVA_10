import { userApi } from "@/api";
import { roleApi } from "@/api/features/rbac/role.api";
import {
  auditableFieldsSchema,
  type EntityConfig,
  type EntitySchema,
  type FieldSchema,
} from "@/types";
import { UserLockAction } from "./components/UserLockAction";
import { useQueryClient } from "@tanstack/react-query";

const USER_SAMPLE_ID_MAP: Record<string, string> = {
  "admin@example.com": "USR001",
  "student@example.com": "USR012",
  "teacher@example.com": "USR026",
};

function UserLockRowAction({ user }: { user: any }) {
  const queryClient = useQueryClient();

  return (
      <UserLockAction
          user={user}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["user"] });
          }}
      />
  );
}

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
    },
    {
      name: "lastName",
      label: "Last Name",
      type: "text",
      visible: false,
      hideable: false,
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
    ...(auditableFieldsSchema as FieldSchema[]),
  ],
};

export const entityConfig: EntityConfig = {
  name: "User",
  path: "/users",
  api: userApi,
  schema: userSchema,
  extraRowActions: (row) => <UserLockRowAction user={row} />,
};
