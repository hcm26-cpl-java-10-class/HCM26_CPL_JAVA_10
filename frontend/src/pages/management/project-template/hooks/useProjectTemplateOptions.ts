import { projectTemplateApi } from "@/api/features/project-template.api";
import { usePermissions } from "@/hooks/usePermissions";
import { useQuery } from "@tanstack/react-query";

export function useProjectTemplateOptions() {
  const { user, activeRole, hasPermission } = usePermissions();
  const allowedRole = activeRole === "ADMIN" || activeRole === "PROGRAM_MANAGER";
  const canRead = allowedRole && hasPermission("PROJECT_TEMPLATE_READ");
  const query = useQuery({
    queryKey: ["project-templates", user.email, activeRole, "options"],
    queryFn: ({ signal }) => projectTemplateApi.getOptions(signal),
    enabled: canRead,
    retry: false,
  });
  return { ...query, canRead, user, activeRole, hasPermission };
}
