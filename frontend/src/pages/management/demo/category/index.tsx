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
      filterable: true,
      validation: {
        required: true,
        requiredMessage: "Category name is required",
        maxLength: 150,
      },
    },
    {
      name: "code",
      label: "Code",
      type: "text",
      sortable: true,
      filterable: true,
      validation: {
        required: true,
        requiredMessage: "Category code is required",
        maxLength: 50,
        pattern: {
          regex: /^[A-Za-z0-9_-]*$/,
          message: "Code may only contain letters, digits, '_' and '-'",
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
      filterable: true,
      relation: {
        api: categoryApi,
        valueField: "id",
        labelField: "name",
        // Ô chọn cha: ẩn chính nó và toàn bộ con, cháu (tránh vòng lặp cha-con).
        filterItems: (items, { initial, isEdit }) => {
          if (!isEdit) return items;
          const excluded = new Set<number>([initial.id]);
          let added = true;
          while (added) {
            added = false;
            for (const item of items) {
              if (item.parentId != null && excluded.has(item.parentId) && !excluded.has(item.id)) {
                excluded.add(item.id);
                added = true;
              }
            }
          }
          return items.filter((item) => !excluded.has(item.id));
        },
      },
      validation: {
        // Backend: "A category cannot be its own parent"
        custom: (value, _form, ctx) =>
          ctx.isEdit && value != null && ctx.initial?.id === value
            ? "A category cannot be its own parent"
            : null,
      },
    },
    {
      name: "displayOrder",
      label: "Display Order",
      type: "number",
      sortable: false,
      validation: {
        min: 0,
      },
    },
    {
      name: "iconUrl",
      label: "Icon URL",
      type: "text",
      sortable: false,
      visible: false,
      validation: {
        maxLength: 255,
      },
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      sortable: false,
      validation: {
        maxLength: 500,
      },
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