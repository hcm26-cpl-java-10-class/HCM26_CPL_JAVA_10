import axiosInstance from "../axios";
import type { ImportResult } from "@/types";

export type AssignmentRole = "MAIN" | "ASSISTANT";

export interface SharedClass {
  id: number;
  code: string;
  name: string;
  programId?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: string;
  plannedSize?: number | null;
  deliveryType?: string | null;
  traineeType?: string | null;
  formatType?: string | null;
  skills?: string | null;
  site?: string | null;
  location?: string | null;
  subjectType?: string | null;
  scope?: string | null;
  supplierPartner?: string | null;
  keyProgram?: string | null;
  jobRecommendation?: boolean | null;
}

export interface SharedClassRequest {
  code: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  status: "active" | "inactive";
  plannedSize: number | null;
  deliveryType?: string | null;
  traineeType?: string | null;
  formatType?: string | null;
  skills?: string | null;
  site?: string | null;
  location?: string | null;
  subjectType?: string | null;
  scope?: string | null;
  supplierPartner?: string | null;
  keyProgram?: string | null;
  jobRecommendation?: boolean | null;
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

interface AssignmentPage<T> {
  content: T[];
  number: number;
  size: number;
  totalPages: number;
  totalElements: number;
}

export const classSetupApi = {
  getDataSource: async () =>
    (await axiosInstance.get<{ sampleData: boolean }>("/external/data-source")).data,
  getClasses: async () =>
    (await axiosInstance.get<SharedClass[]>("/external/classes", { params: { status: "all" } })).data,
  createClass: async (request: SharedClassRequest) =>
    (await axiosInstance.post<SharedClass>("/classes", request)).data,
  importClasses: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return (await axiosInstance.post<ImportResult>("/classes/import", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })).data;
  },
  updateClass: async (classId: number, request: SharedClassRequest) =>
    (await axiosInstance.put<SharedClass>(`/classes/${classId}`, request)).data,
  deleteClass: async (classId: number) => axiosInstance.delete(`/classes/${classId}`),
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
  searchAssignments: async (params: {
    classId?: number;
    programSubjectId?: number;
    trainerId?: number;
    role?: AssignmentRole;
    effectiveOn?: string;
    page?: number;
    size?: number;
    sort?: string;
  }) =>
    (await axiosInstance.get<AssignmentPage<TeachingAssignment>>("/teaching-assignments", { params })).data,
  getAssignment: async (id: number) =>
    (await axiosInstance.get<TeachingAssignment>(`/teaching-assignments/${id}`)).data,
  createAssignment: async (request: TeachingAssignmentRequest) =>
    (await axiosInstance.post<TeachingAssignment>("/teaching-assignments", request)).data,
  updateAssignment: async (id: number, request: TeachingAssignmentRequest) =>
    (await axiosInstance.put<TeachingAssignment>(`/teaching-assignments/${id}`, request)).data,
  deleteAssignment: async (id: number) =>
    axiosInstance.delete(`/teaching-assignments/${id}`),
};
