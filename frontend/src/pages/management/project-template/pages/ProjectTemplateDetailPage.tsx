import { projectTemplateApi } from "@/api/features/project-template.api";
import { projectTemplateVersionApi } from "@/api/features/project-template-version.api";
import { TemplateDeleteDialog } from "../components/TemplateDeleteDialog";
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
import { TemplateMilestonesPanel } from "../components/TemplateMilestonesPanel";
import { TemplateActivationDialog } from "../components/TemplateActivationDialog";
import { TemplateArchiveDialog } from "../components/TemplateArchiveDialog";
import { TemplateSampleContentPanel } from "../components/TemplateSampleContentPanel";
import { TemplateVersionsPanel } from "../components/TemplateVersionsPanel";
import { useProjectTemplateOptions } from "../hooks/useProjectTemplateOptions";
import { descriptionWordCount, maxDescriptionWords, templateLevelLabel } from "../project-template.utils";

export function ProjectTemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const options = useProjectTemplateOptions();
  const requestedTab = searchParams.get("tab");
  const tab = requestedTab === "team-constraints" || requestedTab === "milestones" || requestedTab === "sample-content" || requestedTab === "versions" ? requestedTab : "overview";
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
  const versionId = Number(searchParams.get("version"));
  const versionQuery = useQuery({
    queryKey: ["project-template-versions", options.user.email, options.activeRole, "configuration", versionId],
    queryFn: ({ signal }) => projectTemplateVersionApi.getConfiguration(versionId, signal),
    enabled: tab === "versions" && Number.isSafeInteger(versionId) && versionId > 0 && options.isSuccess
      && options.hasPermission("PROJECT_TEMPLATE_VERSION_READ"),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const displayedTemplate = tab === "versions" && versionQuery.data?.template.id === template?.id
    ? versionQuery.data?.template : template;
  const canEdit = options.isSuccess && options.data?.canUpdate === true && !query.isError && !!template?.editable
    && options.hasPermission("PROJECT_TEMPLATE_UPDATE");
  const canActivate = options.isSuccess && options.data?.canActivate === true && !query.isError
    && template?.readOnly !== true
    && template?.status === "DRAFT" && (options.activeRole === "ADMIN" || options.activeRole === "PROGRAM_MANAGER")
    && options.hasPermission("PROJECT_TEMPLATE_ACTIVATE");
  const canArchive = options.isSuccess && options.data?.canArchive === true && !query.isError
    && template?.readOnly !== true
    && template?.status === "ACTIVE" && options.hasPermission("PROJECT_TEMPLATE_ARCHIVE");
  const formatDate = (value: string) => new Date(value).toLocaleString("en-GB");
  const selectTab = (value: string) => setSearchParams((current) => {
    const next = new URLSearchParams(current);
    if (value === "overview") next.delete("tab");
    else next.set("tab", value);
    return next;
  }, { replace: true });

  return (
    <MainLayout pathName={{ "project-templates": "Project Templates", ...(id ? { [id]: "Template" } : {}), detail: "Details" }}>
      <section className="mx-auto grid min-w-0 w-full max-w-5xl grid-cols-1 gap-5">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
          <div>
            <p className="text-sm text-muted-foreground">Project Templates</p>
            <h1 className="mt-1 text-2xl font-semibold">{tab === "versions" ? "Template version details" : "Template details"}</h1>
            {displayedTemplate && options.isSuccess && !query.isError && (
              <p className="mt-2 break-words text-sm text-muted-foreground">{displayedTemplate.code} · {displayedTemplate.name}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate("/project-templates")}><ArrowLeft /> Back to templates</Button>
            {tab === "versions" && <Button variant="outline" onClick={() => navigate(`/project-templates/${id}/detail`)}>Current template</Button>}
            {tab === "overview" && canEdit && (
              <Button onClick={() => navigate(`/project-templates/${id}/edit`)}><Pen /> Edit draft</Button>
            )}
            {tab !== "versions" && template && template.status === "DRAFT" && !template.readOnly && options.data?.canArchive
              && options.hasPermission("PROJECT_TEMPLATE_ARCHIVE") && <TemplateDeleteDialog template={template}
                onDeleted={() => navigate("/project-templates")} />}
            {tab !== "versions" && canActivate && template && <TemplateActivationDialog template={template}
              onOpenSection={selectTab}
              onActivated={(saved) => {
                queryClient.setQueryData(detailQueryKey, saved);
                void queryClient.invalidateQueries({ queryKey: ["project-templates"] });
              }} />}
            {tab !== "versions" && canArchive && template && <TemplateArchiveDialog template={template} onArchived={(saved) => {
              queryClient.setQueryData(detailQueryKey, saved);
              void queryClient.invalidateQueries({ queryKey: ["project-templates"] });
            }} />}
          </div>
        </header>
        {!options.canRead ? <ProjectTemplateError denied />
          : options.isLoading || (options.isSuccess && query.isLoading) ? <ProjectTemplateLoading />
          : options.isError || query.isError ? <ProjectTemplateError error={options.error ?? query.error}
            onRetry={() => { void options.refetch(); void query.refetch(); }} />
          : template && (
            <>
              {tab !== "versions" && template.status !== "DRAFT" && (
                <Alert><LockKeyhole /><AlertDescription>{template.status === "ARCHIVED"
                  ? "This template is archived and cannot be selected for new classes or cohorts. Its saved configuration remains available below."
                  : "This template is active and can be assigned to a team. Use the Versions tab to prepare a new draft without changing the published configuration."}</AlertDescription></Alert>
              )}
              {template.readOnly && (
                <Alert><LockKeyhole /><AlertDescription>This template comes from the shared catalogue and is read-only. Duplicate it to create an editable draft in your organization.</AlertDescription></Alert>
              )}
              {tab === "versions" ? <TemplateVersionsPanel template={template} /> : <Tabs value={tab} onValueChange={selectTab} className="min-w-0 gap-4">
                <TabsList aria-label="Template configuration"
                  className="grid w-full max-w-3xl grid-cols-2 group-data-[orientation=horizontal]/tabs:h-auto sm:grid-cols-5">
                  <TabsTrigger value="overview" className="h-full min-h-9 whitespace-normal">Overview</TabsTrigger>
                  <TabsTrigger value="team-constraints" className="h-full min-h-9 whitespace-normal">Team constraints</TabsTrigger>
                  <TabsTrigger value="milestones" className="h-full min-h-9 whitespace-normal">Milestones</TabsTrigger>
                  <TabsTrigger value="sample-content" className="h-full min-h-9 whitespace-normal">Backlog</TabsTrigger>
                  <TabsTrigger value="versions" className="h-full min-h-9 whitespace-normal">Versions</TabsTrigger>
                </TabsList>
                <TabsContent value="overview">
                  <Card className="min-w-0">
                    <CardHeader className="gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="max-w-full font-mono"><span className="truncate">{template.code}</span></Badge>
                        <ProjectTemplateStatusBadge status={template.status} />
                        <Button variant="outline" size="xs" onClick={() => selectTab("versions")}
                          aria-label="View version history">Version {template.templateVersion} · View history</Button>
                      </div>
                      <CardTitle className="break-words text-xl leading-relaxed">{template.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="grid min-w-0 grid-cols-1 gap-6">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h2 className="text-sm font-medium">Description</h2>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {descriptionWordCount(template.description ?? "").toLocaleString("en-US")} / {maxDescriptionWords.toLocaleString("en-US")} words
                          </span>
                        </div>
                        <p className="mt-2 min-w-0 max-w-full whitespace-pre-wrap text-sm leading-7 text-muted-foreground [overflow-wrap:anywhere]">{template.description}</p>
                      </div>
                      <dl className="grid gap-5 rounded-lg border bg-muted/20 p-4 text-sm sm:grid-cols-2 md:grid-cols-3">
                        {[
                          ["Domain / category", template.category],
                          ["Level", templateLevelLabel(template.level)],
                          ["Estimated duration", template.estimatedDurationWeeks == null ? "—" : `${template.estimatedDurationWeeks} weeks`],
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
                <TabsContent value="milestones">
                  <TemplateMilestonesPanel templateId={template.id} editable={canEdit} />
                </TabsContent>
                <TabsContent value="sample-content">
                  <TemplateSampleContentPanel templateId={template.id} editable={canEdit} />
                </TabsContent>
              </Tabs>}
            </>
          )}
      </section>
    </MainLayout>
  );
}
