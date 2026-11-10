import { keepPreviousData, useQuery } from "@tanstack/react-query";
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
import { ExportExcelButton } from "@/pages/management/demo/analytics/components/ExportExcelButton";
import { MetricCard } from "@/pages/management/demo/analytics/components/MetricCard";
import {
  AXIS_COLOR,
  CHART_COLORS,
  GRID_COLOR,
  formatNumber,
  tooltipNumber,
} from "@/pages/management/demo/analytics/lib/chart-helpers";
import type { CourseAnalyticsGranularity } from "@/types";
import { AnalyticsLoading } from "@/pages/management/demo/analytics/components/AnalyticsLoading";

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
  { value: "DAY", label: "Daily" },
  { value: "WEEK", label: "Weekly" },
  { value: "MONTH", label: "Monthly" },
];

const SERIES_LABEL: Record<string, string> = {
  enrollments: "New enrollments",
  lessonsCompleted: "Lessons completed",
  certificatesIssued: "Certificates issued",
};

export function TrendTab({ courseId }: Props) {
  const [from, setFrom] = useState(daysAgoIso(29));
  const [to, setTo] = useState(todayIso());
  const [granularity, setGranularity] = useState<CourseAnalyticsGranularity>("DAY");

  const validRange = !!from && !!to && from <= to;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["course-analytics", "trend", courseId, from, to, granularity],
    enabled: validRange,
    // Giữ dữ liệu cũ khi đổi khoảng thời gian / granularity để biểu đồ không nháy trắng.
    placeholderData: keepPreviousData,
    queryFn: () => courseAnalyticsApi.getTrend(courseId, { from, to, granularity }),
  });

  const granularityLabel =
    data?.granularity === "DAY"
      ? "day"
      : data?.granularity === "WEEK"
        ? "week (starting Monday)"
        : "month";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-end">
        <ExportExcelButton
          label="Export Excel"
          successMessage="Exported the trend data."
          onExport={() =>
            courseAnalyticsApi.exportTrend(courseId, { from, to, granularity })
          }
        />
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-muted-foreground">From date</span>
          <input
            className="rounded-md border bg-background px-3 py-2 text-sm"
            type="date"
            value={from}
            max={to}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-muted-foreground">To date</span>
          <input
            className="rounded-md border bg-background px-3 py-2 text-sm"
            type="date"
            value={to}
            min={from}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-muted-foreground">Granularity</span>
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
            30 days
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFrom(daysAgoIso(89));
              setTo(todayIso());
            }}
          >
            90 days
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFrom(daysAgoIso(364));
              setTo(todayIso());
            }}
          >
            1 year
          </Button>
        </div>
      </div>

      {!validRange ? (
        <p role="alert" className="text-sm text-destructive">
          Invalid date range: the start date must be on or before the end date.
        </p>
      ) : null}

      {isLoading && validRange ? (
        <AnalyticsLoading label="Loading trend data..." compact />
      ) : null}

      {isError ? (
        <AnalyticsEmptyState
          variant="error"
          message="Could not load the trend data. An overly long range can also cause errors (maximum 400 points)."
        />
      ) : null}

      {data && validRange ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard
              label="New enrollments"
              value={formatNumber(data.totalEnrollments)}
            />
            <MetricCard
              label="Lessons completed"
              value={formatNumber(data.totalLessonsCompleted)}
            />
            <MetricCard
              label="Certificates issued"
              value={formatNumber(data.totalCertificatesIssued)}
            />
          </div>

          <AnalyticsPanel
            title={`Trends for ${data.courseName}`}
            description={`From ${data.from} to ${data.to} · granularity: ${granularityLabel}.`}
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
                    labelFormatter={(label) => `Period: ${label}`}
                  />
                  <Legend formatter={(value) => SERIES_LABEL[value] ?? value} />
                  <Line isAnimationActive={true} animationDuration={850} animationEasing="ease-out"
                    type="monotone"
                    dataKey="enrollments"
                    stroke={CHART_COLORS[0]}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line isAnimationActive={true} animationDuration={850} animationEasing="ease-out"
                    type="monotone"
                    dataKey="lessonsCompleted"
                    stroke={CHART_COLORS[1]}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line isAnimationActive={true} animationDuration={850} animationEasing="ease-out"
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
