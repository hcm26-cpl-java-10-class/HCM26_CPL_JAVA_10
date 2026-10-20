import { certificateApi, courseApi, userApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePermissions } from "@/hooks/usePermissions";
import { AutoCrudPage } from "@/pages/management/AutoCrudPage";
import {
  auditableFieldsSchema,
  type EntityConfig,
  type EntitySchema,
  type FieldSchema,
} from "@/types";
import { useQuery } from "@tanstack/react-query";
import {
  Award,
  Calendar,
  CheckCircle,
  Download,
  Hash,
  Search,
  User,
} from "lucide-react";
import { useState } from "react";

// Hàm tiện ích ghép đầy đủ họ tên học viên từ các field của backend
export const getUserFullName = (item?: {
  userFirstName?: string;
  userLastName?: string;
  firstName?: string;
  lastName?: string;
  userName?: string;
  userId?: number | string;
}) => {
  if (!item) return "N/A";

  const firstName = item.userFirstName ?? item.firstName;
  const lastName = item.userLastName ?? item.lastName;

  // Ghép theo thứ tự Họ Tên (chuẩn Tiếng Việt: lastName + firstName) hoặc điều chỉnh nếu muốn
  const parts = [lastName, firstName].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(" ");
  }

  return item.userName || (item.userId ? `User #${item.userId}` : "N/A");
};

// 1. Cấu hình Schema: Chuẩn hóa theo CertificateDTO & Entity ở Backend
const certificateSchema: EntitySchema = {
  entityName: "certificate",
  idField: "id",
  fields: [
    {
      name: "certificateNumber",
      label: "Certificate Number",
      type: "text",
      sortable: true,
      bold: true,
    },
    // Hiển thị tên học viên trên bảng list AutoCrudPage
    {
      name: "userLastName",
      label: "Student Last Name",
      type: "text",
      sortable: true,
      editable: false,
    },
    {
      name: "userFirstName",
      label: "Student First Name",
      type: "text",
      sortable: true,
      editable: false,
    },
    // Form Select User khi tạo/sửa
    {
      name: "userId",
      label: "Student",
      type: "relation",
      sortable: false,
      visible: false,
      relation: {
        api: userApi,
        valueField: "id",
        labelField: "email",
      },
    },
    // Hiển thị tên khóa học trên bảng list
    {
      name: "courseName",
      label: "Course",
      type: "text",
      sortable: true,
      editable: false,
    },
    // Form Select Course khi tạo/sửa
    {
      name: "courseId",
      label: "Course",
      type: "relation",
      sortable: false,
      visible: false,
      relation: {
        api: courseApi,
        valueField: "id",
        labelField: "name",
      },
    },
    ...(auditableFieldsSchema as FieldSchema[]),
  ],
};

// 2. EntityConfig dùng cho AutoCrudPage (Dành cho Admin / Instructor)
export const entityConfig: EntityConfig = {
  name: "Certificates",
  path: "/certificates",
  api: certificateApi,
  schema: certificateSchema,
};

export default function CertificateManagementPage() {
  const { activeRole } = usePermissions();

  // Admin / Instructor quản lý chứng chỉ qua AutoCrudPage
  if (activeRole?.toUpperCase() !== "STUDENT") {
    return <AutoCrudPage entity={entityConfig} />;
  }

  // Học viên xem bảng danh sách các chứng chỉ đã đạt được
  return <StudentCertificateList />;
}

// 3. Giao diện chuyên biệt hiển thị Chứng chỉ đã nhận cho Student
function StudentCertificateList() {
  const [search, setSearch] = useState("");

  const certificatesQuery = useQuery({
    queryKey: ["student-certificates", search],
    queryFn: () =>
      certificateApi.getPage({ page: 0, size: 50 }, search.trim() || undefined),
  });

  const certificates =
    certificatesQuery.data?.content ?? certificatesQuery.data?.items ?? [];

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    return Number.isNaN(d.getTime()) ? dateStr : d.toLocaleDateString("vi-VN");
  };

  return (
    <MainLayout pathName={{ certificates: "My Certificates" }}>
      <div className="mx-auto w-full max-w-7xl space-y-8">
        {/* Banner Section */}
        <section className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-10 text-white sm:px-10 sm:py-14">
          <div className="pointer-events-none absolute -right-16 -top-24 size-80 rounded-full bg-amber-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 right-1/3 size-72 rounded-full bg-indigo-500/20 blur-3xl" />

          <div className="relative max-w-2xl">
            <Badge className="mb-5 border border-amber-400/30 bg-amber-400/10 text-amber-200 hover:bg-amber-400/10">
              ACADEMIC ACHIEVEMENTS
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
              Your Certificates & Degrees
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
              Verified certifications proving your skills and course completions.
            </p>
            <div className="mt-7 flex flex-wrap gap-4 text-sm text-slate-200">
              <span className="inline-flex items-center gap-2">
                <Award className="size-4 text-amber-400" /> {certificates.length} certificate(s) earned
              </span>
            </div>
          </div>
          <Award className="absolute bottom-8 right-10 hidden size-32 text-white/5 sm:block" />
        </section>

        {/* Content Section */}
        <section className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Earned Certificates</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                View details, verify credentials, or download your certificates.
              </p>
            </div>
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search certificates"
                className="pl-9"
                placeholder="Search by code, course..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {certificatesQuery.isLoading ? (
            <p role="status" className="rounded-2xl border p-8 text-center text-sm text-muted-foreground">
              Loading certificates...
            </p>
          ) : certificatesQuery.isError ? (
            <div role="alert" className="space-y-3 rounded-2xl border border-destructive/30 p-6">
              <p className="text-sm text-destructive">
                Could not load certificates. Please try again later.
              </p>
              <Button variant="outline" onClick={() => void certificatesQuery.refetch()}>
                Try again
              </Button>
            </div>
          ) : certificates.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-10 text-center">
              <CheckCircle className="mx-auto size-9 text-muted-foreground" />
              <h3 className="mt-3 font-semibold">No certificates found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {search
                  ? "No certificate matched your search keywords."
                  : "You haven't earned any certificates yet. Complete assessments to earn one!"}
              </p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {certificates.map((item: any) => (
                <article
                  key={item.id}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card p-6 shadow-sm transition-all hover:border-amber-500/50 hover:shadow-md"
                >
                  <div className="space-y-4">
                    {/* Header badge & Code */}
                    <div className="flex items-center justify-between gap-2 border-b pb-3">
                      <span className="flex items-center gap-1 font-mono text-xs font-semibold text-muted-foreground">
                        <Hash className="size-3.5 text-amber-500" />
                        {item.certificateNumber}
                      </span>
                      <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                        VERIFIED
                      </Badge>
                    </div>

                    {/* Course Title */}
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Course Certification
                      </p>
                      <h3 className="line-clamp-2 text-lg font-bold group-hover:text-amber-600 transition-colors">
                        {item.courseName || `Course #${item.courseId}`}
                      </h3>
                    </div>

                    {/* Recipient and Issue Date */}
                    <div className="space-y-2 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <User className="size-3.5 text-slate-500" />
                        <span>
                          Issued to: <strong className="text-foreground">{getUserFullName(item)}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="size-3.5 text-slate-500" />
                        <span>Issued on: {formatDate(item.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-6">
                    <Button
                      variant="outline"
                      className="w-full gap-2 border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400"
                      onClick={() => {
                        window.open(`/api/v1/certificates/${item.id}/download`, "_blank");
                      }}
                    >
                      <Download className="size-4" /> Download Certificate
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </MainLayout>
  );
}