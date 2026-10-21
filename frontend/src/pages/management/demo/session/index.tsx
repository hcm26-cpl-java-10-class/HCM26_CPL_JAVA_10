import { sessionApi } from "@/api/features/demo/session.api";
import { SessionScheduleEditor } from "@/pages/management/schedule-validation/SessionScheduleEditor";
import { PermissionGate } from "@/components/PermissionGate";
import { Button } from "@/components/ui/button";
import {
    auditableFieldsSchema,
    type EntityConfig,
    type EntitySchema,
    type FieldSchema,
} from "@/types";
import { CalendarClock } from "lucide-react";
import { Link } from "react-router-dom";

const scheduleValidationAction = (
    <PermissionGate permissions={["SESSION_CREATE", "SESSION_UPDATE"]}>
        <Button asChild variant="outline">
            <Link to="/schedule-validation">
                <CalendarClock className="size-4" aria-hidden="true" />
                Validate schedule
            </Link>
        </Button>
    </PermissionGate>
);

const statusOptions = [
    { value: "SCHEDULED", label: "Scheduled", color: "blue" },
    { value: "COMPLETED", label: "Completed", color: "green" },
    { value: "CANCELLED", label: "Cancelled", color: "red" },
];

const sessionSchema: EntitySchema = {
    entityName: "session",
    idField: "id",
    fields: [
        {
            name: "title",
            label: "Session Title",
            type: "text",
            sortable: true,
            filterable: true,
            filterType: "text",
            bold: true,
        },
        {
            name: "classId",
            label: "Class ID",
            type: "number",
            sortable: true,
            filterable: true,
            filterType: "numberRange",
        },
        {
            name: "topicId",
            label: "Topic ID",
            type: "number",
            sortable: true,
            filterable: true,
            filterType: "numberRange",
        },
        {
            name: "trainerId",
            label: "Trainer ID",
            type: "number",
            sortable: true,
            filterable: true,
            filterType: "numberRange",
        },
        {
            name: "startTime",
            label: "Start Time",
            type: "datetime",
            sortable: true,
            filterable: true,
            filterType: "dateRange",
        },
        {
            name: "endTime",
            label: "End Time",
            type: "datetime",
            sortable: true,
            filterable: true,
            filterType: "dateRange",
        },
        {
            name: "location",
            label: "Location / Room",
            type: "text",
            sortable: true,
            filterable: true,
            filterType: "text",
        },
        {
            name: "status",
            label: "Status",
            type: "select",
            options: statusOptions,
            sortable: true,
            filterable: true,
            filterType: "select",
        },
        {
            name: "note",
            label: "Note",
            type: "textarea",
        },
        {
            name: "cancelReason",
            label: "Cancel Reason",
            type: "text",
            editable: false,
        },
        ...(auditableFieldsSchema as FieldSchema[]),
    ],
};

export const entityConfig: EntityConfig = {
    name: "Class Schedules",
    path: "/sessions",
    api: sessionApi,
    schema: sessionSchema,
    headerActions: scheduleValidationAction,
    actionPages: {
        create: { path: "create", component: SessionScheduleEditor, requiredPermission: "SESSION_CREATE" },
        edit: { path: ":id/edit", component: SessionScheduleEditor, requiredPermission: "SESSION_UPDATE" },
    },
};
