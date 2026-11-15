import {
  BarChart3,
  Building2,
  Clock,
  ClipboardList,
  LineChart,
  MessageSquareWarning,
  Star,
  Trophy,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CourseComparisonItem } from "@/types";

/** Một chỉ số hiển thị trong bảng so sánh. */
export type ComparisonMetric = {
  /** Tên trường trên `CourseComparisonItem`. */
  key: keyof CourseComparisonItem;
  /** Tiêu đề cột. */
  label: string;
  /** Định dạng giá trị hiển thị. */
  format: (item: CourseComparisonItem) => string;
  /**
   * `true` nếu giá trị càng CAO càng tốt (mặc định).
   * `false` nếu giá trị càng THẤP càng tốt (ví dụ: tỉ lệ bỏ học).
   */
  higherIsBetter?: boolean;
};

/** Định nghĩa của một module trong Course Analytics có dữ liệu so sánh. */
export type ComparisonModuleDef = {
  /** Khớp với `ModuleInsight.key` và key trong `moduleEvaluations`. */
  key: string;
  title: string;
  shortTitle: string;
  description: string;
  icon: LucideIcon;
  /** Chỉ số dùng để vẽ biểu đồ cột so sánh. */
  chart: {
    label: string;
    format: (value: number) => string;
    higherIsBetter: boolean;
    getValue: (item: CourseComparisonItem) => number;
  };
  /** Các cột của bảng so sánh. */
  metrics: ComparisonMetric[];
  /** Trường chứa thứ hạng của khóa học trong module này. */
  rankKey: keyof CourseComparisonItem;
  /** Đơn vị/thang đo dùng cho bảng. */
  scale?: "percent" | "number" | "rating" | "hours";
};

const pct = (value: number) => `${value.toFixed(1)}%`;
const num = (value: number) => value.toLocaleString("en-US");
const hours = (value: number) => `${value.toFixed(2)}h`;
const stars = (value: number) => `${value.toFixed(2)}★`;

/**
 * Cấu hình 9 module (8 module + tổng quan) của trang so sánh.
 * Mỗi module đều có đủ: chỉ số so sánh, biểu đồ và bảng xếp hạng.
 */
export const COMPARISON_MODULES: ComparisonModuleDef[] = [
  {
    key: "overview",
    title: "Overall Comparison",
    shortTitle: "Overview",
    description:
      "Health score of each course built from completion, engagement, rating, retention, content quality and study time.",
    icon: Trophy,
    chart: {
      label: "Overall health score",
      format: (value) => value.toFixed(1),
      higherIsBetter: true,
      getValue: (item) => item.overallScore,
    },
    metrics: [
      { key: "overallScore", label: "Health score", format: (item) => item.overallScore.toFixed(1) },
      { key: "overallVerdict", label: "Verdict", format: (item) => item.overallVerdict },
      { key: "learnerCount", label: "Learners", format: (item) => num(item.learnerCount) },
      { key: "completionRate", label: "Completion", format: (item) => pct(item.completionRate) },
      { key: "dropOffRate", label: "Drop-off", format: (item) => pct(item.dropOffRate), higherIsBetter: false },
      { key: "reviewAverageRating", label: "Rating", format: (item) => stars(item.reviewAverageRating) },
    ],
    rankKey: "overallScore",
  },
  {
    key: "funnel",
    title: "Learning Funnel",
    shortTitle: "Funnel",
    description:
      "Average lesson completion, first/last lesson rate and the biggest drop-off between two consecutive lessons.",
    icon: LineChart,
    chart: {
      label: "Average lesson completion",
      format: (value) => pct(value),
      higherIsBetter: true,
      getValue: (item) => item.funnelAvgCompletion,
    },
    metrics: [
      { key: "funnelAvgCompletion", label: "Avg completion", format: (item) => pct(item.funnelAvgCompletion) },
      { key: "funnelFirstLessonRate", label: "First lesson", format: (item) => pct(item.funnelFirstLessonRate) },
      { key: "funnelLastLessonRate", label: "Last lesson", format: (item) => pct(item.funnelLastLessonRate) },
      { key: "funnelMaxDropOff", label: "Max drop-off", format: (item) => pct(item.funnelMaxDropOff), higherIsBetter: false },
      { key: "funnelLowestLessonRate", label: "Lowest lesson", format: (item) => pct(item.funnelLowestLessonRate) },
      { key: "funnelTotalLessons", label: "Lessons", format: (item) => num(item.funnelTotalLessons) },
    ],
    rankKey: "funnelRank",
  },
  {
    key: "trend",
    title: "Trends",
    shortTitle: "Trends",
    description:
      "New enrollments, completed lessons and issued certificates inside the selected period.",
    icon: BarChart3,
    chart: {
      label: "New enrollments",
      format: (value) => num(value),
      higherIsBetter: true,
      getValue: (item) => item.trendEnrollments,
    },
    metrics: [
      { key: "trendEnrollments", label: "New enrollments", format: (item) => num(item.trendEnrollments) },
      { key: "trendEnrollmentsPerDay", label: "Per day", format: (item) => item.trendEnrollmentsPerDay.toFixed(2) },
      { key: "trendLessonsCompleted", label: "Lessons completed", format: (item) => num(item.trendLessonsCompleted) },
      { key: "trendCertificates", label: "Certificates", format: (item) => num(item.trendCertificates) },
    ],
    rankKey: "trendRank",
  },
  {
    key: "activity",
    title: "Activity & Risk",
    shortTitle: "Activity",
    description:
      "Share of learners still active and how many are flagged as at risk of dropping out.",
    icon: ClipboardList,
    chart: {
      label: "Active learner rate",
      format: (value) => pct(value),
      higherIsBetter: true,
      getValue: (item) => item.activityActiveRate,
    },
    metrics: [
      { key: "activityActiveRate", label: "Active rate", format: (item) => pct(item.activityActiveRate) },
      { key: "activityActive", label: "Active", format: (item) => num(item.activityActive) },
      { key: "activityInactive", label: "Inactive", format: (item) => num(item.activityInactive) },
      { key: "activityNeverStarted", label: "Never started", format: (item) => num(item.activityNeverStarted) },
      { key: "activityAtRisk", label: "At risk", format: (item) => num(item.activityAtRisk) },
      { key: "activityAtRiskRate", label: "At-risk rate", format: (item) => pct(item.activityAtRiskRate), higherIsBetter: false },
      { key: "activityAverageRiskScore", label: "Avg risk score", format: (item) => item.activityAverageRiskScore.toFixed(1) },
    ],
    rankKey: "activityRank",
  },
  {
    key: "reviews",
    title: "Reviews",
    shortTitle: "Reviews",
    description:
      "Average rating, review volume, review coverage and the share of low-star reviews.",
    icon: Star,
    chart: {
      label: "Average rating",
      format: (value) => stars(value),
      higherIsBetter: true,
      getValue: (item) => item.reviewAverageRating,
    },
    metrics: [
      { key: "reviewAverageRating", label: "Avg rating", format: (item) => stars(item.reviewAverageRating) },
      { key: "reviewTotal", label: "Reviews", format: (item) => num(item.reviewTotal) },
      { key: "reviewCoverage", label: "Coverage", format: (item) => pct(item.reviewCoverage) },
      { key: "reviewFiveStarRate", label: "5-star", format: (item) => pct(item.reviewFiveStarRate) },
      { key: "reviewLowStarRate", label: "1-2 star", format: (item) => pct(item.reviewLowStarRate), higherIsBetter: false },
    ],
    rankKey: "reviewRank",
  },
  {
    key: "departments",
    title: "Departments",
    shortTitle: "Departments",
    description:
      "How the same course performs across departments inside the organization.",
    icon: Building2,
    chart: {
      label: "Completion gap between departments",
      format: (value) => `${value.toFixed(1)} pts`,
      higherIsBetter: false,
      getValue: (item) => item.departmentGap,
    },
    metrics: [
      { key: "departmentGap", label: "Gap (best - worst)", format: (item) => `${item.departmentGap.toFixed(1)} pts`, higherIsBetter: false },
      { key: "departmentBestRate", label: "Best dept. rate", format: (item) => pct(item.departmentBestRate) },
      { key: "departmentWorstRate", label: "Worst dept. rate", format: (item) => pct(item.departmentWorstRate) },
      { key: "departmentCount", label: "Departments", format: (item) => num(item.departmentCount) },
    ],
    rankKey: "departmentRank",
  },
  {
    key: "ranking",
    title: "Ranking",
    shortTitle: "Ranking",
    description:
      "The four global ranking tables: learner count, completion rate, rating and drop-off rate.",
    icon: Trophy,
    chart: {
      label: "Completion rate",
      format: (value) => pct(value),
      higherIsBetter: true,
      getValue: (item) => item.completionRate,
    },
    metrics: [
      { key: "rankByLearners", label: "Rank by learners", format: (item) => `#${item.rankByLearners}` },
      { key: "rankByCompletion", label: "Rank by completion", format: (item) => `#${item.rankByCompletion}` },
      { key: "rankByRating", label: "Rank by rating", format: (item) => `#${item.rankByRating}` },
      { key: "rankByDropOff", label: "Rank by drop-off", format: (item) => `#${item.rankByDropOff}` },
    ],
    rankKey: "rankByCompletion",
  },
  {
    key: "content",
    title: "Content & Q&A",
    shortTitle: "Content & Q&A",
    description:
      "Reported content issues and how fast learner questions are answered.",
    icon: MessageSquareWarning,
    chart: {
      label: "Question answer rate",
      format: (value) => pct(value),
      higherIsBetter: true,
      getValue: (item) => item.contentAnswerRate,
    },
    metrics: [
      { key: "contentAnswerRate", label: "Answer rate", format: (item) => pct(item.contentAnswerRate) },
      { key: "contentTotalQuestions", label: "Questions", format: (item) => num(item.contentTotalQuestions) },
      { key: "contentUnanswered", label: "Unanswered", format: (item) => num(item.contentUnanswered), higherIsBetter: false },
      { key: "contentResolvedRate", label: "Reports resolved", format: (item) => pct(item.contentResolvedRate) },
      { key: "contentTotalReports", label: "Reports", format: (item) => num(item.contentTotalReports) },
      { key: "contentOpenReports", label: "Open reports", format: (item) => num(item.contentOpenReports), higherIsBetter: false },
      {
        key: "contentAverageResponseHours",
        label: "Avg response",
        format: (item) =>
          item.contentAverageResponseHours == null
            ? "—"
            : `${item.contentAverageResponseHours.toFixed(1)}h`,
      },
    ],
    rankKey: "contentRank",
  },
  {
    key: "study-time",
    title: "Study Time",
    shortTitle: "Study Time",
    description:
      "Total and per-learner study hours invested in each course.",
    icon: Clock,
    chart: {
      label: "Average study hours per learner",
      format: (value) => hours(value),
      higherIsBetter: true,
      getValue: (item) => item.studyAverageHours,
    },
    metrics: [
      { key: "studyTotalHours", label: "Total hours", format: (item) => hours(item.studyTotalHours) },
      { key: "studyAverageHours", label: "Avg hours / learner", format: (item) => hours(item.studyAverageHours) },
      { key: "studyMaxHours", label: "Max hours", format: (item) => hours(item.studyMaxHours) },
    ],
    rankKey: "studyRank",
  },
];

/** Màu badge theo xếp loại đánh giá tổng hợp. */
export const VERDICT_STYLES: Record<string, { label: string; className: string }> = {
  EXCELLENT: { label: "Excellent", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  GOOD: { label: "Good", className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  AVERAGE: { label: "Average", className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  POOR: { label: "Poor", className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
};
