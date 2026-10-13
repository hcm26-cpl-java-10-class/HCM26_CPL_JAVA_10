import axiosInstance from "../axios";

export interface ProfileDTO {
    id: number;
    email: string;
    firstName: string;
    lastName: string | null;
    roles: string[];
}

export interface UpdateProfileRequest {
    firstName: string;
    lastName?: string;
}

export const profileApi = {
    getMe: async (): Promise<ProfileDTO> => {
        const response = await axiosInstance.get<ProfileDTO>("/profile");
        return response.data;
    },

    updateMe: async (data: UpdateProfileRequest): Promise<ProfileDTO> => {
        const response = await axiosInstance.put<ProfileDTO>("/profile", data);
        return response.data;
    },
};