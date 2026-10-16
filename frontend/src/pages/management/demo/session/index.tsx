import { sessionApi } from "@/api/features/demo/session.api";
import {
    auditableFieldsSchema,
    type EntityConfig,
    type EntitySchema,
    type FieldSchema,
} from "@/types";

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
};