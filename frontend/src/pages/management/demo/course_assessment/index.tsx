import { assessmentApi, courseApi } from "@/api";
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
import { CalendarClock, CheckCircle, Clock, FileQuestion, HelpCircle, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

// 1. Cấu hình Schema: AutoCrudPage sẽ tự động tạo bảng, form Create, Edit, Detail từ đây
const assessmentSchema: EntitySchema = {
  entityName: "assessment",
  idField: "id",
  fields: [
    {
      name: "name",
      label: "Assessment Name",
      type: "text",
      sortable: true,
      bold: true,
    },
    {
      name: "courseName",
      label: "Course",
      type: "text",
      sortable: true,
      editable: false,
    },
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
    {
      name: "type",
      label: "Type",
      type: "select",
      sortable: true,
      options: [
        { label: "Quiz", value: "QUIZ" },
        { label: "Assignment", value: "ASSIGNMENT" },
        { label: "Exam", value: "EXAM" },
      ],
    },
    {
      name: "timeLimit",
      label: "Time Limit (mins)",
      type: "number",
      sortable: true,
      visible: false,
    },
    {
      name: "maxAttempt",
      label: "Max Attempts",
      type: "number",
      sortable: true,
      visible: false,
    },
    {
      name: "dueAt",
      label: "Due Date",
      type: "datetime-local",
      sortable: true,
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      sortable: false,
      visible: false,
    },
    ...(auditableFieldsSchema as FieldSchema[]),
  ],
};

// 2. EntityConfig chuẩn dùng trực tiếp với AutoCrudPage (không cần custom actionPages)
export const entityConfig: EntityConfig = {
  name: "Assessments",
  path: "/assessments",
  api: assessmentApi,
  schema: assessmentSchema,
};

export default function AssessmentManagementPage() {
  const { activeRole } = usePermissions();

  // Admin / Instructor dùng CRUD tự động tạo bởi schema
  if (activeRole?.toUpperCase() !== "STUDENT") {
    return <AutoCrudPage entity={entityConfig} />;
  }

  // Học viên xem giao diện làm bài / danh sách bài thi
  return <StudentAssessmentList />;
}

// 3. Giao diện chuyên biệt dành cho Student
function StudentAssessmentList() {
  const [search, setSearch] = useState("");

  const assessmentsQuery = useQuery({
    queryKey: ["student-assessments", search],
    queryFn: () =>
      assessmentApi.getPage({ page: 0, size: 100 }, search.trim() || undefined),
  });

  const assessments =
    assessmentsQuery.data?.content ?? assessmentsQuery.data?.items ?? [];

  const formatDueDate = (dateStr?: string) => {
    if (!dateStr) return "No due date";
    const d = new Date(dateStr);
    return Number.isNaN(d.getTime()) ? dateStr : d.toLocaleDateString("vi-VN");
  };

  return (
    <MainLayout pathName={{ assessments: "Assessments" }}>
      <div className="mx-auto w-full max-w-7xl space-y-8">
        {/* Banner Section */}
        <section className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-10 text-white sm:px-10 sm:py-14">
          <div className="pointer-events-none absolute -right-16 -top-24 size-80 rounded-full bg-indigo-500/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 right-1/3 size-72 rounded-full bg-cyan-500/20 blur-3xl" />

          <div className="relative max-w-2xl">
            <Badge className="mb-5 border border-white/20 bg-white/10 text-blue-100 hover:bg-white/10">
              EVALUATE & PRACTICE
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
              Test your knowledge.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
              Complete quizzes and assignments to evaluate your learning progress.
            </p>
            <div className="mt-7 flex flex-wrap gap-4 text-sm text-slate-200">
              <span className="inline-flex items-center gap-2">
                <FileQuestion className="size-4" /> {assessments.length} available
              </span>
            </div>
          </div>
          <HelpCircle className="absolute bottom-8 right-10 hidden size-32 text-white/10 sm:block" />
        </section>

        {/* Content Section */}
        <section className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Your assessments</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Select an assessment to start or review your results.
              </p>
            </div>
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search assessments"
                className="pl-9"
                placeholder="Search assessments..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {assessmentsQuery.isLoading ? (
            <p role="status" className="rounded-2xl border p-8 text-center text-sm text-muted-foreground">
              Loading assessments...
            </p>
          ) : assessmentsQuery.isError ? (
            <div role="alert" className="space-y-3 rounded-2xl border border-destructive/30 p-6">
              <p className="text-sm text-destructive">
                Could not load assessments. Please try again later.
              </p>
              <Button variant="outline" onClick={() => void assessmentsQuery.refetch()}>
                Try again
              </Button>
            </div>
          ) : assessments.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-10 text-center">
              <CheckCircle className="mx-auto size-9 text-muted-foreground" />
              <h3 className="mt-3 font-semibold">No assessments found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {search ? "Try searching with a different keyword." : "You have no pending assessments."}
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {assessments.map((item) => (
                <article
                  key={item.id}
                  className="flex flex-col justify-between overflow-hidden rounded-2xl border bg-card p-6 shadow-sm transition-all hover:shadow-md"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="secondary" className="font-semibold uppercase tracking-wider text-[11px]">
                        {item.type || "QUIZ"}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarClock className="size-3.5" /> Due: {formatDueDate(item.dueAt)}
                      </span>
                    </div>

                    <div>
                      <h3 className="line-clamp-1 text-lg font-semibold">{item.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {item.courseName ? `Course: ${item.courseName}` : `Course #${item.courseId}`}
                      </p>
                    </div>

                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {item.description || "No description provided."}
                    </p>

                    <div className="flex flex-wrap gap-3 pt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3.5" />
                        {item.timeLimit ? `${item.timeLimit} mins` : "No limit"}
                      </span>
                      <span>•</span>
                      <span>Max attempts: {item.maxAttempt ?? "Unlimited"}</span>
                    </div>
                  </div>

                  <div className="pt-5">
                    <Button asChild className="w-full">
                      <Link to={`/assessments/${item.id}/take`}>Start Assessment</Link>
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