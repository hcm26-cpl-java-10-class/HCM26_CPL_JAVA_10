import { createBaseApiService } from "@/api/base-service.api";
import axiosInstance from "@/api/axios";
import type { Pagination, StudySessionDTO, StudySessionFilter } from "@/types";

const path = "/study-sessions";

export interface StudySessionStatistics {
  total: number;
  scheduled: number;
  completed: number;
  cancelled: number;
  completionRate: number;
  cancellationRate: number;
}

export interface StudySessionStatisticsFilter {
  subjectId?: number;
  sessionDateFrom?: string;
  sessionDateTo?: string;
}

const base = createBaseApiService<StudySessionDTO, StudySessionFilter>({ path });

function normalizeSubjectId(value: unknown): number {
  const normalizedValue = typeof value === "string" ? value.trim() : value;
  const subjectId = typeof normalizedValue === "number" ? normalizedValue : Number(normalizedValue);

  if (!Number.isSafeInteger(subjectId) || subjectId <= 0) {
    throw new Error("Select a Subject before saving the Study Session.");
  }

  return subjectId;
}

export const studySessionApi = Object.assign({}, base, {
  statistics: async (filter: StudySessionStatisticsFilter = {}) => {
    const response = await axiosInstance.get<StudySessionStatistics>(`${path}/statistics`, { params: filter });
    return response.data;
  },

  create: (data: StudySessionDTO) =>
    base.create({
      ...data,
      subjectId: normalizeSubjectId(data.subjectId),
    }),
  getPage: (
    pagination: Pagination,
    search?: string,
    filter?: StudySessionFilter,
  ) => {
    const { sessionDate, ...rest } = filter ?? {};
    return base.getPage(
      pagination,
      search,
      {
        ...rest,
        sessionDateFrom: sessionDate?.from ?? filter?.sessionDateFrom,
        sessionDateTo: sessionDate?.to ?? filter?.sessionDateTo,
      } as StudySessionFilter,
    );
  },
  update: async (id: string, data: StudySessionDTO) => {
    if (data.subjectId !== undefined) {
      data = {
        ...data,
        subjectId: normalizeSubjectId(data.subjectId),
      };
    }

    const fields = Object.keys(data).filter(
      (field) => data[field as keyof StudySessionDTO] !== undefined,
    );

    if (fields.length === 1 && fields[0] === "isActive") {
      const response = await axiosInstance.patch<StudySessionDTO>(
        `${path}/${id}/status`,
        { isActive: data.isActive },
      );
      return response.data;
    }

    return base.update(id, data);
  },
  cancel: async (id: string, reason: string) => {
    const response = await axiosInstance.patch<StudySessionDTO>(
      `${path}/${id}/cancel`,
      { reason },
    );
    return response.data;
  },
  complete: async (id: string, notes?: string) => {
    const response = await axiosInstance.patch<StudySessionDTO>(
      `${path}/${id}/complete`,
      notes?.trim() ? { notes: notes.trim() } : undefined,
    );
    return response.data;
  },
});
