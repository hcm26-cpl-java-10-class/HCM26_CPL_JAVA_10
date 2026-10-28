import { createBaseApiService } from "@/api/base-service.api";
import axiosInstance from "@/api/axios";
import type { SessionCancelDTO, SessionDTO, SessionFilter } from "@/types";
import type { ImportPreview, ImportInputRow, ImportResult } from "@/types/common/import-result";

const path = "/sessions";

const base = createBaseApiService<SessionDTO, SessionFilter>({
    path,
});

export const sessionApi = Object.assign({}, base, {
    previewFileImport: async (file: File): Promise<ImportPreview> => {
        const formData = new FormData();
        formData.append("file", file);
        const response = await axiosInstance.post<ImportPreview>(
            `${path}/import/preview`, formData,
            { headers: { "Content-Type": "multipart/form-data" } },
        );
        return response.data;
    },
    previewEditedRows: async (rows: ImportInputRow[]): Promise<ImportPreview> => {
        const response = await axiosInstance.post<ImportPreview>(
            `${path}/import/preview-rows`, { rows }, { headers: { "Content-Type": "application/json" } });
        return response.data;
    },
    importEditedRows: async (rows: ImportInputRow[]): Promise<ImportResult> => {
        const response = await axiosInstance.post<ImportResult>(
            `${path}/import/rows`, { rows }, { headers: { "Content-Type": "application/json" } });
        return response.data;
    },
    cancelSession: async (id: string | number, data: SessionCancelDTO): Promise<SessionDTO> => {
        const res = await axiosInstance.patch<SessionDTO>(`${path}/${id}/cancel`, data);
        return res.data;
    },
});