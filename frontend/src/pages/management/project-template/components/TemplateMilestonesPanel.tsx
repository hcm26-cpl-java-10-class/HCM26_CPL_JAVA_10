import { projectTemplateApi } from "@/api/features/project-template.api";
import { usePermissions } from "@/hooks/usePermissions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ProjectTemplateError, ProjectTemplateLoading } from "./ProjectTemplateState";
import { TemplateMilestonesForm } from "./TemplateMilestonesForm";

export function TemplateMilestonesPanel({ templateId, editable }: { templateId: number; editable: boolean }) {
  const { user, activeRole } = usePermissions();
  const queryClient = useQueryClient();
  const queryKey = ["project-templates", user.email, activeRole, "milestones", templateId];
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => projectTemplateApi.getMilestones(templateId, signal),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const options = useQuery({
    queryKey: ["project-templates", user.email, activeRole, "milestone-options", templateId],
    queryFn: ({ signal }) => projectTemplateApi.getMilestoneOptions(templateId, signal),
    retry: false,
    enabled: editable,
  });

  if (query.isLoading || (editable && options.isLoading)) return <ProjectTemplateLoading />;
  if (query.isError) return <ProjectTemplateError error={query.error} onRetry={() => void query.refetch()} />;
  if (editable && options.isError) return <ProjectTemplateError error={options.error} onRetry={() => void options.refetch()} />;
  if (!query.data) return null;

  return <TemplateMilestonesForm
    key={templateId}
    plan={query.data}
    editable={editable && query.data.editable}
    rubrics={options.data?.rubrics ?? []}
    refreshingRubrics={options.isFetching}
    onRefreshRubrics={() => void options.refetch()}
    onSaved={(saved) => {
      queryClient.setQueryData(queryKey, saved);
      void queryClient.invalidateQueries({ queryKey: ["project-templates"] });
    }}
  />;
}
