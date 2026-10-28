import { studentApi } from "@/api/features/student.api";
import { auditableFieldsSchema, type EntityConfig, type EntitySchema, type FieldSchema } from "@/types";

const studentSchema: EntitySchema = {
  entityName: "student",
  idField: "id",
  fields: [
    { name: "studentCode", label: "Mã sinh viên", type: "text", sortable: true, filterable: true, filterType: "text", bold: true, required: true },
    { name: "firstName", label: "Họ", type: "text", sortable: true, filterable: true, filterType: "text", required: true },
    { name: "lastName", label: "Tên", type: "text", sortable: true, filterable: true, filterType: "text", required: true },
    { name: "email", label: "Email", type: "text", sortable: true, filterable: true, filterType: "text", required: true },
    { name: "phone", label: "Số điện thoại", type: "text", sortable: true, required: true },
    { name: "dateOfBirth", label: "Ngày sinh", type: "date", sortable: true, required: true },
    { name: "gender", label: "Giới tính", type: "select", sortable: true, filterable: true, filterType: "select", options: [{ label: "Nam", value: "MALE" }, { label: "Nữ", value: "FEMALE" }], filterOptions: [{ label: "Nam", value: "MALE" }, { label: "Nữ", value: "FEMALE" }], required: true },
    { name: "className", label: "Lớp", type: "text", sortable: true, filterable: true, filterType: "text", required: true },
    { name: "address", label: "Địa chỉ", type: "textarea", maxLength: 1000 },
    ...(auditableFieldsSchema as FieldSchema[]),
  ],
};

export const entityConfig: EntityConfig = { name: "Sinh viên", path: "/students", api: studentApi, schema: studentSchema };
