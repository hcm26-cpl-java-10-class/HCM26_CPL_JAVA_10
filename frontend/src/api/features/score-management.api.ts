import axiosInstance from "@/api/axios";

export interface SmCourse {
  id: number;
  name: string;
  studentCount: number;
  columnCount: number;
}

export type SmColumnType = "ASSIGNMENT" | "QUIZ" | "MIDTERM" | "FINAL_TEST";

export const SM_COLUMN_TYPES: { value: SmColumnType; label: string }[] = [
  { value: "ASSIGNMENT", label: "Assignment" },
  { value: "QUIZ", label: "Quiz" },
  { value: "MIDTERM", label: "Midterm" },
  { value: "FINAL_TEST", label: "Final" },
];

export interface SmColumn {
  id: number;
  name: string;
  type: SmColumnType | null;
  weightPercent: number;
  examId: number | null;
  examTitle: string | null;
  /** False when the linked assessment's scores are not published to students yet. */
  published: boolean;
  /** NO_ATTEMPTS / PENDING_GRADING / GRADED for the linked assessment (null without one). */
  gradingState?: "NO_ATTEMPTS" | "PENDING_GRADING" | "GRADED" | null;
}

export type SmReleasePolicy =
    | "MY_SCORES_ONLY"
    | "MY_SCORES_AND_EMAIL"
    | "HIDDEN";

export interface SmPublicationStatus {
  examId: number;
  releasePolicy: SmReleasePolicy | null;
  published: boolean;
  publishedAt: string | null;
  publishedBy: number | null;
  unpublishedAt: string | null;
  unpublishedBy: number | null;
}

export interface SmStudentRow {
  id: number;
  name: string;
  email: string;
  code: string | null;
  scores: Record<string, number>;
  /** Bonus points already included in `scores`, per column id. */
  bonuses: Record<string, number>;
  finalScore: number | null;
}

export interface SmGradebook {
  courseId: number;
  courseName: string;
  columns: SmColumn[];
  totalWeight: number;
  students: SmStudentRow[];
  /** Took a linked assessment but not enrolled (e.g. via link). Same columns and weights as the main table. */
  extraStudents?: SmStudentRow[];
  /** Last time the teacher confirmed with "Save scores" (ISO string) or null. */
  savedAt: string | null;
  /** True when the table differs from the last saved version. */
  unsaved: boolean;
}

export interface SmBonusLog {
  id: number;
  columnId: number;
  columnName: string;
  studentId: number;
  studentName: string;
  points: number;
  reason: string;
  grantedByName: string | null;
  createdAt: string;
  revokedAt: string | null;
  revokedByName: string | null;
}

export interface SmSaveLog {
  id: number;
  savedAt: string;
  savedByName: string | null;
  columnCount: number;
  studentCount: number;
  totalWeight: number;
}

export interface SmAvailableExam {
  id: number;
  title: string;
  courseName: string | null;
  inCourse: boolean;
  attemptCount: number;
}

export interface SmPerson {
  id: number;
  name: string;
  email: string;
  code: string | null;
  score: number | null;
  reason: string;
}

export interface SmImportReport {
  columnId: number;
  columnName: string;
  examId: number;
  examTitle: string;
  imported: number;
  extra: SmPerson[];
  missing: SmPerson[];
  published: boolean;
}

export interface SmScanResult {
  gradebook: SmGradebook;
  created: number;
  refreshed: number;
  reports: SmImportReport[];
}

export interface SmClass {
  id: number;
  code: string;
  name: string;
  studentCount: number;
  /** Number of distinct assessments the class members have taken. */
  assessmentCount: number;
}

export interface SmClassTypeColumn {
  type: SmColumnType;
  label: string;
  examCount: number;
  /** How many class members have a score in this type. */
  scoredCount: number;
  examTitles: string[];
}

export interface SmClassStudentRow {
  id: number;
  name: string;
  email: string;
  code: string | null;
  /** type -> mean of the student's best score per assessment of that type (10-point scale). */
  scores: Record<string, number>;
  averageScore: number | null;
  examCount: number;
}

export interface SmClassGradebook {
  classId: number;
  classCode: string;
  className: string;
  columns: SmClassTypeColumn[];
  students: SmClassStudentRow[];
  columnAverages: Record<string, number | null>;
  classAverage: number | null;
}

const base = "/score-management";

export const scoreManagementApi = {
  classes: async (): Promise<SmClass[]> => (await axiosInstance.get<SmClass[]>(`${base}/classes`)).data,
  classGradebook: async (classId: number): Promise<SmClassGradebook> =>
    (await axiosInstance.get<SmClassGradebook>(`${base}/classes/${classId}`)).data,
  courses: async (): Promise<SmCourse[]> => (await axiosInstance.get<SmCourse[]>(`${base}/courses`)).data,
  gradebook: async (courseId: number): Promise<SmGradebook> =>
    (await axiosInstance.get<SmGradebook>(`${base}/courses/${courseId}`)).data,
  autoScan: async (courseId: number): Promise<SmScanResult> =>
    (await axiosInstance.post<SmScanResult>(`${base}/courses/${courseId}/auto-scan`)).data,
  save: async (courseId: number): Promise<SmGradebook> =>
    (await axiosInstance.post<SmGradebook>(`${base}/courses/${courseId}/save`)).data,
  addColumn: async (courseId: number, weightPercent: number, type: SmColumnType): Promise<SmGradebook> =>
    (await axiosInstance.post<SmGradebook>(`${base}/courses/${courseId}/columns`, { weightPercent, type })).data,
  updateColumn: async (columnId: number, weightPercent: number, type?: SmColumnType): Promise<SmGradebook> =>
    (await axiosInstance.put<SmGradebook>(`${base}/columns/${columnId}`, { weightPercent, type })).data,
  deleteColumn: async (columnId: number): Promise<SmGradebook> =>
    (await axiosInstance.delete<SmGradebook>(`${base}/columns/${columnId}`)).data,
  bonusLog: async (courseId: number): Promise<SmBonusLog[]> =>
    (await axiosInstance.get<SmBonusLog[]>(`${base}/courses/${courseId}/bonuses`)).data,
  addBonus: async (courseId: number, body: { columnId: number; studentId: number; points: number; reason: string }): Promise<SmBonusLog[]> =>
    (await axiosInstance.post<SmBonusLog[]>(`${base}/courses/${courseId}/bonuses`, body)).data,
  revokeBonus: async (bonusId: number): Promise<SmBonusLog[]> =>
    (await axiosInstance.post<SmBonusLog[]>(`${base}/bonuses/${bonusId}/revoke`)).data,
  history: async (courseId: number): Promise<SmSaveLog[]> =>
    (await axiosInstance.get<SmSaveLog[]>(`${base}/courses/${courseId}/history`)).data,
  availableExams: async (courseId: number, type?: SmColumnType | null): Promise<SmAvailableExam[]> =>
    (await axiosInstance.get<SmAvailableExam[]>(`${base}/courses/${courseId}/available-exams`, { params: type ? { type } : {} })).data,
  importExam: async (columnId: number, examId: number): Promise<SmImportReport> =>
    (await axiosInstance.post<SmImportReport>(`${base}/columns/${columnId}/import`, { examId })).data,
  report: async (columnId: number): Promise<SmImportReport> =>
    (await axiosInstance.get<SmImportReport>(`${base}/columns/${columnId}/report`)).data,
  publicationStatus: async (
      examId: number
  ): Promise<SmPublicationStatus> =>
      (
          await axiosInstance.get<SmPublicationStatus>(
              `/exams/${examId}/result-publication`
          )
      ).data,

  publishExam: async (
      examId: number,
      releasePolicy: SmReleasePolicy
  ): Promise<SmPublicationStatus> =>
      (
          await axiosInstance.post<SmPublicationStatus>(
              `/exams/${examId}/result-publication/publish`,
              { releasePolicy }
          )
      ).data,
};
