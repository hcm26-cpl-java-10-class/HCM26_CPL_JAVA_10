import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";
import type { GoalsHabitsDashboardData, PerformanceDashboardData } from "../dashboard-api";

export function exportPerformancePdf(data: PerformanceDashboardData) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = 48;
  doc.setFontSize(16);
  doc.text("Learning Performance Report", 40, y);
  y += 20;
  doc.setFontSize(10);
  doc.text(`Period: ${data.from} to ${data.to} (${data.zone})`, 40, y);
  y += 24;

  if (data.overview) {
    doc.setFontSize(12);
    doc.text("Overview KPIs (Current Snapshot)", 40, y);
    y += 16;
    doc.setFontSize(10);
    const lines = [
      `Total Enrolled: ${data.overview.enrolled}`,
      `Completed: ${data.overview.completed}`,
      `In Progress: ${data.overview.inProgress}`,
      `Not Started: ${data.overview.notStarted}`,
      `Completion Rate: ${data.overview.completionRate != null ? data.overview.completionRate.toFixed(1) + "%" : "—"}`,
      `Average Progress: ${data.overview.averageProgress != null ? data.overview.averageProgress.toFixed(1) + "%" : "—"}`,
    ];
    for (const line of lines) {
      doc.text(line, 48, y);
      y += 14;
    }
    y += 10;
  }

  if (data.courses && data.courses.length > 0) {
    doc.setFontSize(12);
    doc.text("Course Progress", 40, y);
    y += 16;
    doc.setFontSize(9);
    for (const c of data.courses.slice(0, 25)) {
      if (y > 760) {
        doc.addPage();
        y = 48;
      }
      doc.text(`${c.name} — ${c.status} (${c.percent != null ? c.percent + "%" : "—"})`, 48, y);
      y += 14;
    }
  }
  doc.save(`learning-performance-${data.from}-to-${data.to}.pdf`);
}

export function exportPerformanceExcel(data: PerformanceDashboardData) {
  const wb = XLSX.utils.book_new();
  if (data.overview) {
    const kpiSheet = XLSX.utils.json_to_sheet([
      {
        From: data.from,
        To: data.to,
        Zone: data.zone,
        Enrolled: data.overview.enrolled,
        Completed: data.overview.completed,
        InProgress: data.overview.inProgress,
        NotStarted: data.overview.notStarted,
        CompletionRatePercent: data.overview.completionRate ?? "",
        AverageProgressPercent: data.overview.averageProgress ?? "",
      },
    ]);
    XLSX.utils.book_append_sheet(wb, kpiSheet, "Overview");
  }
  if (data.courses) {
    const courseSheet = XLSX.utils.json_to_sheet(
      data.courses.map((c) => ({
        CourseId: c.id,
        CourseName: c.name,
        Status: c.status,
        ProgressPercent: c.percent ?? "",
        CompletedLessons: c.completedLessons ?? "",
        TotalLessons: c.totalLessons ?? "",
      })),
    );
    XLSX.utils.book_append_sheet(wb, courseSheet, "Courses");
  }
  XLSX.writeFile(wb, `learning-performance-${data.from}-to-${data.to}.xlsx`);
}

export function exportGoalsHabitsPdf(data: GoalsHabitsDashboardData) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = 48;
  doc.setFontSize(16);
  doc.text("Goals & Habits Report", 40, y);
  y += 20;
  doc.setFontSize(10);
  doc.text(`Period: ${data.from} to ${data.to} (${data.zone})`, 40, y);
  y += 24;

  if (data.study) {
    doc.setFontSize(12);
    doc.text("Study Summary", 40, y);
    y += 16;
    doc.setFontSize(10);
    const lines = [
      `Recorded Study Time: ${Math.round(data.study.actualSeconds / 60)} min`,
      `Planned Study Time: ${data.study.plannedSeconds != null ? Math.round(data.study.plannedSeconds / 60) + " min" : "—"}`,
      `Goal Achievement: ${data.study.achievement != null ? data.study.achievement.toFixed(1) + "%" : "—"}`,
      `Active Days: ${data.study.activeDays}`,
      `Current Streak: ${data.study.currentStreak} days`,
      `Longest Streak: ${data.study.longestStreak} days`,
    ];
    for (const line of lines) {
      doc.text(line, 48, y);
      y += 14;
    }
  }
  doc.save(`goals-habits-${data.from}-to-${data.to}.pdf`);
}

export function exportGoalsHabitsExcel(data: GoalsHabitsDashboardData) {
  const wb = XLSX.utils.book_new();
  if (data.study) {
    const summarySheet = XLSX.utils.json_to_sheet([
      {
        From: data.from,
        To: data.to,
        Zone: data.zone,
        ActualMinutes: Math.round(data.study.actualSeconds / 60),
        PlannedMinutes: data.study.plannedSeconds != null ? Math.round(data.study.plannedSeconds / 60) : "",
        AchievementPercent: data.study.achievement ?? "",
        ActiveDays: data.study.activeDays,
        CurrentStreak: data.study.currentStreak,
        LongestStreak: data.study.longestStreak,
      },
    ]);
    XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

    const dailySheet = XLSX.utils.json_to_sheet(
      data.study.days.map((d) => ({
        Date: d.date,
        TotalMinutes: Math.round(d.seconds / 60),
        ManualMinutes: Math.round(d.selfReportedSeconds / 60),
        Active: d.active ? "Yes" : "No",
      })),
    );
    XLSX.utils.book_append_sheet(wb, dailySheet, "DailyActivity");
  }
  XLSX.writeFile(wb, `goals-habits-${data.from}-to-${data.to}.xlsx`);
}
