import axiosInstance from "@/api/axios";

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

export async function getTrainingClass(
    classId: string,
): Promise<TrainingClassResponse> {
    const response = await axiosInstance.get<TrainingClassResponse>(
        `/classes/${classId}`,
    );
    return response.data;
}