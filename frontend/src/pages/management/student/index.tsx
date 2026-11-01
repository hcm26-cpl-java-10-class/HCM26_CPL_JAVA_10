import { studentApi } from "@/api/features/rbac/student.api";
import { auditableFieldsSchema, type EntityConfig, type EntitySchema } from "@/types";

const studentSchema: EntitySchema = {
  entityName: "student",
  idField: "id",
  fields: [
    { name: "studentCode", label: "Mã sinh viên", type: "text", sortable: true, filterable: true, filterType: "text", bold: true },
    { name: "firstName", label: "Họ", type: "text", sortable: true, filterable: true, filterType: "text" },
    { name: "lastName", label: "Tên", type: "text", sortable: true, filterable: true, filterType: "text" },
    { name: "phone", label: "Số điện thoại", type: "text", sortable: true },
    { name: "dateOfBirth", label: "Ngày sinh", type: "date", sortable: true },
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
    { name: "address", label: "Địa chỉ", type: "textarea" },
    ...(auditableFieldsSchema as any[]).filter((field) => field.name !== "isActive"),
  ],
};

export const entityConfig: EntityConfig = { name: "Sinh viên", path: "/students", api: studentApi, schema: studentSchema };