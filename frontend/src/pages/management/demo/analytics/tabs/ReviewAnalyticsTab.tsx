import { useQuery } from "@tanstack/react-query";
import { courseAnalyticsApi } from "@/api/features/demo/course-analytics.api";
import { Star } from "lucide-react";
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

export function ReviewAnalyticsTab({ courseId }: Props) {
  const reviewQuery = useQuery({
    queryKey: ["course-analytics", "review-analytics", courseId],
    queryFn: () => courseAnalyticsApi.getReviewAnalytics(courseId),
  });

  const rankingQuery = useQuery({
    queryKey: ["course-analytics", "course-ratings"],
    queryFn: courseAnalyticsApi.getCourseRatingRanking,
  });

  if (reviewQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Đang tải đánh giá khóa học...</p>;
  }

  if (reviewQuery.isError || !reviewQuery.data) {
    return (
      <AnalyticsEmptyState
        variant="error"
        message="Không tải được dữ liệu đánh giá khóa học."
      />
    );
  }

  const data = reviewQuery.data;
  const ranking = rankingQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Điểm trung bình"
          value={data.totalReviews ? `${data.averageRating.toFixed(2)} ★` : "—"}
          hint={data.courseName}
        />
        <MetricCard label="Số review" value={formatNumber(data.totalReviews)} />
        <MetricCard
          label="Tỉ lệ học viên đã đánh giá"
          value={formatPercent(data.reviewCoverage)}
          hint={`${formatNumber(data.totalLearners)} học viên đang học`}
        />
        <MetricCard label="Số khóa học xếp hạng" value={formatNumber(ranking.length)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AnalyticsPanel
          title="Phân bố điểm đánh giá"
          description="Số review theo từng mức sao từ 5 xuống 1."
        >
          {!data.distribution.length ? (
            <AnalyticsEmptyState message="Chưa có review nào cho khóa học này." />
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.distribution}
                  margin={{ top: 10, right: 20, bottom: 10, left: 0 }}
                >
                  <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="stars" tick={{ fill: AXIS_COLOR, fontSize: 11 }} />
                  <YAxis
                    tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                    width={40}
                    allowDecimals={false}
                  />
                  <Tooltip
                    formatter={(value) => tooltipNumber(value, "Review")}
                    labelFormatter={(label) => `${label} sao`}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {data.distribution.map((bucket) => (
                      <Cell
                        key={bucket.stars}
                        fill={CHART_COLORS[Math.max(0, 5 - bucket.stars)]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </AnalyticsPanel>

        <AnalyticsPanel
          title="Tỉ lệ theo mức sao"
          description="Phần trăm review của mỗi mức sao trong tổng số review."
        >
          {!data.distribution.length ? (
            <AnalyticsEmptyState message="Chưa có review nào cho khóa học này." />
          ) : (
            <div className="space-y-3">
              {data.distribution.map((bucket) => (
                <div key={bucket.stars} className="grid grid-cols-[4.5rem_1fr_5rem] items-center gap-3 text-sm">
                  <span className="inline-flex items-center gap-1 font-medium">
                    <Star className="size-3.5 fill-amber-400 text-amber-400" />
                    {bucket.stars} sao
                  </span>
                  <div className="h-3 rounded bg-muted">
                    <div
                      className="h-3 rounded bg-amber-400"
                      style={{ width: `${Math.min(100, bucket.percentage)}%` }}
                    />
                  </div>
                  <span className="text-right text-muted-foreground">
                    {formatPercent(bucket.percentage)} ({formatNumber(bucket.count)})
                  </span>
                </div>
              ))}
            </div>
          )}
        </AnalyticsPanel>
      </div>

      <AnalyticsPanel
        title="Xếp hạng đánh giá giữa các khóa học"
        description="So sánh điểm trung bình của các khóa học bạn được xem (admin: tất cả, giảng viên: khóa của mình)."
      >
        {rankingQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Đang tải bảng xếp hạng...</p>
        ) : !ranking.length ? (
          <AnalyticsEmptyState message="Chưa có khóa học nào để xếp hạng." />
        ) : (
          <div className="max-h-[520px] overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">Hạng</TableHead>
                  <TableHead>Khóa học</TableHead>
                  <TableHead>Giảng viên</TableHead>
                  <TableHead className="text-right">Điểm TB</TableHead>
                  <TableHead className="text-right">Số review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranking.map((item) => (
                  <TableRow key={item.courseId}>
                    <TableCell className="font-medium text-muted-foreground">
                      {item.rank}
                    </TableCell>
                    <TableCell className="font-medium">{item.courseName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.instructor || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center gap-1 font-medium">
                        <Star className="size-3.5 fill-amber-400 text-amber-400" />
                        {item.averageRating.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(item.totalReviews)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </AnalyticsPanel>
    </div>
  );
}
