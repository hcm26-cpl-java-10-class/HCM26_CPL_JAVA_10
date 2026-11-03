import type {
    AttendanceRecord,
    AuditRecord,
    ClassBudget,
    ClassSession,
    ExternalClass,
    ExternalRoom,
    ExternalTrainer,
    StatusTransitionInfo,
    Trainee,
    TrainingAnalytics,
} from "@/types";
import axiosInstance from "../axios";

/** Asks the backend for records of every status instead of its default ("active"). */
export const ALL_STATUSES = "all";

/** Access to the master training system, proxied by the backend under /api/external. */
export const externalApi = {
    // ===================== CLASSES =====================
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
        const response = await axiosInstance.get<Trainee[]>(`/external/classes/${classId}/trainees`);
        return response.data;
    },

    getAllTrainees: async (): Promise<Trainee[]> => {
        const response = await axiosInstance.get<Trainee[]>("/external/trainees");
        return response.data;
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
        const response = await axiosInstance.get<ClassBudget>(`/external/classes/${classId}/budget`);
        return response.data;
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
};
