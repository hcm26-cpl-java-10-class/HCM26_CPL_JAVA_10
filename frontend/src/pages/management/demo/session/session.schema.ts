import { externalApi } from "@/api/features/external.api";
import { auditableFieldsSchema, type EntitySchema, type FieldSchema } from "@/types";
import { classTitle } from "@/utils/class.utils";
import { getSessionStatusMeta } from "@/utils/session.utils";

/*
 * The generic table shows a "relation" column by looking its value up in a list of { id, label } options.
 * These adapters feed that mechanism, so the Sessions table shows a class code, a trainer name and a status
 * label instead of raw ids / enum names, and the matching filters offer the same choices.
 */
const classOptions = {
    getPage: async () => ({
        content: (await externalApi.getClasses()).map((item) => ({ id: item.id, label: classTitle(item) })),
    }),
};

const trainerOptions = {
    getPage: async () => ({
        content: (await externalApi.getTrainers()).map((trainer) => ({
            id: trainer.id,
            label: trainer.name || `Trainer #${trainer.id}`,
        })),
    }),
};

const statusOptions = {
    getPage: async () => ({
        content: (["SCHEDULED", "COMPLETED", "CANCELLED"] as const).map((status) => ({
            id: status,
            label: getSessionStatusMeta(status).label,
        })),
    }),
};

/** isActive is not part of the session lifecycle (use Cancel), and range filters on audit dates have no backend counterpart. */
const auditFields = (auditableFieldsSchema as FieldSchema[])
    .filter((field) => field.name !== "isActive")
    .map((field) => (field.filterType === "dateRange" ? { ...field, filterable: false } : field));

export const sessionSchema: EntitySchema = {
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
            minWidth: 200,
            width: 220,
        },
        {
            name: "classId",
            label: "Class",
            type: "relation",
            relation: { api: classOptions, valueField: "id", labelField: "label" },
            sortable: true,
            filterable: true,
            filterType: "select",
        },
        {
            name: "topicId",
            label: "Topic ID",
            type: "number",
            sortable: true,
            filterable: true,
            filterType: "text",
            width: 110,
        },
        {
            name: "trainerId",
            label: "Trainer",
            type: "relation",
            relation: { api: trainerOptions, valueField: "id", labelField: "label" },
            sortable: true,
            filterable: true,
            filterType: "select",
        },
        {
            name: "startTime",
            label: "Start",
            type: "date",
            sortable: true,
            filterable: true,
            filterType: "dateRange",
        },
        {
            name: "endTime",
            label: "End",
            type: "date",
            sortable: true,
        },
        {
            name: "location",
            label: "Room",
            type: "text",
            sortable: true,
            filterable: true,
            filterType: "text",
        },
        {
            name: "status",
            label: "Status",
            type: "relation",
            relation: { api: statusOptions, valueField: "id", labelField: "label" },
            sortable: true,
            filterable: true,
            filterType: "select",
        },
        {
            name: "note",
            label: "Note",
            type: "textarea",
            visible: false,
        },
        {
            name: "cancelReason",
            label: "Cancel Reason",
            type: "text",
            editable: false,
            visible: false,
        },
        ...auditFields,
    ],
};
