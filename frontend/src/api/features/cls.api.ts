import type { AxiosResponse } from "axios";
import axiosInstance from "../axios";

// ======================== TYPES ========================

export type ClassStatus =
    | "planning"
    | "assigned"
    | "active"
    | "completed"
    | "closed"
    | "cancelled"
    | string;

export interface TrainingClass {
    traineeSource?: "internal";
    id: number;
    code: string;
    name: string;
    status: ClassStatus;
    startDate: string;
    endDate: string;
    plannedSize: number;
    site?: string;
    traineeType?: string;
    program: string;
    classAdmin: string;
    masterTrainer: string;
    deliveryType?: string;
    formatType?: string;
    skills?: string;
    location?: string;
    // Optional compatibility fields with FAMS / ExternalClass interfaces
    programId?: number;
    trainingProgram?: string;
    enrolledTrainees?: number;
    subjectType?: string;
    plannedRevenue?: string;
    scope?: string;
    supplierPartner?: string;
    keyProgram?: string;
    globalSe?: string;
    jobRecommendation?: string;
}

export type TrainingClassDTO = TrainingClass;

export interface ClassPage {
    content: TrainingClass[];
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
    programs: string[];
}

export interface ClassStatistics {
    totalClasses: number;
    inProgress: number;
    upcomingClasses: number;
    completedClasses: number;
    asOf: string;
    upcomingThrough: string;
    timezone: string;
}

export interface ClassReadiness {
    classId: number;
    checks: Array<{ key: string; label: string; status: "READY" | "NOT_READY" | "UNKNOWN" | "BLOCKED"; reason: string; target: string; action?: string }>;
    ready: number;
    notReady: number;
    unknown: number;
    blocked?: number;
    verified: number;
    enrolledTrainees: number;
    evaluatedAt: string;
}

export interface ClassFilterParams {
    page?: number;
    size?: number;
    search?: string;
    status?: string;
    program?: string;
    from?: string;
    to?: string;
    sort?: string;
    direction?: "asc" | "desc";
}

export interface CreateTrainingClassInput {
    code: string;
    name: string;
    status: string;
    startDate: string;
    endDate: string;
    plannedSize: number;
    site?: string;
    traineeType?: string;
    program: string;
    classAdmin: string;
    masterTrainer: string;
    deliveryType?: string;
    formatType?: string;
    skills?: string;
    location?: string;
}

export type UpdateTrainingClassInput = Partial<CreateTrainingClassInput>;

// ======================== API CLIENT ========================

/**
 * Internal Training Class API Client.
 * Connects directly to Spring Boot backend endpoints:
 *   - GET    /classes
 *   - GET    /classes/{id}
 *   - POST   /classes
 *   - POST   /classes/import
 *   - PUT    /classes/{id}
 *   - DELETE /classes/{id}
 * Note: axiosInstance baseURL already includes '/api', so paths do not repeat '/api'.
 */
export const clsApi = {
    getAllClasses: async (): Promise<TrainingClass[]> => {
        const result: TrainingClass[] = [];
        for (let page = 0; ; page++) {
            const { data } = await clsApi.getClasses({ status: "all", page, size: 100 });
            if (Array.isArray(data)) return data;
            result.push(...data.content);
            if (page + 1 >= data.totalPages) return result;
        }
    },
    getReadiness: async (id: number): Promise<ClassReadiness> => (await axiosInstance.get<ClassReadiness>(`/classes/${id}/readiness`)).data,
    getStatistics: async (): Promise<ClassStatistics> => (await axiosInstance.get<ClassStatistics>("/classes/stats")).data,
    /**
     * GET /classes
     * Fetch paginated and filtered classes.
     * Can receive a params object or a status string (e.g. "all", "active").
     */
    getClasses: async (
        params?: ClassFilterParams | string
    ): Promise<AxiosResponse<ClassPage | TrainingClass[]>> => {
        let queryParams: Record<string, any> = {};

        if (typeof params === "string") {
            queryParams.status = params;
        } else if (params) {
            queryParams = { ...params };
        }

        return axiosInstance.get<ClassPage | TrainingClass[]>("/classes", {
            params: queryParams,
        });
    },

    /**
     * GET /classes/{id}
     * Fetch a single class by ID (numeric ID or class code resolution).
     */
    getClassById: async (
        id: number | string
    ): Promise<AxiosResponse<TrainingClass>> => {
        const raw = String(id).trim();
        const isNumericId = /^[1-9]\d*$/.test(raw);

        if (!isNumericId) {
            const allRes = await clsApi.getClasses("all");
            const items = Array.isArray(allRes.data)
                ? allRes.data
                : (allRes.data as ClassPage)?.content ?? [];
            const matched = items.find(
                (item) =>
                    (item.code ?? "").toLowerCase() === raw.toLowerCase() ||
                    (item.name ?? "").toLowerCase() === raw.toLowerCase()
            );
            if (matched) {
                return { ...allRes, data: matched };
            }
        }

        return axiosInstance.get<TrainingClass>(`/classes/${id}`);
    },

    /**
     * POST /classes
     * Create a new training class (initial status must be 'planning').
     */
    createClass: async (
        data: CreateTrainingClassInput
    ): Promise<AxiosResponse<TrainingClass>> => {
        return axiosInstance.post<TrainingClass>("/classes", data);
    },

    /**
     * POST /classes/import
     * Batch import multiple training classes (up to 500 classes).
     */
    importClasses: async (
        data: CreateTrainingClassInput[]
    ): Promise<AxiosResponse<TrainingClass[]>> => {
        return axiosInstance.post<TrainingClass[]>("/classes/import", data);
    },

    /**
     * PUT /classes/{id}
     * Update an existing training class.
     */
    updateClass: async (
        id: number | string,
        data: UpdateTrainingClassInput
    ): Promise<AxiosResponse<TrainingClass>> => {
        return axiosInstance.put<TrainingClass>(`/classes/${id}`, data);
    },

    /**
     * DELETE /classes/{id}
     * Soft-deactivate an unstarted class.
     */
    deleteClass: async (
        id: number | string
    ): Promise<AxiosResponse<void>> => {
        return axiosInstance.delete<void>(`/classes/${id}`);
    },

    // Convenience aliases
    getById: (id: number | string) => clsApi.getClassById(id),
    getAll: (params?: ClassFilterParams | string) => clsApi.getClasses(params),
    create: (data: CreateTrainingClassInput) => clsApi.createClass(data),
    update: (id: number | string, data: UpdateTrainingClassInput) => clsApi.updateClass(id, data),
    delete: (id: number | string) => clsApi.deleteClass(id),
};

export const classApi = clsApi;
export default clsApi;
