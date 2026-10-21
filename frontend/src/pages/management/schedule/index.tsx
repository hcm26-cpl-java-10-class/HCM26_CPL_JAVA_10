import { sessionApi } from "@/api";
import {
  auditableFieldsSchema,
  type EntityConfig,
  type EntitySchema,
  type FieldSchema,
} from "@/types";
import { SessionCreatePage } from "./pages/SessionCreatePage";
import { SessionEditPage } from "./pages/SessionEditPage";
import { SessionDetailPage } from "./pages/SessionDetailPage";
import { SessionListPage } from "./pages/SessionListPage";
import { SessionRowActions } from "./components/SessionRowActions";

const sessionSchema: EntitySchema = {
  entityName: "session",
  idField: "id",
  fields: [
    {
      name: "classCode",
      label: "Class Code",
      type: "text",
      sortable: true,
      bold: true,
    },
    {
      name: "title",
      label: "Session Title",
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
      label: "Trainer",
      type: "text",
      sortable: true,
    },
    {
      name: "startTime",
      label: "Start Time",
      type: "date",
      sortable: true,
    },
    {
      name: "endTime",
      label: "End Time",
      type: "date",
      sortable: true,
    },
    {
      name: "room",
      label: "Room",
      type: "text",
      sortable: true,
    },
    {
      name: "status",
      label: "Status",
      type: "text",
      sortable: true,
    },
    {
      name: "notes",
      label: "Notes",
      type: "text",
    },
    {
      name: "isOverridden",
      label: "Override",
      type: "boolean",
      sortable: true,
    },
    {
      name: "overrideReason",
      label: "Override Reason",
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
    detail: {
      path: "/sessions/:id",
      component: SessionDetailPage,
      requiredPermission: "SESSION_READ",
    },
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

export default function SchedulePage() {
  return <SessionListPage entity={entityConfig} />;
}
