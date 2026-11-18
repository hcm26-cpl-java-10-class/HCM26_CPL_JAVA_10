import { projectTemplateVersionApi } from "@/api/features/project-template-version.api";
import { usePermissions } from "@/hooks/usePermissions";
import { ProjectTemplateError, ProjectTemplateLoading } from "@/pages/management/project-template/components/ProjectTemplateState";
import { useQuery } from "@tanstack/react-query";
import { Navigate, useSearchParams } from "react-router-dom";
import type { EntityConfig } from "@/types";
import { projectTemplateVersionSchema } from "./project-template-version.schema";

export default function ProjectTemplateVersionPage() {
  const [params] = useSearchParams();
  const { user, activeRole } = usePermissions();
  const templateId = params.get("templateId");
  const versionId = params.get("versionId") ?? params.get("version");
  const query = useQuery({ queryKey: ["project-template-versions", user.email, activeRole, "redirect", versionId],
    queryFn: () => projectTemplateVersionApi.getById(versionId!), enabled: !templateId && !!versionId && /^\d+$/.test(versionId), retry: false });
  if (templateId && /^\d+$/.test(templateId)) {
    return <Navigate replace to={`/project-templates/${templateId}/detail?tab=versions${versionId && /^\d+$/.test(versionId) ? `&version=${versionId}` : ""}`} />;
  }
  if (versionId && /^\d+$/.test(versionId)) {
    if (query.isError) return <ProjectTemplateError error={query.error} onRetry={() => void query.refetch()} />;
    if (!query.data) return <ProjectTemplateLoading />;
    return <Navigate replace to={`/project-templates/${query.data.templateId}/detail?tab=versions&version=${versionId}`} />;
  }
  return <Navigate replace to="/project-templates" />;
}

export const entityConfig: EntityConfig = {
  name: "ProjectTemplateVersion",
  path: "/project-template-versions",
  api: projectTemplateVersionApi,
  schema: projectTemplateVersionSchema,
};
