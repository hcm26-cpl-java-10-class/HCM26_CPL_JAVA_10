import { projectTemplateApi } from "@/api/features/project-template.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ProjectTemplateForm } from "../components/ProjectTemplateForm";
import { ProjectTemplateError, ProjectTemplateLoading } from "../components/ProjectTemplateState";
import { useProjectTemplateOptions } from "../hooks/useProjectTemplateOptions";
import { minimumTemplateDurationWeeks } from "../project-template.utils";

export function ProjectTemplateFormPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const options = useProjectTemplateOptions();
  const parentId = id ? null : new URLSearchParams(location.search).get("parentTemplateId");
  const parent = useQuery({
    queryKey: ["project-templates", options.user.email, options.activeRole, "parent", parentId],
    queryFn: ({ signal }) => projectTemplateApi.getById(parentId!, signal),
    enabled: !id && !!parentId && options.isSuccess, retry: false,
  });
  const template = useQuery({
    queryKey: ["project-templates", options.user.email, options.activeRole, "detail", id, location.key],
    queryFn: ({ signal }) => projectTemplateApi.getById(id!, signal),
    enabled: !!id && options.isSuccess,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
  const milestonePlan = useQuery({
    queryKey: ["project-templates", options.user.email, options.activeRole, "milestones", id, location.key],
    queryFn: ({ signal }) => projectTemplateApi.getMilestones(Number(id), signal),
    enabled: !!id && options.isSuccess && template.data?.editable === true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
  const minimumDuration = milestonePlan.data?.lockVersion === template.data?.lockVersion && milestonePlan.data
    ? minimumTemplateDurationWeeks(milestonePlan.data.milestones) : 0;
  const allowed = options.canRead && options.hasPermission(`PROJECT_TEMPLATE_${id ? "UPDATE" : "CREATE"}`);
  const permitted = id ? options.data?.canUpdate : options.data?.canCreate;
  const goBack = () => navigate(id ? `/project-templates/${id}/detail`
    : parentId ? `/project-templates/${parentId}/detail?tab=modules` : "/project-templates");

  return (
    <MainLayout pathName={{ "project-templates": "Project Templates", create: "Create", edit: "Edit", ...(id ? { [id]: "Template" } : {}) }}>
      <section className="mx-auto grid min-w-0 w-full max-w-5xl grid-cols-1 gap-5">
        <header className="border-b pb-4">
          <p className="text-sm text-muted-foreground">Project Templates</p>
          <h1 className="mt-1 text-2xl font-semibold">{id ? "Edit project template" : parentId ? "Create child module" : "Create project template"}</h1>
          {parent.data && <p className="mt-2 text-sm text-muted-foreground">Parent: {parent.data.code} · {parent.data.name}</p>}
          <p className="mt-1 text-sm text-muted-foreground">{id ? "Update the general information for this draft." : "Save the project brief as a draft before configuring its team and milestones."}</p>
        </header>
        {!allowed ? <ProjectTemplateError denied />
          : options.isLoading || (!!id && options.isSuccess && template.isLoading) || milestonePlan.isLoading || (!!parentId && parent.isLoading) ? <ProjectTemplateLoading />
          : options.isError || template.isError || milestonePlan.isError || parent.isError ? <ProjectTemplateError error={options.error ?? template.error ?? milestonePlan.error ?? parent.error}
            onRetry={() => { void options.refetch(); if (parentId) void parent.refetch(); if (id) { void template.refetch(); void milestonePlan.refetch(); } }} />
          : !permitted ? <ProjectTemplateError denied />
          : parent.data?.parentTemplateId != null ? (
            <Alert>
              <LockKeyhole />
              <AlertTitle>Only master templates can contain modules</AlertTitle>
              <AlertDescription>
                <Button variant="outline" size="sm" onClick={goBack}><ArrowLeft /> Back to details</Button>
              </AlertDescription>
            </Alert>
          )
          : id && template.data && !template.data.editable ? (
            <Alert>
              <LockKeyhole />
              <AlertTitle>This template is read-only</AlertTitle>
              <AlertDescription>
                <p>Only draft templates can be edited.</p>
                <Button variant="outline" size="sm" onClick={goBack}><ArrowLeft /> Back to details</Button>
              </AlertDescription>
            </Alert>
          ) : options.data && (!id || template.data) && (!parentId || parent.data) ? (
            <ProjectTemplateForm key={id ?? `create-${parentId}`} template={template.data} parentTemplate={parent.data}
              options={options.data}
              minimumDurationWeeks={minimumDuration}
              onCancel={goBack} onSaved={(saved) => navigate(`/project-templates/${saved.id}/detail`)} />
          ) : null}
      </section>
    </MainLayout>
  );
}
