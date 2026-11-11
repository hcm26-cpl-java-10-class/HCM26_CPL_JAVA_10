import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Lightbulb,
  Minus,
  Sparkles,
  Star,
  Trophy,
  XCircle,
} from "lucide-react";
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
import { AnalyticsEmptyState } from "@/pages/management/demo/analytics/components/AnalyticsEmptyState";
import { AnalyticsLoading } from "@/pages/management/demo/analytics/components/AnalyticsLoading";
import { AnalyticsPanel } from "@/pages/management/demo/analytics/components/AnalyticsPanel";
import { MetricCard } from "@/pages/management/demo/analytics/components/MetricCard";
import {
  AXIS_COLOR,
  CHART_COLORS,
  GRID_COLOR,
  formatNumber,
  formatPercent,
} from "@/pages/management/demo/analytics/lib/chart-helpers";
import type {
  CourseComparisonItem,
  CourseComparisonResponse,
  ModuleInsight,
} from "@/types";
import {
  COMPARISON_MODULES,
  type ComparisonModuleDef,
  VERDICT_STYLES,
} from "./comparison-config";

type Props = {
  /** Số khóa học tối thiểu để hiện bảng so sánh. */
  minCourses?: number;
};

/**
 * Panel so sánh giữa các khóa học — đặt ở TRANG CHÍNH của Course Analytics.
 *
 * <p>Mỗi module của Course Analytics có một tab riêng, bên trong gồm 3 phần:
 * <ol>
 *   <li><b>So sánh</b> — biểu đồ cột + bảng số liệu cạnh nhau giữa các khóa học.</li>
 *   <li><b>Đánh giá module</b> — nhận định tổng hợp, khóa học tốt nhất / kém nhất.</li>
 *   <li><b>Đánh giá từng khóa học</b> — nhận định riêng của mỗi khóa học trong module đó.</li>
 * </ol>
 */
export function CourseComparisonPanel({ minCourses = 2 }: Props) {
  const [moduleKey, setModuleKey] = useState<string>(COMPARISON_MODULES[0].key);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["course-analytics", "course-comparison"],
    queryFn: () => courseAnalyticsApi.getCourseComparison(),
  });

  const activeModule = useMemo(
    () =>
      COMPARISON_MODULES.find((item) => item.key === moduleKey) ??
      COMPARISON_MODULES[0],
    [moduleKey],
  );

  if (isLoading) {
    return <AnalyticsLoading label="Loading the course comparison..." />;
  }

  if (isError || !data) {
    return (
      <AnalyticsEmptyState
        variant="error"
        message="Could not load the course comparison. Make sure you have access to at least one course."
      />
    );
  }

  if (data.courses.length < minCourses) {
    return (
      <AnalyticsEmptyState
        message={`The comparison needs at least ${minCourses} courses. You currently have ${data.courses.length} course available.`}
      />
    );
  }

  return (
    <div className="space-y-4">
      <ComparisonHeader data={data} />

      <div className="overflow-x-auto">
        <div
          role="tablist"
          aria-label="Comparison modules"
          className="inline-flex min-w-full items-center gap-1 rounded-xl border bg-card p-1"
        >
          {COMPARISON_MODULES.map((module) => {
            const Icon = module.icon;
            const isActive = module.key === activeModule.key;
            return (
              <button
                key={module.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setModuleKey(module.key)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Icon className="size-4" />
                {module.shortTitle}
              </button>
            );
          })}
        </div>
      </div>

      <div
        key={activeModule.key}
        className="min-w-0 animate-in fade-in slide-in-from-bottom-2 duration-300"
      >
        <ModuleComparison
          module={activeModule}
          data={data}
          courses={data.courses}
        />
      </div>
    </div>
  );
}

/** ======================================================================
 *  Header: thông tin chung + bảng điểm tổng hợp
 *  ====================================================================== */

function ComparisonHeader({ data }: { data: CourseComparisonResponse }) {
  const best = data.courses[0];
  const worst = data.courses[data.courses.length - 1];
  const avgScore =
    data.courses.reduce((sum, item) => sum + item.overallScore, 0) /
    Math.max(1, data.courses.length);
  const totalLearners = data.courses.reduce(
    (sum, item) => sum + item.learnerCount,
    0,
  );
  const avgRating =
    data.courses.reduce((sum, item) => sum + item.reviewAverageRating, 0) /
    Math.max(1, data.courses.length);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="size-4 text-primary" />
              Course Comparison
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Every course you can access is compared side by side across all
              modules of Course Analytics, each one with its own evaluation.
            </p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div>
              Period: <span className="font-medium text-foreground">{data.from}</span>{" "}
              → <span className="font-medium text-foreground">{data.to}</span>
            </div>
            <div>
              Inactive threshold:{" "}
              <span className="font-medium text-foreground">
                {data.inactiveThresholdDays} days
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Courses compared"
          value={formatNumber(data.totalCourses)}
          hint="All courses you can access"
        />
        <MetricCard
          label="Total learners"
          value={formatNumber(totalLearners)}
          hint={`Avg. ${formatPercent(
            data.courses.reduce((sum, item) => sum + item.learnerCount, 0) /
              Math.max(1, data.courses.length),
          )} per course`}
        />
        <MetricCard
          label="Avg. health score"
          value={avgScore.toFixed(1)}
          hint={`${best?.courseName ?? "—"} leads with ${best?.overallScore.toFixed(1) ?? "—"}`}
        />
        <MetricCard
          label="Avg. rating"
          value={`${avgRating.toFixed(2)} ★`}
          hint={`Lowest: ${worst?.courseName ?? "—"}`}
        />
      </div>
    </div>
  );
}

/** ======================================================================
 *  Nội dung của một module: so sánh + đánh giá
 *  ====================================================================== */

function ModuleComparison({
  module,
  data,
  courses,
}: {
  module: ComparisonModuleDef;
  data: CourseComparisonResponse;
  courses: CourseComparisonItem[];
}) {
  const insight = data.modules.find((item) => item.key === module.key);

  return (
    <div className="space-y-3">
      {/* ---------- 1. SO SÁNH: biểu đồ ---------- */}
      <AnalyticsPanel
        title={`${module.title} — comparison chart`}
        description={module.description}
      >
        <ComparisonChart module={module} courses={courses} />
      </AnalyticsPanel>

      {/* ---------- 2. ĐÁNH GIÁ của module ---------- */}
      <ModuleEvaluation insight={insight} module={module} />

      {/* ---------- 3. SO SÁNH: bảng số liệu ---------- */}
      <AnalyticsPanel
        title={`${module.title} — side-by-side data`}
        description="Every metric of this module, aligned course by course. The best value in each row is highlighted."
      >
        <ComparisonTable module={module} courses={courses} />
      </AnalyticsPanel>

      {/* ---------- 4. ĐÁNH GIÁ riêng của từng khóa học ---------- */}
      <AnalyticsPanel
        title={`${module.title} — evaluation per course`}
        description="A written assessment for each course in this module: its own numbers, its position in the ranking and what to do next."
      >
        <PerCourseEvaluations module={module} courses={courses} />
      </AnalyticsPanel>
    </div>
  );
}

/** Biểu đồ cột so sánh giữa các khóa học. */
function ComparisonChart({
  module,
  courses,
}: {
  module: ComparisonModuleDef;
  courses: CourseComparisonItem[];
}) {
  const data = courses.map((course) => ({
    name: course.courseName,
    shortName:
      course.courseName.length > 16
        ? `${course.courseName.slice(0, 15)}…`
        : course.courseName,
    value: module.chart.getValue(course),
  }));

  // Chỉ số "càng thấp càng tốt" được tô xanh; "càng cao càng tốt" tô xanh lá.
  const best = module.chart.higherIsBetter
    ? Math.max(...data.map((item) => item.value))
    : Math.min(...data.map((item) => item.value));
  const worst = module.chart.higherIsBetter
    ? Math.min(...data.map((item) => item.value))
    : Math.max(...data.map((item) => item.value));

  const colorFor = (value: number) => {
    if (value === best) return CHART_COLORS[1];
    if (value === worst) return CHART_COLORS[3];
    return CHART_COLORS[0];
  };

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 20, bottom: 60, left: 0 }}>
          <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="shortName"
            tick={{ fill: AXIS_COLOR, fontSize: 11 }}
            angle={-25}
            textAnchor="end"
            interval={0}
            height={60}
          />
          <YAxis tick={{ fill: AXIS_COLOR, fontSize: 11 }} width={50} />
          <Tooltip
            shared={false}
            cursor={false}
            wrapperStyle={{ pointerEvents: "none", zIndex: 50 }}
            formatter={(value) => [module.chart.format(Number(value)), module.chart.label]}
            labelFormatter={(_, payload) => {
              const row = payload?.[0]?.payload as { name?: string } | undefined;
              return row?.name ?? "";
            }}
          />
          <Bar
            isAnimationActive
            animationDuration={850}
            animationEasing="ease-out"
            dataKey="value"
            radius={[6, 6, 0, 0]}
            maxBarSize={90}
          >
            {data.map((row) => (
              <Cell key={row.name} fill={colorFor(row.value)} />
            ))}
            <LabelList
              dataKey="value"
              position="top"
              formatter={(value: unknown) => module.chart.format(Number(value))}
              style={{ fill: AXIS_COLOR, fontSize: 11 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Nhận định tổng hợp của module + khóa học tốt nhất / kém nhất. */
function ModuleEvaluation({
  insight,
  module,
}: {
  insight?: ModuleInsight;
  module: ComparisonModuleDef;
}) {
  if (!insight) {
    return (
      <AnalyticsEmptyState message="No evaluation available for this module." />
    );
  }

  const Icon = module.icon;

  return (
    <AnalyticsPanel
      title={`${module.title} — evaluation`}
      description={`Assessment based on "${insight.bestMetric}".`}
      action={
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Icon className="size-3.5" />
          {insight.bestMetric}
        </span>
      }
    >
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <Lightbulb className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-sm font-medium">Overall assessment</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {insight.evaluation}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <WinnerCard
            icon={CheckCircle2}
            tone="best"
            title={`Best on ${insight.bestMetric}`}
            courseName={insight.bestCourseName}
            value={
              insight.bestValue == null
                ? "—"
                : module.chart.format(insight.bestValue)
            }
          />
          <WinnerCard
            icon={XCircle}
            tone="worst"
            title={`Lowest on ${insight.bestMetric}`}
            courseName={insight.worstCourseName}
            value={
              insight.worstValue == null
                ? "—"
                : module.chart.format(insight.worstValue)
            }
          />
        </div>
      </div>
    </AnalyticsPanel>
  );
}

function WinnerCard({
  icon: Icon,
  tone,
  title,
  courseName,
  value,
}: {
  icon: typeof Trophy;
  tone: "best" | "worst";
  title: string;
  courseName?: string | null;
  value: string;
}) {
  const toneClass =
    tone === "best"
      ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/40"
      : "border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/40";
  const iconClass =
    tone === "best"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-red-600 dark:text-red-400";

  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <div className={`flex items-center gap-2 text-xs font-medium ${iconClass}`}>
        <Icon className="size-4" />
        {title}
      </div>
      <div className="mt-1.5 truncate text-base font-semibold" title={courseName ?? ""}>
        {courseName ?? "—"}
      </div>
      <div className="mt-0.5 text-sm text-muted-foreground">{value}</div>
    </div>
  );
}

/** Bảng so sánh số liệu giữa các khóa học. */
function ComparisonTable({
  module,
  courses,
}: {
  module: ComparisonModuleDef;
  courses: CourseComparisonItem[];
}) {
  // Sắp xếp theo thứ hạng của module (nhỏ hơn = tốt hơn).
  const sorted = [...courses].sort(
    (a, b) =>
      Number(a[module.rankKey] ?? 0) - Number(b[module.rankKey] ?? 0),
  );

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="max-h-[560px] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">Rank</TableHead>
              <TableHead>Course</TableHead>
              {module.metrics.map((metric) => (
                <TableHead key={String(metric.key)} className="text-right">
                  {metric.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((course, index) => (
              <TableRow key={course.courseId}>
                <TableCell className="font-medium text-muted-foreground">
                  {index + 1}
                </TableCell>
                <TableCell className="font-medium">{course.courseName}</TableCell>
                {module.metrics.map((metric) => {
                  const isBest = isBestValue(courses, metric, course);
                  return (
                    <TableCell
                      key={String(metric.key)}
                      className={`text-right tabular-nums ${
                        isBest ? "font-semibold text-emerald-600 dark:text-emerald-400" : ""
                      }`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {isBest ? (
                          <Star className="size-3 fill-amber-400 text-amber-400" />
                        ) : null}
                        {metric.format(course)}
                      </span>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/** Kiểm tra giá trị của `course` có phải giá trị tốt nhất trong cột không. */
function isBestValue(
  courses: CourseComparisonItem[],
  metric: { key: keyof CourseComparisonItem; higherIsBetter?: boolean },
  course: CourseComparisonItem,
): boolean {
  const raw = course[metric.key];
  if (typeof raw !== "number") return false;

  const values = courses
    .map((item) => item[metric.key])
    .filter((value): value is number => typeof value === "number");
  if (!values.length) return false;

  const best = metric.higherIsBetter === false
    ? Math.min(...values)
    : Math.max(...values);
  return raw === best;
}

/** Nhận định riêng cho từng khóa học trong module. */
function PerCourseEvaluations({
  module,
  courses,
}: {
  module: ComparisonModuleDef;
  courses: CourseComparisonItem[];
}) {
  const sorted = [...courses].sort(
    (a, b) =>
      Number(a[module.rankKey] ?? 0) - Number(b[module.rankKey] ?? 0),
  );

  return (
    <div className="space-y-2">
      {sorted.map((course, index) => {
        const evaluation =
          course.moduleEvaluations?.[module.key] ??
          "No evaluation available for this course.";
        const verdict = VERDICT_STYLES[course.overallVerdict];
        const rank = index + 1;
        const previous = index > 0 ? sorted[index - 1] : undefined;

        return (
          <div
            key={course.courseId}
            className="rounded-xl border bg-card p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${
                    rank === 1
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  #{rank}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    {course.courseName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {course.instructor || "No instructor"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {verdict ? (
                  <Badge className={verdict.className}>{verdict.label}</Badge>
                ) : null}
                <Badge variant="outline">{course.overallScore.toFixed(1)}</Badge>
              </div>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {evaluation}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Trophy className="size-3.5" />
                {module.title} rank: #{rank} / {courses.length}
              </span>
              <span className="inline-flex items-center gap-1">
                <Sparkles className="size-3.5" />
                Health score: {course.overallScore.toFixed(1)}
              </span>
              {previous ? (
                <span className="inline-flex items-center gap-1">
                  {course.overallScore > previous.overallScore ? (
                    <ArrowUpRight className="size-3.5 text-emerald-600" />
                  ) : course.overallScore < previous.overallScore ? (
                    <ArrowDownRight className="size-3.5 text-red-600" />
                  ) : (
                    <Minus className="size-3.5" />
                  )}
                  vs {previous.courseName}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
