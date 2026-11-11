import axiosInstance from "../axios";
import { externalApi } from "./external.api";
import { programApi } from "./program.api";
import type { ExternalTrainer } from "@/types";
import type { TrainingProgramItem } from "@/types/features/content";
import type { FileFormat, ImportResult } from "@/types";
import { downloadBlob, getFilenameFromHeader } from "@/components/datatable/util/dataio.utils";

export interface ProgramLink {
    id: number; programId: number; code: string; name: string; version: string;
    status: "ACTIVE" | "INACTIVE"; active: boolean; matchesClassProgram: boolean;
}
export interface MainAssignment {
    id: number; classId: number; classCode: string; programSubjectId: number; subjectId: number;
    subjectCode: string; subjectName: string; trainerId: number; trainerName: string | null;
    role: "MAIN" | "ASSISTANT"; effectiveFrom: string; effectiveTo: string | null;
}
export interface ClassSetup {
    classId: number; classCode: string; savedProgram: string; masterTrainer: string;
    startDate: string; endDate: string; programLink: ProgramLink | null;
    subjects: Array<{ id: number; subjectId: number; code: string; name: string; eligible: boolean }>;
    assignments: MainAssignment[];
}
export interface AssignmentInput {
    classId: number; programSubjectId: number; trainerId: number; role: "MAIN";
    effectiveFrom: string; effectiveTo: string | null;
}
export const classSetupKey = (id: number) => ["classes", "setup", id] as const;

export type AssignmentRole = "MAIN" | "ASSISTANT";

export interface AssignmentTeachingSlot {
  date: string;
  startTime: string;
  endTime: string;
}

export interface SharedClass {
  id: number;
  code: string;
  name: string;
  programId?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: string;
  plannedSize?: number | null;
  enrolledCount?: number | null;
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
  revision?: number;
  teachingSlots?: AssignmentTeachingSlot[];
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
  teachingSlots?: AssignmentTeachingSlot[];
}

export interface AssignmentEditContext {
  assignment: TeachingAssignment;
  classProfile: SharedClass;
  trainers: SharedTrainer[];
  linkedSessionCount: number;
  trainerLocked: boolean;
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

export interface AssignmentEndRequest {
  effectiveTo: string;
  revision: number;
}

export interface AssignmentLifecycleContext {
  assignment: TeachingAssignment;
  linkedSessionCount: number;
  canDelete: boolean;
  previouslyUsed: boolean;
}

export type AssignmentSessionStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";

export interface AssignmentSession {
  source: "DEMO_SESSION" | "STUDY_SESSION";
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

export interface ClassCourseItem {
  courseId: number;
  code: string | null;
  name: string;
  instructor: string | null;
  description: string | null;
  active: boolean;
}

export interface ClassContextInfo {
  status: string | null;
  startDate: string | null;
  endDate: string | null;
  site: string | null;
  location: string | null;
  formatType: string | null;
  plannedSize: number | null;
  enrolledCount: number;
}

export interface ClassProgramSubjectItem {
  programSubjectId: number;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  subjectVersion: string;
  technicalGroup?: string | null;
  durationHours: number;
  orderIndex: number;
  course: ClassCourseItem | null;
  courseChangeLocked: boolean;
  availableCourses: ClassCourseItem[];
  assignments: TeachingAssignment[];
  scheduledSessionCount: number;
  completedSessionCount: number;
}

export interface ClassProgramSubjects {
  classId: number;
  classCode: string;
  className: string;
  classContext: ClassContextInfo;
  program: {
    id: number;
    code: string;
    name: string;
    version: string;
    region?: string | null;
    status: "DRAFT" | "ACTIVE" | "INACTIVE";
    totalDurationHours: number;
  } | null;
  programChangeBlocked: boolean;
  programChangeBlockReasons: string[];
  courseChangeLockedByEnrollment: boolean;
  subjects: ClassProgramSubjectItem[];
}

export interface ClassSetupOverview {
  classId: number;
  code: string;
  name: string;
  status: string | null;
  startDate: string | null;
  endDate: string | null;
  site: string | null;
  location: string | null;
  formatType: string | null;
  plannedSize: number | null;
  enrolledCount: number;
  programId: number | null;
  programCode: string | null;
  programName: string | null;
  programVersion: string | null;
  totalSubjects: number;
  coursesAssignedCount: number;
  subjectsWithTrainerCount: number;
  subjectsWithScheduleCount: number;
  scheduledSessionCount: number;
  missingCourseCount: number;
  missingTrainerCount: number;
  missingScheduleCount: number;
  setupComplete: boolean;
}

export interface TopicCourseSaveItem {
  programSubjectId: number;
  courseId: number | null;
}

export interface ClassTopicCoursesSaveResponse {
  classId: number;
  classCode: string;
  assignedCount: number;
  updatedCount: number;
  removedCount: number;
  unchangedCount: number;
  message: string;
  plan: ClassProgramSubjects;
}

export interface MissingSubjectSummaryItem {
  programSubjectId: number;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  subjectVersion: string;
  orderIndex: number;
  durationHours: number;
}

export interface ClassPlanSummary {
  classId: number;
  classCode: string;
  className: string;
  classStatus: string | null;
  enrolledCount: number;
  plannedSize: number | null;
  hasProgram: boolean;
  programId: number | null;
  programCode: string | null;
  programName: string | null;
  programVersion: string | null;
  totalSubjects: number;
  totalDurationHours: number;
  coursesAssignedCount: number;
  subjectsWithTrainerCount: number;
  subjectsWithScheduleCount: number;
  totalScheduledSessions: number;
  missingCourses: MissingSubjectSummaryItem[];
  missingAssignments: MissingSubjectSummaryItem[];
  missingSchedules: MissingSubjectSummaryItem[];
  programChangeBlocked: boolean;
  programChangeBlockReasons: string[];
}

export interface ClassSubjectOption {
  programSubjectId: number;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  subjectVersion: string;
  orderIndex: number;
  durationHours: number;
  courseId: number | null;
  courseCode: string | null;
  courseName: string | null;
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

export interface AssignmentNewClassRequest {
  name: string;
  programId?: number;
  newProgram?: { name: string; version: string; subjectIds: number[] };
  startDate: string;
  endDate: string;
  plannedSize: number;
}

export interface AssignmentClassProgram {
  id: number; code: string; name: string; version: string;
}

export interface AssignmentCreationRequest {
  classDetails: AssignmentNewClassRequest;
  trainer: { name: string; email: string };
  subjectId?: number;
  newSubject?: { name: string; durationHours?: number };
  role: AssignmentRole;
  effectiveFrom: string;
  effectiveTo: string | null;
  teachingSlots: AssignmentTeachingSlot[];
}

export interface AssignmentClassContext {
  classProfile: SharedClass;
  program: NonNullable<ClassProgramSubjects["program"]>;
  subjects: Array<{ programSubjectId: number; subjectId: number; code: string; name: string; version: string }>;
}

export const classSetupApi = {
  get: async (id: number) => (await axiosInstance.get<ClassSetup>(`/classes/${id}/setup`)).data,
  link: async (id: number, programId: number) => (await axiosInstance.put<ProgramLink>(`/classes/${id}/program-link`, { programId })).data,
  activePrograms: async () => {
    const result: TrainingProgramItem[] = [];
    for (let page = 0; ; page++) {
      const response = await programApi.getPage({ status: "ACTIVE", size: 1000, page });
      result.push(...response.content.filter(p => p.isActive && p.status === "ACTIVE"));
      if (page + 1 >= response.totalPages) return result;
    }
  },
  verifiedTrainers: async (): Promise<ExternalTrainer[]> => {
    const trainers = await externalApi.getTrainers("active");
    const provenance = (await axiosInstance.get<{ sampleData: boolean }>("/external/data-source")).data;
    if (provenance.sampleData !== false) throw new Error("BLOCKED: Master Trainer API is sample or unverified. Configure the real directory; no sample trainers can be selected.");
    return trainers.filter(t => t.id != null && t.status?.toLowerCase() === "active" && t.name?.trim());
  },
  createAssignmentWithDetails: async (request: AssignmentCreationRequest) =>
    (await axiosInstance.post<TeachingAssignment>("/teaching-assignments/create-with-details", request)).data,
  getNewProgramSubjects: async (signal?: AbortSignal) =>
    (await axiosInstance.get<Array<{ id: number; code: string; name: string; version: string; durationHours: number }>>("/teaching-assignments/class-subject-options", { signal })).data,
  saveAssignmentTrainer: async (request: { name: string; email: string }) =>
    (await axiosInstance.post<SharedTrainer>("/teaching-assignments/trainers", request)).data,
  getNewClassPrograms: async (signal?: AbortSignal) =>
    (await axiosInstance.get<AssignmentClassProgram[]>("/teaching-assignments/class-program-options", { signal })).data,
  createAssignmentClass: async (request: AssignmentNewClassRequest) =>
    (await axiosInstance.post<SharedClass>("/teaching-assignments/classes", request)).data,
  downloadAssignmentTemplate: async () => {
    const response = await axiosInstance.get<Blob>("/teaching-assignments/import-template", { responseType: "blob" });
    downloadBlob(response.data, "teaching-assignments-template.xlsx");
  },
  importAssignments: async (file: File) => {
    const body = new FormData();
    body.append("file", file);
    return (await axiosInstance.post<ImportResult>("/teaching-assignments/import", body, {
      headers: { "Content-Type": "multipart/form-data" },
    })).data;
  },
  exportAssignments: async (format: FileFormat, filters: AssignmentSearchParams) => {
    const response = await axiosInstance.get<Blob>("/teaching-assignments/export", {
      params: { ...filters, page: undefined, size: undefined, format }, responseType: "blob",
    });
    downloadBlob(response.data, getFilenameFromHeader(response.headers["content-disposition"]) ?? `teaching-assignments.${format === "EXCEL" ? "xlsx" : format.toLowerCase()}`);
  },
  getRooms: async () => (await axiosInstance.get<Array<{ id: number; name: string }>>("/external/rooms")).data,
  getAssignmentCreateOptions: async (signal?: AbortSignal) =>
    (await axiosInstance.get<AssignmentCreateOptions>("/teaching-assignments/create-options", { signal })).data,
  getAssignmentCreateContext: async (classId: number, signal?: AbortSignal) =>
    (await axiosInstance.get<AssignmentClassContext>("/teaching-assignments/create-context", { params: { classId }, signal })).data,
  getDataSource: async () =>
    (await axiosInstance.get<{ sampleData: boolean }>("/external/data-source")).data,
  getActiveClasses: async () =>
    (await axiosInstance.get<SharedClass[]>("/external/classes", { params: { status: "active" } })).data,
  getClasses: async () =>
    (await axiosInstance.get<SharedClass[]>("/external/classes", { params: { status: "all" } })).data,
  getSetupOverview: async () =>
    (await axiosInstance.get<ClassSetupOverview[]>("/classes/setup-overview")).data,
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
  removeProgram: async (classId: number) =>
    (await axiosInstance.delete<ClassProgramSubjects>(`/classes/${classId}/training-program`)).data,
  getProgramSubjects: async (classId: number) =>
    (await axiosInstance.get<ClassProgramSubjects>(`/classes/${classId}/program-subjects`)).data,
  saveTopicCourses: async (classId: number, items: TopicCourseSaveItem[]) =>
    (await axiosInstance.put<ClassTopicCoursesSaveResponse>(`/classes/${classId}/topic-courses`, { items })).data,
  saveSingleTopicCourse: async (classId: number, programSubjectId: number, courseId: number | null) =>
    (await axiosInstance.put<ClassTopicCoursesSaveResponse>(
      `/classes/${classId}/program-subjects/${programSubjectId}/course`,
      { courseId },
    )).data,
  getPlanSummary: async (classId: number) =>
    (await axiosInstance.get<ClassPlanSummary>(`/classes/${classId}/plan-summary`)).data,
  getSubjectOptions: async (classId: number) =>
    (await axiosInstance.get<ClassSubjectOption[]>(`/classes/${classId}/subject-options`)).data,
  getAssignments: async (classId: number) =>
    (await axiosInstance.get<TeachingAssignment[]>(`/classes/${classId}/teaching-assignments`)).data,
  getAvailableAssignments: async (classId: number, query: string | { date?: string; programSubjectId?: number; from?: string; to?: string }, signal?: AbortSignal) =>
    (await axiosInstance.get<TeachingAssignment[]>(`/classes/${classId}/teaching-assignments/available`, { params: typeof query === "string" ? { date: query } : query, signal })).data,
  getAssignmentOptions: async (signal?: AbortSignal) =>
    (await axiosInstance.get<AssignmentOptions>("/teaching-assignments/options", { signal })).data,
  searchAssignments: async (params: AssignmentSearchParams, signal?: AbortSignal) =>
    (await axiosInstance.get<AssignmentPage<TeachingAssignment>>("/teaching-assignments", { params, signal })).data,
  getAssignment: async (id: number, signal?: AbortSignal) =>
    (await axiosInstance.get<TeachingAssignment>(`/teaching-assignments/${id}`, { signal })).data,
  getAssignmentSessions: async (id: number, params: AssignmentSessionParams, signal?: AbortSignal) =>
    (await axiosInstance.get<AssignmentPage<AssignmentSession>>(`/teaching-assignments/${id}/sessions`, { params, signal })).data,
  createAssignment: async (classIdOrRequest: number | TeachingAssignmentRequest, input?: AssignmentInput): Promise<any> => {
    if (typeof classIdOrRequest === "number") {
      return (await axiosInstance.post<MainAssignment>(`/classes/${classIdOrRequest}/teaching-assignments`, input)).data;
    }
    return (await axiosInstance.post<TeachingAssignment>("/teaching-assignments", classIdOrRequest)).data;
  },
  getAssignmentEditContext: async (id: number, signal?: AbortSignal) =>
    (await axiosInstance.get<AssignmentEditContext>(`/teaching-assignments/${id}/edit-context`, { signal })).data,
  previewAssignmentImpact: async (id: number, request: TeachingAssignmentUpdateRequest, page: number, signal?: AbortSignal) =>
    (await axiosInstance.post<AssignmentImpact>(`/teaching-assignments/${id}/impact-preview`, request, { params: { page, size: 10 }, signal })).data,
  updateAssignment: async (classIdOrId: number, idOrRequest: number | TeachingAssignmentUpdateRequest, input?: AssignmentInput): Promise<any> => {
    if (typeof idOrRequest === "number" && input !== undefined) {
      return (await axiosInstance.put<MainAssignment>(`/classes/${classIdOrId}/teaching-assignments/${idOrRequest}`, input)).data;
    }
    return (await axiosInstance.put<TeachingAssignment>(`/teaching-assignments/${classIdOrId}`, idOrRequest as TeachingAssignmentUpdateRequest)).data;
  },
  getAssignmentLifecycleContext: async (id: number, signal?: AbortSignal) =>
    (await axiosInstance.get<AssignmentLifecycleContext>(`/teaching-assignments/${id}/lifecycle-context`, { signal })).data,
  previewAssignmentEnd: async (id: number, request: AssignmentEndRequest, page: number, signal?: AbortSignal) =>
    (await axiosInstance.post<AssignmentImpact>(`/teaching-assignments/${id}/end-preview`, request, { params: { page, size: 10 }, signal })).data,
  endAssignment: async (id: number, request: AssignmentEndRequest) =>
    (await axiosInstance.patch<TeachingAssignment>(`/teaching-assignments/${id}/end`, request)).data,
  deleteAssignment: async (id: number, revision: number) =>
    axiosInstance.delete(`/teaching-assignments/${id}`, { params: { revision } }),
};
