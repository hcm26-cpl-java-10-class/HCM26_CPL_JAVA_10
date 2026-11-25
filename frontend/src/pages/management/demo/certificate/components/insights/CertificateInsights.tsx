import { formatDateNow, formatNumberNow } from "@/i18n/format";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  Award,
  BookOpen,
  Building2,
  Users,
  X,
} from "lucide-react";

import { certificateInsightsApi } from "@/api/features/demo/certificate-insights.api";

import type {
  CertificateInsightCell,
  CertificateInsightCellDetail,
} from "@/types/features/demo/certificate-insights";

type Selection = {
  departmentId: number;
  categoryId: number;
};

function formatNumber(value: number) {
  return formatNumberNow(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1).replace(/\.0$/, "")}%`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : formatDateNow(date);
}

/*
 * Màu chỉ thể hiện tỷ lệ sở hữu chứng chỉ,
 * không phải đánh giá phòng ban đạt hay không đạt.
 */
function coverageClass(coverage: number) {
  if (coverage >= 70) {
    return [
      "border-emerald-200 bg-emerald-100 text-emerald-900",
      "hover:bg-emerald-200",
      "dark:border-emerald-900 dark:bg-emerald-950/70",
      "dark:text-emerald-100",
    ].join(" ");
  }

  if (coverage >= 40) {
    return [
      "border-sky-200 bg-sky-100 text-sky-900",
      "hover:bg-sky-200",
      "dark:border-sky-900 dark:bg-sky-950/70",
      "dark:text-sky-100",
    ].join(" ");
  }

  return [
    "border-slate-200 bg-slate-100 text-slate-800",
    "hover:bg-slate-200",
    "dark:border-slate-700 dark:bg-slate-800",
    "dark:text-slate-100",
  ].join(" ");
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {label}
        </p>

        <span className="text-muted-foreground">
          {icon}
        </span>
      </div>

      <p className="mt-2 text-2xl font-semibold tracking-tight">
        {value}
      </p>
    </div>
  );
}

export default function CertificateInsights() {

  const [departmentFilter, setDepartmentFilter] =
    useState("all");

  const [skillFilter, setSkillFilter] =
    useState("all");

  const [selection, setSelection] =
    useState<Selection | null>(null);

  // Overview API
  const overviewQuery = useQuery({
    queryKey: ["certificate-insights", "overview"],
    queryFn: certificateInsightsApi.getOverview,
    staleTime: 60_000,
  });

  // Heatmap API
  const heatmapQuery = useQuery({
    queryKey: ["certificate-insights", "heatmap"],
    queryFn: certificateInsightsApi.getHeatmap,
    staleTime: 60_000,
  });

  const heatmap = heatmapQuery.data;

  // Filter departments
  const filteredDepartments = useMemo(
    () =>
      (heatmap?.departments ?? []).filter(
        (department) =>
          departmentFilter === "all" ||
          String(department.departmentId) === departmentFilter
      ),
    [heatmap?.departments, departmentFilter]
  );

  // Filter skill groups
  const filteredSkills = useMemo(
    () =>
      (heatmap?.skills ?? []).filter(
        (skill) =>
          skillFilter === "all" ||
          String(skill.categoryId) === skillFilter
      ),
    [heatmap?.skills, skillFilter]
  );

  // Build map for fast cell lookup.
  const cellMap = useMemo(() => {

    const map = new Map<string, CertificateInsightCell>();

    for (const cell of heatmap?.cells ?? []) {
      map.set(
        `${cell.departmentId}:${cell.categoryId}`,
        cell
      );
    }

    return map;

  }, [heatmap?.cells]);

  // Load detail after selecting a populated cell.
  const detailQuery = useQuery<CertificateInsightCellDetail>({
    queryKey: [
      "certificate-insights",
      "cell",
      selection?.departmentId,
      selection?.categoryId,
    ],

    queryFn: () =>
      certificateInsightsApi.getCellDetail(
        selection!.departmentId,
        selection!.categoryId
      ),

    enabled: selection !== null,
    staleTime: 60_000,
  });

  const overview = overviewQuery.data;

  const hasData = (heatmap?.cells.length ?? 0) > 0;

  return (
    <div className="space-y-5">

      {/* OVERVIEW */}
      <section>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

          <MetricCard
            label="Certificates issued"
            value={formatNumber(
              overview?.totalCertificates ?? 0
            )}
            icon={<Award className="size-5" />}
          />

          <MetricCard
            label="Certified learners"
            value={formatNumber(
              overview?.uniqueLearners ?? 0
            )}
            icon={<Users className="size-5" />}
          />

          <MetricCard
            label="Courses represented"
            value={formatNumber(
              overview?.uniqueCourses ?? 0
            )}
            icon={<BookOpen className="size-5" />}
          />

          <MetricCard
            label="Departments represented"
            value={formatNumber(
              heatmap?.departments.length ?? 0
            )}
            icon={<Building2 className="size-5" />}
          />

        </div>
      </section>

      {/* COMPETENCY HEATMAP */}
      <section className="space-y-4 rounded-xl border bg-card p-4 shadow-sm sm:p-5">

        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">

          <div>
            <h2 className="text-lg font-semibold">
              Skill Certification Overview
            </h2>

            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Overview of certificate ownership across departments
              and skill groups. Only combinations with existing
              certificates are displayed.
            </p>
          </div>

          {/* FILTERS */}
          <div className="flex flex-col gap-2 sm:flex-row">

            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">
                Department
              </span>

              <select
                className="h-9 min-w-44 rounded-md border bg-background px-3"
                value={departmentFilter}
                onChange={(event) =>
                  setDepartmentFilter(event.target.value)
                }
              >
                <option value="all">
                  All departments
                </option>

                {(heatmap?.departments ?? []).map(
                  (department) => (
                    <option
                      key={department.departmentId}
                      value={department.departmentId}
                    >
                      {department.departmentName}
                    </option>
                  )
                )}
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">
                Skill group
              </span>

              <select
                className="h-9 min-w-44 rounded-md border bg-background px-3"
                value={skillFilter}
                onChange={(event) =>
                  setSkillFilter(event.target.value)
                }
              >
                <option value="all">
                  All skill groups
                </option>

                {(heatmap?.skills ?? []).map((skill) => (
                  <option
                    key={skill.categoryId}
                    value={skill.categoryId}
                  >
                    {skill.skillName}
                  </option>
                ))}
              </select>
            </label>

          </div>
        </div>

        {/* LEGEND */}
        <div className="flex flex-wrap items-center justify-between gap-3">

          <p className="text-xs text-muted-foreground">
            Each cell shows certified employees / total department
            employees and certificate coverage.
          </p>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Coverage</span>

            <span className="rounded border border-slate-200 bg-slate-100 px-2 py-1 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
              Lower
            </span>

            <span className="rounded border border-sky-200 bg-sky-100 px-2 py-1 text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-100">
              Medium
            </span>

            <span className="rounded border border-emerald-200 bg-emerald-100 px-2 py-1 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
              Higher
            </span>
          </div>

        </div>

        {/* LOADING */}
        {heatmapQuery.isPending ? (

          <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            Loading competency data...
          </div>

        ) : heatmapQuery.isError ? (

          <div className="rounded-lg border border-destructive/30 p-5 text-sm text-destructive">
            Could not load competency heatmap.

            <button
              type="button"
              className="ml-2 underline"
              onClick={() => void heatmapQuery.refetch()}
            >
              Retry
            </button>
          </div>

        ) : !hasData ? (

          <div className="rounded-lg border border-dashed p-10 text-center">
            <Award className="mx-auto size-8 text-muted-foreground" />

            <p className="mt-3 font-medium">
              No certificate coverage data
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              The heatmap will display department and skill groups
              after certificates have been issued.
            </p>
          </div>

        ) : filteredDepartments.length === 0 ||
          filteredSkills.length === 0 ? (

          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No data matches the selected filters.
          </div>

        ) : (

          /* HEATMAP TABLE */
          <div className="overflow-x-auto rounded-lg border">

            <table className="w-full min-w-190 border-collapse text-sm">

              <thead className="sticky top-0 z-10 bg-muted/80">
                <tr>

                  <th className="sticky left-0 z-20 min-w-48 border-b border-r bg-muted px-3 py-3 text-left font-semibold">
                    Department
                  </th>

                  {filteredSkills.map((skill) => (
                    <th
                      key={skill.categoryId}
                      className="min-w-36 border-b px-3 py-3 text-center font-semibold"
                    >
                      <span title={skill.skillCode}>
                        {skill.skillName}
                      </span>
                    </th>
                  ))}

                </tr>
              </thead>

              <tbody>

                {filteredDepartments.map((department) => (

                  <tr
                    key={department.departmentId}
                    className="border-b last:border-b-0"
                  >

                    <th className="sticky left-0 z-1 border-r bg-card px-3 py-3 text-left font-medium">

                      <div>
                        {department.departmentName}
                      </div>

                      <div className="mt-0.5 text-xs font-normal text-muted-foreground">
                        {formatNumber(department.totalEmployees)} employees
                      </div>

                    </th>

                    {filteredSkills.map((skill) => {

                      const cell = cellMap.get(
                        `${department.departmentId}:${skill.categoryId}`
                      );

                      return (

                        <td
                          key={skill.categoryId}
                          className="h-20 border-l px-2 py-2 text-center"
                        >

                          {/* 
                            Không có cell thì không hiển thị
                            button, số 0 hay phần trăm 0%.
                          */}
                          {cell && (

                            <button
                              type="button"
                              title={`${cell.skillName}: ${cell.certifiedEmployees}/${cell.totalEmployees} employees; ${formatPercent(cell.coveragePercentage)}; ${cell.certificateCount} certificates`}
                              onClick={() =>
                                setSelection({
                                  departmentId: cell.departmentId,
                                  categoryId: cell.categoryId,
                                })
                              }
                              className={[
                                "mx-auto flex min-h-14 w-full max-w-36",
                                "flex-col items-center justify-center",
                                "rounded-lg border px-2 py-2 transition",
                                "focus-visible:outline-none",
                                "focus-visible:ring-2 focus-visible:ring-ring",
                                coverageClass(cell.coveragePercentage),

                                selection?.departmentId === cell.departmentId &&
                                selection?.categoryId === cell.categoryId
                                  ? "ring-2 ring-primary ring-offset-2"
                                  : "",
                              ].join(" ")}
                            >

                              <span className="font-semibold tabular-nums">
                                {cell.certifiedEmployees}/
                                {cell.totalEmployees}
                              </span>

                              <span className="text-xs tabular-nums opacity-80">
                                {formatPercent(cell.coveragePercentage)}
                              </span>

                            </button>

                          )}

                        </td>

                      );
                    })}

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        )}

      </section>

      {/* SELECTED CELL DETAILS */}
      {selection && (

        <section className="space-y-4 rounded-xl border bg-card p-4 shadow-sm sm:p-5">

          <div className="flex items-start justify-between gap-3">

            <div>
              <h2 className="text-lg font-semibold">
                Department Skill Details
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Details for the selected department and skill group.
              </p>
            </div>

            <button
              type="button"
              aria-label="Close certificate details"
              className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => setSelection(null)}
            >
              <X className="size-4" />
            </button>

          </div>

          {detailQuery.isPending ? (

            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Loading details...
            </p>

          ) : detailQuery.isError ? (

            <p className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
              Could not load details for this heatmap cell.

              <button
                type="button"
                className="ml-2 underline"
                onClick={() => void detailQuery.refetch()}
              >
                Retry
              </button>
            </p>

          ) : detailQuery.data ? (

            <CellDetails detail={detailQuery.data} />

          ) : null}

        </section>

      )}

    </div>
  );
}

/*
 * Chi tiết một cặp Department × Skill.
 */
function CellDetails({
  detail,
}: {
  detail: CertificateInsightCellDetail;
}) {

  const { summary, courses, learners } = detail;

  return (

    <div className="space-y-5">

      <div className="flex flex-wrap items-center gap-2">

        <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium">
          {summary.departmentName}
        </span>

        <span className="text-muted-foreground">
          /
        </span>

        <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium">
          {summary.skillName}
        </span>

      </div>

      {/* STATISTICS */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

        <MetricCard
          label="Department employees"
          value={formatNumber(summary.totalEmployees)}
          icon={<Users className="size-5" />}
        />

        <MetricCard
          label="Certified employees"
          value={formatNumber(summary.certifiedEmployees)}
          icon={<Award className="size-5" />}
        />

        <MetricCard
          label="Certificates issued"
          value={formatNumber(summary.certificateCount)}
          icon={<BookOpen className="size-5" />}
        />

        <MetricCard
          label="Certificate coverage"
          value={formatPercent(summary.coveragePercentage)}
          icon={<Building2 className="size-5" />}
        />

      </div>

      <div className="grid gap-5 xl:grid-cols-2">

        {/* COURSES */}
        <div className="min-w-0">

          <div className="mb-2 flex items-center justify-between gap-2">

            <h3 className="font-semibold">
              Courses represented
            </h3>

            <span className="text-xs text-muted-foreground">
              {courses.length} course(s)
            </span>

          </div>

          {courses.length === 0 ? (

            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No course details available.
            </p>

          ) : (

            <div className="overflow-x-auto rounded-lg border">

              <table className="w-full text-sm">

                <thead className="bg-muted/70">
                  <tr>

                    <th className="px-3 py-2 text-left font-medium">
                      Course
                    </th>

                    <th className="px-3 py-2 text-right font-medium">
                      Learners
                    </th>

                    <th className="px-3 py-2 text-right font-medium">
                      Certificates
                    </th>

                  </tr>
                </thead>

                <tbody>

                  {courses.map((course) => (

                    <tr
                      key={course.courseId}
                      className="border-t"
                    >

                      <td className="px-3 py-2 font-medium">
                        {course.courseName}
                      </td>

                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatNumber(course.certifiedLearners)}
                      </td>

                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatNumber(course.certificateCount)}
                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          )}

        </div>

        {/* CERTIFIED EMPLOYEES */}
        <div className="min-w-0">

          <div className="mb-2 flex items-center justify-between gap-2">

            <h3 className="font-semibold">
              Certified employees
            </h3>

            <span className="text-xs text-muted-foreground">
              {learners.length} employee(s)
            </span>

          </div>

          {learners.length === 0 ? (

            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No learner details available.
            </p>

          ) : (

            <div className="max-h-80 overflow-auto rounded-lg border">

              <table className="w-full text-sm">

                <thead className="sticky top-0 bg-muted/70">
                  <tr>

                    <th className="px-3 py-2 text-left font-medium">
                      Employee
                    </th>

                    <th className="px-3 py-2 text-right font-medium">
                      Certificates
                    </th>

                    <th className="px-3 py-2 text-right font-medium">
                      Latest issue
                    </th>

                  </tr>
                </thead>

                <tbody>

                  {learners.map((learner) => (

                    <tr
                      key={learner.userId}
                      className="border-t"
                    >

                      <td className="px-3 py-2">

                        <div className="font-medium">
                          {learner.fullName}
                        </div>

                        <div className="text-xs text-muted-foreground">
                          {learner.email}
                        </div>

                      </td>

                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatNumber(learner.certificateCount)}
                      </td>

                      <td className="px-3 py-2 text-right text-muted-foreground">
                        {formatDate(learner.latestIssuedAt)}
                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          )}

        </div>

      </div>

    </div>
  );
}
