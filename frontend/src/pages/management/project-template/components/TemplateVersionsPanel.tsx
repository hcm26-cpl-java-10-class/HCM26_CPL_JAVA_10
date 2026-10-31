import { projectTemplateVersionApi } from "@/api";
import { PermissionGate } from "@/components/PermissionGate";
import { usePermissions } from "@/hooks/usePermissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreateVersionDialog } from "@/pages/management/project-template-version/workspace/CreateVersionDialog";
import {
  formatDateTime,
  parentVersionLabel,
  statusMeta,
} from "@/pages/management/project-template-version/workspace/version.constants";
import type { ProjectTemplateDTO } from "@/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, CopyPlus, GitBranch, Layers, Loader2, RefreshCw } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

/** Mirrors the error extraction used by the version workspace. */
const errorMessage = (error: unknown, fallback: string) => {
  const response = (error as { response?: { data?: unknown } } | null)?.response;
  const data = response?.data;

  if (typeof data === "string" && data.trim()) return data;

  if (data && typeof data === "object") {
    const payload = data as { message?: unknown; detail?: unknown };
    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message;
    }
    if (typeof payload.detail === "string" && payload.detail.trim()) {
      return payload.detail;
    }
  }

  if (error instanceof Error && error.message) return error.message;

  return fallback;
};

/**
 * US-07: version chain of a single Project Template.
 * <p>
 * The Project Template detail page used to be blind to its versions: versions
 * could only be created from `/project-template-versions`, which was not
 * reachable from the template the Program Manager was looking at. This panel
 * closes that gap by reading
 * `GET /api/project-template-versions/by-template/{id}` and exposing the
 * "Create new version" action right next to the template configuration.
 * <p>
 * The backend owns the business rules: the label is auto-incremented
 * (`v1.0 -> v2.0`), the configuration is copied, the new row is `DRAFT` and
 * `parentTemplateId` keeps pointing at the source version, so the snapshots
 * already used by workspaces/projects are never modified (AC01 / AC02).
 */
export function TemplateVersionsPanel({ template }: { template: ProjectTemplateDTO }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, activeRole } = usePermissions();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const pending = useRef(false);

  const query = useQuery({
    queryKey: ["project-template-versions", "by-template", template.id, user.email, activeRole],
    queryFn: () => projectTemplateVersionApi.getByTemplate(template.id),
    retry: false,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const versions = query.data ?? [];
  // US-07: the newest version is the one the next version is derived from.
  const source = versions[0] ?? null;

  const handleCreate = async () => {
    if (pending.current || query.isLoading || query.isError || template.readOnly || template.status === "ARCHIVED") return;
    pending.current = true;
    setSubmitting(true);

    try {
      // No version yet (template created before the version chain existed):
      // seed the v1.0 baseline from the template configuration. Otherwise
      // derive the next version from the newest one.
      const created = source?.id
        ? await projectTemplateVersionApi.createNewVersion(source.id)
        : await projectTemplateVersionApi.createInitialVersion(template.id);
      setOpen(false);

      await query.refetch();
      await queryClient.invalidateQueries({ queryKey: ["project_template_version"] });
      await queryClient.invalidateQueries({ queryKey: ["project-templates"] });

      toast.success(`Version ${created?.version ?? "v1.0"} created as a draft.`);
      if (created?.templateId && created.templateId !== template.id) {
        navigate(`/project-templates/${created.templateId}/detail`);
      }
    } catch (error) {
      toast.error(errorMessage(error, "Unable to create a new version."));
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  };

  return (
    <section className="min-w-0 rounded-xl border bg-card shadow-xs" aria-label="Template version history">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Version history</h2>
          <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">{versions.length}</Badge>
          <Badge variant="outline" className="h-5 px-1.5 text-[11px]">Template version {template.templateVersion}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={query.isFetching || submitting} onClick={() => void query.refetch()}>
            <RefreshCw className={query.isFetching ? "animate-spin" : undefined} /> Refresh versions
          </Button>
          <Button variant="outline" onClick={() => navigate("/project-template-versions")}>
            <ArrowUpRight /> Open version workspace
          </Button>
          {!template.readOnly && template.status !== "ARCHIVED" && <PermissionGate permission="PROJECT_TEMPLATE_VERSION_CREATE">
            <Button onClick={() => setOpen(true)} disabled={submitting || query.isLoading || query.isError}>
              {submitting ? <Loader2 className="animate-spin" /> : <CopyPlus />}
              {source ? "Create new version" : "Create first version"}
            </Button>
          </PermissionGate>}
        </div>
      </header>

      {query.isLoading ? (
        <p className="px-4 py-8 text-center text-xs text-muted-foreground">Loading versions...</p>
      ) : query.isError ? (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-xs text-muted-foreground">
          <p>{errorMessage(query.error, "Unable to load version history.")}</p>
          <Button variant="outline" size="sm" onClick={() => void query.refetch()}>Retry</Button>
        </div>
      ) : versions.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-muted-foreground">
          No version has been created yet. Create the first version to snapshot this template.
        </p>
      ) : (
        <ul className="divide-y">
          {versions.map((version) => {
            const meta = statusMeta(version.status);
            const derivedFrom = parentVersionLabel(versions, version.parentTemplateId);

            return (
              <li key={version.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                <span className="font-semibold">{version.version ?? `#${version.id}`}</span>
                {derivedFrom && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                    title={`parent_template_id = ${version.parentTemplateId}`}
                  >
                    <GitBranch className="h-3 w-3" />
                    from {derivedFrom}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {version.templateName ?? template.name}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {formatDateTime(version.updatedAt ?? version.createdAt)}
                </span>
                <span
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.badge}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                  {meta.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <CreateVersionDialog
        open={open}
        onOpenChange={value => { if (!pending.current) setOpen(value); }}
        source={source}
        versions={versions}
        loading={submitting}
        onConfirm={handleCreate}
      />
    </section>
  );
}
