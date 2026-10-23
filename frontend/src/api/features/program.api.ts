import axiosInstance from "../axios";

export type ProgramStatus = "DRAFT" | "ACTIVE" | "INACTIVE";

export interface ProgramSubjectRequest {
  subjectId: number;
  orderIndex: number;
}

export interface ProgramSubjectResponse extends ProgramSubjectRequest {
  code: string;
  name: string;
  version: string;
  durationHours: number;
}

export interface TrainingProgramRequest {
  code: string;
  name: string;
  version: string;
  region?: string;
  subjects: ProgramSubjectRequest[];
}

export interface TrainingProgramResponse {
  id: number;
  code: string;
  name: string;
  version: string;
  region?: string;
  status: ProgramStatus;
  isActive: boolean;
  subjects: ProgramSubjectResponse[];
  totalDurationHours: number;
}

const path = "/programs";

export const programApi = {
  getAll: async (params?: { search?: string; status?: ProgramStatus; region?: string }) =>
    (await axiosInstance.get<TrainingProgramResponse[]>(path, { params })).data,
  getById: async (id: number) =>
    (await axiosInstance.get<TrainingProgramResponse>(`${path}/${id}`)).data,
  create: async (data: TrainingProgramRequest) =>
    (await axiosInstance.post<TrainingProgramResponse>(path, data)).data,
  update: async (id: number, data: TrainingProgramRequest) =>
    (await axiosInstance.put<TrainingProgramResponse>(`${path}/${id}`, data)).data,
  updateSubjects: async (id: number, subjects: ProgramSubjectRequest[]) =>
    (await axiosInstance.put<TrainingProgramResponse>(`${path}/${id}/subjects`, subjects)).data,
  cloneVersion: async (id: number, newVersion: string) =>
    (await axiosInstance.post<TrainingProgramResponse>(`${path}/${id}/clone`, null, { params: { newVersion } })).data,
  activate: async (id: number) =>
    (await axiosInstance.post<TrainingProgramResponse>(`${path}/${id}/activate`)).data,
  changeStatus: async (id: number, status: ProgramStatus) =>
    (await axiosInstance.patch<TrainingProgramResponse>(`${path}/${id}/status`, null, { params: { status } })).data,
  exportCsv: async (search?: string) =>
    (await axiosInstance.get(`${path}/export`, { params: { search }, responseType: "blob" })).data as Blob,
};
