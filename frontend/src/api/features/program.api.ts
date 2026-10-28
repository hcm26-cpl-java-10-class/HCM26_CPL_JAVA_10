
import axiosInstance from "../axios";

export type ProgramStatus = "DRAFT" | "ACTIVE" | "INACTIVE";

export interface ProgramSubjectRequest {
  subjectId: number;
  orderIndex: number;
}

/** Dữ liệu môn học theo cấu trúc mà các component frontend đang sử dụng. */
export interface ProgramSubjectResponse extends ProgramSubjectRequest {
  id: number;
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

/** Cấu trúc response thực tế từ Spring Boot. */
interface BackendProgramSubject {
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  durationHours: number;
  orderIndex: number;
}

interface BackendTrainingProgram {
  id: number;
  code: string;
  name: string;
  version: string;
  region?: string | null;
  status: ProgramStatus;
  subjectCount: number;
  totalDurationHours: number;
  subjects: BackendProgramSubject[];
  createdAt?: string;
  updatedAt?: string;
}

interface BackendProgramPage {
  content: BackendTrainingProgram[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

const path = "/programs";

/** Chuyển response backend thành kiểu dữ liệu frontend hiện đang sử dụng. */
const normalizeProgram = (
  program: BackendTrainingProgram
): TrainingProgramResponse => ({
  id: program.id,
  code: program.code,
  name: program.name,
  version: program.version,
  region: program.region ?? "",
  status: program.status,
  isActive: program.status === "ACTIVE",
  totalDurationHours: program.totalDurationHours,
  subjects: (program.subjects ?? []).map((subject) => ({
    subjectId: subject.subjectId,
    orderIndex: subject.orderIndex,
    id: subject.subjectId,
    code: subject.subjectCode,
    name: subject.subjectName,
    version: "",
    durationHours: subject.durationHours,
  })),
});

export const programApi = {
  /**
   * Backend trả về Page<TrainingProgramResponse>.
   * Lấy content và chuẩn hóa dữ liệu để index.tsx tiếp tục nhận mảng.
   * size tối đa backend cho phép là 100.
   */
  getAll: async (params?: {
    search?: string;
    status?: ProgramStatus;
    region?: string;
    page?: number;
    size?: number;
    sort?: string;
  }): Promise<TrainingProgramResponse[]> => {
    const response = await axiosInstance.get<BackendProgramPage>(
      path,
      {
        params: {
          ...params,
          page: params?.page ?? 0,
          size: params?.size ?? 100,
        },
      }
    );

    return (response.data.content ?? []).map(normalizeProgram);
  },

  getById: async (id: number): Promise<TrainingProgramResponse> => {
    const response = await axiosInstance.get<BackendTrainingProgram>(
      `${path}/${id}`
    );

    return normalizeProgram(response.data);
  },

  create: async (
    data: TrainingProgramRequest
  ): Promise<TrainingProgramResponse> => {
    const response = await axiosInstance.post<BackendTrainingProgram>(
      path,
      data
    );

    return normalizeProgram(response.data);
  },

  update: async (
    id: number,
    data: TrainingProgramRequest
  ): Promise<TrainingProgramResponse> => {
    const response = await axiosInstance.put<BackendTrainingProgram>(
      `${path}/${id}`,
      data
    );

    return normalizeProgram(response.data);
  },

  /** Backend hiện chưa có endpoint PUT /{id}/subjects. */
  updateSubjects: async (
    _id: number,
    _subjects: ProgramSubjectRequest[]
  ): Promise<never> => {
    throw new Error(
      "Backend chưa hỗ trợ endpoint cập nhật riêng danh sách môn học."
    );
  },

  cloneVersion: async (
    id: number,
    newVersion: string
  ): Promise<TrainingProgramResponse> => {
    const response = await axiosInstance.post<BackendTrainingProgram>(
      `${path}/${id}/clone`,
      { newVersion }
    );

    return normalizeProgram(response.data);
  },

  activate: async (
    id: number
  ): Promise<TrainingProgramResponse> => {
    const response = await axiosInstance.patch<BackendTrainingProgram>(
      `${path}/${id}/status`,
      { status: "ACTIVE" }
    );

    return normalizeProgram(response.data);
  },

  changeStatus: async (
    id: number,
    status: ProgramStatus
  ): Promise<TrainingProgramResponse> => {
    const response = await axiosInstance.patch<BackendTrainingProgram>(
      `${path}/${id}/status`,
      { status }
    );

    return normalizeProgram(response.data);
  },

  /** Backend hiện chưa có endpoint GET /export. */
  exportCsv: async (_search?: string): Promise<Blob> => {
    throw new Error(
      "Backend chưa hỗ trợ endpoint xuất CSV. Hãy dùng chức năng xuất file phía frontend."
    );
  },
};
