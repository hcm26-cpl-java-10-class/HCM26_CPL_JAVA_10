import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { externalApi } from "@/api/features/external.api";
import { retryUnlessClientError } from "@/utils/query.utils";
import type { ClassOperationData, TopicAssessment } from "@/types";

const STALE_TIME_MS = 60_000;

export const externalKeys = {
    classes: ["external", "classes"] as const,
    class: (id: string | number) => ["external", "class", String(id)] as const,
    classStatus: (id: string | number) => ["external", "class", String(id), "status"] as const,
    classTrainees: (id: string | number) => ["external", "class", String(id), "trainees"] as const,
    classSessions: (id: string | number) => ["external", "class", String(id), "sessions"] as const,
    sessionAttendance: (classId: string | number, sessionId: number) =>
        ["external", "class", String(classId), "session", String(sessionId), "attendance"] as const,
    classBudget: (id: string | number) => ["external", "class", String(id), "budget"] as const,
    classAudits: (id: string | number) => ["external", "class", String(id), "audits"] as const,
    allAudits: ["external", "audits"] as const,
    analytics: ["external", "analytics"] as const,
    allTrainees: ["external", "trainees"] as const,
    trainers: ["external", "trainers"] as const,
    activeTrainers: ["external", "trainers", "active"] as const,
    rooms: ["external", "rooms"] as const,
    classOperation: (id: string | number) => ["external", "class", String(id), "operation"] as const,
    topicAssessments: (id: string | number) => ["external", "class", String(id), "topicAssessments"] as const,
    classActivities: (id: string | number) => ["external", "class", String(id), "activities"] as const,
};

/** Every class known to the master training system, whatever its status. */
export function useExternalClasses(enabled = true) {
    return useQuery({
        queryKey: externalKeys.classes,
        queryFn: () => externalApi.getClasses(),
        enabled,
        staleTime: STALE_TIME_MS,
        retry: retryUnlessClientError,
    });
}

export function useExternalClass(classId: string | undefined) {
    return useQuery({
        queryKey: externalKeys.class(classId ?? ""),
        queryFn: () => externalApi.getClassById(classId as string),
        enabled: !!classId,
        staleTime: STALE_TIME_MS,
        retry: retryUnlessClientError,
    });
}

// ===================== STATUS LIFECYCLE =====================

export function useClassStatusInfo(classId: string | undefined) {
    return useQuery({
        queryKey: externalKeys.classStatus(classId ?? ""),
        queryFn: () => externalApi.getClassStatusInfo(classId as string),
        enabled: !!classId,
        staleTime: 10_000,
        retry: retryUnlessClientError,
    });
}

export function useTransitionClassStatus(classId: string | undefined) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ status, reason }: { status: string; reason?: string }) =>
            externalApi.transitionClassStatus(classId as string, status, reason),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: externalKeys.class(classId ?? "") });
            void qc.invalidateQueries({ queryKey: externalKeys.classStatus(classId ?? "") });
            void qc.invalidateQueries({ queryKey: externalKeys.classes });
            void qc.invalidateQueries({ queryKey: externalKeys.classActivities(classId ?? "") });
        },
    });
}

// ===================== TRAINEES =====================

export function useClassTrainees(classId: string | undefined) {
    return useQuery({
        queryKey: externalKeys.classTrainees(classId ?? ""),
        queryFn: () => externalApi.getClassTrainees(classId as string),
        enabled: !!classId,
        staleTime: STALE_TIME_MS,
        retry: retryUnlessClientError,
    });
}

export function useAllTrainees(enabled = true) {
    return useQuery({
        queryKey: externalKeys.allTrainees,
        queryFn: () => externalApi.getAllTrainees(),
        enabled,
        staleTime: STALE_TIME_MS,
        retry: retryUnlessClientError,
    });
}

export function useAddTrainee(classId: string | undefined) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (traineeId: number) => externalApi.addTraineeToClass(classId as string, traineeId),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: externalKeys.classTrainees(classId ?? "") });
            void qc.invalidateQueries({ queryKey: externalKeys.class(classId ?? "") });
            void qc.invalidateQueries({ queryKey: externalKeys.classActivities(classId ?? "") });
        },
    });
}

export function useRemoveTrainee(classId: string | undefined) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ traineeId, reason }: { traineeId: number; reason: string }) =>
            externalApi.removeTraineeFromClass(classId as string, traineeId, reason),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: externalKeys.classTrainees(classId ?? "") });
            void qc.invalidateQueries({ queryKey: externalKeys.class(classId ?? "") });
            void qc.invalidateQueries({ queryKey: externalKeys.classActivities(classId ?? "") });
        },
    });
}

// ===================== SESSIONS =====================

export function useClassSessions(classId: string | undefined) {
    return useQuery({
        queryKey: externalKeys.classSessions(classId ?? ""),
        queryFn: () => externalApi.getClassSessions(classId as string),
        enabled: !!classId,
        staleTime: STALE_TIME_MS,
        retry: retryUnlessClientError,
    });
}

export function useCreateSession(classId: string | undefined) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data: Parameters<typeof externalApi.createClassSession>[1]) =>
            externalApi.createClassSession(classId as string, data),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: externalKeys.classSessions(classId ?? "") });
        },
    });
}

export function useDeleteSession(classId: string | undefined) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (sessionId: number) => externalApi.deleteClassSession(classId as string, sessionId),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: externalKeys.classSessions(classId ?? "") });
        },
    });
}

// ===================== ATTENDANCE =====================

export function useSessionAttendance(classId: string | undefined, sessionId: number | undefined) {
    return useQuery({
        queryKey: externalKeys.sessionAttendance(classId ?? "", sessionId ?? 0),
        queryFn: () => externalApi.getSessionAttendance(classId as string, sessionId as number),
        enabled: !!classId && !!sessionId,
        staleTime: 30_000,
        retry: retryUnlessClientError,
    });
}

export function useSaveAttendance(classId: string | undefined, sessionId: number | undefined) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (records: Parameters<typeof externalApi.saveSessionAttendance>[2]) =>
            externalApi.saveSessionAttendance(classId as string, sessionId as number, records),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: externalKeys.sessionAttendance(classId ?? "", sessionId ?? 0) });
            void qc.invalidateQueries({ queryKey: externalKeys.classTrainees(classId ?? "") });
            void qc.invalidateQueries({ queryKey: externalKeys.classSessions(classId ?? "") });
        },
    });
}

// ===================== BUDGET =====================

export function useClassBudget(classId: string | undefined) {
    return useQuery({
        queryKey: externalKeys.classBudget(classId ?? ""),
        queryFn: () => externalApi.getClassBudget(classId as string),
        enabled: !!classId,
        staleTime: STALE_TIME_MS,
        retry: retryUnlessClientError,
    });
}

// ===================== AUDIT =====================

export function useAllAudits(enabled = true) {
    return useQuery({
        queryKey: externalKeys.allAudits,
        queryFn: () => externalApi.getAllAudits(),
        enabled,
        staleTime: STALE_TIME_MS,
        retry: retryUnlessClientError,
    });
}

export function useClassAudits(classId: string | undefined) {
    return useQuery({
        queryKey: externalKeys.classAudits(classId ?? ""),
        queryFn: () => externalApi.getClassAudits(classId as string),
        enabled: !!classId,
        staleTime: STALE_TIME_MS,
        retry: retryUnlessClientError,
    });
}

export function useCreateAudit() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data: Parameters<typeof externalApi.createAudit>[0]) => externalApi.createAudit(data),
        onSuccess: (_, variables) => {
            void qc.invalidateQueries({ queryKey: externalKeys.allAudits });
            if (variables.classId) {
                void qc.invalidateQueries({ queryKey: externalKeys.classAudits(variables.classId) });
            }
        },
    });
}

// ===================== ANALYTICS =====================

export function useTrainingAnalytics(enabled = true) {
    return useQuery({
        queryKey: externalKeys.analytics,
        queryFn: () => externalApi.getAnalytics(),
        enabled,
        staleTime: 30_000,
        retry: retryUnlessClientError,
    });
}

// ===================== TRAINERS & ROOMS =====================

export function useExternalTrainers(enabled = true) {
    return useQuery({
        queryKey: externalKeys.trainers,
        queryFn: () => externalApi.getTrainers(),
        enabled,
        staleTime: STALE_TIME_MS,
        retry: retryUnlessClientError,
    });
}

/** Only active trainers can be given a session: this is the exact set the backend verifies against. */
export function useAssignableTrainers(enabled = true) {
    return useQuery({
        queryKey: externalKeys.activeTrainers,
        queryFn: () => externalApi.getTrainers("active"),
        enabled,
        staleTime: STALE_TIME_MS,
        retry: retryUnlessClientError,
    });
}

export function useExternalRooms(enabled = true) {
    return useQuery({
        queryKey: externalKeys.rooms,
        queryFn: () => externalApi.getRooms(),
        enabled,
        staleTime: STALE_TIME_MS,
        retry: retryUnlessClientError,
    });
}

// ===================== BUDGET & OPERATION INFO =====================

export function useClassOperation(classId: string | undefined) {
    return useQuery({
        queryKey: externalKeys.classOperation(classId ?? ""),
        queryFn: () => externalApi.getClassOperation(classId as string),
        enabled: !!classId,
        staleTime: STALE_TIME_MS,
        retry: retryUnlessClientError,
    });
}

export function useSaveClassOperation(classId: string | undefined) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data: Partial<ClassOperationData>) =>
            externalApi.saveClassOperation(classId as string, data),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: externalKeys.classOperation(classId ?? "") });
            void qc.invalidateQueries({ queryKey: externalKeys.class(classId ?? "") });
            void qc.invalidateQueries({ queryKey: externalKeys.classActivities(classId ?? "") });
        },
    });
}

// ===================== TOPIC ASSESSMENTS =====================

export function useTopicAssessments(classId: string | undefined) {
    return useQuery({
        queryKey: externalKeys.topicAssessments(classId ?? ""),
        queryFn: () => externalApi.getTopicAssessments(classId as string),
        enabled: !!classId,
        staleTime: STALE_TIME_MS,
        retry: retryUnlessClientError,
    });
}

export function useSaveTopicAssessments(classId: string | undefined) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({
            topics,
            action,
        }: {
            topics: TopicAssessment[];
            action?: "confirm" | "reject" | "discard";
        }) => externalApi.saveTopicAssessments(classId as string, topics, action),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: externalKeys.topicAssessments(classId ?? "") });
            void qc.invalidateQueries({ queryKey: externalKeys.classOperation(classId ?? "") });
            void qc.invalidateQueries({ queryKey: externalKeys.classActivities(classId ?? "") });
        },
    });
}

// ===================== CLASS ACTIVITIES =====================

export function useClassActivities(classId: string | undefined) {
    return useQuery({
        queryKey: externalKeys.classActivities(classId ?? ""),
        queryFn: () => externalApi.getClassActivities(classId as string),
        enabled: !!classId,
        staleTime: 10_000,
        retry: retryUnlessClientError,
    });
}

export function useAddClassActivity(classId: string | undefined) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (activity: { author?: string; content: string; type?: "history" | "comment" }) =>
            externalApi.addClassActivity(classId as string, activity),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: externalKeys.classActivities(classId ?? "") });
        },
    });
}
