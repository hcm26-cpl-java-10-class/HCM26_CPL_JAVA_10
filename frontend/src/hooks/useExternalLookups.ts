import { useQuery } from "@tanstack/react-query";
import { externalApi } from "@/api/features/external.api";
import { retryUnlessClientError } from "@/utils/query.utils";

const STALE_TIME_MS = 60_000;

export const externalKeys = {
    classes: ["external", "classes"] as const,
    class: (id: string | number) => ["external", "class", String(id)] as const,
    trainers: ["external", "trainers"] as const,
    activeTrainers: ["external", "trainers", "active"] as const,
    rooms: ["external", "rooms"] as const,
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
