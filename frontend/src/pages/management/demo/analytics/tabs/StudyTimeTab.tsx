import { useQuery } from "@tanstack/react-query";
import { courseAnalyticsApi } from "@/api/features/demo/course-analytics.api";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AnalyticsEmptyState } from "@/pages/management/demo/analytics/components/AnalyticsEmptyState";
import { AnalyticsPanel } from "@/pages/management/demo/analytics/components/AnalyticsPanel";
import { ExportExcelButton } from "@/pages/management/demo/analytics/components/ExportExcelButton";
import { MetricCard } from "@/pages/management/demo/analytics/components/MetricCard";
import { TablePagination } from "@/pages/management/demo/analytics/components/TablePagination";
import { TableSearchBox } from "@/pages/management/demo/analytics/components/TableSearchBox";
import {
  AXIS_COLOR,
  CHART_COLORS,
  GRID_COLOR,
  formatDateTime,
  formatNumber,
  formatPercent,
  truncateLabel,
} from "@/pages/management/demo/analytics/lib/chart-helpers";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMemo, useState } from "react";
import { AnalyticsLoading } from "@/pages/management/demo/analytics/components/AnalyticsLoading";

type Props = {
  courseId: number;
};

/** Formats study hours as "12.5 h" (one decimal place). */
const formatHours = (value?: number | null): string =>
  typeof value === "number" && Number.isFinite(value)
    ? `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })} h`
    : "—";

/** Converts seconds into "1 h 25 min" for extra detail. */
const formatDuration = (seconds?: number | null): string => {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) {
    return "—";
  }
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
};

export function StudyTimeTab({ courseId }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["course-analytics", "study-time", courseId],
    queryFn: () => courseAnalyticsApi.getStudyTime(courseId),
  });

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const filteredLearners = useMemo(() => {
    const list = data?.learners ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return list;
    return list.filter((item) =>
      [item.studentName, item.studentEmail, item.departmentName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [data?.learners, search]);

  const totalPages = Math.max(1, Math.ceil(filteredLearners.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pagedLearners = useMemo(
    () =>
      filteredLearners.slice(
        currentPage * pageSize,
        currentPage * pageSize + pageSize,
      ),
    [filteredLearners, currentPage, pageSize],
  );

  if (isLoading) {
    return <AnalyticsLoading label="Loading learner study time..." />;
  }

  if (isError || !data) {
    return (
      <AnalyticsEmptyState
        variant="error"
        message="Could not load the study time data for this course."
      />
    );
  }

  if (!data.learners.length) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap justify-end">
          <ExportExcelButton
            label="Export Excel"
            successMessage="Exported the study time data."
            onExport={() => courseAnalyticsApi.exportStudyTime(courseId)}
          />
        </div>
        <AnalyticsEmptyState message="No learners are enrolled in this course." />
      </div>
    );
  }

  const top = data.topLearner;
  const top10 = data.learners.slice(0, 10);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-end">
        <ExportExcelButton
          label="Export Excel"
          successMessage="Exported the study time data."
          onExport={() => courseAnalyticsApi.exportStudyTime(courseId)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total study time"
          value={formatHours(data.totalStudyHours)}
          hint={formatDuration(data.totalStudySeconds)}
        />
        <MetricCard
          label="Learners"
          value={formatNumber(data.totalLearners)}
          hint={data.courseName}
        />
        <MetricCard
          label="Average study time"
          value={formatHours(data.averageStudyHoursPerLearner)}
          hint="Per learner"
        />
        <MetricCard
          label="Top learner"
          value={top ? formatHours(top.studyHours) : "—"}
          hint={top?.studentName}
        />
      </div>

      <AnalyticsPanel
        title="Top 10 learners by study time"
        description="Ranked by the total time learners spent on the lessons of this course."
      >
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={top10}
              layout="vertical"
              margin={{ top: 10, right: 24, bottom: 10, left: 10 }}
            >
              <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                unit="h"
              />
              <YAxis
                type="category"
                dataKey="studentName"
                tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                width={150}
                tickFormatter={(value: string) => truncateLabel(value, 22)}
              />
              <Tooltip shared={false} cursor={false} wrapperStyle={{ pointerEvents: "none", zIndex: 50 }}
                formatter={(value) => [
                  formatHours(Number(value)),
                  "Total study time",
                ]}
                labelFormatter={(label) => {
                  const item = top10.find((l) => l.studentName === label);
                  return item ? `${item.studentName} (${item.departmentName ?? "—"})` : String(label);
                }}
              />
              <Bar isAnimationActive={true} animationDuration={850} animationEasing="ease-out" dataKey="studyHours" radius={[0, 4, 4, 0]}>
                {top10.map((item, index) => (
                  <Cell
                    key={item.enrollmentId}
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </AnalyticsPanel>

      <AnalyticsPanel
        title="Study time per learner"
        description="Total study time, number of completed lessons and the most recent visit of every learner in the course. Scope: this course only — for learning hours across all courses, see Enrollment → Learning Hours."
      >
        <div className="flex flex-wrap items-center gap-2 pb-3">
          <TableSearchBox
            value={search}
            onSearch={(term) => {
              setSearch(term);
              setPage(0);
            }}
            placeholder="Search learner or department..."
          />
          <span className="ml-auto text-xs text-muted-foreground">
            {formatNumber(filteredLearners.length)} of{" "}
            {formatNumber(data.learners.length)} learners
          </span>
        </div>

        <div className="overflow-hidden rounded-lg border">
          <div className="max-h-[560px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">#</TableHead>
                  <TableHead>Learner</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-right">Total study time</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead className="text-right">Lessons completed</TableHead>
                  <TableHead className="text-right">Completion rate</TableHead>
                  <TableHead className="text-right">Last accessed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedLearners.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="py-6 text-center text-muted-foreground"
                    >
                      No learner matches the current search.
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedLearners.map((item) => (
                    <TableRow key={item.enrollmentId}>
                      <TableCell className="text-right text-muted-foreground">
                        {filteredLearners.indexOf(item) + 1}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{item.studentName}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.studentEmail}
                        </div>
                      </TableCell>
                      <TableCell>{item.departmentName ?? "—"}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatHours(item.studyHours)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatDuration(item.studySeconds)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(item.completedLessons)}/{formatNumber(item.totalLessons)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPercent(item.completionRate)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatDateTime(item.lastAccessedAt)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <TablePagination
            totalItems={filteredLearners.length}
            page={page}
            pageSize={pageSize}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(0);
            }}
            unit="learners"
          />
        </div>
      </AnalyticsPanel>
    </div>
  );
}