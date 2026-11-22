import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { courseAnalyticsApi } from "@/api/features/demo/course-analytics.api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AnalyticsEmptyState } from "@/pages/management/demo/analytics/components/AnalyticsEmptyState";
import { AnalyticsLoading } from "@/pages/management/demo/analytics/components/AnalyticsLoading";
import { AnalyticsPanel } from "@/pages/management/demo/analytics/components/AnalyticsPanel";
import {
  formatDateTime,
  formatNumber,
} from "@/pages/management/demo/analytics/lib/chart-helpers";
import type { TopLearnerItem, TopLearnerSortBy } from "@/types";

type Props = {
  courseId?: number;
};

const LIMIT_PRESETS = [10, 50, 100];
const SYSTEM_SCOPE = "ALL";

const SORT_OPTIONS: { value: TopLearnerSortBy; label: string }[] = [
  { value: "STUDY_TIME", label: "Study time" },
  { value: "LESSONS_COMPLETED", label: "Lessons completed" },
];

/** Most diligent learners, per department and across the whole system. */
export function TopLearnersPanel({ courseId: selectedCourseId }: Props) {
  // Admins can switch from the selected course to the whole system.
  const [systemWide, setSystemWide] = useState(selectedCourseId == null);
  const courseId = systemWide ? undefined : selectedCourseId;
  const [limit, setLimit] = useState(10);
  const [sortBy, setSortBy] = useState<TopLearnerSortBy>("STUDY_TIME");
  const [scope, setScope] = useState<string>(SYSTEM_SCOPE);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["course-analytics", "top-learners", courseId ?? null, limit, sortBy],
    retry: false,
    placeholderData: keepPreviousData,
    queryFn: () => courseAnalyticsApi.getTopLearners({ courseId, limit, sortBy }),
  });

  if (isLoading) {
    return <AnalyticsLoading label="Loading the learner ranking..." />;
  }
  if (isError || !data) {
    const forbidden =
      (error as { response?: { status?: number } } | null)?.response?.status === 403;
    return (
      <AnalyticsPanel
        title="Most diligent learners"
        action={
          selectedCourseId != null && systemWide ? (
            <button
              type="button"
              className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
              onClick={() => setSystemWide(false)}
            >
              Back to this course
            </button>
          ) : undefined
        }
      >
        <AnalyticsEmptyState
          variant="error"
          message={
            forbidden
              ? "You do not have access to this ranking. Only administrators can view the whole system."
              : "Could not load the learner ranking."
          }
        />
      </AnalyticsPanel>
    );
  }

  const department =
    scope === SYSTEM_SCOPE
      ? undefined
      : data.departments.find((item) => String(item.departmentId) === scope);
  const rows: TopLearnerItem[] = department
    ? department.topLearners
    : data.systemTopLearners;
  const title = department
    ? `Top ${limit} learners - ${department.departmentName}`
    : `Top ${limit} learners - ${courseId ? data.courseName : "whole system"}`;

  return (
    <AnalyticsPanel
      title={title}
      description={
        department
          ? `${formatNumber(department.learnerCount)} learners in this department, ${formatNumber(
              department.activeLearnerCount,
            )} with learning activity, ${formatNumber(
              Math.round(department.totalStudyHours * 10) / 10,
            )} h in total.`
          : `Ranked by ${
              sortBy === "STUDY_TIME" ? "study time" : "lessons completed"
            } across ${formatNumber(data.totalLearners)} learners. Learners without any activity are not ranked.`
      }
      action={
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {selectedCourseId != null ? (
            <div className="flex gap-1">
              {[
                { value: false, label: "This course" },
                { value: true, label: "Whole system" },
              ].map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => {
                    setSystemWide(option.value);
                    setScope(SYSTEM_SCOPE);
                  }}
                  className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                    systemWide === option.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background hover:bg-muted"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
          <select
            aria-label="Department"
            value={scope}
            onChange={(event) => setScope(event.target.value)}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            <option value={SYSTEM_SCOPE}>All departments</option>
            {data.departments.map((item) => (
              <option key={item.departmentId} value={String(item.departmentId)}>
                {item.departmentName} ({item.learnerCount})
              </option>
            ))}
          </select>
          <select
            aria-label="Ranking criteria"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as TopLearnerSortBy)}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="flex gap-1">
            {LIMIT_PRESETS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setLimit(value)}
                className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                  limit === value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted"
                }`}
              >
                Top {value}
              </button>
            ))}
          </div>
        </div>
      }
    >
      {!rows.length ? (
        <AnalyticsEmptyState message="No learner with learning activity yet." />
      ) : (
        <div className="max-h-[560px] overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">Rank</TableHead>
                <TableHead>Learner</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Study time</TableHead>
                <TableHead className="text-right">Lessons completed</TableHead>
                <TableHead className="text-right">Courses (done / enrolled)</TableHead>
                <TableHead>Last access</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((learner) => (
                <TableRow key={learner.userId}>
                  <TableCell className="font-semibold">
                    {learner.rank <= 3 ? ["🥇", "🥈", "🥉"][learner.rank - 1] : learner.rank}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{learner.studentName}</div>
                    <div className="text-xs text-muted-foreground">{learner.studentEmail}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {learner.departmentName ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatNumber(Math.round(learner.studyHours * 10) / 10)} h
                  </TableCell>
                  <TableCell className="text-right">{formatNumber(learner.lessonsCompleted)}</TableCell>
                  <TableCell className="text-right">
                    {learner.coursesCompleted} / {learner.coursesEnrolled}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(learner.lastAccessedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AnalyticsPanel>
  );
}
