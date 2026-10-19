
import axiosInstance from "../axios";
import type { SubjectDTO } from "@/types";

const path = "/subjects";

export const subjectApi = {
    getActiveSubjects: async (): Promise<SubjectDTO[]> => {
        const response = await axiosInstance.get<SubjectDTO[]>(
            `${path}/active`
        );

        return response.data;
    },
};
