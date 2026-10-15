import { categoryApi } from "@/api";
import { AutoCrudPage } from "@/pages/management/AutoCrudPage";
import { type EntityConfig, type EntitySchema, auditableFieldsSchema, type FieldSchema } from "@/types";

const categorySchema: EntitySchema = {
  entityName: "category",
  idField: "id",
  fields: [
    {
      name: "name",
      label: "Category Name",
      type: "text",
      sortable: true,
      bold: true,
    },
    {
      name: "code",
      label: "Code",
      type: "text",
      sortable: true,
    },
    {
      name: "parentName",
      label: "Parent Category",
      type: "text",
      sortable: false,
      editable: false,
    },
    {
      // Chỉ dùng trong form: chọn danh mục cha ở modal thêm/sửa
      name: "parentId",
      label: "Parent Category",
      type: "relation",
      sortable: false,
      visible: false,
      relation: {
        api: categoryApi,
        valueField: "id",
        labelField: "name",
      },
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      sortable: false,
    },
    ...(auditableFieldsSchema as FieldSchema[]),
  ],
};

export const entityConfig: EntityConfig = {
  name: "Category",
  path: "/categories",
  api: categoryApi,
  schema: categorySchema,
};

// Admin: đầy đủ CRUD. Teacher chỉ có CATEGORY_READ -> AutoCrudPage tự chuyển sang chế độ chỉ xem.
export default function CategoryManagementPage() {
  return <AutoCrudPage entity={entityConfig} />;
}