import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { courseAnalyticsApi } from "@/api/features/demo/course-analytics.api";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
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
  tooltipNumber,
} from "@/pages/management/demo/analytics/lib/chart-helpers";
import type { AtRiskLearner } from "@/types";
import { useMemo, useState } from "react";
import { AnalyticsLoading } from "@/pages/management/demo/analytics/components/AnalyticsLoading";

type Props = {
  courseId: number;
};

const INACTIVE_PRESETS = [7, 14, 30];

const REASON_LABEL: Record<string, string> = {
  NEVER_STARTED: "Never started",
  INACTIVE: "Inactive",
};

export function ActivityTab({ courseId }: Props) {
  const [inactiveDays, setInactiveDays] = useState(14);
  // Luôn lấy tối đa để phân trang phía client có đủ dữ liệu.
  const [limit] = useState(500);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["course-analytics", "activity", courseId, inactiveDays, limit],
    // Giữ dữ liệu cũ khi đổi ngưỡng không hoạt động để bảng không nháy trắng.
    placeholderData: keepPreviousData,
    queryFn: () => courseAnalyticsApi.getActivity(courseId, { inactiveDays, limit }),
  });

  const filteredAtRisk = useMemo(() => {
    const list = data?.atRiskLearners ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return list;
    return list.filter((learner) =>
      [learner.studentName, learner.studentEmail, learner.departmentName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [data?.atRiskLearners, search]);

  const totalPages = Math.max(1, Math.ceil(filteredAtRisk.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pagedAtRisk = useMemo(
    () =>
      filteredAtRisk.slice(
        currentPage * pageSize,
        currentPage * pageSize + pageSize,
      ),
    [filteredAtRisk, currentPage, pageSize],
  );

  if (isLoading) {
    return <AnalyticsLoading label="Loading learner activity..." />;
  }

  if (isError || !data) {
    return (
      <AnalyticsEmptyState
        variant="error"
        message="Could not load the learner activity data."
      />
    );
  }

  const pieData = [
    { name: "Completed", value: data.completedLearners, color: CHART_COLORS[1] },
    { name: "Active", value: data.activeLearners, color: CHART_COLORS[0] },
    { name: "Inactive", value: data.inactiveLearners, color: CHART_COLORS[2] },
    { name: "Never started", value: data.neverStartedLearners, color: CHART_COLORS[3] },
  ].filter((item) => item.value > 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
        <div className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-muted-foreground">
            Inactivity threshold
          </span>
          <div className="flex gap-2">
            {INACTIVE_PRESETS.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setInactiveDays(days)}
                className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                  inactiveDays === days
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted"
                }`}
              >
                {days} days
              </button>
            ))}
          </div>
        </div>
        <div className="ml-auto">
        <ExportExcelButton
          label="Export Excel"
          successMessage="Exported the activity data."
          onExport={() =>
            courseAnalyticsApi.exportActivity(courseId, { inactiveDays })
          }
        />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total learners" value={formatNumber(data.totalLearners)} />
        <MetricCard
          label="Completed"
          value={formatNumber(data.completedLearners)}
          tone="default"
        />
        <MetricCard
          label="Active"
          value={formatNumber(data.activeLearners)}
          hint={`Visited in the last ${data.inactiveThresholdDays} days`}
        />
        <MetricCard
          label="At risk of dropping out"
          value={formatNumber(data.atRiskCount)}
          hint={`${data.highRiskCount} high risk / ${data.mediumRiskCount} medium risk`}
          tone={data.atRiskCount > 0 ? "warning" : "default"}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <AnalyticsPanel
          title="Learner status distribution"
          description="Based on lesson progress and the most recent visit."
        >
          {pieData.length ? (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie isAnimationActive={true} animationDuration={850} animationEasing="ease-out"
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    label={({ name, percent }) =>
                      `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip shared={false} cursor={false} wrapperStyle={{ pointerEvents: "none", zIndex: 50 }} formatter={(value, name) => tooltipNumber(value, String(name))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <AnalyticsEmptyState message="No learners enrolled in this course yet." />
          )}
        </AnalyticsPanel>

        <AnalyticsPanel
          title="Learning progress distribution"
          description="Number of learners by the percentage of lessons completed."
        >
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.progressDistribution}
                margin={{ top: 10, right: 20, bottom: 10, left: 0 }}
              >
                <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                  interval={0}
                />
                <YAxis tick={{ fill: AXIS_COLOR, fontSize: 11 }} width={40} allowDecimals={false} />
                <Tooltip shared={false} cursor={false} wrapperStyle={{ pointerEvents: "none", zIndex: 50 }} formatter={(value) => tooltipNumber(value, "Learners")} />
                <Bar isAnimationActive={true} animationDuration={850} animationEasing="ease-out" dataKey="learners" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </AnalyticsPanel>
      </div>

      <AnalyticsPanel
        title="Learners at risk of dropping out"
        description="Sorted by risk score, then by the number of days without access. High risk = long absence combined with low progress."
      >
        {!data.atRiskLearners.length ? (
          <AnalyticsEmptyState message="No learners fall into the at-risk group. Great work!" />
        ) : (
          <>
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
                {formatNumber(filteredAtRisk.length)} of{" "}
                {formatNumber(data.atRiskLearners.length)} at-risk learners
              </span>
            </div>

            <div className="overflow-hidden rounded-lg border">
              <div className="max-h-[520px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Learner</TableHead>
                      <TableHead className="text-right">Progress</TableHead>
                      <TableHead className="text-right">Days inactive</TableHead>
                      <TableHead>Last accessed</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead className="text-right">Risk score</TableHead>
                      <TableHead>Risk level</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedAtRisk.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="py-6 text-center text-muted-foreground"
                        >
                          No learner matches the current search.
                        </TableCell>
                      </TableRow>
                    ) : (
                      pagedAtRisk.map((learner) => (
                        <AtRiskRow key={learner.enrollmentId} learner={learner} />
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <TablePagination
                totalItems={filteredAtRisk.length}
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
          </>
        )}
      </AnalyticsPanel>
    </div>
  );
}

function AtRiskRow({ learner }: { learner: AtRiskLearner }) {
  const badgeVariant =
    learner.riskLevel === "HIGH"
      ? "destructive"
      : learner.riskLevel === "MEDIUM"
        ? "secondary"
        : "outline";

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{learner.studentName}</div>
        <div className="text-xs text-muted-foreground">{learner.studentEmail}</div>
      </TableCell>
      <TableCell className="text-right">{formatPercent(learner.progressPercentage, 0)}</TableCell>
      <TableCell className="text-right font-medium">{learner.inactiveDays} days</TableCell>
      <TableCell className="text-muted-foreground">
        {formatDateTime(learner.lastAccessedAt)}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {REASON_LABEL[learner.reason] ?? learner.reason}
      </TableCell>
      <TableCell className="text-right font-medium">
        {learner.riskScore ?? 0}
      </TableCell>
      <TableCell>
        <Badge variant={badgeVariant}>{learner.riskLevel}</Badge>
      </TableCell>
    </TableRow>
  );
}