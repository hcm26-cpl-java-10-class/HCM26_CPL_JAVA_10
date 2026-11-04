import axiosInstance from "@/api/axios";
import type { CourseReportItem } from "@/types";

export const courseReportApi = {
    getCourseEnrollmentReport: async (): Promise<CourseReportItem[]> => {
        const response = await axiosInstance.get<CourseReportItem[]>(
            "/reports/course-enrollments",
        );
        return response.data;
    },
};
