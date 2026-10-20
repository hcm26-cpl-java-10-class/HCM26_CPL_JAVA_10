import { sessionApi } from "@/api";
import {
  auditableFieldsSchema,
  type EntityConfig,
  type EntitySchema,
  type FieldSchema,
} from "@/types";
import { SessionCreatePage } from "./pages/SessionCreatePage";
import { SessionEditPage } from "./pages/SessionEditPage";
import { SessionRowActions } from "./components/SessionRowActions";

const sessionSchema: EntitySchema = {
  entityName: "session",
  idField: "id",
  fields: [
    {
      name: "classCode",
      label: "Mã Lớp",
      type: "text",
      sortable: true,
      bold: true,
    },
    {
      name: "title",
      label: "Tiêu Đề Buổi Học",
      type: "text",
      sortable: true,
      bold: true,
    },
    {
      name: "topicName",
      label: "Topic",
      type: "text",
      sortable: true,
    },
    {
      name: "trainerName",
      label: "Giảng Viên",
      type: "text",
      sortable: true,
    },
    {
      name: "startTime",
      label: "Thời Gian Bắt Đầu",
      type: "date",
      sortable: true,
    },
    {
      name: "endTime",
      label: "Thời Gian Kết Thúc",
      type: "date",
      sortable: true,
    },
    {
      name: "room",
      label: "Phòng Học",
      type: "text",
      sortable: true,
    },
    {
      name: "status",
      label: "Trạng Thái",
      type: "text",
      sortable: true,
    },
    {
      name: "isOverridden",
      label: "Override (BR-10)",
      type: "boolean",
      sortable: true,
    },
    {
      name: "overrideReason",
      label: "Lý Do Override",
      type: "text",
    },
    ...(auditableFieldsSchema as FieldSchema[]),
  ],
};

export const entityConfig: EntityConfig = {
  name: "Class Schedule",
  path: "/sessions",
  api: sessionApi,
  schema: sessionSchema,
  actionPages: {
    create: {
      path: "/sessions/create",
      component: SessionCreatePage,
      requiredPermission: "SESSION_CREATE",
    },
    edit: {
      path: "/sessions/:id/edit",
      component: SessionEditPage,
      requiredPermission: "SESSION_UPDATE",
    },
  },
  extraRowActions: (row) => <SessionRowActions session={row} />,
};
