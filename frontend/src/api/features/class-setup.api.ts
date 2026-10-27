import axiosInstance from "../axios";

export type AssignmentRole = "MAIN" | "ASSISTANT";

export interface SharedClass {
  id: number;
  code: string;
  name: string;
  programId?: number | null;
  status?: string;
  startDate?: string | null;
  endDate?: string | null;
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
  revision?: number;
}

export type TeachingAssignmentUpdateRequest = TeachingAssignmentRequest & { revision: number };

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
  className?: string | null;
  subjectVersion?: string;
  trainerEmail?: string | null;
  programId?: number;
  programCode?: string;
  programName?: string;
  programVersion?: string;
  revision: number;
}

export interface AssignmentEditContext {
  assignment: TeachingAssignment;
  classProfile: SharedClass;
  trainers: SharedTrainer[];
  linkedSessionCount: number;
}

export interface AssignmentImpact {
  canSave: boolean;
  revision: number;
  linkedSessionCount: number;
  affectedSessionCount: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  affectedSessions: AssignmentPage<{ session: AssignmentSession; reasons: string[] }>;
}

export type AssignmentSessionStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";

export interface AssignmentSession {
  id: number;
  title: string;
  startTime: string;
  endTime: string;
  location: string | null;
  roomId: number | null;
  meetingUrl: string | null;
  status: AssignmentSessionStatus;
  active: boolean;
}

export interface AssignmentSessionParams {
  page?: number;
  size?: number;
  sort?: string;
  status?: AssignmentSessionStatus;
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

export interface AssignmentCreateOptions {
  classes: SharedClass[];
  trainers: SharedTrainer[];
  sampleData: boolean;
}

export interface AssignmentClassContext {
  classProfile: SharedClass;
  program: NonNullable<ClassProgramSubjects["program"]>;
  subjects: Array<{ programSubjectId: number; subjectId: number; code: string; name: string; version: string }>;
}

export const classSetupApi = {
  getAssignmentCreateOptions: async (signal?: AbortSignal) =>
    (await axiosInstance.get<AssignmentCreateOptions>("/teaching-assignments/create-options", { signal })).data,
  getAssignmentCreateContext: async (classId: number, signal?: AbortSignal) =>
    (await axiosInstance.get<AssignmentClassContext>("/teaching-assignments/create-context", { params: { classId }, signal })).data,
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
  getAssignment: async (id: number, signal?: AbortSignal) =>
    (await axiosInstance.get<TeachingAssignment>(`/teaching-assignments/${id}`, { signal })).data,
  getAssignmentSessions: async (id: number, params: AssignmentSessionParams, signal?: AbortSignal) =>
    (await axiosInstance.get<AssignmentPage<AssignmentSession>>(`/teaching-assignments/${id}/sessions`, { params, signal })).data,
  createAssignment: async (request: TeachingAssignmentRequest) =>
    (await axiosInstance.post<TeachingAssignment>("/teaching-assignments", request)).data,
  getAssignmentEditContext: async (id: number, signal?: AbortSignal) =>
    (await axiosInstance.get<AssignmentEditContext>(`/teaching-assignments/${id}/edit-context`, { signal })).data,
  previewAssignmentImpact: async (id: number, request: TeachingAssignmentUpdateRequest, page: number, signal?: AbortSignal) =>
    (await axiosInstance.post<AssignmentImpact>(`/teaching-assignments/${id}/impact-preview`, request, { params: { page, size: 10 }, signal })).data,
  updateAssignment: async (id: number, request: TeachingAssignmentUpdateRequest) =>
    (await axiosInstance.put<TeachingAssignment>(`/teaching-assignments/${id}`, request)).data,
  deleteAssignment: async (id: number) =>
    axiosInstance.delete(`/teaching-assignments/${id}`),
};
