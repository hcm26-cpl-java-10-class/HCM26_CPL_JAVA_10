import type { ExternalClass, ExternalRoom, ExternalTrainer } from "@/types";
import axiosInstance from "../axios";

/** Asks the backend for records of every status instead of its default ("active"). */
export const ALL_STATUSES = "all";

/** Access to the master training system, proxied by the backend under /api/external. */
export const externalApi = {
    getClasses: async (status: string = ALL_STATUSES): Promise<ExternalClass[]> => {
        const response = await axiosInstance.get<ExternalClass[]>("/external/classes", { params: { status } });
        return response.data;
    },

    getClassById: async (id: string | number): Promise<ExternalClass> => {
        const response = await axiosInstance.get<ExternalClass>(`/external/classes/${id}`);
        return response.data;
    },

    createClass: async (data: Partial<ExternalClass>): Promise<ExternalClass> => {
        const response = await axiosInstance.post<ExternalClass>("/external/classes", data);
        return response.data;
    },

    updateClass: async (id: string | number, data: Partial<ExternalClass>): Promise<ExternalClass> => {
        const response = await axiosInstance.put<ExternalClass>(`/external/classes/${id}`, data);
        return response.data;
    },

    deleteClass: async (id: string | number): Promise<void> => {
        await axiosInstance.delete(`/external/classes/${id}`);
    },

    batchImportClasses: async (classes: Partial<ExternalClass>[]): Promise<{ message: string; count: number }> => {
        const response = await axiosInstance.post<{ message: string; count: number }>("/external/classes/batch", classes);
        return response.data;
    },

    getTrainers: async (status: string = ALL_STATUSES): Promise<ExternalTrainer[]> => {
        const response = await axiosInstance.get<ExternalTrainer[]>("/external/trainers", { params: { status } });
        return response.data;
    },

    getRooms: async (): Promise<ExternalRoom[]> => {
        const response = await axiosInstance.get<ExternalRoom[]>("/external/rooms");
        return response.data;
    },
};
