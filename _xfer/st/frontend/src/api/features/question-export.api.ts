import { questionApi } from "@/api/features/exam.api";
import axiosInstance from "@/api/axios";
import type { ImportResult } from "@/types";
import type { FileFormat } from "@/types/common/file-format";

const exportEndpoints: Record<FileFormat, string> = {
    EXCEL: "/questions/export/xlsx",
    CSV: "/questions/export/csv",
    PDF: "/questions/export/pdf",
};

export const questionExportApi = {
    ...questionApi,

    /** Validates an import file without saving anything. */
    previewImport: async (file: File): Promise<ImportResult> => {
        const formData = new FormData();
        formData.append("file", file);
        const response = await axiosInstance.post<ImportResult>("/questions/import/preview", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        return response.data;
    },

    export: async (format: FileFormat) => {
        const endpoint = exportEndpoints[format];

        return axiosInstance.get(endpoint, {
            responseType: "blob",
        });
    },
} as typeof questionApi;
