import { studentApi } from "@/api/features/rbac/student.api";
import { clsApi } from "@/api/features/cls.api";
import { auditableFieldsSchema, type EntityConfig, type EntitySchema } from "@/types";

const studentSchema: EntitySchema = {
  entityName: "student",
  idField: "id",
  fields: [
    { name: "studentCode", label: "Mã sinh viên", type: "text", sortable: true, filterable: true, filterType: "text", bold: true },
    { name: "firstName", label: "Họ", type: "text", sortable: true, filterable: true, filterType: "text" },
    { name: "lastName", label: "Tên", type: "text", sortable: true, filterable: true, filterType: "text" },
    {
      name: "email",
      label: "Email",
      type: "text",
      sortable: true,
      filterable: true,
      filterType: "text"
    },
    { name: "trainingClass", label: "Training Class", type: "text", sortable: false, editable: false, minWidth: 160 },
    {
      name: "trainingClassIds",
      label: "Training Class",
      type: "relation",
      visible: false,
      relation: {
        api: {
          getPage: async () => {
            const classes = await clsApi.getAllClasses();
            return {
              content: classes.map((item) => ({
                id: item.id,
                label: `${item.code} - ${item.name}`,
                status: item.status,
              })),
            };
          },
        },
        valueField: "id",
        labelField: "label",
        multiple: true,
        filterItems: (items, { initial }) => {
          const currentIds = (initial?.trainingClassIds ?? []).map((id: number) => String(id));
          return items.filter((item) =>
            ["planning", "assigned", "active"].includes(String(item.status).toLowerCase()) ||
            currentIds.includes(String(item.id))
          );
        },
      },
      defaultValue: [],
      helpText: "Chọn một hoặc nhiều lớp. Lớp mới chỉ được chọn khi ở trạng thái Planning, Assigned hoặc Active.",
    },
    { name: "phone", label: "Số điện thoại", type: "text", sortable: true },
    { 
      name: "dateOfBirth", 
      label: "Ngày sinh", 
      type: "date", 
      sortable: true,
      
      dateFormat: "date" 
    },
    
    { 
      name: "gender", 
      label: "Giới tính", 
      type: "select", 
      sortable: true, 
      filterable: true, 
      filterType: "select", 
      options: [
        { label: "Nam", value: "MALE" }, 
        { label: "Nữ", value: "FEMALE" }
      ] 
    },
    { name: "address", label: "Địa chỉ", type: "textarea", maxLength: 1000, showCount: true },
    ...(auditableFieldsSchema as any[]).filter((field) => field.name !== "isActive"),
  ],
};

export const entityConfig: EntityConfig = { name: "Sinh viên", path: "/students", api: studentApi, schema: studentSchema };