import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ProjectTemplateVersionDTO } from "@/types";
import {
  ChevronDown,
  Copy,
  CopyPlus,
  GitBranch,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import { activeMeta, formatDate, parentVersionLabel, statusMeta } from "./version.constants";

interface ProjectTemplateVersionWorkspaceHeaderProps {
  version: ProjectTemplateVersionDTO | null;
  versions: ProjectTemplateVersionDTO[];
  onSelectVersion: (id: number) => void;
  templateLabel: string;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  submitting: boolean;
  /** US-07: create the next version from the selected one. */
  onNewVersion: () => void;
  /** US-08: duplicate the template of the selected version as a new template. */
  onDuplicate: () => void;
  onEditVersion: () => void;
  onDeleteVersion: () => void;
  tabs: ReactNode;
}

/**
 * Workspace header cloned from `SprintWorkspaceHeader`: template ribbon,
 * version switcher, version level actions and the section tabs of the
 * `/project-template-versions` page.
 */
export function ProjectTemplateVersionWorkspaceHeader({
  version,
  versions,
  onSelectVersion,
  templateLabel,
  canCreate,
  canUpdate,
  canDelete,
  submitting,
  onNewVersion,
  onDuplicate,
  onEditVersion,
  onDeleteVersion,
  tabs,
}: ProjectTemplateVersionWorkspaceHeaderProps) {
  const active = activeMeta(version?.isActive);
  const status = statusMeta(version?.status);
  const versionIndex = version
    ? versions.findIndex((item) => item.id === version.id) + 1
    : 0;

  return (
    <header className="rounded-xl border bg-card shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 pt-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="rounded-md border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-bold tracking-wide text-primary">
              {templateLabel}
            </Badge>
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Project Template Versions
            </span>
          </div>

          <h1 className="mt-2 truncate text-2xl font-bold tracking-tight text-foreground">
            {version?.version ?? "Project Template Versions"}
          </h1>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>Created {formatDate(version?.createdAt)}</span>
            <span className="text-border">•</span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                status.badge,
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
              {status.label}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                active.badge,
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", active.dot)} />
              {active.label}
            </span>

            {version?.parentTemplateId != null && (
              <>
                <span className="text-border">•</span>
                <span
                  className="inline-flex items-center gap-1"
                  title={`parent_template_id = ${version.parentTemplateId}`}
                >
                  <GitBranch className="h-3 w-3" />
                  Derived from{" "}
                  {parentVersionLabel(versions, version.parentTemplateId)}
                </span>
              </>
            )}

            {versions.length > 0 && (
              <>
                <span className="text-border">•</span>
                <Select
                  value={version?.id != null ? String(version.id) : ""}
                  onValueChange={(value) => onSelectVersion(Number(value))}
                >
                  <SelectTrigger
                    size="sm"
                    className="h-6 w-auto gap-1 border-dashed px-2 text-[11px] font-medium"
                  >
                    <SelectValue placeholder="Select version">
                      {`Version ${versionIndex > 0 ? versionIndex : 1} of ${versions.length}`}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent align="start">
                    {versions.map((item, index) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        Version {index + 1} of {versions.length} —{" "}
                        {item.version ?? `#${item.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canCreate && (
            <Button size="sm" onClick={onNewVersion} disabled={!version || submitting}>
              <CopyPlus className="h-4 w-4" />
              Create New Version
            </Button>
          )}

          {canCreate && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDuplicate}
              disabled={!version || submitting}
              title="Clone the selected template as a new independent template"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              Clone
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={!version}>
                Version Actions
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Template</DropdownMenuLabel>
              <DropdownMenuItem
                disabled={!canCreate || submitting}
                onSelect={onDuplicate}
              >
                <Copy className="h-4 w-4" />
                Duplicate as new template
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Snapshot</DropdownMenuLabel>
              <DropdownMenuItem disabled={!canUpdate} onSelect={onEditVersion}>
                <Pencil className="h-4 w-4" />
                Edit version
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={!canDelete || submitting}
                onSelect={onDeleteVersion}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete version
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mt-3 px-3">{tabs}</div>
    </header>
  );
}
