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
import { ArrowLeft, CalendarDays, ClipboardList, FileText, Flag, FolderOpen, FolderTree, History, Layers3, LockKeyhole, Pen, Tags, Users } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ProjectTemplateHeader } from "../components/ProjectTemplateHeader";
import { ProjectTemplateError, ProjectTemplateLoading } from "../components/ProjectTemplateState";
import { ProjectTemplateStatusBadge } from "../components/ProjectTemplateStatusBadge";
import { TemplateTeamConstraintsForm } from "../components/TemplateTeamConstraintsForm";
import { TemplateMilestonesPanel } from "../components/TemplateMilestonesPanel";
import { TemplateActivationDialog } from "../components/TemplateActivationDialog";
import { TemplateArchiveDialog } from "../components/TemplateArchiveDialog";
import { TemplateSampleContentPanel } from "../components/TemplateSampleContentPanel";
import { TemplateModulesPanel } from "../components/TemplateModulesPanel";
import { TemplateResourcesPanel } from "../components/TemplateResourcesPanel";
import { TemplateVersionsPanel } from "../components/TemplateVersionsPanel";
import { useProjectTemplateOptions } from "../hooks/useProjectTemplateOptions";
import { maxDescriptionLength, templateLevelLabel } from "../project-template.utils";

const templateSections = [
  { id: "overview", label: "Overview", icon: FileText },
  { id: "team-constraints", label: "Team constraints", icon: Users },
  { id: "milestones", label: "Milestones", icon: Flag },
  { id: "sample-content", label: "Backlog", icon: ClipboardList },
  { id: "modules", label: "Modules", icon: FolderTree },
  { id: "resources", label: "Resources", icon: FolderOpen },
  { id: "versions", label: "Versions", icon: History },
];

export function ProjectTemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const options = useProjectTemplateOptions();
  const requestedTab = searchParams.get("tab");
  const tab = requestedTab === "team-constraints" || requestedTab === "milestones" || requestedTab === "sample-content"
    || requestedTab === "versions" || requestedTab === "modules" || requestedTab === "resources" ? requestedTab : "overview";
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
  const resourceVersions = useQuery({
    queryKey: ["project-template-versions", "by-template", template?.id, options.user.email, options.activeRole],
    queryFn: () => projectTemplateVersionApi.getByTemplate(template!.id),
    enabled: !!template && tab === "resources" && options.hasPermission("PROJECT_TEMPLATE_VERSION_READ"),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const resourceVersion = resourceVersions.data?.find(version => version.isActive
    && version.status === (template?.status === "ACTIVE" ? "PUBLISHED" : template?.status));

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
  const headingTemplate = options.isSuccess && !query.isError ? displayedTemplate : undefined;
  const isModule = headingTemplate?.parentTemplateId != null;
  const canEdit = options.isSuccess && options.data?.canUpdate === true && !query.isError && !!template?.editable
    && options.hasPermission("PROJECT_TEMPLATE_UPDATE");
  const canActivateTemplate = options.isSuccess && options.data?.canActivate === true && !query.isError
    && !!template && !template.readOnly && template.status !== "ARCHIVED"
    && (options.activeRole === "ADMIN" || options.activeRole === "PROGRAM_MANAGER")
    && options.hasPermission("PROJECT_TEMPLATE_ACTIVATE");
  const canActivate = canActivateTemplate && template?.status === "DRAFT";
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
      <section className="mx-auto grid min-w-0 w-full max-w-6xl grid-cols-1 gap-5">
        <ProjectTemplateHeader module={isModule}
          title={headingTemplate?.name ?? "Template details"}
          label={tab === "versions" ? "Template versions" : isModule ? "Child module" : "Master template"}
          description={headingTemplate && <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="max-w-full font-mono"><span className="truncate">{headingTemplate.code}</span></Badge>
            <ProjectTemplateStatusBadge status={headingTemplate.status} />
          </div>}>
            <Button variant="outline" onClick={() => navigate("/project-templates")}><ArrowLeft /> Back to templates</Button>
            {template?.parentTemplateId && <Button variant="outline" onClick={() => navigate(`/project-templates/${template.parentTemplateId}/detail?tab=modules`)}>
              <ArrowLeft />Parent template</Button>}
            {tab === "versions" && <Button variant="outline" onClick={() => navigate(`/project-templates/${id}/detail`)}>Current template</Button>}
            {tab === "overview" && canEdit && (
              <Button onClick={() => navigate(`/project-templates/${id}/edit`)}><Pen /> Edit draft</Button>
            )}
            {tab !== "versions" && template && !template.removed && (template.status === "DRAFT" || template.parentTemplateId != null) && !template.readOnly && options.data?.canArchive
              && options.hasPermission("PROJECT_TEMPLATE_ARCHIVE") && <TemplateDeleteDialog template={template}
                onDeleted={() => navigate(template.parentTemplateId ? `/project-templates/${template.parentTemplateId}/detail?tab=modules` : "/project-templates")} />}
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
        </ProjectTemplateHeader>
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
                <div className="min-w-0 overflow-x-auto overflow-y-hidden rounded-xl border bg-card p-1.5">
                  <TabsList aria-label="Template configuration" className="h-auto w-max min-w-full justify-start gap-1 bg-transparent">
                    {templateSections.map(({ id: section, label, icon: Icon }) => <TabsTrigger key={section} value={section}
                      className="min-h-9 px-3 text-xs data-[state=active]:border-indigo-200 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 dark:data-[state=active]:border-indigo-800 dark:data-[state=active]:bg-indigo-950 dark:data-[state=active]:text-indigo-300">
                      <Icon className="size-4" aria-hidden />{label}
                    </TabsTrigger>)}
                  </TabsList>
                </div>
                <TabsContent value="overview">
                  <Card className="min-w-0">
                    <CardHeader className="flex flex-wrap items-center justify-between gap-3">
                      <CardTitle className="flex items-center gap-2 text-base"><FileText className="size-5 text-indigo-600 dark:text-indigo-400" />Project brief</CardTitle>
                      <Button variant="outline" size="xs" onClick={() => selectTab("versions")}
                        aria-label="View version history"><History />Version {template.templateVersion} · View history</Button>
                    </CardHeader>
                    <CardContent className="grid min-w-0 grid-cols-1 gap-6">
                      <dl className="grid gap-3 text-sm sm:grid-cols-3">
                        {[
                          { label: "Domain / category", value: template.category, icon: Tags },
                          { label: "Level", value: templateLevelLabel(template.level), icon: Layers3 },
                          { label: "Estimated duration", value: template.estimatedDurationWeeks == null ? "—" : `${template.estimatedDurationWeeks} weeks`, icon: CalendarDays },
                        ].map(({ label, value, icon: Icon }) => (
                          <div key={label} className="min-w-0 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 dark:border-indigo-900/60 dark:bg-indigo-950/30">
                            <dt className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="size-4 text-indigo-600 dark:text-indigo-400" aria-hidden />{label}</dt>
                            <dd className="mt-1.5 break-words font-medium">{value}</dd>
                          </div>
                        ))}
                      </dl>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h2 className="text-sm font-medium">Description</h2>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {(template.description?.length ?? 0).toLocaleString("en-US")} / {maxDescriptionLength.toLocaleString("en-US")} characters
                          </span>
                        </div>
                        <p className="mt-2 min-w-0 max-w-full whitespace-pre-wrap text-sm leading-7 text-muted-foreground [overflow-wrap:anywhere]">{template.description}</p>
                      </div>
                      <dl className="grid gap-4 border-t pt-4 text-xs sm:grid-cols-3">
                        {[
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
                <TabsContent value="modules"><TemplateModulesPanel templateId={template.id}
                  canActivate={canActivateTemplate}
                  canCreate={!!options.data?.canCreate && !template.readOnly && template.status !== "ARCHIVED"} /></TabsContent>
                <TabsContent value="resources">
                  {!options.hasPermission("PROJECT_TEMPLATE_VERSION_READ") ? <Alert><AlertDescription>Version access is required to view resources.</AlertDescription></Alert>
                    : resourceVersions.isPending ? <ProjectTemplateLoading />
                    : resourceVersions.isError ? <ProjectTemplateError error={resourceVersions.error} onRetry={() => void resourceVersions.refetch()} />
                    : resourceVersion?.id != null ? <TemplateResourcesPanel versionId={resourceVersion.id} editable={canEdit} />
                    : <Alert><AlertDescription>Select a version in the Versions tab to view its resources.</AlertDescription></Alert>}
                </TabsContent>
              </Tabs>}
            </>
          )}
      </section>
    </MainLayout>
  );
}
