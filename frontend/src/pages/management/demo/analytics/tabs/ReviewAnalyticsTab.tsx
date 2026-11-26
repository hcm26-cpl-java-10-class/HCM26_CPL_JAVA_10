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
    return <AnalyticsLoading label="Loading course reviews..." />;
  }

  if (reviewQuery.isError || !reviewQuery.data) {
    return (
      <AnalyticsEmptyState
        variant="error"
        message="Could not load the course review data."
      />
    );
  }

  const data = reviewQuery.data;
  const ranking = rankingQuery.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-end">
        <ExportExcelButton
          label="Export Excel"
          successMessage="Exported the review data."
          onExport={() => courseAnalyticsApi.exportReviews(courseId)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Average rating"
          value={data.totalReviews ? `${data.averageRating.toFixed(2)} ★` : "—"}
          hint={data.courseName}
        />
        <MetricCard label="Reviews" value={formatNumber(data.totalReviews)} />
        <MetricCard
          label="Review coverage"
          value={formatPercent(data.reviewCoverage)}
          hint={`${formatNumber(data.totalLearners)} active learners`}
        />
        <MetricCard label="Courses ranked" value={formatNumber(ranking.length)} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <AnalyticsPanel
          title="Rating distribution"
          description="Number of reviews per star rating, from 5 down to 1."
        >
          {!data.distribution.length ? (
            <AnalyticsEmptyState message="No reviews for this course yet." />
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
                  <Tooltip shared={false} cursor={false} wrapperStyle={{ pointerEvents: "none", zIndex: 50 }}
                    formatter={(value) => tooltipNumber(value, "Reviews")}
                    labelFormatter={(label) => `${label} stars`}
                  />
                  <Bar isAnimationActive={true} animationDuration={850} animationEasing="ease-out" dataKey="count" radius={[4, 4, 0, 0]}>
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
          title="Share per star rating"
          description="Percentage of reviews for each star rating out of all reviews."
        >
          {!data.distribution.length ? (
            <AnalyticsEmptyState message="No reviews for this course yet." />
          ) : (
            <div className="space-y-3">
              {data.distribution.map((bucket) => (
                <div key={bucket.stars} className="grid grid-cols-[4.5rem_1fr_5rem] items-center gap-3 text-sm">
                  <span className="inline-flex items-center gap-1 font-medium">
                    <Star className="size-3.5 fill-amber-400 text-amber-400" />
                    {bucket.stars} stars
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
        title="Review ranking across courses"
        description="Compares the average rating of the courses you can view (admin: all courses, instructor: own courses)."
      >
        {rankingQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading the ranking table...</p>
        ) : !ranking.length ? (
          <AnalyticsEmptyState message="No courses available to rank." />
        ) : (
          <div className="max-h-[520px] overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">Rank</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Instructor</TableHead>
                  <TableHead className="text-right">Avg rating</TableHead>
                  <TableHead className="text-right">Reviews</TableHead>
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