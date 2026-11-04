gitimport type {
    AttendanceRecord,
        AuditRecord,
        ClassActivity,
        ClassBudget,
        ClassOperationData,
        ClassSession,
        ExternalClass,
        ExternalRoom,
        ExternalTrainer,
        StatusTransitionInfo,
        TopicAssessment,
        Trainee,
        TrainingAnalytics,
} from "@/types";
import axiosInstance from "../axios";
import { traineeService } from "./trainee.api";
import type { ClassCalendarVersion } from "@/types/features/external";
import {
    findMockClass,
    getMockBudgetByClass,
    getMockCalendarsByClass,
    MOCK_TRAINEES_POOL,
    MOCK_TRAINING_CLASSES,
} from "@/pages/management/training/class/mocks/classTrainee.mock";

/** Asks the backend for records of every status instead of its default ("active"). */
export const ALL_STATUSES = "all";

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

/** Access to the master training system, proxied by the backend under /api/external. */
export const externalApi = {
    createCalendarVersion: async (classId: number, calendarId: number, data: {
        classStartDate: string; actualLearningStartDate: string; overviewItems: import("@/types/features/external").CalendarTopic[];
    }): Promise<ClassCalendarVersion> => {
        const response = await axiosInstance.post<ClassCalendarVersion>(`/external/classes/${classId}/calendars/${calendarId}/versions`, data);
        return response.data;
    },
    downloadCalendarWithDetailedTime: async (classId: number, calendarId: number): Promise<Blob> => {
        const response = await axiosInstance.get<Blob>(`/external/classes/${classId}/calendars/${calendarId}/export`, { responseType: "blob" });
        return response.data;
    },
    saveClassCalendars: async (classId: number, updates: Array<{ id: number; name: string; historyChange: string }>): Promise<void> => {
        await axiosInstance.put(`/external/classes/${classId}/calendars`, { updates });
    },
    getClassCalendars: async (classId: number): Promise<ClassCalendarVersion[]> => {
        return withFallback(
            async () => (await axiosInstance.get<ClassCalendarVersion[]>(`/external/classes/${classId}/calendars`)).data,
            () => getMockCalendarsByClass(classId),
        );
    },
    // ===================== CLASSES =====================
    getClasses: async (status: string = ALL_STATUSES): Promise<ExternalClass[]> => {
        return withFallback(
            async () => (await axiosInstance.get<ExternalClass[]>("/external/classes", { params: { status } })).data,
            () => MOCK_TRAINING_CLASSES,
        );
    },

    getClassById: async (id: string | number): Promise<ExternalClass> => {
        const raw = String(id).trim();
        const isNumericId = /^[1-9]\d*$/.test(raw);

        if (!isNumericId) {
            const list = await externalApi.getClasses();
            const matched = list.find(
                (item) =>
                    (item.code ?? "").toLowerCase() === raw.toLowerCase() ||
                    (item.name ?? "").toLowerCase() === raw.toLowerCase(),
            );
            if (matched) return matched;
            const mockMatch = useMockFallback() ? findMockClass(raw) : undefined;
            if (mockMatch) return mockMatch;
            throw Object.assign(new Error(`Class '${raw}' not found`), { response: { status: 404 } });
        }

        return withFallback(
            async () => (await axiosInstance.get<ExternalClass>(`/external/classes/${raw}`)).data,
            () => {
                const found = findMockClass(raw);
                if (!found) {
                    throw Object.assign(new Error(`Class '${raw}' not found`), { response: { status: 404 } });
                }
                return found;
            },
        );
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

    // ===================== CLASS STATUS LIFECYCLE =====================
    getClassStatusInfo: async (classId: string | number): Promise<StatusTransitionInfo> => {
        const response = await axiosInstance.get<StatusTransitionInfo>(`/external/classes/${classId}/status`);
        return response.data;
    },

    transitionClassStatus: async (
        classId: string | number,
        status: string,
        reason?: string
    ): Promise<{ message: string; class: ExternalClass }> => {
        const response = await axiosInstance.patch<{ message: string; class: ExternalClass }>(
            `/external/classes/${classId}/status`,
            { status, reason }
        );
        return response.data;
    },

    // ===================== TRAINEES =====================
    getClassTrainees: async (classId: string | number): Promise<Trainee[]> => {
        return traineeService.getByClassId(classId);
    },

    getAllTrainees: async (): Promise<Trainee[]> => {
        return withFallback(
            async () => (await axiosInstance.get<Trainee[]>("/external/trainees")).data,
            () => MOCK_TRAINEES_POOL,
        );
    },

    addTraineeToClass: async (
        classId: string | number,
        traineeId: number
    ): Promise<{ message: string; trainee: Trainee }> => {
        const response = await axiosInstance.post<{ message: string; trainee: Trainee }>(
            `/external/classes/${classId}/trainees`,
            { traineeId }
        );
        return response.data;
    },

    removeTraineeFromClass: async (
        classId: string | number,
        traineeId: number,
        reason: string
    ): Promise<{ message: string }> => {
        const response = await axiosInstance.delete<{ message: string }>(
            `/external/classes/${classId}/trainees/${traineeId}`,
            { data: { reason } }
        );
        return response.data;
    },

    // ===================== SESSIONS =====================
    getClassSessions: async (classId: string | number): Promise<ClassSession[]> => {
        const response = await axiosInstance.get<ClassSession[]>(`/external/classes/${classId}/sessions`);
        return response.data;
    },

    createClassSession: async (classId: string | number, data: Partial<ClassSession>): Promise<ClassSession> => {
        const response = await axiosInstance.post<ClassSession>(`/external/classes/${classId}/sessions`, data);
        return response.data;
    },

    updateClassSession: async (
        classId: string | number,
        sessionId: number,
        data: Partial<ClassSession>
    ): Promise<ClassSession> => {
        const response = await axiosInstance.put<ClassSession>(
            `/external/classes/${classId}/sessions/${sessionId}`,
            data
        );
        return response.data;
    },

    deleteClassSession: async (classId: string | number, sessionId: number): Promise<void> => {
        await axiosInstance.delete(`/external/classes/${classId}/sessions/${sessionId}`);
    },

    // ===================== ATTENDANCE =====================
    getSessionAttendance: async (classId: string | number, sessionId: number): Promise<AttendanceRecord[]> => {
        const response = await axiosInstance.get<AttendanceRecord[]>(
            `/external/classes/${classId}/sessions/${sessionId}/attendance`
        );
        return response.data;
    },

    saveSessionAttendance: async (
        classId: string | number,
        sessionId: number,
        records: AttendanceRecord[]
    ): Promise<{ message: string }> => {
        const response = await axiosInstance.put<{ message: string }>(
            `/external/classes/${classId}/sessions/${sessionId}/attendance`,
            { records }
        );
        return response.data;
    },

    // ===================== BUDGET =====================
    getClassBudget: async (classId: string | number): Promise<ClassBudget> => {
        return withFallback(
            async () => (await axiosInstance.get<ClassBudget>(`/external/classes/${classId}/budget`)).data,
            () => getMockBudgetByClass(classId),
        );
    },

    // ===================== AUDIT =====================
    getAllAudits: async (): Promise<AuditRecord[]> => {
        const response = await axiosInstance.get<AuditRecord[]>("/external/audits");
        return response.data;
    },

    getClassAudits: async (classId: string | number): Promise<AuditRecord[]> => {
        const response = await axiosInstance.get<AuditRecord[]>(`/external/classes/${classId}/audits`);
        return response.data;
    },

    createAudit: async (data: Partial<AuditRecord>): Promise<AuditRecord> => {
        const response = await axiosInstance.post<AuditRecord>("/external/audits", data);
        return response.data;
    },

    // ===================== ANALYTICS =====================
    getAnalytics: async (): Promise<TrainingAnalytics> => {
        const response = await axiosInstance.get<TrainingAnalytics>("/external/analytics");
        return response.data;
    },

    // ===================== TRAINERS & ROOMS =====================
    getTrainers: async (status: string = ALL_STATUSES): Promise<ExternalTrainer[]> => {
        const response = await axiosInstance.get<ExternalTrainer[]>("/external/trainers", { params: { status } });
        return response.data;
    },

    getRooms: async (): Promise<ExternalRoom[]> => {
        const response = await axiosInstance.get<ExternalRoom[]>("/external/rooms");
        return response.data;
    },

    // ===================== BUDGET & OPERATION INFO =====================
    getClassOperation: async (classId: string | number): Promise<ClassOperationData> => {
        const response = await axiosInstance.get<ClassOperationData>(`/external/classes/${classId}/operation`);
        return response.data;
    },

    saveClassOperation: async (
        classId: string | number,
        data: Partial<ClassOperationData>
    ): Promise<ClassOperationData> => {
        const response = await axiosInstance.put<ClassOperationData>(`/external/classes/${classId}/operation`, data);
        return response.data;
    },

    // ===================== TOPIC ASSESSMENTS =====================
    getTopicAssessments: async (classId: string | number): Promise<TopicAssessment[]> => {
        const response = await axiosInstance.get<TopicAssessment[]>(`/external/classes/${classId}/topic-assessments`);
        return response.data;
    },

    saveTopicAssessments: async (
        classId: string | number,
        topics: TopicAssessment[],
        action?: "confirm" | "reject" | "discard"
    ): Promise<TopicAssessment[]> => {
        const response = await axiosInstance.put<TopicAssessment[]>(
            `/external/classes/${classId}/topic-assessments`,
            { topics, action }
        );
        return response.data;
    },

    // ===================== CLASS ACTIVITIES =====================
    getClassActivities: async (classId: string | number): Promise<ClassActivity[]> => {
        const response = await axiosInstance.get<ClassActivity[]>(`/external/classes/${classId}/activities`);
        return response.data;
    },

    addClassActivity: async (
        classId: string | number,
        activity: { author?: string; content: string; type?: "history" | "comment" }
    ): Promise<ClassActivity> => {
        const response = await axiosInstance.post<ClassActivity>(
            `/external/classes/${classId}/activities`,
            activity
        );
        return response.data;
    },
};
