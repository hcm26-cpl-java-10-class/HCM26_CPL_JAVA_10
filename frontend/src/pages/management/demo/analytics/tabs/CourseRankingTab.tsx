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

type Props = {
  courseId: number;
};

export function CourseRankingTab({ courseId }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["course-analytics", "course-ranking"],
    queryFn: courseAnalyticsApi.getCourseRanking,
  });

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">Đang tải bảng xếp hạng...</p>
    );
  }

  if (isError || !data) {
    return (
      <AnalyticsEmptyState
        variant="error"
        message="Không tải được bảng xếp hạng khóa học."
      />
    );
  }

  if (!data.allCourses.length) {
    return (
      <AnalyticsEmptyState message="Chưa có khóa học nào để xếp hạng." />
    );
  }

  const current = data.allCourses.find((item) => item.courseId === courseId);
  const topLearners = data.topByLearners[0];
  const topCompletion = data.topByCompletionRate[0];
  const topRating = data.topByRating[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end">
        <ExportExcelButton
          label="Export Excel"
          successMessage="Đã export bảng xếp hạng khóa học."
          onExport={() => courseAnalyticsApi.exportCourseRanking()}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Số khóa học"
          value={formatNumber(data.totalCourses)}
          hint="Xếp hạng trên các khóa học bạn được xem"
        />
        <MetricCard
          label="Nhiều học viên nhất"
          value={topLearners ? formatNumber(topLearners.learnerCount) : "—"}
          hint={topLearners?.courseName}
        />
        <MetricCard
          label="Hoàn thành cao nhất"
          value={topCompletion ? formatPercent(topCompletion.completionRate) : "—"}
          hint={topCompletion?.courseName}
        />
        <MetricCard
          label="Rating cao nhất"
          value={topRating ? `${topRating.averageRating.toFixed(2)} ★` : "—"}
          hint={topRating?.courseName}
        />
      </div>

      {current ? (
        <AnalyticsPanel
          title="Vị trí của khóa học đang chọn"
          description="So sánh khóa học này với các khóa học khác trên cùng bảng xếp hạng."
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <RankTile
              icon={Trophy}
              label="Hạng theo học viên"
              value={`#${rankOf(data.topByLearners, current.courseId)}`}
              hint={`${formatNumber(current.learnerCount)} học viên`}
            />
            <RankTile
              icon={Trophy}
              label="Hạng hoàn thành"
              value={`#${rankOf(data.topByCompletionRate, current.courseId)}`}
              hint={`${formatPercent(current.completionRate)} hoàn thành`}
            />
            <RankTile
              icon={Star}
              label="Hạng rating"
              value={`#${rankOf(data.topByRating, current.courseId)}`}
              hint={`${current.averageRating.toFixed(2)} ★ / ${formatNumber(current.totalReviews)} review`}
            />
            <RankTile
              icon={Trophy}
              label="Hạng bỏ học"
              value={`#${rankOf(data.highestDropOff, current.courseId)}`}
              hint={`${formatPercent(current.dropOffRate)} bỏ học`}
            />
          </div>
        </AnalyticsPanel>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <AnalyticsPanel
          title="Top khóa học nhiều học viên nhất"
          description="Xếp theo số lượt đăng ký."
        >
          <RankingTable items={data.topByLearners.slice(0, 5)} />
        </AnalyticsPanel>

        <AnalyticsPanel
          title="Top khóa học hoàn thành tốt nhất"
          description="Xếp theo tỷ lệ hoàn thành khóa học."
        >
          <RankingTable items={data.topByCompletionRate.slice(0, 5)} />
        </AnalyticsPanel>

        <AnalyticsPanel
          title="Top khóa học rating cao nhất"
          description="Xếp theo điểm đánh giá trung bình."
        >
          <RankingTable items={data.topByRating.slice(0, 5)} />
        </AnalyticsPanel>

        <AnalyticsPanel
          title="Khóa học có tỷ lệ bỏ học cao"
          description="Xếp theo tỷ lệ học viên chưa hoàn thành khóa học."
        >
          <RankingTable items={data.highestDropOff.slice(0, 5)} highlightDropOff />
        </AnalyticsPanel>
      </div>

      <AnalyticsPanel
        title="Bảng xếp hạng đầy đủ"
        description="Toàn bộ khóa học bạn được xem, kèm các chỉ số chính."
      >
        <div className="max-h-[560px] overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">Hạng</TableHead>
                <TableHead>Khóa học</TableHead>
                <TableHead>Giảng viên</TableHead>
                <TableHead className="text-right">Học viên</TableHead>
                <TableHead className="text-right">Hoàn thành</TableHead>
                <TableHead className="text-right">Tỷ lệ hoàn thành</TableHead>
                <TableHead className="text-right">Rating</TableHead>
                <TableHead className="text-right">Bỏ học</TableHead>
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
                    {formatPercent(item.dropOffRate)}
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
    return <AnalyticsEmptyState message="Chưa có dữ liệu xếp hạng." />;
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-14">Hạng</TableHead>
            <TableHead>Khóa học</TableHead>
            <TableHead className="text-right">
              {highlightDropOff ? "Tỷ lệ bỏ học" : "Học viên"}
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
