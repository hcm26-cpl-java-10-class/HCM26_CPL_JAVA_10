
import axiosInstance from "../axios";

export type ProgramStatus = "ACTIVE" | "INACTIVE";

export type ExportFormat = "xlsx" | "xls" | "csv" | "txt";
export type ExportScope = "all" | "filtered";

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

/** Cấu trúc môn học trong response backend. */
interface BackendProgramSubject {
  id?: number;
  subjectId: number;
  subjectCode?: string;
  subjectName?: string;
  code?: string;
  name?: string;
  version?: string;
  durationHours: number;
  orderIndex: number;
}

/** Cấu trúc chương trình trong response backend. */
interface BackendTrainingProgram {
  id: number;
  code: string;
  name: string;
  version: string;
  region?: string | null;
  status: ProgramStatus;
  isActive?: boolean;
  subjectCount?: number;
  totalDurationHours: number;
  subjects: BackendProgramSubject[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ProgramPage {
  content: TrainingProgramResponse[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

interface BackendProgramPage {
  content: BackendTrainingProgram[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface ProgramImportPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  canImport: boolean;
  rows: Array<{
    rowNumber: number;
    programCode: string;
    programVersion: string;
    subjectCode: string;
    subjectVersion: string;
    valid: boolean;
    errors: string[];
  }>;
}

export interface ProgramImportResult {
  importedPrograms: number;
  message: string;
}

export interface ProgramExportFilters {
  search?: string;
  status?: ProgramStatus;
  region?: string;
  scope: ExportScope;
  format: ExportFormat;
}

const path = "/programs";

/** Chuẩn hóa response backend về kiểu dữ liệu frontend đang sử dụng. */
const normalizeProgram = (
  program: BackendTrainingProgram
): TrainingProgramResponse => ({
  id: program.id,
  code: program.code,
  name: program.name,
  version: program.version,
  region: program.region ?? "",
  status: program.status,
  isActive: program.isActive ?? program.status === "ACTIVE",
  totalDurationHours: program.totalDurationHours,
  subjects: (program.subjects ?? []).map((subject) => ({
    subjectId: subject.subjectId,
    orderIndex: subject.orderIndex,
    id: subject.id ?? subject.subjectId,
    code: subject.subjectCode ?? subject.code ?? "",
    name: subject.subjectName ?? subject.name ?? "",
    version: subject.version ?? "",
    durationHours: subject.durationHours,
  })),
});

export const programApi = {
  /**
   * Backend hiện trả về mảng JSON trực tiếp.
   * Vẫn hỗ trợ response dạng phân trang để tương thích nếu backend thay đổi.
   */
  getPage: async (params: {
    search?: string;
    status?: ProgramStatus;
    region?: string;
    page: number;
    size: number;
    sort?: string;
  }): Promise<ProgramPage> => {
    const response = await axiosInstance.get<BackendProgramPage>(path, {
      params,
    });

    return {
      ...response.data,
      content: (response.data.content ?? []).map(normalizeProgram),
    };
  },

  getRegions: async (): Promise<string[]> =>
    (await axiosInstance.get<string[]>(`${path}/regions`)).data,

  getAll: async (params?: {
    search?: string;
    status?: ProgramStatus;
    region?: string;
    page?: number;
    size?: number;
    sort?: string;
  }): Promise<TrainingProgramResponse[]> => {
    const response = await axiosInstance.get<
      BackendProgramPage | BackendTrainingProgram[]
    >(path, {
      params: {
        search: params?.search,
        status: params?.status,
        region: params?.region,
        page: params?.page ?? 0,
        size: params?.size ?? 100,
        sort: params?.sort,
      },
    });

    const data = response.data;

    if (Array.isArray(data)) {
      return data.map(normalizeProgram);
    }

    return (data.content ?? []).map(normalizeProgram);
  },

  getById: async (
    id: number
  ): Promise<TrainingProgramResponse> => {
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

  /** Backend có endpoint PUT /{id}/subjects. */
  updateSubjects: async (
    id: number,
    subjects: ProgramSubjectRequest[]
  ): Promise<TrainingProgramResponse> => {
    const response = await axiosInstance.put<
      BackendTrainingProgram[] | BackendTrainingProgram
    >(`${path}/${id}/subjects`, subjects);

    const data = response.data;

    if (Array.isArray(data)) {
      throw new Error(
        "Backend trả về danh sách thay vì một chương trình sau khi cập nhật môn học."
      );
    }

    return normalizeProgram(data);
  },

  cloneVersion: async (
    id: number,
    newVersion: string
  ): Promise<TrainingProgramResponse> => {
    const response = await axiosInstance.post<BackendTrainingProgram>(
      `${path}/${id}/clone`,
      null,
      {
        params: { newVersion },
      }
    );

    return normalizeProgram(response.data);
  },

  activate: async (
    id: number
  ): Promise<TrainingProgramResponse> => {
    const response = await axiosInstance.post<BackendTrainingProgram>(
      `${path}/${id}/activate`
    );

    return normalizeProgram(response.data);
  },

  changeStatus: async (
    id: number,
    status: ProgramStatus
  ): Promise<TrainingProgramResponse> => {
    const response = await axiosInstance.patch<BackendTrainingProgram>(
      `${path}/${id}/status`,
      null,
      {
        params: { status },
      }
    );

    return normalizeProgram(response.data);
  },

  delete: async (id: number): Promise<void> => {
    await axiosInstance.delete(`${path}/${id}`);
  },

  /** Xem trước dữ liệu Import trước khi xác nhận nhập. */
  previewImport: async (
    file: File
  ): Promise<ProgramImportPreview> => {
    const body = new FormData();
    body.append("file", file);

    return (
      await axiosInstance.post<ProgramImportPreview>(
        `${path}/import/preview`,
        body,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      )
    ).data;
  },

  /** Nhập toàn bộ dữ liệu sau khi người dùng xác nhận. */
  importFile: async (
    file: File
  ): Promise<ProgramImportResult> => {
    const body = new FormData();
    body.append("file", file);

    return (
      await axiosInstance.post<ProgramImportResult>(
        `${path}/import`,
        body,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      )
    ).data;
  },

  /** Tải file mẫu Import XLSX. */
  downloadImportTemplate: async (): Promise<Blob> =>
    (
      await axiosInstance.get(`${path}/import/template`, {
        responseType: "blob",
      })
    ).data,

  /**
   * Export chương trình theo định dạng và phạm vi được chọn.
   *
   * scope:
   * - all: xuất tất cả chương trình.
   * - filtered: xuất theo bộ lọc hiện tại.
   *
   * format:
   * - xlsx, xls, csv, txt.
   */
  exportFile: async (
    filters: ProgramExportFilters
  ): Promise<Blob> => {
    const response = await axiosInstance.get<Blob>(
      `${path}/export`,
      {
        params: {
          search:
            filters.scope === "filtered"
              ? filters.search
              : undefined,
          status:
            filters.scope === "filtered"
              ? filters.status
              : undefined,
          region:
            filters.scope === "filtered"
              ? filters.region
              : undefined,
          scope: filters.scope,
          format: filters.format,
        },
        responseType: "blob",
      }
    );

    return response.data;
  },

  /**
   * Giữ lại hàm cũ để tránh lỗi ở những component
   * vẫn đang gọi exportCsv.
   */
  exportCsv: async (filters?: {
    search?: string;
    status?: ProgramStatus;
    region?: string;
  }): Promise<Blob> => {
    const response = await axiosInstance.get<Blob>(
      `${path}/export`,
      {
        params: {
          ...filters,
          format: "csv",
          scope: "filtered",
        },
        responseType: "blob",
      }
    );

    return response.data;
  },
};
