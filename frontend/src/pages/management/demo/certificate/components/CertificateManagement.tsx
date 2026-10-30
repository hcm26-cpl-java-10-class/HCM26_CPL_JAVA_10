// import { usePermissions } from "@/hooks/usePermissions";
import { useProTable } from "@/components/datatable/hook/useProTable";
import { certificateApi, courseApi, userApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { ProTable } from "@/components/datatable/ProTable";
import type { EntitySchema, FieldSchema } from "@/types";
import { auditableFieldsSchema } from "@/types";

// 1. Cấu hình Schema: Chuẩn hóa theo CertificateDTO & Entity ở Backend
  const certificateSchema: EntitySchema = {
    entityName: "certificate",
    idField: "id",
    fields: [
      {
        name: "userFullName",
        label: "Student",
        type: "text",
        sortable: true,
        editable: false,
      },
      // Hiển thị tên khóa học trên bảng list
      {
        name: "courseName",
        label: "Course",
        type: "text",
        sortable: true,
        editable: false,
      },
      {
        name: "issuedAt",
        label: "Issue Date",
        type: "text",
        sortable: true,
        editable: false,
      },
      // Form Select User khi tạo/sửa
      {
        name: "userId",
        label: "Student",
        hint: "Select the student who receives the certificate",
        type: "relation",
        sortable: false,
        visible: false,
        validation: { required: true, requiredMessage: "User is required" },
        relation: {
          api: userApi,
          valueField: "id",
          labelField: "email",
        },
      },
      // Form Select Course khi tạo/sửa
      {
        name: "courseId",
        label: "Course",
        hint: "Select the completed course",
        type: "relation",
        sortable: false,
        visible: false,
        validation: { required: true, requiredMessage: "Course is required" },
        relation: {
          api: courseApi,
          valueField: "id",
          labelField: "name",
        },
      },
      ...(auditableFieldsSchema as FieldSchema[]),
    ],
  };

export default function CertificateManagement() {
  return <AdminCertificatePage />;
}

// Trang quản lý chứng chỉ dành cho Admin: chỉ xem danh sách.
function AdminCertificatePage() {
    
  const table = useProTable(certificateApi, certificateSchema);

  return (
    <MainLayout pathName={{ certificates: "Certificates" }}>
      <div className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-7xl flex-col space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Certificate Management
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            View certificates automatically issued to students.
          </p>
        </div>

        <ProTable
          table={table}
          mode="browse"
          hideActions          
        />
      </div>
    </MainLayout>
  );
}