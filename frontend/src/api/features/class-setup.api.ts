import axiosInstance from "../axios";
import { externalApi } from "./external.api";
import { programApi } from "./program.api";
import type { ExternalTrainer } from "@/types";
import type { TrainingProgramItem } from "@/types/features/content";

export interface ProgramLink {
    id: number; programId: number; code: string; name: string; version: string;
    status: "ACTIVE" | "INACTIVE"; active: boolean; matchesClassProgram: boolean;
}
export interface MainAssignment {
    id: number; classId: number; classCode: string; programSubjectId: number; subjectId: number;
    subjectCode: string; subjectName: string; trainerId: number; trainerName: string | null;
    role: "MAIN" | "ASSISTANT"; effectiveFrom: string; effectiveTo: string | null;
}
export interface ClassSetup {
    classId: number; classCode: string; savedProgram: string; masterTrainer: string;
    startDate: string; endDate: string; programLink: ProgramLink | null;
    subjects: Array<{ id: number; subjectId: number; code: string; name: string; eligible: boolean }>;
    assignments: MainAssignment[];
}
export interface AssignmentInput {
    classId: number; programSubjectId: number; trainerId: number; role: "MAIN";
    effectiveFrom: string; effectiveTo: string | null;
}
export const classSetupKey = (id: number) => ["classes", "setup", id] as const;
export const classSetupApi = {
    get: async (id: number) => (await axiosInstance.get<ClassSetup>(`/classes/${id}/setup`)).data,
    link: async (id: number, programId: number) => (await axiosInstance.put<ProgramLink>(`/classes/${id}/program-link`, { programId })).data,
    createAssignment: async (id: number, input: AssignmentInput) =>
        (await axiosInstance.post<MainAssignment>(`/classes/${id}/teaching-assignments`, input)).data,
    updateAssignment: async (id: number, assignmentId: number, input: AssignmentInput) =>
        (await axiosInstance.put<MainAssignment>(`/classes/${id}/teaching-assignments/${assignmentId}`, input)).data,
    activePrograms: async () => {
        const result: TrainingProgramItem[] = [];
        for (let page = 0; ; page++) {
            const response = await programApi.getPage({ status: "ACTIVE", size: 1000, page });
            result.push(...response.content.filter(p => p.isActive && p.status === "ACTIVE"));
            if (page + 1 >= response.totalPages) return result;
        }
    },
    verifiedTrainers: async (): Promise<ExternalTrainer[]> => {
        // Fetch provenance after the directory request: that response may identify itself as sample data.
        const trainers = await externalApi.getTrainers("active");
        const provenance = (await axiosInstance.get<{ sampleData: boolean }>("/external/data-source")).data;
        if (provenance.sampleData !== false) throw new Error("BLOCKED: Master Trainer API is sample or unverified. Configure the real directory; no sample trainers can be selected.");
        return trainers.filter(t => t.id != null && t.status?.toLowerCase() === "active" && t.name?.trim());
    },
};
