import type { PageResponse, Pagination, TopicMarkGradebookSearchResponseDTO, TopicMarkGradebookTableRow } from "@/types";
import axiosInstance from "@/api/axios";

const META_KEYS = new Set(["FINAL_SCORE", "IS_PASSED"]);

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const toBoolean = (value: unknown): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }

  if (typeof value === "number") {
    return value > 0;
  }

  return false;
};

export const topicMarkGradebookApi = {
  getPage: async (pagination: Pagination, search?: string): Promise<PageResponse<TopicMarkGradebookTableRow>> => {
    const { page = 0, size = 10, sort } = pagination;

    const sortValue = Array.isArray(sort) ? sort[0] : sort;

    const response = await axiosInstance.get<TopicMarkGradebookSearchResponseDTO>(
      "/topic-marks/gradebook/search",
      {
        params: {
          page,
          size,
          sort: sortValue || "fullName,asc",
          keyword: search || undefined,
        },
      },
    );

    const gradebook = response.data;
    const scoreColumns = (gradebook.columns ?? []).filter((column) => !META_KEYS.has(column.key));

    const keyOrder = scoreColumns.map((column) => column.key);
    const keyLabelMap = scoreColumns.reduce<Record<string, string>>((acc, column) => {
      acc[column.key] = column.label;
      return acc;
    }, {});

    const content = (gradebook.rows?.content ?? []).map<TopicMarkGradebookTableRow>((row) => {
      const values = row.values ?? {};

      return {
        id: row.userId,
        userId: row.userId,
        fullName: row.fullName,
        email: row.email,
        values,
        finalScore: toNumber(values.FINAL_SCORE),
        isPassed: toBoolean(values.IS_PASSED),
        __dynamicMeta: {
          values: {
            keyOrder,
            keyLabelMap,
          },
        },
      };
    });

    const totalPages = gradebook.rows?.totalPages ?? 0;
    const currentPage = gradebook.rows?.page ?? page;

    return {
      content,
      items: content,
      page: currentPage,
      size: gradebook.rows?.size ?? size,
      totalPages,
      totalElements: gradebook.rows?.totalElements ?? 0,
      hasNext: currentPage + 1 < totalPages,
      hasPrevious: currentPage > 0,
    };
  },

  getById: async (id: string) => {
    const response = await axiosInstance.get(`/topic-marks/students/${id}`);
    return response.data;
  },

  create: async () => {
    throw new Error("Topic mark gradebook demo is read-only.");
  },

  update: async () => {
    throw new Error("Topic mark gradebook demo is read-only.");
  },

  delete: async () => {
    throw new Error("Topic mark gradebook demo is read-only.");
  },

  import: async () => {
    throw new Error("Topic mark gradebook demo does not support import.");
  },

  export: async () => {
    throw new Error("Topic mark gradebook demo does not support export.");
  },
};
