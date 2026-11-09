import { useState } from "react";
import { Eye } from "lucide-react";
import { useProTable } from "@/components/datatable/hook/useProTable";
import { certificateApi, courseApi, userApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { ProTable } from "@/components/datatable/ProTable";
import type { EntitySchema, FieldSchema } from "@/types";
import { auditableFieldsSchema } from "@/types";
import ActionButton from "@/components/datatable/common/ActionButton";
import { DetailModal } from "@/components/datatable/modal/DetailModal";


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
    {
      name: "userId",
      label: "Student",
      hint: "Select the student who receives the certificate",
      type: "relation",
      sortable: false,
      visible: false,
      validation: {
        required: true,
        requiredMessage: "User is required",
      },
      relation: {
        api: userApi,
        valueField: "id",
        labelField: "email",
      },
    },
    {
      name: "courseId",
      label: "Course",
      hint: "Select the completed course",
      type: "relation",
      sortable: false,
      visible: false,
      validation: {
        required: true,
        requiredMessage: "Course is required",
      },
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

function AdminCertificatePage() {
  const table = useProTable(certificateApi, certificateSchema, {
    permissionOverrides: {
      canCreate: false,
      canUpdate: false,
      canDelete: false,
      canImport: false,
      canExport: true,
    },
  });

  const [selectedCertificate, setSelectedCertificate] =
    useState<any | null>(null);

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
          mode="default"
          renderRowActions={(row) => (
            <ActionButton
              onClick={() => setSelectedCertificate(row)}
              tooltip="View detail"
              icon={<Eye size={10} className="text-gray-500" />}
            />
          )}
        />

        <DetailModal
          open={!!selectedCertificate}
          onClose={(open) => {
            if (!open) setSelectedCertificate(null);
          }}
          schema={certificateSchema}
          row={selectedCertificate}
          relationOptions={table.relationOptions}
        />
      </div>
    </MainLayout>
  );
}