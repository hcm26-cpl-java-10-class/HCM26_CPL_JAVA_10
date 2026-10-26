import { projectTemplateApi } from "@/api/features/project-template.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, LockKeyhole, Pen } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ProjectTemplateError, ProjectTemplateLoading } from "../components/ProjectTemplateState";
import { ProjectTemplateStatusBadge } from "../components/ProjectTemplateStatusBadge";
import { TemplateTeamConstraintsForm } from "../components/TemplateTeamConstraintsForm";
import { useProjectTemplateOptions } from "../hooks/useProjectTemplateOptions";
import { templateLevelLabel } from "../project-template.utils";

export function ProjectTemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const options = useProjectTemplateOptions();
  const tab = searchParams.get("tab") === "team-constraints" ? "team-constraints" : "overview";
  const detailQueryKey = ["project-templates", options.user.email, options.activeRole, "detail", id];
  const query = useQuery({
    queryKey: detailQueryKey,
    queryFn: ({ signal }) => projectTemplateApi.getById(id!, signal),
    enabled: !!id && options.isSuccess,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const template = query.data;
  const canEdit = options.isSuccess && options.data?.canUpdate === true && !query.isError && !!template?.editable
    && options.hasPermission("PROJECT_TEMPLATE_UPDATE");
  const formatDate = (value: string) => new Date(value).toLocaleString("en-GB");
  const selectTab = (value: string) => setSearchParams((current) => {
    const next = new URLSearchParams(current);
    if (value === "overview") next.delete("tab");
    else next.set("tab", value);
    return next;
  }, { replace: true });

  return (
    <MainLayout pathName={{ "project-templates": "Project Templates", ...(id ? { [id]: "Template" } : {}), detail: "Details" }}>
      <section className="mx-auto grid w-full max-w-5xl gap-5">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
          <div>
            <p className="text-sm text-muted-foreground">Project Templates</p>
            <h1 className="mt-1 text-2xl font-semibold">Template details</h1>
            {template && options.isSuccess && !query.isError && (
              <p className="mt-2 break-words text-sm text-muted-foreground">{template.code} · {template.name}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate("/project-templates")}><ArrowLeft /> Back to templates</Button>
            {tab === "overview" && canEdit && (
              <Button onClick={() => navigate(`/project-templates/${id}/edit`)}><Pen /> Edit draft</Button>
            )}
          </div>
        </header>
        {!options.canRead ? <ProjectTemplateError denied />
          : options.isLoading || (options.isSuccess && query.isLoading) ? <ProjectTemplateLoading />
          : options.isError || query.isError ? <ProjectTemplateError error={options.error ?? query.error}
            onRetry={() => { void options.refetch(); void query.refetch(); }} />
          : template && (
            <>
              {template.status !== "DRAFT" && (
                <Alert><LockKeyhole /><AlertDescription>This template is read-only. Only draft templates can be edited.</AlertDescription></Alert>
              )}
              <Tabs value={tab} onValueChange={selectTab} className="min-w-0 gap-4">
                <TabsList aria-label="Template configuration">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="team-constraints">Team constraints</TabsTrigger>
                </TabsList>
                <TabsContent value="overview">
                  <Card>
                    <CardHeader className="gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="max-w-full font-mono"><span className="truncate">{template.code}</span></Badge>
                        <ProjectTemplateStatusBadge status={template.status} />
                        <Badge variant="outline">Version {template.templateVersion}</Badge>
                      </div>
                      <CardTitle className="break-words text-xl leading-relaxed">{template.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-6">
                      <div>
                        <h2 className="text-sm font-medium">Description</h2>
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">{template.description}</p>
                      </div>
                      <dl className="grid gap-5 rounded-lg border bg-muted/20 p-4 text-sm sm:grid-cols-2 md:grid-cols-3">
                        {[
                          ["Domain / category", template.category],
                          ["Level", templateLevelLabel(template.level)],
                          ["Estimated duration", `${template.estimatedDurationWeeks} weeks`],
                          ["Tenant", options.data?.tenantName],
                          ["Created at", formatDate(template.createdAt)],
                          ["Updated at", formatDate(template.updatedAt)],
                        ].map(([label, value]) => (
                          <div key={label} className="min-w-0"><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>
                        ))}
                      </dl>
                    </CardContent>
                  </Card>
                </TabsContent>
                <TabsContent value="team-constraints">
                  <TemplateTeamConstraintsForm
                    key={template.id}
                    template={template}
                    editable={canEdit}
                    onSaved={(saved) => {
                      queryClient.setQueryData(detailQueryKey, saved);
                      void queryClient.invalidateQueries({ queryKey: ["project-templates"] });
                    }}
                  />
                </TabsContent>
              </Tabs>
            </>
          )}
      </section>
    </MainLayout>
  );
}
