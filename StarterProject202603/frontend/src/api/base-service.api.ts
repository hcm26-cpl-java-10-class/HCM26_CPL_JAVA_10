import type { FileFormat, ImportResult, Pagination } from "@/types";
import type { PageResponse } from "@/types/common/pageable";
import type { AxiosInstance } from "axios";
import axiosInstance from "./axios";

export interface BaseApiService<DTO, Filter> {
    import(file: File): Promise<ImportResult>;
    export(format: FileFormat): Promise<Blob>;
    getPage(pagination: Pagination, search?: string, filter?: Filter): Promise<PageResponse<DTO>>;
    getById(id: string): Promise<DTO>;
    create(data: DTO): Promise<DTO>;
    update(id: string, data: DTO): Promise<DTO>;
    delete(id: string): Promise<void>;
}

interface BaseApiConfig {
    path: string;
    instance?: AxiosInstance;
}

export const createBaseApiService = <DTO = any, Filter = any>({
    path,
    instance = axiosInstance,
}: BaseApiConfig): BaseApiService<DTO, Filter> => {
    return {
        import: async (file: File): Promise<ImportResult> => {
            const formData = new FormData();
            formData.append("file", file);
            const response = await instance.post<ImportResult>(`${path}/import`, formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            });
            return response.data;
        },

        export: async (format: FileFormat) => {
            return instance.get(`${path}/export`, {
                params: { format },
                responseType: "blob",
            });
        },

        getPage: async (pagination: Pagination, search?: string, filter?: Filter): Promise<PageResponse<DTO>> => {
            const { sort, ...rest } = pagination;
            const params = new URLSearchParams();

            Object.entries(rest).forEach(([key, value]) => {
                if (value !== undefined && value !== null) params.append(key, String(value));
            });

            if (sort) {
                const sortArr = Array.isArray(sort) ? sort : [sort];
                sortArr.forEach((s) => params.append("sort", s));
            }

            if (search) params.append("search", search);

            const serializeValue = (value: any) => {
                if (value instanceof Date) return value.toISOString();
                return String(value);
            };

            if (filter) {
                Object.entries(filter as Record<string, any>).forEach(([key, value]) => {
                    if (value === undefined || value === null) return;

                    if (typeof value === "string" && !value.trim()) return;

                    if (Array.isArray(value)) {
                        value.forEach((v) => params.append(key, serializeValue(v)));
                    } else {
                        params.append(key, serializeValue(value));
                    }
                });
            }

            const response = await instance.get<PageResponse<DTO>>(path, {
                params,
            });
            console.log("GetPage response:", response);
            return response.data;
        },

        getById: async (id: string): Promise<DTO> => {
            console.log(`Fetching ${path} with ID:`, id);
            const response = await instance.get<DTO>(`${path}/${id}`);
            console.log("GetById response:", response);
            return response.data;
        },

        create: async (data: DTO): Promise<DTO> => {
            console.log("Creating new entry at", path, "with data:", data);
            const response = await instance.post<DTO>(path, data);
            console.log("Create response:", response);
            return response.data;
        },

        update: async (id: string, data: DTO): Promise<DTO> => {
            console.log(`Updating ${path} with ID:`, id, "and data:", data);
            const response = await instance.put<DTO>(`${path}/${id}`, data);
            console.log("Update response:", response);
            return response.data;
        },

        delete: async (id: string): Promise<void> => {
            console.log(`Deleting ${path} with ID:`, id);
            const response = await instance.delete(`${path}/${id}`);
            console.log("Delete response:", response);
            return response.data;
        },
    };
};
