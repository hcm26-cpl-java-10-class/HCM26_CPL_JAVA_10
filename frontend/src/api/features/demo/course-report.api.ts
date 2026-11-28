import axiosInstance from "@/api/axios";
import type { CourseReportItem, LearningHoursReport } from "@/types";

export const courseReportApi = {
    getCourseEnrollmentReport: async (): Promise<CourseReportItem[]> => {
        const response = await axiosInstance.get<CourseReportItem[]>(
            "/reports/course-enrollments",
        );
        return response.data;
    },

    /**
     * Learning hours analytics: giờ học theo học viên / phòng ban / khóa học,
     * kèm ngày đăng ký để đối chiếu.
     */
    getLearningHoursReport: async (): Promise<LearningHoursReport> => {
        const response = await axiosInstance.get<LearningHoursReport>(
            "/reports/learning-hours",
        );
        return response.data;
    },
};
