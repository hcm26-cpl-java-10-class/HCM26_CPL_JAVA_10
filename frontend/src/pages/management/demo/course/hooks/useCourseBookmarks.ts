import { courseBookmarkApi } from "@/api/features/demo/course-bookmark.api";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { getErrorMessage } from "../utils/course.utils.ts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";

/**
 * Manages the current user's saved (bookmarked) course IDs and toggle mutations.
 */
export function useCourseBookmarks(enabled = true) {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();

  const canBookmark = Boolean(user?.email && hasPermission("COURSE_READ"));
  const idsQueryKey = ["course-bookmarks", "ids", user?.email];

  const savedIdsQuery = useQuery({
    queryKey: idsQueryKey,
    queryFn: courseBookmarkApi.getSavedIds,
    enabled: enabled && canBookmark,
    retry: false,
  });

  const savedCourseIds = useMemo(
    () => new Set<number>(savedIdsQuery.data ?? []),
    [savedIdsQuery.data],
  );

  const toggleMutation = useMutation({
    mutationFn: async (courseId: number) => {
      const currentlySaved = savedCourseIds.has(courseId);
      return currentlySaved
        ? courseBookmarkApi.remove(courseId)
        : courseBookmarkApi.save(courseId);
    },
    onSuccess: (result) => {
      queryClient.setQueryData<number[]>(idsQueryKey, (prev = []) => {
        if (result.saved) {
          return prev.includes(result.courseId) ? prev : [result.courseId, ...prev];
        }
        return prev.filter((id) => id !== result.courseId);
      });
      void queryClient.invalidateQueries({ queryKey: ["course-bookmarks"] });
      void queryClient.invalidateQueries({ queryKey: ["course-catalog"] });
      toast.success(result.saved ? "Saved course for later" : "Removed from saved courses");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Could not update saved course"));
    },
  });

  return {
    canBookmark,
    savedIdsQuery,
    savedCourseIds,
    savedCount: savedCourseIds.size,
    togglingCourseId: toggleMutation.isPending ? toggleMutation.variables : undefined,
    toggleBookmark: (courseId: number) => {
      if (!canBookmark || toggleMutation.isPending) return;
      toggleMutation.mutate(courseId);
    },
  };
}
