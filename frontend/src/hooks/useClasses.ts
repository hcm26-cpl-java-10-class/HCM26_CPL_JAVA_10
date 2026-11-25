import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
    clsApi,
    type ClassFilterParams,
    type ClassPage,
} from "@/api/features/cls.api";
import type { ExternalClass } from "@/types";

export interface UseClassesDetailOptions {
    classId: string | number;
    enabled?: boolean;
}

export interface UseClassesListOptions {
    classId?: undefined;
    enabled?: boolean;
    params?: ClassFilterParams | string;
}

export function useClasses(options: UseClassesDetailOptions): UseQueryResult<ExternalClass, Error>;
export function useClasses(options?: UseClassesListOptions): UseQueryResult<ExternalClass[], Error>;
export function useClasses(
    options?: { classId?: string | number; enabled?: boolean; params?: ClassFilterParams | string }
): UseQueryResult<any, Error> {
    const { classId, enabled = true, params } = options || {};
    const hasClassId = classId !== undefined && classId !== null && String(classId).trim().length > 0;

    return useQuery({
        queryKey: hasClassId ? ["classes", String(classId)] : ["classes", params ?? "all"],
        queryFn: async () => {
            if (hasClassId) {
                const response = await clsApi.getClassById(classId);
                return response.data as ExternalClass;
            }

            const listParams = params ?? { status: "all", size: 100 };
            const response = await clsApi.getClasses(listParams);
            const data = response.data;

            if (Array.isArray(data)) {
                return data as ExternalClass[];
            }

            if (data && typeof data === "object" && "content" in data && Array.isArray((data as ClassPage).content)) {
                const first = data as ClassPage;
                // Class List filters and paginates locally, so it needs every server page.
                // Explicit page requests keep their existing single-page behavior.
                if (typeof params === "object") return first.content as ExternalClass[];
                const remaining = await Promise.all(
                    Array.from({ length: Math.max(0, (first.totalPages ?? 1) - 1) }, (_, index) =>
                        clsApi.getClasses({ status: typeof params === "string" ? params : "all", page: index + 1, size: first.size }),
                    ),
                );
                return [first.content, ...remaining.map(page => (page.data as ClassPage).content)].flat() as ExternalClass[];
            }

            return [] as ExternalClass[];
        },
        enabled: enabled && (!classId || String(classId).trim().length > 0),
        staleTime: 60_000,
    });
}

export default useClasses;
