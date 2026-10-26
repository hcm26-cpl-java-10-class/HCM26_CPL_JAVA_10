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

export function ProjectTemplateFormPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const options = useProjectTemplateOptions();
  const template = useQuery({
    queryKey: ["project-templates", options.user.email, options.activeRole, "detail", id, location.key],
    queryFn: ({ signal }) => projectTemplateApi.getById(id!, signal),
    enabled: !!id && options.isSuccess,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
  const allowed = options.canRead && options.hasPermission(`PROJECT_TEMPLATE_${id ? "UPDATE" : "CREATE"}`);
  const permitted = id ? options.data?.canUpdate : options.data?.canCreate;
  const goBack = () => navigate(id ? `/project-templates/${id}/detail` : "/project-templates");

  return (
    <MainLayout pathName={{ "project-templates": "Project Templates", create: "Create", edit: "Edit", ...(id ? { [id]: "Template" } : {}) }}>
      <section className="mx-auto grid w-full max-w-5xl gap-5">
        <header className="border-b pb-4">
          <p className="text-sm text-muted-foreground">Project Templates</p>
          <h1 className="mt-1 text-2xl font-semibold">{id ? "Edit project template" : "Create project template"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{id ? "Update the general information for this draft." : "Save the project brief as a draft before configuring its team and milestones."}</p>
        </header>
        {!allowed ? <ProjectTemplateError denied />
          : options.isLoading || (!!id && options.isSuccess && template.isLoading) ? <ProjectTemplateLoading />
          : options.isError || template.isError ? <ProjectTemplateError error={options.error ?? template.error}
            onRetry={() => { void options.refetch(); if (id) void template.refetch(); }} />
          : !permitted ? <ProjectTemplateError denied />
          : id && template.data && !template.data.editable ? (
            <Alert>
              <LockKeyhole />
              <AlertTitle>This template is read-only</AlertTitle>
              <AlertDescription>
                <p>Only draft templates can be edited.</p>
                <Button variant="outline" size="sm" onClick={goBack}><ArrowLeft /> Back to details</Button>
              </AlertDescription>
            </Alert>
          ) : options.data && (!id || template.data) ? (
            <ProjectTemplateForm key={id ?? "create"} template={template.data} options={options.data}
              onCancel={goBack} onSaved={(saved) => navigate(`/project-templates/${saved.id}/detail`)} />
          ) : null}
      </section>
    </MainLayout>
  );
}
