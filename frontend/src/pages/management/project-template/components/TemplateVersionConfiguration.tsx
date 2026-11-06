import { projectTemplateVersionApi } from "@/api/features/project-template-version.api";
import { projectTemplateApi } from "@/api/features/project-template.api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/hooks/usePermissions";
import type { TemplateVersionConfiguration as Configuration } from "@/types/features/project-template-version";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Loader2, LockKeyhole, Pen, Rocket } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useProjectTemplateOptions } from "../hooks/useProjectTemplateOptions";
import { minimumTemplateDurationWeeks, getTemplateError, templateLevelLabel } from "../project-template.utils";
import { ProjectTemplateForm } from "./ProjectTemplateForm";
import { ProjectTemplateError, ProjectTemplateLoading } from "./ProjectTemplateState";
import { TemplateMilestonesForm } from "./TemplateMilestonesForm";
import { TemplateResourcesPanel } from "./TemplateResourcesPanel";
import { TemplateSampleContentForm } from "./TemplateSampleContentForm";
import { TemplateTeamConstraintsForm } from "./TemplateTeamConstraintsForm";
import { ProjectTemplateStatusBadge } from "./ProjectTemplateStatusBadge";

export function TemplateVersionConfiguration({ versionId, editOverview = false, onChanged }: { versionId: number; editOverview?: boolean; onChanged: () => void }) {
  const { user, activeRole, hasPermission } = usePermissions();
  const client = useQueryClient();
  const options = useProjectTemplateOptions();
  const [tab, setTab] = useState("overview");
  const [editingOverview, setEditingOverview] = useState(editOverview);
  const [publishing, setPublishing] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishError, setPublishError] = useState<ReturnType<typeof getTemplateError> | null>(null);
  const pending = useRef(false);
  const key = ["project-template-versions", user.email, activeRole, "configuration", versionId];
  const query = useQuery({ queryKey: key, queryFn: ({ signal }) => projectTemplateVersionApi.getConfiguration(versionId, signal),
    retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false });
  const configuration = query.data;
  const editable = !!configuration?.editable && hasPermission("PROJECT_TEMPLATE_VERSION_UPDATE") && hasPermission("PROJECT_TEMPLATE_UPDATE");
  const rubricQuery = useQuery({ queryKey: ["project-templates", user.email, activeRole, "milestone-options", configuration?.template.id],
    queryFn: ({ signal }) => projectTemplateApi.getMilestoneOptions(configuration!.template.id, signal), enabled: !!configuration && editable, retry: false });
  const audit = useQuery({ queryKey: ["project-template-versions", user.email, activeRole, "audit", versionId],
    queryFn: () => projectTemplateVersionApi.getAuditLogs(versionId), enabled: tab === "activity", retry: false });
  const remember = (saved: Configuration) => {
    client.setQueryData(key, saved);
    void client.invalidateQueries({ queryKey: ["project-templates"] });
    void client.invalidateQueries({ queryKey: ["project-template-versions", "by-template"] });
    void client.invalidateQueries({ queryKey: ["project-template-versions", user.email, activeRole, "audit", versionId] });
    onChanged();
    return saved;
  };
  const publish = async () => {
    if (pending.current || !configuration) return;
    pending.current = true; setPublishing(true); setPublishError(null);
    try {
      remember(await projectTemplateVersionApi.publish(versionId, configuration.template.lockVersion));
      setPublishOpen(false);
      toast.success("Version published successfully. New workspaces will use this configuration.");
    } catch (error) { setPublishError(getTemplateError(error)); }
    finally { pending.current = false; setPublishing(false); }
  };
  if (query.isLoading) return <ProjectTemplateLoading />;
  if (query.isError) return <ProjectTemplateError error={query.error} onRetry={() => void query.refetch()} />;
  if (!configuration) return null;
  const { template, version, milestones, sampleContent } = configuration;
  const formKey = `${versionId}-${template.lockVersion}`;
  return <section className="grid min-w-0 gap-4" aria-label={`Configuration of ${version.version}`}>
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-card p-4">
      <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{version.version} · {template.name}</h3>
        <ProjectTemplateStatusBadge status={template.status} /></div>
        <p className="mt-1 text-sm text-muted-foreground">{editable
          ? "Changes are saved to this draft. Publish it when the configuration is ready."
          : "This version is read-only. Create a new version to change its configuration."}</p></div>
      {configuration.canPublish && hasPermission("PROJECT_TEMPLATE_VERSION_UPDATE") && <Button disabled={publishing}
        onClick={() => { setPublishError(null); setPublishOpen(true); }}><Rocket />Publish version</Button>}
    </div>
    {configuration.legacyContent && <Alert><LockKeyhole /><AlertDescription>
      This version uses a legacy configuration format. Its original content is preserved. Duplicate it to prepare a complete editable template.
    </AlertDescription></Alert>}
    <Tabs value={tab} onValueChange={value => { setTab(value); setEditingOverview(false); }}>
      <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-6" aria-label="Version configuration">
        <TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="team-constraints">Team constraints</TabsTrigger>
        <TabsTrigger value="milestones">Milestones</TabsTrigger><TabsTrigger value="backlog">Backlog</TabsTrigger>
        <TabsTrigger value="resources">Resources</TabsTrigger>
        <TabsTrigger value="activity"><History />Activity</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        {editable && editingOverview && options.data ? <ProjectTemplateForm key={formKey} template={template} options={options.data}
          minimumDurationWeeks={minimumTemplateDurationWeeks(milestones.milestones)} onCancel={() => setEditingOverview(false)}
          save={async payload => remember(await projectTemplateVersionApi.saveOverview(versionId, payload)).template}
          onSaved={() => setEditingOverview(false)} />
          : <Card className="min-w-0"><CardHeader><div className="flex items-center justify-between gap-3"><CardTitle className="break-words">{template.name}</CardTitle>
            {editable && <Button variant="outline" disabled={!options.data} onClick={() => setEditingOverview(true)}><Pen />Edit version overview</Button>}</div></CardHeader>
            <CardContent className="grid min-w-0 gap-5"><p className="whitespace-pre-wrap text-sm leading-7 [overflow-wrap:anywhere]">{template.description || "No description"}</p>
              <dl className="grid gap-4 text-sm sm:grid-cols-3">{[["Code", template.code], ["Category", template.category], ["Level", templateLevelLabel(template.level)],
                ["Duration", template.estimatedDurationWeeks == null ? "—" : `${template.estimatedDurationWeeks} weeks`]].map(([label, value]) =>
                  <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-medium">{value || "—"}</dd></div>)}</dl>
            </CardContent></Card>}
      </TabsContent>
      <TabsContent value="team-constraints"><TemplateTeamConstraintsForm key={formKey} template={template} editable={editable}
        save={async payload => remember(await projectTemplateVersionApi.saveTeam(versionId, payload)).template} onSaved={() => undefined} /></TabsContent>
      <TabsContent value="milestones">{editable && rubricQuery.isError ? <ProjectTemplateError error={rubricQuery.error} onRetry={() => void rubricQuery.refetch()} />
        : editable && rubricQuery.isLoading ? <ProjectTemplateLoading /> : <TemplateMilestonesForm key={formKey} plan={milestones} editable={editable}
          rubrics={rubricQuery.data?.rubrics ?? []} refreshingRubrics={rubricQuery.isFetching} onRefreshRubrics={() => void rubricQuery.refetch()}
          save={async payload => remember(await projectTemplateVersionApi.saveMilestones(versionId, payload)).milestones} onSaved={() => undefined} />}</TabsContent>
      <TabsContent value="backlog"><TemplateSampleContentForm key={formKey} content={sampleContent} editable={editable}
        previewImport={file => projectTemplateVersionApi.previewBacklogImport(versionId, file)}
        downloadImportTemplate={() => projectTemplateVersionApi.getBacklogImportTemplate(versionId)}
        save={async payload => remember(await projectTemplateVersionApi.saveBacklog(versionId, payload)).sampleContent} onSaved={() => undefined} /></TabsContent>
      <TabsContent value="resources">
        {hasPermission("PROJECT_TEMPLATE_VERSION_READ") && <TemplateResourcesPanel versionId={versionId} editable={editable} />}
      </TabsContent>
      <TabsContent value="activity">{audit.isLoading ? <ProjectTemplateLoading /> : audit.isError ? <ProjectTemplateError error={audit.error} onRetry={() => void audit.refetch()} />
        : <Card><CardHeader><CardTitle>Version activity</CardTitle></CardHeader><CardContent>
          {!audit.data?.length ? <p className="text-sm text-muted-foreground">No recorded activity.</p> : <ul className="divide-y">{audit.data.map(item => <li key={item.id} className="grid gap-1 py-3 text-sm">
            <span className="font-medium">{item.action?.replaceAll("_", " ")}</span><span className="text-muted-foreground">{item.actorEmail ?? "System"} · {item.createdAt ? new Date(item.createdAt).toLocaleString("en-GB") : "—"}</span>
          </li>)}</ul>}</CardContent></Card>}</TabsContent>
    </Tabs>
    <Dialog open={publishOpen} onOpenChange={value => { if (!publishing) setPublishOpen(value); }}>
      <DialogContent showCloseButton={!publishing}><DialogHeader><DialogTitle>Publish {version.version}?</DialogTitle><DialogDescription>
        This version will become active and the previous active version will be archived. Existing projects and workspaces keep their saved brief, milestones and backlog.
      </DialogDescription></DialogHeader>
        {publishError && <Alert variant="destructive"><AlertTitle>Unable to publish version</AlertTitle><AlertDescription>
          <p>{publishError.message}</p><ul className="list-disc pl-4">{[...new Set(Object.values(publishError.fields).flat())].map(message => <li key={message}>{message}</li>)}</ul>
        </AlertDescription></Alert>}
        <DialogFooter><Button variant="outline" disabled={publishing} onClick={() => setPublishOpen(false)}>Cancel</Button>
          <Button disabled={publishing} onClick={() => void publish()}>{publishing ? <Loader2 className="animate-spin" /> : <Rocket />}Publish version</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
