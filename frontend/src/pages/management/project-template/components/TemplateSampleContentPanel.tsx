import { projectTemplateApi } from "@/api/features/project-template.api";
import { usePermissions } from "@/hooks/usePermissions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ProjectTemplateError, ProjectTemplateLoading } from "./ProjectTemplateState";
import { TemplateSampleContentForm } from "./TemplateSampleContentForm";

export function TemplateSampleContentPanel({ templateId, editable }: { templateId: number; editable: boolean }) {
  const { user, activeRole } = usePermissions();
  const client = useQueryClient();
  const queryKey = ["project-templates", user.email, activeRole, "sample-content", templateId];
  const query = useQuery({ queryKey, queryFn: ({ signal }) => projectTemplateApi.getSampleContent(templateId, signal),
    retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false });
  if (query.isLoading) return <ProjectTemplateLoading />;
  if (query.isError) return <ProjectTemplateError error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data) return null;
  return <TemplateSampleContentForm key={templateId} content={query.data} editable={editable && query.data.editable}
    onSaved={(saved) => { client.setQueryData(queryKey, saved); void client.invalidateQueries({ queryKey: ["project-templates"] }); }} />;
}
