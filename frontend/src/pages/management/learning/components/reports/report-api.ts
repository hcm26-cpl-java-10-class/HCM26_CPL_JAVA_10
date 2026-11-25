import axios from "@/api/axios";
export type Period = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "CUSTOM";
export type Section = "OVERVIEW" | "COURSES" | "STUDY" | "ROADMAP" | "OBJECTIVES" | "ASSESSMENTS" | "AI";
export type Mode = "STANDARD" | "AI_ENHANCED";
export type Language = "EN" | "VI";
export interface ReportInput {
  requestKey: string; title: string; type: Period; from: string; to: string;
  language: Language; mode: Mode; sections: Section[];
}
export interface ReportItem extends Omit<ReportInput, "requestKey"> {
  id: number; zone: string; generatedAt: string; periodToDate: boolean; retryable: boolean;
  aiStatus: "NOT_REQUESTED" | "PENDING" | "AVAILABLE" | "UNAVAILABLE";
}
export interface Course {
  id: number; name: string; enrolledOn: string | null; status: string; percent: number | null;
  completedLessons: number | null; totalLessons: number | null;
}
export interface ReportDetail {
  report: ReportItem;
  snapshot: {
    learner: string;
    overview: { enrolled: number; enrolledInPeriod: number; completed: number; inProgress: number;
      notStarted: number; unknown: number; completionRate: number | null; averageProgress: number | null; measuredCourses: number } | null;
    courses: Course[] | null;
    study: { actualSeconds: number; timerSeconds: number; selfReportedSeconds: number; plannedSeconds: number | null;
      remainingSeconds: number | null; coveredDays: number; coveredActualSeconds: number | null; achievement: number | null;
      activeDays: number; averageActiveDaySeconds: number; currentStreak: number; longestStreak: number;
      weeks: { start: string; plannedSeconds: number | null; actualSeconds: number }[];
      days: { date: string; seconds: number; selfReportedSeconds: number; active: boolean }[];
      byCourse: { courseId: number | null; name: string; seconds: number }[] } | null;
    roadmap: { goal: string; level: string; title: string | null; revision: number; generatedAt: string | null;
      weeks: number | null; budgetMinutes: number; completedPhases: number; completionRate: number | null;
      phases: { title: string; status: string; startWeek: number; endWeek: number; objective: string | null; courses: Course[] }[] } | null;
    objectives: { total: number; completed: number; overdue: number; completedDuringPeriod: number } | null;
    assessments: { results: number; averagePercent: number | null; scores: {
      title: string; submittedAt: string; score: number; maxScore: number; percent: number }[] } | null;
    limitations: string[];
  };
  analysis: { executiveSummary: string; achievements: Finding[]; improvementAreas: Finding[];
    recommendations: { priority: string; action: string; reason: string; relatedCourseIds: string[] }[];
    nextPeriodActionPlan: string[]; dataLimitations: string[] } | null;
  evidence: Record<string, number>;
}
interface Finding { title: string; description: string; evidenceMetricIds: string[] }
export interface Options { today: string; zone: string; maxDays: number; aiAvailable: boolean; sections: Section[] }
export interface History { items: ReportItem[]; matches: number; totalSaved: number; createdThisMonth: number; lastGenerated: string | null }
const path = "/learning/me/reports";
export const reportApi = {
  options: async (signal: AbortSignal) => (await axios.get<Options>(path + "/options", { signal })).data,
  history: async (params: object, signal: AbortSignal) => (await axios.get<History>(path, { params, signal })).data,
  detail: async (id: number, signal: AbortSignal) => (await axios.get<ReportDetail>(path + "/" + id, { signal })).data,
  create: async (input: ReportInput) => (await axios.post<ReportDetail>(path, input)).data,
  rename: async (id: number, title: string) => axios.patch(path + "/" + id + "/title", { title }),
  remove: async (id: number) => axios.delete(path + "/" + id),
  retry: async (id: number) => (await axios.post<ReportDetail>(path + "/" + id + "/retry-ai")).data,
  xlsx: async (id: number) => (await axios.get<Blob>(path + "/" + id + "/export/xlsx", { responseType: "blob" })).data,
};
