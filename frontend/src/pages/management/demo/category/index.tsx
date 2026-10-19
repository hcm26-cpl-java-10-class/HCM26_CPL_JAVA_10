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
      // DB: categories.name length 150, not null
      validation: { required: true, minLength: 2, maxLength: 150 },
    },
    {
      name: "code",
      label: "Code",
      type: "text",
      sortable: true,
      // DB: categories.code length 50, unique, not null
      validation: {
        required: true,
        maxLength: 50,
        pattern: {
          regex: /^[A-Za-z0-9_-]+$/,
          message: "Code may only contain letters, numbers, '-' and '_'",
        },
      },
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
      validation: {
        custom: (value, _form, { initial }) =>
          value && initial?.id != null && String(value) === String(initial.id)
            ? "A category cannot be its own parent"
            : null,
      },
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      sortable: false,
      // DB: categories.description length 500
      validation: { maxLength: 500 },
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