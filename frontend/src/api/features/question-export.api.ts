import { questionApi } from "@/api/features/exam.api";
import axiosInstance from "@/api/axios";
import type { FileFormat } from "@/types/common/file-format";

const exportEndpoints: Record<FileFormat, string> = {
    EXCEL: "/questions/export/xlsx",
    CSV: "/questions/export/csv",
    PDF: "/questions/export/pdf",
};

export const questionExportApi = {
    ...questionApi,

    export: async (format: FileFormat) => {
        const endpoint = exportEndpoints[format];

        return axiosInstance.get(endpoint, {
            responseType: "blob",
        });
    },
} as typeof questionApi;
