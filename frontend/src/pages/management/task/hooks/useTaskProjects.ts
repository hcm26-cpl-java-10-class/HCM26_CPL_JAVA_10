import { useQuery } from "@tanstack/react-query";
import { taskAlertApi } from "@/api/features/task-alert.api";
import { usePermissions } from "@/hooks/usePermissions";

export function useTaskProjects() {
  const { user, activeRole } = usePermissions();
  return useQuery({
    queryKey: ["task-projects", user.email, activeRole],
    queryFn: ({ signal }) => taskAlertApi.projects(signal),
    retry: false, gcTime: 0,
  });
}
