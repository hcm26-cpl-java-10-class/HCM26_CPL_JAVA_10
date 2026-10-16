import { enrollmentApi } from "@/api";
import { usePermissions } from "@/hooks/usePermissions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";
import { getErrorMessage } from "../utils/course.utils.ts";

/**
 * Gom logic ghi danh dùng chung cho Catalog và Course Detail:
 * - map courseId -> enrollment (để lấy enrollmentId cho nút "Continue learning")
 * - mutation ghi danh / hủy ghi danh và invalidate các query liên quan.
 */
export function useCourseEnrollment() {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();

  const canEnroll = hasPermission("ENROLLMENT_CREATE");
  const canCancel = hasPermission("ENROLLMENT_DELETE");
  const canReadEnrollments = hasPermission("ENROLLMENT_READ");

  const enrollmentsQuery = useQuery({
    queryKey: ["my-enrollments"],
    queryFn: enrollmentApi.getMyCourses,
    enabled: canReadEnrollments,
  });

  const enrollmentByCourseId = useMemo(
    () => new Map((enrollmentsQuery.data ?? []).map((enrollment) => [enrollment.courseId, enrollment])),
    [enrollmentsQuery.data],
  );

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["my-enrollments"] }),
      queryClient.invalidateQueries({ queryKey: ["course-catalog"] }),
      queryClient.invalidateQueries({ queryKey: ["course-detail"] }),
    ]);

  const enrollMutation = useMutation({
    mutationFn: (courseId: number) => enrollmentApi.enroll(courseId),
    onSuccess: async () => {
      await refresh();
      toast.success("You are enrolled in this course.");
    },
    onError: (error) => toast.error(getErrorMessage(error, "Could not enroll in this course.")),
  });

  const cancelMutation = useMutation({
    mutationFn: (enrollmentId: number) => enrollmentApi.cancel(enrollmentId),
    onSuccess: async () => {
      await refresh();
      toast.success("Your enrollment has been canceled.");
    },
    onError: (error) => toast.error(getErrorMessage(error, "Could not cancel this enrollment.")),
  });

  return {
    canEnroll,
    canCancel,
    enrollmentsQuery,
    enrollmentByCourseId,
    enrollMutation,
    cancelMutation,
  };
}
