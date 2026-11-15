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
import {
  AXIS_COLOR,
  CHART_COLORS,
  GRID_COLOR,
  formatNumber,
  formatPercent,
  tooltipNumber,
} from "@/pages/management/demo/analytics/lib/chart-helpers";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AnalyticsLoading } from "@/pages/management/demo/analytics/components/AnalyticsLoading";

type Props = {
  courseId: number;
};

export function DepartmentAnalyticsTab({ courseId }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["course-analytics", "department-analytics", courseId],
    queryFn: () => courseAnalyticsApi.getDepartmentAnalytics(courseId),
  });

  if (isLoading) {
    return <AnalyticsLoading label="Loading department metrics..." />;
  }

  if (isError || !data) {
    return (
      <AnalyticsEmptyState
        variant="error"
        message="Could not load the department data."
      />
    );
  }

  if (!data.departments.length) {
    return (
      <AnalyticsEmptyState message="No department data available for this course." />
    );
  }

  const best = data.bestDepartment;
  const worst = data.worstDepartment;
  const totalCompleted = data.departments.reduce(
    (sum, item) => sum + item.completedLearners,
    0,
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-end">
        <ExportExcelButton
          label="Export Excel"
          successMessage="Exported the department data."
          onExport={() => courseAnalyticsApi.exportDepartments(courseId)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Total learners"
          value={formatNumber(data.totalLearners)}
          hint={data.courseName}
        />
        <MetricCard
          label="Departments"
          value={formatNumber(data.departmentCount)}
          hint={`${formatNumber(totalCompleted)} completed learners`}
        />
        <MetricCard
          label="Total study time"
          value={`${formatNumber(Math.round(data.totalStudyHours * 10) / 10)} h`}
          hint="Combined study time across all departments"
        />
        <MetricCard
          label="Best department"
          value={best ? formatPercent(best.completionRate) : "—"}
          hint={best?.departmentName}
          tone="default"
        />
        <MetricCard
          label="Worst department"
          value={worst ? formatPercent(worst.completionRate) : "—"}
          hint={worst?.departmentName}
          tone={worst && worst.completionRate < 50 ? "warning" : "default"}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <AnalyticsPanel
          title="Learners by department"
          description="Number of enrollments by the learner's department."
        >
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.departments}
                margin={{ top: 10, right: 20, bottom: 10, left: 0 }}
              >
                <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="departmentCode"
                  tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                />
                <YAxis tick={{ fill: AXIS_COLOR, fontSize: 11 }} width={40} allowDecimals={false} />
                <Tooltip shared={false} cursor={false} wrapperStyle={{ pointerEvents: "none", zIndex: 50 }}
                  formatter={(value) => tooltipNumber(value, "Learners")}
                  labelFormatter={(label) => {
                    const item = data.departments.find((d) => d.departmentCode === label);
                    return item ? `${item.departmentName}` : String(label);
                  }}
                />
                <Bar isAnimationActive={true} animationDuration={850} animationEasing="ease-out" dataKey="learnerCount" radius={[4, 4, 0, 0]}>
                  {data.departments.map((item, index) => (
                    <Cell
                      key={item.departmentId}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </AnalyticsPanel>

        <AnalyticsPanel
          title="Completion rate by department"
          description="Compares training effectiveness between departments."
        >
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.departments}
                margin={{ top: 10, right: 20, bottom: 10, left: 0 }}
              >
                <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="departmentCode"
                  tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                />
                <YAxis
                  tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                  width={40}
                  unit="%"
                  domain={[0, 100]}
                />
                <Tooltip shared={false} cursor={false} wrapperStyle={{ pointerEvents: "none", zIndex: 50 }}
                  formatter={(value) => [
                    formatPercent(Number(value)),
                    "Completion rate",
                  ]}
                  labelFormatter={(label) => {
                    const item = data.departments.find((d) => d.departmentCode === label);
                    return item ? `${item.departmentName}` : String(label);
                  }}
                />
                <Bar isAnimationActive={true} animationDuration={850} animationEasing="ease-out" dataKey="completionRate" radius={[4, 4, 0, 0]}>
                  {data.departments.map((item, index) => (
                    <Cell
                      key={item.departmentId}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </AnalyticsPanel>
        <AnalyticsPanel
          title="Total study time by department"
          description="Total study time (hours) of each department in this course."
        >
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.departments}
                margin={{ top: 10, right: 20, bottom: 10, left: 0 }}
              >
                <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="departmentCode"
                  tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                />
                <YAxis
                  tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                  width={48}
                  unit="h"
                />
                <Tooltip shared={false} cursor={false} wrapperStyle={{ pointerEvents: "none", zIndex: 50 }}
                  formatter={(value) => [
                    `${Number(value).toLocaleString("en-US", {
                      maximumFractionDigits: 1,
                    })} h`,
                    "Total study time",
                  ]}
                  labelFormatter={(label) => {
                    const item = data.departments.find((d) => d.departmentCode === label);
                    return item ? `${item.departmentName}` : String(label);
                  }}
                />
                <Bar isAnimationActive={true} animationDuration={850} animationEasing="ease-out" dataKey="totalStudyHours" radius={[4, 4, 0, 0]}>
                  {data.departments.map((item, index) => (
                    <Cell
                      key={item.departmentId}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </AnalyticsPanel>
      </div>

      <AnalyticsPanel
        title="Training effectiveness by department"
        description="Learner count, completion rate, average progress, average exam score, total study time and drop-off rate."
      >
        <div className="max-h-[560px] overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Learners</TableHead>
                <TableHead className="text-right">Completed</TableHead>
                <TableHead className="text-right">Completion rate</TableHead>
                <TableHead className="text-right">Avg progress</TableHead>
                <TableHead className="text-right">Avg exam score</TableHead>
                <TableHead className="text-right">Total study time</TableHead>
                <TableHead className="text-right">Avg h/learner</TableHead>
                <TableHead className="text-right">Drop-off rate</TableHead>
                <TableHead className="text-right">At risk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.departments.map((item) => (
                <TableRow key={item.departmentId}>
                  <TableCell>
                    <div className="font-medium">{item.departmentName}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.departmentCode}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(item.learnerCount)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(item.completedLearners)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatPercent(item.completionRate)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatPercent(item.averageProgress)}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.averageExamScore == null
                      ? "—"
                      : formatPercent(item.averageExamScore)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatNumber(Math.round(item.totalStudyHours * 10) / 10)} h
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(
                      Math.round(item.averageStudyHoursPerLearner * 10) / 10,
                    )}{" "}
                    h
                  </TableCell>
                  <TableCell className="text-right">
                    {formatPercent(item.dropOffRate)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(item.atRiskLearners)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </AnalyticsPanel>
    </div>
  );
}