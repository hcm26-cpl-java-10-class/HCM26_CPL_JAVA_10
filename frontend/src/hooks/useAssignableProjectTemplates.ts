import { projectTemplateApi } from "@/api/features/project-template.api";
import { usePermissions } from "@/hooks/usePermissions";
import { useQuery } from "@tanstack/react-query";

export function useAssignableProjectTemplates() {
  const { user, activeRole } = usePermissions();
  return useQuery({
    queryKey: ["project-templates", "assignable", user.email, activeRole],
    queryFn: ({ signal }) => projectTemplateApi.getAssignableOptions(signal),
    enabled: !!user.email,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    retry: false,
  });
}
