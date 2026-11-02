import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, ExternalLink, FileText, FolderOpen, Loader2 } from "lucide-react";
import { isAxiosError } from "axios";
import { projectResourceApi } from "@/api/features/project-resource.api";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { InheritedProjectResource } from "@/types/features/project-resource";
import { WorkspaceSectionState, sectionForbidden } from "./WorkspaceSectionState";
import { getWorkspaceError } from "./workspace.shared";

function sizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function WorkspaceResourcesPanel({ workspaceId, projectId, teamId, onAccessChanged }: {
  workspaceId: number; projectId?: number | null; teamId: number; onAccessChanged: () => void;
}) {
  const { user, activeRole } = usePermissions();
  const [downloading, setDownloading] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState<unknown>();
  const pending = useRef<AbortController | null>(null);
  const query = useQuery({
    queryKey: ["workspace-resources", workspaceId, user.email, activeRole],
    queryFn: ({ signal }) => projectResourceApi.list(workspaceId, signal),
    retry: false, staleTime: 0, gcTime: 0, refetchOnMount: "always",
  });
  const invalidLink = isAxiosError(downloadError) && downloadError.response?.data?.code === "RESOURCE_DOWNLOAD_LINK_INVALID";
  const denied = sectionForbidden(query.error) || sectionForbidden(downloadError) && !invalidLink;
  useEffect(() => () => pending.current?.abort(), []);

  async function download(resource: InheritedProjectResource) {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setDownloading(resource.id);
    setDownloadError(undefined);
    try {
      const blob = await projectResourceApi.download(workspaceId, resource.id, controller.signal);
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = resource.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      if (!controller.signal.aborted) setDownloadError(error);
    } finally {
      if (pending.current === controller) pending.current = null;
      if (!controller.signal.aborted) setDownloading(null);
    }
  }

  if (query.isPending || query.isError || denied)
    return <WorkspaceSectionState loading={query.isPending} denied={denied} error={query.error}
      retry={() => denied ? onAccessChanged() : void query.refetch()} />;
  const data = query.data;
  if (data.workspaceId !== workspaceId || data.teamId !== teamId || data.projectId !== (projectId ?? null))
    return <WorkspaceSectionState error={new Error("Resources do not match this workspace.")}
      retry={() => void query.refetch()} />;
  const count = data.groups.reduce((total, group) => total + group.resources.length, 0);

  return <Card>
    <CardHeader className="gap-2">
      <div className="flex items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2"><FolderOpen className="size-5" />Resources</CardTitle>
        <Badge variant="secondary">{count} {count === 1 ? "resource" : "resources"}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">Shared project resources and resources from your assigned sub-projects.</p>
    </CardHeader>
    <CardContent className="space-y-5">
      {downloadError != null && <p role="alert" className="text-sm text-destructive">{getWorkspaceError(downloadError)}</p>}
      {count === 0 ? <p className="text-sm text-muted-foreground">No resources were assigned to this workspace.</p>
        : data.groups.map(group => <section key={group.sourceTemplateId == null ? `project-${group.projectId}` : `template-${group.sourceTemplateId}`} className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 break-words text-sm font-semibold">{group.projectName}</h3>
            <Badge variant="outline">{group.origin === "PARENT" ? "Shared (Parent)"
              : group.origin === "SUB_PROJECT" ? "Sub-project" : "Project"}</Badge>
          </div>
          {group.resources.length === 0 ? <p className="text-sm text-muted-foreground">No resources in this group.</p>
            : <ul className="divide-y rounded-lg border">{group.resources.map(resource =>
              <li key={resource.id} className="flex items-start justify-between gap-3 p-3">
                <div className="flex min-w-0 gap-3">
                  <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 space-y-1">
                    <p className="break-words text-sm font-medium">{resource.title}</p>
                    {resource.description && <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{resource.description}</p>}
                    <p className="break-all text-xs text-muted-foreground">{resource.kind === "LINK" ? resource.url
                      : `${resource.fileName} · ${sizeLabel(resource.sizeBytes)}`} · {resource.version}</p>
                  </div>
                </div>
                {resource.kind === "LINK" ? resource.url?.startsWith("https://") && <Button variant="outline" size="sm" className="shrink-0" asChild>
                  <a href={resource.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${resource.title}`}><ExternalLink />Open link</a>
                </Button> : <Button variant="outline" size="sm" className="shrink-0" disabled={downloading !== null}
                  aria-label={`Download ${resource.title}`} onClick={() => void download(resource)}>
                  {downloading === resource.id ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  <span className="hidden sm:inline">Download</span>
                </Button>}
              </li>)}</ul>}
        </section>)}
    </CardContent>
  </Card>;
}
