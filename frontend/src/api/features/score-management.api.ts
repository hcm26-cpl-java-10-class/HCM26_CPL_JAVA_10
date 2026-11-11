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
}

export interface SmStudentRow {
  id: number;
  name: string;
  email: string;
  code: string | null;
  scores: Record<string, number>;
  finalScore: number | null;
}

export interface SmGradebook {
  courseId: number;
  courseName: string;
  columns: SmColumn[];
  totalWeight: number;
  students: SmStudentRow[];
  /** Last time the teacher confirmed with "Save scores" (ISO string) or null. */
  savedAt: string | null;
  /** True when the table differs from the last saved version. */
  unsaved: boolean;
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
}

export interface SmScanResult {
  gradebook: SmGradebook;
  created: number;
  refreshed: number;
  reports: SmImportReport[];
}

const base = "/score-management";

export const scoreManagementApi = {
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
  setCell: async (courseId: number, columnId: number, studentId: number, score: number | null): Promise<SmGradebook> =>
    (await axiosInstance.put<SmGradebook>(`${base}/courses/${courseId}/cells`, { columnId, studentId, score })).data,
  availableExams: async (courseId: number, type?: SmColumnType | null): Promise<SmAvailableExam[]> =>
    (await axiosInstance.get<SmAvailableExam[]>(`${base}/courses/${courseId}/available-exams`, { params: type ? { type } : {} })).data,
  importExam: async (columnId: number, examId: number): Promise<SmImportReport> =>
    (await axiosInstance.post<SmImportReport>(`${base}/columns/${columnId}/import`, { examId })).data,
  report: async (columnId: number): Promise<SmImportReport> =>
    (await axiosInstance.get<SmImportReport>(`${base}/columns/${columnId}/report`)).data,
};
