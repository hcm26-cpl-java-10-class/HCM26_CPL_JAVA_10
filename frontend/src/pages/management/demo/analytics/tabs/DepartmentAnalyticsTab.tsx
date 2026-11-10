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

type Props = {
  courseId: number;
};

export function DepartmentAnalyticsTab({ courseId }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["course-analytics", "department-analytics", courseId],
    queryFn: () => courseAnalyticsApi.getDepartmentAnalytics(courseId),
  });

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">
        Đang tải số liệu theo phòng ban...
      </p>
    );
  }

  if (isError || !data) {
    return (
      <AnalyticsEmptyState
        variant="error"
        message="Không tải được dữ liệu phòng ban."
      />
    );
  }

  if (!data.departments.length) {
    return (
      <AnalyticsEmptyState message="Chưa có dữ liệu phòng ban cho khóa học này." />
    );
  }

  const best = data.bestDepartment;
  const worst = data.worstDepartment;
  const totalCompleted = data.departments.reduce(
    (sum, item) => sum + item.completedLearners,
    0,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end">
        <ExportExcelButton
          label="Export Excel"
          successMessage="Đã export dữ liệu phòng ban."
          onExport={() => courseAnalyticsApi.exportDepartments(courseId)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Tổng học viên"
          value={formatNumber(data.totalLearners)}
          hint={data.courseName}
        />
        <MetricCard
          label="Số phòng ban"
          value={formatNumber(data.departmentCount)}
          hint={`${formatNumber(totalCompleted)} học viên hoàn thành`}
        />
        <MetricCard
          label="Phòng ban tốt nhất"
          value={best ? formatPercent(best.completionRate) : "—"}
          hint={best?.departmentName}
          tone="default"
        />
        <MetricCard
          label="Phòng ban kém nhất"
          value={worst ? formatPercent(worst.completionRate) : "—"}
          hint={worst?.departmentName}
          tone={worst && worst.completionRate < 50 ? "warning" : "default"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AnalyticsPanel
          title="Số học viên theo phòng ban"
          description="Số lượt đăng ký học của học viên thuộc từng phòng ban."
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
                <Tooltip
                  formatter={(value) => tooltipNumber(value, "Học viên")}
                  labelFormatter={(label) => {
                    const item = data.departments.find((d) => d.departmentCode === label);
                    return item ? `${item.departmentName}` : String(label);
                  }}
                />
                <Bar dataKey="learnerCount" radius={[4, 4, 0, 0]}>
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
          title="Tỷ lệ hoàn thành theo phòng ban"
          description="So sánh hiệu quả đào tạo giữa các phòng ban."
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
                <Tooltip
                  formatter={(value) => [
                    formatPercent(Number(value)),
                    "Tỷ lệ hoàn thành",
                  ]}
                  labelFormatter={(label) => {
                    const item = data.departments.find((d) => d.departmentCode === label);
                    return item ? `${item.departmentName}` : String(label);
                  }}
                />
                <Bar dataKey="completionRate" radius={[4, 4, 0, 0]}>
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
        title="So sánh hiệu quả đào tạo giữa các phòng ban"
        description="Số học viên, tỷ lệ hoàn thành, tiến độ trung bình, điểm thi trung bình và tỷ lệ bỏ học."
      >
        <div className="max-h-[560px] overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Phòng ban</TableHead>
                <TableHead className="text-right">Học viên</TableHead>
                <TableHead className="text-right">Hoàn thành</TableHead>
                <TableHead className="text-right">Tỷ lệ hoàn thành</TableHead>
                <TableHead className="text-right">Tiến độ TB</TableHead>
                <TableHead className="text-right">Điểm thi TB</TableHead>
                <TableHead className="text-right">Tỷ lệ bỏ học</TableHead>
                <TableHead className="text-right">Nguy cơ</TableHead>
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
