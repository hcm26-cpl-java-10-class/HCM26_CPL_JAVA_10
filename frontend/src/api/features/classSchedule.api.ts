import axiosInstance from "@/api/axios";
import type {
    ScheduleClassInfo,
    ScheduleConfig,
    ScheduleEntry,
    ScheduleProgram,
    SlotNumber,
} from "@/pages/management/calendar/schedule.config";

export interface ClassScheduleResponse {
    classInfo: ScheduleClassInfo;
    program: ScheduleProgram | null;
    config: ScheduleConfig;
    hasSchedule: boolean;
    outdated: boolean;
    outdatedReason?: string | null;
    entries: ScheduleEntry[];
}

export interface SaveScheduleEntryPayload {
    id?: string;
    courseId: number;
    date: string;
    actualDate?: string;
    slot: SlotNumber;
    isManual: boolean;
    note?: string;
}

export interface GenerateScheduleOptions {
    holidays?: string[];
    actualStartDate?: string;
}

export interface SaveScheduleOptions {
    actualStartDate?: string;
    actualEndDate?: string;
}

export const classScheduleApi = {
    getClassSchedule: async (classId: number | string): Promise<ClassScheduleResponse> => {
        const res = await axiosInstance.get<ClassScheduleResponse>(`/classes/${classId}/schedule`);
        return res.data;
    },

    generateClassSchedule: async (
        classId: number | string,
        options?: string[] | GenerateScheduleOptions,
    ): Promise<ScheduleEntry[]> => {
        const payload = Array.isArray(options)
            ? { holidays: options }
            : {
                  ...(options?.holidays ? { holidays: options.holidays } : {}),
                  ...(options?.actualStartDate ? { actualStartDate: options.actualStartDate } : {}),
              };
        const res = await axiosInstance.post<ScheduleEntry[]>(
            `/classes/${classId}/schedule/generate`,
            payload,
        );
        return res.data;
    },

    saveClassSchedule: async (
        classId: number | string,
        entries: SaveScheduleEntryPayload[],
        options?: SaveScheduleOptions,
    ): Promise<ClassScheduleResponse> => {
        const res = await axiosInstance.put<ClassScheduleResponse>(`/classes/${classId}/schedule`, {
            entries,
            ...(options?.actualStartDate ? { actualStartDate: options.actualStartDate } : {}),
            ...(options?.actualEndDate ? { actualEndDate: options.actualEndDate } : {}),
        });
        return res.data;
    },
};
