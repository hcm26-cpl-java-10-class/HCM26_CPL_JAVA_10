import { useQuery } from "@tanstack/react-query";
import { courseAnalyticsApi } from "@/api/features/demo/course-analytics.api";
import { Star, Trophy } from "lucide-react";
import { AnalyticsEmptyState } from "@/pages/management/demo/analytics/components/AnalyticsEmptyState";
import { AnalyticsPanel } from "@/pages/management/demo/analytics/components/AnalyticsPanel";
import { ExportExcelButton } from "@/pages/management/demo/analytics/components/ExportExcelButton";
import { MetricCard } from "@/pages/management/demo/analytics/components/MetricCard";
import {
  formatNumber,
  formatPercent,
} from "@/pages/management/demo/analytics/lib/chart-helpers";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CourseRankingItem } from "@/types";
import { AnalyticsLoading } from "@/pages/management/demo/analytics/components/AnalyticsLoading";

type Props = {
  courseId: number;
};

export function CourseRankingTab({ courseId }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["course-analytics", "course-ranking"],
    queryFn: courseAnalyticsApi.getCourseRanking,
  });

  if (isLoading) {
    return <AnalyticsLoading label="Loading the ranking table..." />;
  }

  if (isError || !data) {
    return (
      <AnalyticsEmptyState
        variant="error"
        message="Could not load the course ranking."
      />
    );
  }

  if (!data.allCourses.length) {
    return (
      <AnalyticsEmptyState message="No courses available to rank." />
    );
  }

  const current = data.allCourses.find((item) => item.courseId === courseId);
  const topLearners = data.topByLearners[0];
  const topCompletion = data.topByCompletionRate[0];
  const topRating = data.topByRating[0];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-end">
        <ExportExcelButton
          label="Export Excel"
          successMessage="Exported the course ranking."
          onExport={() => courseAnalyticsApi.exportCourseRanking()}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Courses"
          value={formatNumber(data.totalCourses)}
          hint="Ranked across the courses you can view"
        />
        <MetricCard
          label="Most learners"
          value={topLearners ? formatNumber(topLearners.learnerCount) : "—"}
          hint={topLearners?.courseName}
        />
        <MetricCard
          label="Highest completion"
          value={topCompletion ? formatPercent(topCompletion.completionRate) : "—"}
          hint={topCompletion?.courseName}
        />
        <MetricCard
          label="Highest rating"
          value={topRating ? `${topRating.averageRating.toFixed(2)} ★` : "—"}
          hint={topRating?.courseName}
        />
      </div>

      {current ? (
        <AnalyticsPanel
          title="Position of the selected course"
          description="Compares this course with the others on the same ranking tables."
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <RankTile
              icon={Trophy}
              label="Rank by learners"
              value={`#${rankOf(data.topByLearners, current.courseId)}`}
              hint={`${formatNumber(current.learnerCount)} learners`}
            />
            <RankTile
              icon={Trophy}
              label="Rank by completion"
              value={`#${rankOf(data.topByCompletionRate, current.courseId)}`}
              hint={`${formatPercent(current.completionRate)} completed`}
            />
            <RankTile
              icon={Star}
              label="Rank by rating"
              value={`#${rankOf(data.topByRating, current.courseId)}`}
              hint={`${current.averageRating.toFixed(2)} ★ / ${formatNumber(current.totalReviews)} reviews`}
            />
            <RankTile
              icon={Trophy}
              label="Rank by drop-off"
              value={`#${rankOf(data.highestDropOff, current.courseId)}`}
              hint={`${formatPercent(current.dropOffRate)} dropped out`}
            />
          </div>
        </AnalyticsPanel>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <AnalyticsPanel
          title="Top courses by learner count"
          description="Ranked by number of enrollments."
        >
          <RankingTable items={data.topByLearners.slice(0, 5)} />
        </AnalyticsPanel>

        <AnalyticsPanel
          title="Top courses by completion rate"
          description="Ranked by course completion rate."
        >
          <RankingTable items={data.topByCompletionRate.slice(0, 5)} />
        </AnalyticsPanel>

        <AnalyticsPanel
          title="Top courses by rating"
          description="Ranked by average review score."
        >
          <RankingTable items={data.topByRating.slice(0, 5)} />
        </AnalyticsPanel>

        <AnalyticsPanel
          title="Courses with the highest drop-off rate"
          description="Ranked by the share of learners who stopped learning without completing the course (inactive or never started)."
        >
          <RankingTable items={data.highestDropOff.slice(0, 5)} highlightDropOff />
        </AnalyticsPanel>
      </div>

      <AnalyticsPanel
        title="Full ranking table"
        description="Every course you can view, with the main indicators."
      >
        <div className="overflow-hidden rounded-lg border">
          <div className="max-h-[560px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">Rank</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Instructor</TableHead>
                  <TableHead className="text-right">Learners</TableHead>
                  <TableHead className="text-right">Completed</TableHead>
                  <TableHead className="text-right">Completion rate</TableHead>
                  <TableHead className="text-right">Rating</TableHead>
                  <TableHead className="text-right">Active</TableHead>
                  <TableHead className="text-right">Inactive</TableHead>
                  <TableHead className="text-right">Never started</TableHead>
                  <TableHead className="text-right">Drop-off</TableHead>
                  <TableHead className="text-right">Non-completion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.allCourses.map((item) => (
                  <TableRow
                    key={item.courseId}
                    className={
                      item.courseId === courseId
                        ? "bg-blue-50/60 dark:bg-blue-950/20"
                        : undefined
                    }
                  >
                    <TableCell className="font-medium text-muted-foreground">
                      {item.rank}
                    </TableCell>
                    <TableCell className="font-medium">{item.courseName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.instructor || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(item.learnerCount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(item.completedLearners)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPercent(item.completionRate)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center gap-1">
                        <Star className="size-3.5 fill-amber-400 text-amber-400" />
                        {item.averageRating.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(item.activeLearners)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(item.inactiveLearners)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(item.neverStartedLearners)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatPercent(item.dropOffRate)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatPercent(item.notCompletedRate)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </AnalyticsPanel>
    </div>
  );
}

function rankOf(items: CourseRankingItem[], courseId: number): number {
  return items.find((item) => item.courseId === courseId)?.rank ?? 0;
}

function RankTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Trophy;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" />
        <span>{label}</span>
      </div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {hint ? (
        <div className="mt-0.5 truncate text-xs text-muted-foreground" title={hint}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function RankingTable({
  items,
  highlightDropOff = false,
}: {
  items: CourseRankingItem[];
  highlightDropOff?: boolean;
}) {
  if (!items.length) {
    return <AnalyticsEmptyState message="No ranking data available." />;
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-14">Rank</TableHead>
            <TableHead>Course</TableHead>
            <TableHead className="text-right">
              {highlightDropOff ? "Drop-off rate" : "Learners"}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.courseId}>
              <TableCell className="font-medium text-muted-foreground">
                {item.rank}
              </TableCell>
              <TableCell className="font-medium">{item.courseName}</TableCell>
              <TableCell className="text-right">
                {highlightDropOff
                  ? formatPercent(item.dropOffRate)
                  : formatNumber(item.learnerCount)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}