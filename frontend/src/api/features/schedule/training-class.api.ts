import axiosInstance from "@/api/axios";

function toApiDate(value: unknown): string {
    const text = String(value ?? "").trim();
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);

    if (match) {
        const [, day, month, year] = match;
        return `${year}-${month}-${day}`;
    }

    return text;
}

function requirePositiveInteger(
    value: unknown,
    message: string,
): number {
    const number = Number(value);

    if (!Number.isSafeInteger(number) || number <= 0) {
        throw new Error(message);
    }

    return number;
}

function buildClassPayload(data: Record<string, unknown>) {
    const capacity = requirePositiveInteger(data.capacity, "Capacity must be a whole number from 1 to 50.");
    if (capacity > 50) throw new Error("Capacity must not exceed 50 trainees.");
    return {
        code: data.code,
        name: data.name,
        description: data.description,
        traineeType: data.traineeType,
        deliveryFormat: data.deliveryFormat,
        site: data.site,
        location: data.location,
        programVersionId: requirePositiveInteger(
            data.programVersionId,
            "Please select a valid training program version.",
        ),
        startDate: toApiDate(data.startDate),
        endDate: toApiDate(data.endDate),
        capacity,
    };
}

export interface TrainingClassResponse {
    id: number;
    version: number;
    currentRevisionId: number | null;
    currentRevisionNo: number | null;
    pendingRevisionId: number | null;
    pendingRevisionNo: number | null;
    pendingRevisionStatus: ClassRevisionStatus | null;
    lastIssuedRevisionNo: number;
    openClassRequestId: number | null;
    code: string;
    name: string;
    description: string | null;
    traineeType: string;
    deliveryFormat: string;
    site: string;
    location: string;
    programVersionId: number;
    startDate: string;
    endDate: string;
    capacity: number;
    status: string;
    isActive: boolean;
    createdAt: string;
    createdBy: number | null;
    updatedAt: string;
    updatedBy: number | null;
}

export interface TrainingClassTablePagination {
    page: number;
    size: number;
    sort?: string[];
}

export interface TrainingClassPage {
    content: TrainingClassResponse[];
    number: number;
    totalPages: number;
    totalElements: number;
}

export interface TrainingClassOption {
    value: string;
    label: string;
}

export interface TrainingClassCreateOptions {
    sites: TrainingClassOption[];
    traineeTypes: TrainingClassOption[];
    deliveryFormats: TrainingClassOption[];
    locations: TrainingClassLocationOption[];
}

export interface TrainingClassLocationOption extends TrainingClassOption {
    site: string;
}

export const trainingClassTableApi = {
    async create(
        data: Record<string, unknown>,
    ): Promise<TrainingClassResponse> {
        const openClassRequestId = requirePositiveInteger(
            data.openClassRequestId,
            "Please select an approved open class request.",
        );

        const response = await axiosInstance.post<TrainingClassResponse>(
            "/classes",
            {
                ...buildClassPayload(data),
                openClassRequestId,
            },
        );

        return response.data;
    },

    async update(
        id: number | string,
        data: Record<string, unknown>,
    ): Promise<TrainingClassResponse> {
        const version = Number(data.version);
        if (data.version == null || !Number.isSafeInteger(version) || version < 0) {
            throw new Error("Reload the class before editing.");
        }
        const response = await axiosInstance.put<TrainingClassResponse>(
            `/classes/${id}`,
            { ...buildClassPayload(data), version,
                revisionId: requirePositiveInteger(data.revisionId, "Load a draft before editing."),
                revisionVersion: data.revisionVersion },
        );

        return response.data;
    },

    async delete(id: number | string): Promise<void> {
        await axiosInstance.delete(`/classes/${id}`);
    },

    async getPage(
        pagination: TrainingClassTablePagination,
        search = "",
        filters: Record<string, unknown> = {},
    ): Promise<TrainingClassPage> {
        const params = new URLSearchParams();

        params.set("page", String(pagination.page));
        params.set("size", String(pagination.size));
        params.set("search", search.trim());

        for (const key of ["status", "site"] as const) {
            const value = filters[key];

            if (typeof value === "string" && value.trim()) {
                params.set(key, value.trim());
            }
        }

        const programVersionId = String(
            filters.programVersionId ?? "",
        ).trim();

        if (programVersionId) {
            if (
                !/^[1-9]\d*$/.test(programVersionId) ||
                !Number.isSafeInteger(Number(programVersionId))
            ) {
                throw new Error(
                    "Program version ID must be a positive integer.",
                );
            }

            params.set("programVersionId", programVersionId);
        }

        const dateRange = filters.startDate;

        if (
            typeof dateRange === "object" &&
            dateRange !== null &&
            !Array.isArray(dateRange)
        ) {
            const range = dateRange as {
                from?: string;
                to?: string;
            };

            const from = range.from ? toApiDate(range.from) : "";
            const to = range.to ? toApiDate(range.to) : "";

            if (from && to && from > to) {
                throw new Error(
                    "Start date From must not be after To.",
                );
            }

            if (from) {
                params.set("startDateFrom", from);
            }

            if (to) {
                params.set("startDateTo", to);
            }
        }

        const sorts = pagination.sort?.length
            ? pagination.sort
            : ["id,desc"];

        sorts.forEach((sort) => params.append("sort", sort));

        const response = await axiosInstance.get<TrainingClassPage>(
            "/classes",
            { params },
        );

        return response.data;
    },
};

export type ClassRevisionStatus = "DRAFT" | "UNDER_REVIEW" | "ACTIVE" | "ARCHIVED" | "REJECTED";

export interface TrainingClassRevisionResponse {
    id: number;
    classId: number;
    revisionNo: number;
    version: number;
    baseRevisionId: number | null;
    status: ClassRevisionStatus;
    name: string;
    description: string | null;
    traineeType: string;
    deliveryFormat: string;
    site: string;
    location: string;
    startDate: string;
    endDate: string;
    capacity: number;
    createdBy: number | null;
    createdAt: string;
    updatedBy: number | null;
    updatedAt: string;
    submittedBy: number | null;
    submittedAt: string | null;
    reviewedBy: number | null;
    reviewedAt: string | null;
    rejectionReason: string | null;
    dependencyValidationRequired: boolean;
}

export async function getTrainingClassRevisions(classId: number | string): Promise<TrainingClassRevisionResponse[]> {
    return (await axiosInstance.get<TrainingClassRevisionResponse[]>(`/classes/${classId}/revisions`)).data;
}

export async function createTrainingClassDraft(data: TrainingClassResponse): Promise<TrainingClassResponse> {
    return (await axiosInstance.post<TrainingClassResponse>(`/classes/${data.id}/revisions`, { version: data.version })).data;
}

export async function actOnTrainingClassRevision(
    data: TrainingClassResponse, revision: TrainingClassRevisionResponse,
    action: "submit" | "approve" | "reject", reason?: string,
): Promise<TrainingClassResponse> {
    return (await axiosInstance.post<TrainingClassResponse>(`/classes/${data.id}/revisions/${revision.id}/${action}`, {
        version: data.version, revisionVersion: revision.version, reason,
    })).data;
}

export async function getTrainingClass(
    classId: string,
): Promise<TrainingClassResponse> {
    const response = await axiosInstance.get<TrainingClassResponse>(
        `/classes/${classId}`,
    );

    return response.data;
}

export async function getTrainingClasses(
    page = 0,
): Promise<TrainingClassPage> {
    const response = await axiosInstance.get<TrainingClassPage>(
        "/classes",
        {
            params: {
                page,
                size: 10,
                sort: "id,desc",
            },
        },
    );

    return response.data;
}

export async function getTrainingClassCreateOptions():
    Promise<TrainingClassCreateOptions> {
    const response =
        await axiosInstance.get<TrainingClassCreateOptions>(
            "/classes/create-options",
        );

    return response.data;


}

export interface OpenClassRequestOption {
    id: number;
    label: string;
    programVersionId: number;
    programLabel: string;
}

export async function getOpenClassRequestOptions():
    Promise<OpenClassRequestOption[]> {
    const response =
        await axiosInstance.get<OpenClassRequestOption[]>(
            "/classes/request-options",
        );

    return response.data;
}
