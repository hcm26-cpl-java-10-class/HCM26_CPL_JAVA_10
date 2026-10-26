import axiosInstance from "../axios";

export type AssignmentRole = "MAIN" | "ASSISTANT";

export interface SharedClass {
  id: number;
  code: string;
  name: string;
  programId?: number | null;
  status?: string;
}

export interface SharedTrainer {
  id: number;
  name: string;
  email?: string;
  status?: string;
}

export interface TeachingAssignmentRequest {
  classId: number;
  programSubjectId: number;
  trainerId: number;
  role: AssignmentRole;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface TeachingAssignment {
  id: number;
  classId: number;
  classCode: string | null;
  programSubjectId: number;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  trainerId: number;
  trainerName: string | null;
  role: AssignmentRole;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface ClassProgramSubjects {
  classId: number;
  classCode: string;
  className: string;
  program: {
    id: number;
    code: string;
    name: string;
    version: string;
    status: "DRAFT" | "ACTIVE" | "INACTIVE";
  } | null;
  subjects: Array<{
    programSubjectId: number;
    subjectId: number;
    subjectCode: string;
    subjectName: string;
    durationHours: number;
    orderIndex: number;
    assignments: TeachingAssignment[];
  }>;
}

export interface AssignmentPage<T> {
  content: T[];
  number: number;
  size: number;
  totalPages: number;
  totalElements: number;
}

export interface AssignmentSearchParams {
  search?: string;
  classId?: number;
  subjectId?: number;
  programSubjectId?: number;
  trainerId?: number;
  role?: AssignmentRole;
  effectiveOn?: string;
  page?: number;
  size?: number;
  sort?: string;
}

export interface AssignmentOptions {
  classes: SharedClass[];
  trainers: SharedTrainer[];
  subjects: Array<{ id: number; code: string; name: string; version: string }>;
  sampleData: boolean;
}

export const classSetupApi = {
  getDataSource: async () =>
    (await axiosInstance.get<{ sampleData: boolean }>("/external/data-source")).data,
  getActiveClasses: async () =>
    (await axiosInstance.get<SharedClass[]>("/external/classes", { params: { status: "active" } })).data,
  getActiveTrainers: async () =>
    (await axiosInstance.get<SharedTrainer[]>("/external/trainers", { params: { status: "active" } })).data,
  assignProgram: async (classId: number, programId: number) =>
    (await axiosInstance.put<ClassProgramSubjects>(`/classes/${classId}/training-program`, { programId })).data,
  getProgramSubjects: async (classId: number) =>
    (await axiosInstance.get<ClassProgramSubjects>(`/classes/${classId}/program-subjects`)).data,
  getAssignments: async (classId: number) =>
    (await axiosInstance.get<TeachingAssignment[]>(`/classes/${classId}/teaching-assignments`)).data,
  getAvailableAssignments: async (classId: number, date: string) =>
    (await axiosInstance.get<TeachingAssignment[]>(`/classes/${classId}/teaching-assignments/available`, { params: { date } })).data,
  getAssignmentOptions: async (signal?: AbortSignal) =>
    (await axiosInstance.get<AssignmentOptions>("/teaching-assignments/options", { signal })).data,
  searchAssignments: async (params: AssignmentSearchParams, signal?: AbortSignal) =>
    (await axiosInstance.get<AssignmentPage<TeachingAssignment>>("/teaching-assignments", { params, signal })).data,
  getAssignment: async (id: number) =>
    (await axiosInstance.get<TeachingAssignment>(`/teaching-assignments/${id}`)).data,
  createAssignment: async (request: TeachingAssignmentRequest) =>
    (await axiosInstance.post<TeachingAssignment>("/teaching-assignments", request)).data,
  updateAssignment: async (id: number, request: TeachingAssignmentRequest) =>
    (await axiosInstance.put<TeachingAssignment>(`/teaching-assignments/${id}`, request)).data,
  deleteAssignment: async (id: number) =>
    axiosInstance.delete(`/teaching-assignments/${id}`),
};
