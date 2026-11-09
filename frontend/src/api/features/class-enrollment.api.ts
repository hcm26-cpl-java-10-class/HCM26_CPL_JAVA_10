import axiosInstance from "../axios";
import type { Trainee } from "@/types";
import type { TraineeBatchPayload } from "./trainee.api";

export interface TraineeImportRow {
    rowNumber: number;
    studentId: string;
    fullName: string;
    personalEmail?: string;
    nationalId?: string;
    dob?: string;
    gender?: string;
}
export interface TraineeImportPreview {
    totalRows: number; validRows: number; invalidRows: number; duplicateRows: number; canImport: boolean;
    rows: Array<{ rowNumber: number; valid: boolean; duplicate: boolean; errors: Record<string, string[]> }>;
}
export const classEnrollmentKey = (id: string | number) => ["class-enrollments", String(id)] as const;
export const classEnrollmentApi = {
    list: async (id: string | number): Promise<Trainee[]> => (await axiosInstance.get<Trainee[]>(`/classes/${id}/trainees`)).data,
    preview: async (id: string | number, rows: TraineeImportRow[]): Promise<TraineeImportPreview> =>
        (await axiosInstance.post<TraineeImportPreview>(`/classes/${id}/trainees/preview`, rows)).data,
    import: async (id: string | number, rows: TraineeImportRow[]): Promise<{ importedCount: number; enrolledTrainees: number }> =>
        (await axiosInstance.post<{ importedCount: number; enrolledTrainees: number }>(`/classes/${id}/trainees/import`, rows)).data,
    batch: async (id: string | number, payload: TraineeBatchPayload): Promise<{ message: string; trainees: Trainee[] }> =>
        (await axiosInstance.put<{ message: string; trainees: Trainee[] }>(`/classes/${id}/trainees/batch`, {
            created: payload.created.map((row, index) => ({ rowNumber: index + 2, studentId: row.fptAccount, fullName: row.fullName })),
            updated: payload.updated.map(row => ({ id: row.id, status: row.status })),
            deletedIds: payload.deletedIds,
        })).data,
};
