import { useQuery } from "@tanstack/react-query";
import { courseAnalyticsApi } from "@/api/features/demo/course-analytics.api";
import { Button } from "@/components/ui/button";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useState } from "react";
import { AnalyticsEmptyState } from "@/pages/management/demo/analytics/components/AnalyticsEmptyState";
import { AnalyticsPanel } from "@/pages/management/demo/analytics/components/AnalyticsPanel";
import { MetricCard } from "@/pages/management/demo/analytics/components/MetricCard";
import {
  AXIS_COLOR,
  CHART_COLORS,
  GRID_COLOR,
  formatNumber,
  tooltipNumber,
} from "@/pages/management/demo/analytics/lib/chart-helpers";
import type { CourseAnalyticsGranularity } from "@/types";

type Props = {
  courseId: number;
};

const todayIso = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const daysAgoIso = (days: number) => {
  const date = new Date(`${todayIso()}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
};

const GRANULARITIES: Array<{ value: CourseAnalyticsGranularity; label: string }> = [
  { value: "DAY", label: "Theo ngày" },
  { value: "WEEK", label: "Theo tuần" },
  { value: "MONTH", label: "Theo tháng" },
];

const SERIES_LABEL: Record<string, string> = {
  enrollments: "Đăng ký mới",
  lessonsCompleted: "Bài hoàn thành",
  certificatesIssued: "Chứng chỉ cấp",
};

export function TrendTab({ courseId }: Props) {
  const [from, setFrom] = useState(daysAgoIso(29));
  const [to, setTo] = useState(todayIso());
  const [granularity, setGranularity] = useState<CourseAnalyticsGranularity>("DAY");

  const validRange = !!from && !!to && from <= to;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["course-analytics", "trend", courseId, from, to, granularity],
    enabled: validRange,
    queryFn: () => courseAnalyticsApi.getTrend(courseId, { from, to, granularity }),
  });

  const granularityLabel =
    data?.granularity === "DAY"
      ? "ngày"
      : data?.granularity === "WEEK"
        ? "tuần (bắt đầu thứ Hai)"
        : "tháng";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-muted-foreground">Từ ngày</span>
          <input
            className="rounded-md border bg-background px-3 py-2 text-sm"
            type="date"
            value={from}
            max={to}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-muted-foreground">Đến ngày</span>
          <input
            className="rounded-md border bg-background px-3 py-2 text-sm"
            type="date"
            value={to}
            min={from}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-muted-foreground">Đơn vị</span>
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={granularity}
            onChange={(event) =>
              setGranularity(event.target.value as CourseAnalyticsGranularity)
            }
          >
            {GRANULARITIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFrom(daysAgoIso(29));
              setTo(todayIso());
            }}
          >
            30 ngày
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFrom(daysAgoIso(89));
              setTo(todayIso());
            }}
          >
            90 ngày
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFrom(daysAgoIso(364));
              setTo(todayIso());
            }}
          >
            1 năm
          </Button>
        </div>
      </div>

      {!validRange ? (
        <p role="alert" className="text-sm text-destructive">
          Khoảng thời gian không hợp lệ: ngày bắt đầu phải trước hoặc bằng ngày kết thúc.
        </p>
      ) : null}

      {isLoading && validRange ? (
        <p className="text-sm text-muted-foreground">Đang tải xu hướng...</p>
      ) : null}

      {isError ? (
        <AnalyticsEmptyState
          variant="error"
          message="Không tải được dữ liệu xu hướng. Khoảng thời gian quá dài cũng có thể gây lỗi (tối đa 400 điểm)."
        />
      ) : null}

      {data && validRange ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard
              label="Đăng ký mới"
              value={formatNumber(data.totalEnrollments)}
              hint="CourseEnrollment.createdAt"
            />
            <MetricCard
              label="Bài hoàn thành"
              value={formatNumber(data.totalLessonsCompleted)}
              hint="LessonProgress.completedAt"
            />
            <MetricCard
              label="Chứng chỉ cấp"
              value={formatNumber(data.totalCertificatesIssued)}
              hint="Certificate.issuedAt"
            />
          </div>

          <AnalyticsPanel
            title={`Xu hướng ${data.courseName}`}
            description={`Từ ${data.from} đến ${data.to} · đơn vị ${granularityLabel}.`}
          >
            <div className="h-96 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.points} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                  <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="bucketStart"
                    tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                    interval="preserveStartEnd"
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                    width={45}
                    allowDecimals={false}
                  />
                  <Tooltip
                    formatter={(value, name) =>
                      tooltipNumber(value, SERIES_LABEL[String(name)] ?? String(name))
                    }
                    labelFormatter={(label) => `Kỳ: ${label}`}
                  />
                  <Legend formatter={(value) => SERIES_LABEL[value] ?? value} />
                  <Line
                    type="monotone"
                    dataKey="enrollments"
                    stroke={CHART_COLORS[0]}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="lessonsCompleted"
                    stroke={CHART_COLORS[1]}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="certificatesIssued"
                    stroke={CHART_COLORS[2]}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </AnalyticsPanel>
        </>
      ) : null}
    </div>
  );
}
