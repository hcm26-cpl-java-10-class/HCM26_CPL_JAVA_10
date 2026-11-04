import { certificateApi, courseApi, userApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePermissions } from "@/hooks/usePermissions";
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
  Search,
} from "lucide-react";
import { useState } from "react";
import CertificateManagement from "./components/CertificateManagement";

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
    return <CertificateManagement />
  }

  // Học viên xem bảng danh sách các chứng chỉ đã đạt được
  return <StudentCertificateList />;
}

// 3. Giao diện chuyên biệt hiển thị Chứng chỉ đã nhận cho Student
function StudentCertificateList() {
  const [search, setSearch] = useState("");

  const certificatesQuery = useQuery({
    queryKey: ["student-certificates", search],
    queryFn: () => certificateApi.getMyCertificates(),
  });

  const certificates = certificatesQuery.data ?? [];

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
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-300 hover:shadow-xl dark:border-slate-800 dark:bg-card"
                >
                  {/* Certificate Preview */}
                  <div className="relative overflow-hidden bg-linear-to-br from-slate-50 via-white to-blue-50 p-5 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/40">
                    {/* Decorative elements */}
                    <div className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full border border-blue-200/70 dark:border-blue-800/50" />
                    <div className="pointer-events-none absolute -right-6 -top-6 size-28 rounded-full border border-blue-200/70 dark:border-blue-800/50" />

                    <div className="relative rounded-xl border border-blue-200/80 bg-white/90 p-5 shadow-sm dark:border-blue-900 dark:bg-slate-950/80">
                      {/* Brand and badge */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-700 text-sm font-bold text-white">
                            RB
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                              RBAC System
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400">
                              Online Learning Platform
                            </p>
                          </div>
                        </div>

                        <Badge
                          variant="outline"
                          className="shrink-0 gap-1 border-emerald-200 bg-emerald-50 text-[10px] font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-400"
                        >
                          <CheckCircle className="size-3" />
                          Completed
                        </Badge>
                      </div>

                      {/* Certificate title */}
                      <div className="mt-7 space-y-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-400">
                          Certificate of Completion
                        </p>

                        <h3 className="line-clamp-2 min-h-14 text-xl font-bold leading-7 tracking-tight text-slate-900 transition-colors group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-400">
                          {item.courseName || `Course #${item.courseId}`}
                        </h3>

                        <div className="h-1 w-12 rounded-full bg-blue-600" />
                      </div>

                      {/* Recipient */}
                      <div className="mt-5">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Awarded to
                        </p>
                        <p className="mt-1 line-clamp-2 wrap-break-word text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {item.userFullName}
                        </p>
                      </div>

                      {/* Issue date */}
                      <div className="mt-5 flex items-center gap-2 border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                        <Calendar className="size-4 shrink-0 text-blue-600 dark:text-blue-400" />
                        <span>
                          Issued on: {formatDate(item.issuedAt || item.createdAt)}
                        </span>
                      </div>

                      {/* Bottom decoration */}
                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-[10px] font-medium uppercase tracking-widest text-slate-400">
                          Academic Achievement
                        </span>
                        <Award className="size-6 text-blue-200 dark:text-blue-800" />
                      </div>
                    </div>
                  </div>

                  {/* Card footer */}
                  <div className="p-5 pt-3">
                    <Button
                      className="mt-5 w-full gap-2 bg-blue-700 text-white transition-colors hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                      onClick={() => {
                        if (item.verificationToken) {
                          window.location.href =
                            `/my-certificates/${encodeURIComponent(item.verificationToken)}`;
                        }
                      }}
                    >
                      <Award className="size-4" />
                      View Certificate
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
