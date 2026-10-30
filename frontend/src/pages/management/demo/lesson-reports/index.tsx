import { lessonReportApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { lessonReportReasonLabel } from "@/pages/management/demo/lesson/components/lessonReportReasons";
import { usePermissions } from "@/hooks/usePermissions";
import type { LessonReportInbox, LessonReportStatus } from "@/types";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Clock, Flag, User } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const PAGE_SIZE = 10;

type StatusFilter = LessonReportStatus | "ALL";

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "OPEN", label: "Open" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "ALL", label: "All" },
];

function formatWhen(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

/** Opens the curriculum page on the reported lesson. */
function lessonLink(report: LessonReportInbox): string {
  const params = new URLSearchParams({
    courseId: String(report.courseId),
    sectionId: String(report.sectionId),
    lessonId: String(report.lessonId),
  });
  return `/curriculum?${params.toString()}`;
}

function errorMessage(error: any, fallback: string): string {
  return error?.response?.data?.message || fallback;
}

export default function LessonReportsPage() {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canResolve = hasPermission("LESSON_REPORT_UPDATE");

  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<StatusFilter>("OPEN");
  const status = filter === "ALL" ? undefined : filter;

  useEffect(() => {
    setPage(0);
  }, [filter]);

  const listQuery = useQuery({
    queryKey: ["lesson-reports", { page, status }],
    queryFn: () => lessonReportApi.listInbox({ page, size: PAGE_SIZE, status }),
    placeholderData: keepPreviousData,
  });

  const openCountQuery = useQuery({
    queryKey: ["lesson-reports", "open-count"],
    queryFn: () => lessonReportApi.listInbox({ page: 0, size: 1, status: "OPEN" }),
  });
  const openCount = openCountQuery.data?.totalElements ?? 0;

  const resolveMutation = useMutation({
    mutationFn: (reportId: number) => lessonReportApi.resolve(reportId),
    onSuccess: () => {
      toast.success("Report marked as resolved");
      void queryClient.invalidateQueries({ queryKey: ["lesson-reports"] });
    },
    onError: (error) => toast.error(errorMessage(error, "Could not update the report")),
  });

  const reports = listQuery.data?.content ?? [];
  const totalElements = listQuery.data?.totalElements ?? 0;
  const totalPages = listQuery.data?.totalPages ?? 0;

  return (
    <MainLayout pathName={{ "lesson-reports": "Lesson Reports" }}>
      <section className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-blue-700">Reports</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Lesson reports</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Problems students reported in the courses you teach. The newest come first.
            </p>
          </div>
          {!openCountQuery.isLoading && (
            <Badge variant={openCount > 0 ? "default" : "secondary"} className="text-sm">
              {openCount} open
            </Badge>
          )}
        </div>

        <div className="flex gap-2" role="group" aria-label="Filter by status">
          {FILTERS.map((item) => (
            <Button
              key={item.value}
              type="button"
              size="sm"
              variant={filter === item.value ? "default" : "outline"}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>

        {listQuery.isLoading ? (
          <p role="status" className="rounded-xl border p-10 text-center text-sm text-muted-foreground">
            Loading reports...
          </p>
        ) : listQuery.isError ? (
          <div role="alert" className="space-y-3 rounded-xl border border-destructive/30 p-6">
            <p className="text-sm text-destructive">Could not load lesson reports.</p>
            <Button variant="outline" onClick={() => void listQuery.refetch()}>
              Try again
            </Button>
          </div>
        ) : reports.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-12 text-center">
            <CheckCircle2 className="mx-auto size-12 text-muted-foreground" />
            <h2 className="mt-4 text-lg font-semibold">
              {filter === "OPEN" ? "All caught up" : "No reports here"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {filter === "OPEN"
                ? "No lesson report is waiting for you."
                : "Try a different status filter."}
            </p>
          </div>
        ) : (
          <ul className="space-y-3" aria-busy={listQuery.isPlaceholderData}>
            {reports.map((report) => (
              <li key={report.id} className="rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">{report.courseName}</Badge>
                  <span className="min-w-0 truncate">
                    {report.sectionTitle} &rsaquo; {report.lessonTitle}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant={report.status === "OPEN" ? "default" : "outline"}>
                    <Flag className="size-3" /> {lessonReportReasonLabel(report.reason)}
                  </Badge>
                  {report.status === "RESOLVED" && <Badge variant="secondary">Resolved</Badge>}
                </div>

                {report.detail && (
                  <p className="mt-2 whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">
                    {report.detail}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <User className="size-3.5" />
                      {report.reporterName}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3.5" />
                      {formatWhen(report.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button asChild variant="ghost" size="sm">
                      <Link to={lessonLink(report)}>
                        View lesson <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                    {canResolve && report.status === "OPEN" && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={resolveMutation.isPending}
                        onClick={() => resolveMutation.mutate(report.id)}
                      >
                        <CheckCircle2 className="size-4" /> Mark resolved
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              Page {page + 1} of {totalPages} &middot; {totalElements} report
              {totalElements === 1 ? "" : "s"}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </section>
    </MainLayout>
  );
}
