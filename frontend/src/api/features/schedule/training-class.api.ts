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

export interface TrainingClassResponse {
    id: number;
    code: string;
    name: string;
    traineeType: string;
    deliveryFormat: string;
    site: string;
    location: string;
    programVersionId: number;
    startDate: string;
    endDate: string;
    capacity: number;
    status: string;
    createdAt: string;
    createdBy: number | null;
}
export interface TrainingClassTablePagination {
    page: number;
    size: number;
    sort?: string[];
}

export const trainingClassTableApi = {
    async create(
        data: Record<string, unknown>,
    ): Promise<TrainingClassResponse> {
        const response = await axiosInstance.post<TrainingClassResponse>(
            "/classes",
            {
                code: data.code,
                name: data.name,
                traineeType: data.traineeType,
                deliveryFormat: data.deliveryFormat,
                site: data.site,
                location: data.location,
                programVersionId: Number(data.programVersionId),
                startDate: toApiDate(data.startDate),
                endDate: toApiDate(data.endDate),
                capacity: Number(data.capacity),
            },
        );

        return response.data;
    },
    async getPage(
        pagination: TrainingClassTablePagination,
        search = "",
    ): Promise<TrainingClassPage> {
        const params = new URLSearchParams();

        params.set("page", String(pagination.page));
        params.set("size", String(pagination.size));
        params.set("search", search.trim());

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
export interface TrainingClassPage {
    content: TrainingClassResponse[];
    number: number;
    totalPages: number;
    totalElements: number;
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
    const response = await axiosInstance.get<TrainingClassPage>("/classes", {
        params: {
            page,
            size: 10,
            sort: "id,desc",
        },
    });


    return response.data;



}