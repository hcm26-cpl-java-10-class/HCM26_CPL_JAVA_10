import { moduleApi, moduleGroupApi, permissionApi } from "@/api";
import { iconKeyOptions } from "@/components/datatable/iconMap";
import { auditableFieldsSchema, type EntityConfig, type EntitySchema, type FieldSchema } from "@/types";

const moduleSchema: EntitySchema = {
    entityName: "module",
    idField: "id",
    fields: [
        {
            name: "title",
            label: "Title",
            type: "text",
            sortable: true,
            bold: true,
        },
        {
            name: "moduleGroupId",
            label: "Module Group",
            type: "relation",
            editable: true,
            relation: {
                api: moduleGroupApi,
                valueField: "id",
                labelField: "name",
            },
            filterable: true,
            filterType: "select",
        },
        {
            name: "url",
            label: "URL",
            type: "text",
            sortable: true,
        },
        {
            name: "icon",
            label: "Icon",
            type: "icon",
            options: iconKeyOptions,
            filterable: true,
            filterType: "select",
        },
        {
            name: "requiredPermission",
            label: "Permission",
            type: "relation",
            editable: true,
            relation: {
                api: permissionApi,
                valueField: "name",
                labelField: "name",
            },
            filterable: true,
            filterType: "select",
        },
        {
            name: "displayOrder",
            label: "Display Order",
            type: "number",
            sortable: true,
        },
        ...(auditableFieldsSchema as FieldSchema[])
    ],
};

export const entityConfig: EntityConfig = {
    name: "Module",
    path: "/menus",
    api: moduleApi,
    schema: moduleSchema,
};
