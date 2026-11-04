import type { Trainee } from "@/types";
import axiosInstance from "../axios";
import {
    batchSaveMockTrainees,
    createMockTrainee,
    deleteMockTrainee,
    getMockTraineesByClass,
    updateMockTrainee,
} from "@/pages/management/training/class/mocks/classTrainee.mock";

export type TraineeGender = "Male" | "Female" | "Other";
export type TraineeStatus = "Active" | "Inactive" | "Dropped Out";

export interface TraineeFormInput {
    fullName: string;
    fptAccount: string;
    personalEmail: string;
    nationalId: string;
    employeeId?: string;
    accessCardId?: string;
    dob?: string;
    gender: TraineeGender;
    status: TraineeStatus;
}

export interface TraineeBatchPayload {
    created: TraineeFormInput[];
    updated: Trainee[];
    deletedIds: number[];
}

export interface TraineeBatchResponse {
    message: string;
    trainees: Trainee[];
}

const useMockFallback = () => !import.meta.env.VITEST;

async function withFallback<T>(request: () => Promise<T>, fallback: () => T): Promise<T> {
    try {
        return await request();
    } catch (error) {
        if (useMockFallback()) {
            return fallback();
        }
        throw error;
    }
}

/**
 * Trainee CRUD & Batch Synchronization service for Class Details -> Trainee List.
 * Endpoints are proxied by the Spring Boot backend under /api/external/classes/:classId/trainees.
 */
export const traineeService = {
    getByClassId: async (classId: string | number): Promise<Trainee[]> => {
        return withFallback(
            async () => (await axiosInstance.get<Trainee[]>(`/external/classes/${classId}/trainees`)).data,
            () => getMockTraineesByClass(classId),
        );
    },

    create: async (
        classId: string | number,
        data: TraineeFormInput,
    ): Promise<{ message: string; trainee: Trainee }> => {
        return withFallback(
            async () =>
                (await axiosInstance.post<{ message: string; trainee: Trainee }>(
                    `/external/classes/${classId}/trainees`,
                    data,
                )).data,
            () => ({
                message: "Trainee added to class successfully!",
                trainee: createMockTrainee(classId, data),
            }),
        );
    },

    update: async (
        classId: string | number,
        traineeId: number,
        data: Partial<TraineeFormInput>,
    ): Promise<Trainee> => {
        return withFallback(
            async () =>
                (await axiosInstance.put<Trainee>(
                    `/external/classes/${classId}/trainees/${traineeId}`,
                    data,
                )).data,
            () => updateMockTrainee(classId, traineeId, data),
        );
    },

    delete: async (
        classId: string | number,
        traineeId: number,
        reason = "Removed from class",
    ): Promise<{ message: string }> => {
        return withFallback(
            async () =>
                (await axiosInstance.delete<{ message: string }>(
                    `/external/classes/${classId}/trainees/${traineeId}`,
                    { data: { reason } },
                )).data,
            () => {
                deleteMockTrainee(classId, traineeId);
                return { message: "Trainee removed from class." };
            },
        );
    },

    batchUpdate: async (
        classId: string | number,
        payload: TraineeBatchPayload,
    ): Promise<TraineeBatchResponse> => {
        return withFallback(
            async () =>
                (await axiosInstance.put<TraineeBatchResponse>(
                    `/external/classes/${classId}/trainees/batch`,
                    payload,
                )).data,
            () => batchSaveMockTrainees(classId, payload),
        );
    },
};

