import type { Language, Period, ReportDetail, ReportItem } from "./report-api";
import { dateOffset, monday } from "../habits/habit-format";

export const sectionLabels = {
  OVERVIEW: ["Learning Overview", "Tổng quan học tập"], COURSES: ["Course Progress", "Tiến độ khóa học"],
  STUDY: ["Study Time & Habits", "Thời gian và thói quen học"], ROADMAP: ["Learning Roadmap", "Lộ trình học tập"],
  OBJECTIVES: ["Personal Objectives", "Mục tiêu cá nhân"], ASSESSMENTS: ["Assessment Results", "Kết quả đánh giá"],
  AI: ["AI Analysis & Recommendations", "Phân tích và đề xuất của AI"],
} as const;
export const periods = { WEEKLY: "Weekly", MONTHLY: "Monthly", QUARTERLY: "Quarterly", CUSTOM: "Custom" } as const;
export const aiStatuses = { NOT_REQUESTED: "Standard", PENDING: "Analysis in progress",
  AVAILABLE: "AI analysis available", UNAVAILABLE: "AI analysis unavailable" };
export const translator = (language: Language) => (en: string, vi: string) => language === "VI" ? vi : en;

export function reportPeriod(type: Exclude<Period, "CUSTOM">, date: string, today: string) {
  if (type === "WEEKLY") {
    const from = monday(date);
    const end = dateOffset(from, 6);
    return { from, to: end > today ? today : end, ongoing: end > today };
  }
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7)) - 1;
  const startMonth = type === "MONTHLY" ? month : Math.floor(month / 3) * 3;
  const from = new Date(Date.UTC(year, startMonth, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(year, startMonth + (type === "MONTHLY" ? 1 : 3), 0)).toISOString().slice(0, 10);
  return { from, to: end > today ? today : end, ongoing: end > today };
}

export function dateText(value: string, language: Language = "EN", zone = "UTC") {
  const instant = value.length === 10 ? value + "T00:00:00Z" : value;
  return new Intl.DateTimeFormat(language === "VI" ? "vi-VN" : "en", {
    dateStyle: "medium", ...(value.length > 10 ? { timeStyle: "short" } : {}), timeZone: value.length === 10 ? "UTC" : zone,
  }).format(new Date(instant));
}
export function rangeText(report: ReportItem) {
  return dateText(report.from, report.language) + " – " + dateText(report.to, report.language);
}
export interface ReportBlock { title: string; rows: [string, string][] }

export function reportBlocks({ report, snapshot: s, analysis, evidence }: ReportDetail): ReportBlock[] {
  const t = translator(report.language);
  const locale = report.language === "VI" ? "vi-VN" : "en";
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const percent = (value: number | null) => value == null ? "—" : number.format(value) + "%";
  const minutes = (seconds: number | null) => seconds == null ? "—" : number.format(seconds / 60) + t(" min", " phút");
  const status = (value: string) => ({
    COMPLETED: t("Completed", "Hoàn thành"), IN_PROGRESS: t("In progress", "Đang học"),
    ENROLLED: t("Not started", "Chưa bắt đầu"), UNKNOWN: t("Unknown", "Chưa có dữ liệu"),
    PLANNED: t("Planned", "Dự kiến"), UNAVAILABLE: t("Unavailable", "Không khả dụng"),
    CURRENT: t("Current", "Hiện tại"), UPCOMING: t("Upcoming", "Sắp tới"),
  }[value] ?? value);
  const label = (key: keyof typeof sectionLabels) => t(sectionLabels[key][0], sectionLabels[key][1]);
  const blocks: ReportBlock[] = [];
  const push = (title: string, rows: [string, string][]) => blocks.push({ title, rows });
  if (s.overview) {
    const o = s.overview;
    push(label("OVERVIEW"), [
      [t("Enrolled courses", "Khóa đã đăng ký"), String(o.enrolled)],
      [t("Enrolled during period", "Đăng ký trong kỳ"), String(o.enrolledInPeriod)],
      [status("COMPLETED"), String(o.completed)], [status("IN_PROGRESS"), String(o.inProgress)],
      [status("ENROLLED"), String(o.notStarted)], [status("UNKNOWN"), String(o.unknown)],
      [t("Current completion rate", "Tỷ lệ hoàn thành hiện tại"), percent(o.completionRate)],
      [t("Average course progress", "Tiến độ khóa trung bình"), o.averageProgress == null ? "—" :
        percent(o.averageProgress) + " · " + o.measuredCourses + t(" measured courses", " khóa có dữ liệu")],
    ]);
  }
  if (s.courses) push(label("COURSES"), s.courses.map(row => [row.name, [
    status(row.status), percent(row.percent),
    row.totalLessons == null ? null : row.completedLessons + "/" + row.totalLessons + t(" lessons", " bài học"),
    row.enrolledOn == null ? null : t("Enrolled ", "Đăng ký ") + dateText(row.enrolledOn, report.language),
  ].filter(Boolean).join(" · ")]));
  if (s.study) {
    const data = s.study;
    push(label("STUDY"), [
      [t("Planned study", "Kế hoạch học"), minutes(data.plannedSeconds)],
      [t("Recorded study", "Thời gian đã ghi"), minutes(data.actualSeconds)],
      [t("Timer recorded", "Ghi bằng bộ đếm"), minutes(data.timerSeconds)],
      [t("Self-reported", "Tự khai báo"), minutes(data.selfReportedSeconds)],
      [t("Remaining target", "Còn lại"), minutes(data.remainingSeconds)],
      [t("Achievement", "Mức độ đạt mục tiêu"), percent(data.achievement)],
      [t("Days with applicable targets", "Số ngày có mục tiêu"), String(data.coveredDays)],
      [t("Study on covered days", "Thời gian học trong ngày có mục tiêu"), minutes(data.coveredActualSeconds)],
      [t("Active days", "Ngày hoạt động"), String(data.activeDays)],
      [t("Average per active day", "Trung bình mỗi ngày hoạt động"), minutes(data.averageActiveDaySeconds)],
      [t("Streak at period end", "Chuỗi ngày đến cuối kỳ"), String(data.currentStreak)],
      [t("Longest streak in period", "Chuỗi dài nhất trong kỳ"), String(data.longestStreak)],
    ]);
    push(t("Planned vs. recorded by week", "Kế hoạch và thời gian ghi theo tuần"), data.weeks.map(row =>
      [dateText(row.start, report.language), minutes(row.plannedSeconds) + " / " + minutes(row.actualSeconds)]));
    if (data.byCourse.length) push(t("Study by course", "Thời gian theo khóa"), data.byCourse.map(row =>
      [row.courseId == null ? t("General Study", "Học chung") : row.name, minutes(row.seconds)]));
  }
  if (s.roadmap) {
    const roadmap = s.roadmap;
    const rows: [string, string][] = [
      [t("Career goal", "Mục tiêu nghề nghiệp"), roadmap.goal],
      [t("Skill level", "Trình độ"), roadmap.level],
      [t("Roadmap version", "Phiên bản lộ trình"), [roadmap.title, String(roadmap.revision), roadmap.generatedAt &&
        dateText(roadmap.generatedAt, report.language, report.zone)].filter(Boolean).join(" · ")],
      [t("Planned study budget", "Ngân sách thời gian học"), minutes(roadmap.budgetMinutes)],
      [t("Target weeks", "Số tuần dự kiến"), String(roadmap.weeks ?? "—")],
      [t("Phase completion", "Tiến độ giai đoạn"), roadmap.completionRate == null ? "—" :
        roadmap.completedPhases + "/" + roadmap.phases.length + " · " + percent(roadmap.completionRate)],
    ];
    roadmap.phases.forEach(phase => {
      rows.push([phase.title, [status(phase.status), t("Weeks ", "Tuần ") + phase.startWeek + "–" + phase.endWeek,
        phase.objective].filter(Boolean).join(" · ")]);
      phase.courses.forEach(course => rows.push([course.name, status(course.status) + " · " + percent(course.percent)]));
    });
    push(label("ROADMAP"), rows);
  } else if (report.sections.includes("ROADMAP")) push(label("ROADMAP"), []);
  if (s.objectives) {
    const o = s.objectives;
    push(label("OBJECTIVES"), [[t("Completion", "Tỷ lệ hoàn thành"), o.completed + "/" + o.total +
      " · " + percent(o.total ? o.completed * 100 / o.total : null)],
      [status("COMPLETED"), String(o.completed)], [t("Incomplete", "Chưa hoàn thành"), String(o.total - o.completed)],
      [t("Overdue", "Quá hạn"), String(o.overdue)], [t("Completed during period", "Hoàn thành trong kỳ"), String(o.completedDuringPeriod)]]);
  }
  if (s.assessments) push(label("ASSESSMENTS"), [
    [t("Published results", "Kết quả đã công bố"), String(s.assessments.results)],
    [t("Average normalized score", "Điểm chuẩn hóa trung bình"), percent(s.assessments.averagePercent)],
    ...s.assessments.scores.map((row): [string, string] => [
      row.title, number.format(row.score) + "/" + number.format(row.maxScore) + " · " + percent(row.percent)
        + " · " + dateText(row.submittedAt, report.language, report.zone),
    ]),
  ]);
  if (analysis) {
    const names = new Map([...s.courses ?? [], ...s.roadmap?.phases.flatMap(phase => phase.courses) ?? []]
      .map(row => ["course_" + row.id, row.name]));
    push(label("AI"), [[t("Executive summary", "Tóm tắt"), analysis.executiveSummary],
      ...[...analysis.achievements, ...analysis.improvementAreas].map((row): [string, string] =>
        [row.title, row.description + " · " + row.evidenceMetricIds.map(key =>
          key + " = " + number.format(evidence[key])).join(", ")]),
      ...analysis.recommendations.map((row): [string, string] =>
        [t("Recommendation", "Khuyến nghị") + " · " + row.priority, [row.action, row.reason,
          ...row.relatedCourseIds.map(id => names.get(id))].filter(Boolean).join(" · ")]),
      ...analysis.nextPeriodActionPlan.map((text): [string, string] => [t("Next period action", "Việc làm kỳ tới"), text]),
      ...analysis.dataLimitations.map((text): [string, string] => [t("AI limitation", "Giới hạn phân tích AI"), text]),
    ]);
  } else if (report.sections.includes("AI")) {
    push(label("AI"), [[t("Status", "Trạng thái"), report.aiStatus === "PENDING"
      ? t("Analysis in progress", "Đang phân tích") : t("AI analysis unavailable", "Phân tích AI không khả dụng")]]);
  }
  const limits: Record<string, string> = {
    COURSE_STATUS_CURRENT: t("Course status is measured at generation. Historical completion dates are unavailable.",
      "Trạng thái khóa học tại lúc tạo. Không có ngày hoàn thành lịch sử đáng tin cậy."),
    COURSE_PROGRESS_UNAVAILABLE: t("Course progress is unavailable with the current permissions.", "Quyền hiện tại không cho phép đọc tiến độ."),
    OBJECTIVE_STATUS_CURRENT: t("Checklist status is current. Only the recorded completion timestamp is available.",
      "Đây là trạng thái checklist hiện tại. Chỉ có thời điểm hoàn thành đang lưu."),
    STUDY_SELF_REPORTED: t("Study logs do not verify course completion. Date-only logs cannot establish time-of-day overlap.",
      "Nhật ký học không xác minh hoàn thành khóa. Nhật ký chỉ có ngày không xác định được giờ trùng nhau."),
    ROADMAP_UNAVAILABLE: t("No roadmap has been saved.", "Chưa có lộ trình đã lưu."),
    ROADMAP_CURRENT: t("Roadmap and phase status are captured at generation.", "Lộ trình và trạng thái giai đoạn tại lúc tạo báo cáo."),
    PUBLISHED_ASSESSMENTS_ONLY: t("Includes published scores only, normalized by score divided by maximum.",
      "Chỉ gồm điểm đã công bố, tính chuẩn hóa bằng điểm đạt chia điểm tối đa."),
  };
  if (s.limitations.length) push(t("Data limitations", "Giới hạn dữ liệu"), s.limitations.map(key => ["", limits[key] ?? key]));
  return blocks;
}
