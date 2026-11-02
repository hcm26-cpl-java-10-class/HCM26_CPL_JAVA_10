import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { workspaceApi } from "@/api/features/workspace.api";
import { usePermissions } from "@/hooks/usePermissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { WorkspaceResource, WorkspaceResourceFile } from "@/types/features/workspace-resource";
import {
  BookOpen,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  Link2,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { WorkspaceEmptyState, getWorkspaceError } from "./workspace.shared";
import { WorkspaceSectionState, sectionForbidden } from "./WorkspaceSectionState";

function humanSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function formatDate(value?: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString("en-GB");
}

function categoryLabel(resource: WorkspaceResource) {
  const raw = resource.category?.trim();
  if (raw) return raw;
  if (resource.url?.toLowerCase().includes("github")) return "Git";
  if (resource.url?.toLowerCase().includes("docs.google")) return "Docs";
  return resource.kind === "FILE" ? "Document" : "Link";
}

/**
 * Resources tab of a workspace (`/management/workspaces/:id?tab=resources`).
 * Trainees can browse the documents and external links their team received
 * with the project brief and download the documents through signed URLs.
 */
export function WorkspaceResourcesPanel({
  workspaceId,
  projectId,
  teamId,
  onAccessChanged,
}: {
  workspaceId: number;
  projectId?: number | null;
  teamId: number;
  onAccessChanged: () => void;
}) {
  const { user, activeRole } = usePermissions();
  const [downloading, setDownloading] = useState<number | null>(null);
  const query = useQuery({
    queryKey: ["workspace-resources", workspaceId, user.email, activeRole],
    queryFn: ({ signal }) => workspaceApi.resources(workspaceId, signal),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });

  const denied = sectionForbidden(query.error);
  useEffect(() => {
    if (denied) onAccessChanged();
  }, [denied, onAccessChanged]);

  if (denied || query.isError || query.isPending || query.isFetching) {
    return (
      <WorkspaceSectionState
        loading={!query.isError && query.isFetching}
        denied={denied}
        error={query.error}
        retry={() => (denied ? onAccessChanged() : void query.refetch())}
      />
    );
  }

  const data = query.data;
  if (!data || data.workspaceId !== workspaceId || data.teamId !== teamId
    || (data.projectId ?? null) !== (projectId ?? null)) {
    return (
      <WorkspaceSectionState
        error={new Error("Resources context does not match this workspace.")}
        retry={() => void query.refetch()}
      />
    );
  }

  const documents = data.items.filter((item) => item.kind === "FILE" || item.files.length > 0);
  const links = data.items.filter((item) => item.kind === "LINK" && item.url);
  const empty = data.items.length === 0;
  const noProject = data.projectId == null;

  const download = async (resource: WorkspaceResource, file: WorkspaceResourceFile) => {
    if (downloading != null) return;
    setDownloading(file.id);
    try {
      const ticket = await workspaceApi.resourceDownloadTicket(workspaceId, resource.id, file.id);
      const anchor = document.createElement("a");
      anchor.href = ticket.url;
      anchor.download = ticket.fileName;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      toast.success(`Downloading ${ticket.fileName}`);
    } catch (error) {
      toast.error(getWorkspaceError(error));
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Project resources</CardTitle>
              <CardDescription>
                Documents, repositories and reference links shared with your team for this project.
              </CardDescription>
            </div>
            <Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>
              <RefreshCw className={query.isFetching ? "animate-spin" : undefined} />
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      {noProject ? (
        <Card>
          <CardContent>
            <WorkspaceEmptyState
              icon={BookOpen}
              title="No project linked yet"
              description="This workspace has no project, so no learning resources are available."
            />
          </CardContent>
        </Card>
      ) : empty ? (
        <Card>
          <CardContent>
            <WorkspaceEmptyState
              icon={FolderOpen}
              title="No resources yet"
              description="Your mentor has not shared any documents or links for this project. Check back after the project brief is assigned."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <CardDescription>{documents.length} resource(s) with downloadable files</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {documents.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No documents have been attached yet.
                </p>
              ) : (
                documents.map((resource) => (
                  <div key={resource.id} className="space-y-2 rounded-lg border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <p className="break-words font-medium">{resource.title}</p>
                        {resource.description && (
                          <p className="break-words text-sm text-muted-foreground">{resource.description}</p>
                        )}
                      </div>
                      <Badge variant="outline">{categoryLabel(resource)}</Badge>
                    </div>
                    {resource.files.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No file attached yet.</p>
                    ) : (
                      <ul className="divide-y rounded-md border">
                        {resource.files.map((file) => (
                          <li
                            key={file.id}
                            className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <FileText className="size-4 shrink-0 text-muted-foreground" />
                              <span className="truncate">{file.fileName}</span>
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {humanSize(file.sizeBytes)}
                              </span>
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={downloading === file.id}
                              onClick={() => void download(resource, file)}
                            >
                              {downloading === file.id ? <Loader2 className="animate-spin" /> : <Download />}
                              Download
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-xs text-muted-foreground">Updated {formatDate(resource.updatedAt)}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Links</CardTitle>
              <CardDescription>Git repositories and shared documents</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {links.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No external links have been shared yet.
                </p>
              ) : (
                links.map((resource) => (
                  <a
                    key={resource.id}
                    href={resource.url ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-lg border p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2 font-medium">
                        {categoryLabel(resource).toLowerCase() === "git" ? <Link2 className="size-4 shrink-0" /> : <ExternalLink className="size-4 shrink-0" />}
                        <span className="break-all">{resource.title}</span>
                      </span>
                      <Badge variant="secondary">{categoryLabel(resource)}</Badge>
                    </div>
                    {resource.description && (
                      <p className="mt-1 break-words text-sm text-muted-foreground">{resource.description}</p>
                    )}
                    <p className="mt-2 break-all text-xs text-primary">{resource.url}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Updated {formatDate(resource.updatedAt)}</p>
                  </a>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
