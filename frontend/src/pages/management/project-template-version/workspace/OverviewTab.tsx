import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProjectTemplateVersionDTO } from "@/types";
import { ArrowRight } from "lucide-react";
import { useMemo } from "react";
import { VersionListPanel } from "./VersionListPanel";
import { parseContent } from "./version.constants";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}

function StatCard({ label, value, hint, tone }: StatCardProps) {
  return (
    <div className="rounded-xl border bg-card p-3 shadow-xs">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-1 text-xl font-bold text-foreground", tone)}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

interface OverviewTabProps {
  versions: ProjectTemplateVersionDTO[];
  selectedVersionId?: number;
  onSelectVersion: (id: number) => void;
  onOpenVersions: () => void;
}

/** Workspace overview: version KPIs plus the versions of the selected template. */
export function OverviewTab({
  versions,
  selectedVersionId,
  onSelectVersion,
  onOpenVersions,
}: OverviewTabProps) {
  const selected = versions.find((item) => item.id === selectedVersionId) ?? null;

  const stats = useMemo(() => {
    const templates = new Set<number>();
    let active = 0;
    let withPayload = 0;
    let latest: ProjectTemplateVersionDTO | null = null;

    for (const version of versions) {
      if (version.templateId != null) templates.add(version.templateId);
      if (version.isActive) active += 1;
      if (parseContent(version.contentJson)) withPayload += 1;

      const created = version.createdAt ? Date.parse(version.createdAt) : NaN;
      const latestCreated = latest?.createdAt
        ? Date.parse(latest.createdAt)
        : NaN;

      if (!latest || (Number.isFinite(created) && (!Number.isFinite(latestCreated) || created > latestCreated))) {
        latest = version;
      }
    }

    return { templates: templates.size, active, withPayload, latest };
  }, [versions]);

  const templateVersions = useMemo(
    () =>
      selected?.templateId != null
        ? versions.filter((item) => item.templateId === selected.templateId)
        : [],
    [selected?.templateId, versions],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total versions"
          value={String(versions.length)}
          hint={`${stats.active} active snapshot${stats.active === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Templates covered"
          value={String(stats.templates)}
          hint="Distinct Project Templates"
        />
        <StatCard
          label="Valid payloads"
          value={`${stats.withPayload}/${versions.length}`}
          hint="Snapshots stored as valid JSON"
          tone="text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          label="Latest version"
          value={stats.latest?.version ?? "—"}
          hint={
            stats.latest?.templateName?.trim() ||
            (stats.latest?.templateId != null
              ? `Template #${stats.latest.templateId}`
              : "No version yet")
          }
        />
      </div>

      <VersionListPanel
        title={
          selected?.templateId != null
            ? `Versions of ${
                selected.templateName?.trim() || `template #${selected.templateId}`
              }`
            : "Versions"
        }
        versions={templateVersions}
        selectedId={selectedVersionId}
        onSelect={onSelectVersion}
        showTemplate={false}
        emptyMessage="Select a version to see the other versions of its template."
        action={
          <Button variant="outline" size="sm" onClick={onOpenVersions}>
            Open version catalogue
            <ArrowRight className="h-4 w-4" />
          </Button>
        }
      />
    </div>
  );
}
