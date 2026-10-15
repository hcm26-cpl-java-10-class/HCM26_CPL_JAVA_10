import { categoryApi } from "@/api";
import {
    auditableFieldsSchema,
    type EntityConfig,
    type EntitySchema,
    type FieldSchema,
} from "@/types";

const categorySchema: EntitySchema = {
    entityName: "category",
    idField: "id",
    fields: [
        { name: "name", label: "Name", type: "text", sortable: true, bold: true },
        { name: "code", label: "Code", type: "text", sortable: true },
        {
            name: "parentName",
            label: "Parent",
            type: "text",
            sortable: false,
            editable: false,
        },
        {
            name: "parentId",
            label: "Parent Category",
            type: "relation",
            sortable: false,
            visible: false,
            filterable: true,
            relation: {
                api: categoryApi,
                valueField: "id",
                labelField: "name",
                clearable: true,
            },
        },
        { name: "description", label: "Description", type: "textarea", sortable: false },
        ...(auditableFieldsSchema as FieldSchema[]),
    ],
};

// Không có default export: router tự dùng <AutoCrudPage /> (bảng + modal thêm/sửa + xác nhận xoá).
export const entityConfig: EntityConfig = {
    name: "Category",
    path: "/categories",
    api: categoryApi,
    schema: categorySchema,
};