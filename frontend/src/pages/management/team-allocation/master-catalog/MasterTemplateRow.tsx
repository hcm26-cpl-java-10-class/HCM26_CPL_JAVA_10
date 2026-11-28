import { AlertTriangle, CheckCircle2, Clock, Eye, Flag, Layers, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AssignmentTemplateSummary } from "@/types/features/project-assignment";
import { HighlightText, LevelPill } from "./CatalogBits";
import { assignedPill, levelStyle, statStyles } from "./catalog-styles";
import { formatPublishedAt } from "./master-catalog.utils";

/**
 * Compact one-line entry of the catalogue (about a quarter of a card's height). The title is the row's main action
 * and stretches over the whole row, so clicking anywhere opens the brief; "Chọn" stays a separate button above it.
 */
export function MasterTemplateRow({ template, selected, keyword, onPreview, onSelect }: {
  template: AssignmentTemplateSummary;
  selected: boolean;
  keyword: string;
  onPreview: () => void;
  onSelect: () => void;
}) {
  const published = formatPublishedAt(template.publishedAt);
  const stats = [
    { key: "modules", icon: Layers, value: template.moduleCount > 0 ? String(template.moduleCount) : "–",
      title: template.moduleCount > 0 ? `${template.moduleCount} module trực tiếp` : "Không chia module" },
    { key: "milestones", icon: Flag, value: String(template.milestoneCount), title: `${template.milestoneCount} milestone` },
    { key: "members", icon: Users, value: `${template.minMembers}–${template.maxMembers}`,
      title: `Sĩ số Team ${template.minMembers}–${template.maxMembers} thành viên` },
    { key: "duration", icon: Clock, value: template.estimatedDurationWeeks ? `${template.estimatedDurationWeeks}w` : "–",
      title: template.estimatedDurationWeeks ? `Thời lượng dự kiến ${template.estimatedDurationWeeks} tuần` : "Chưa ước lượng thời lượng" },
  ] as const;
  const details = [template.category, published && `Công bố ${published}`].filter(Boolean).join(" · ");

  return <article aria-label={template.name} title={details || undefined}
    className={"group relative flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 border-l-[3px] px-3 py-2.5 transition-colors sm:flex-nowrap "
      + (selected ? "border-l-blue-500 bg-blue-50/70 dark:border-l-blue-400 dark:bg-blue-950/30"
        : levelStyle(template.level).edge + " hover:bg-muted/50")}>
    <div className="grid min-w-0 flex-1 basis-64 gap-0.5">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
        {template.code && <span className="font-mono font-medium text-muted-foreground">
          <HighlightText text={template.code} keyword={keyword} /></span>}
        <span className="rounded border px-1 text-[11px] text-muted-foreground">{template.version}</span>
        <LevelPill level={template.level} className="py-0 text-[11px]" />
        {template.assignedTeams.length > 0 && <span title={`Đã phân công trong lớp: ${template.assignedTeams.join(", ")}`}
          className={"inline-flex max-w-48 items-center gap-1 rounded-full border px-1.5 text-[11px] font-medium " + assignedPill}>
          <AlertTriangle className="size-3 shrink-0" /><span className="truncate">{template.assignedTeams.join(", ")}</span>
        </span>}
        {selected && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300">
          <CheckCircle2 className="size-3.5" /> Đang chọn</span>}
      </div>
      <p className="truncate text-sm">
        <button type="button" onClick={onPreview}
          className="font-semibold after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-sm focus-visible:after:ring-2 focus-visible:after:ring-ring"
          aria-label={`Xem đề bài ${template.name}`}>
          <HighlightText text={template.name} keyword={keyword} />
        </button>
        {template.technologyStack && <span className="text-muted-foreground"> · <HighlightText text={template.technologyStack} keyword={keyword} /></span>}
      </p>
    </div>
    <dl className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground tabular-nums">
      {stats.map(({ key, icon: Icon, value, title }) => <div key={key} title={title} className="flex items-center gap-1">
        <Icon className={"size-3.5 " + statStyles[key].icon} aria-hidden="true" />
        <dt className="sr-only">{title}</dt><dd aria-hidden="true">{value}</dd>
      </div>)}
    </dl>
    <div className="relative z-10 flex shrink-0 items-center gap-1 max-sm:ml-auto">
      <Button type="button" variant="ghost" size="icon-sm" onClick={onPreview} title="Xem đề bài"
        aria-label={`Xem đề bài ${template.name}`} className="text-muted-foreground hover:text-foreground">
        <Eye className="size-4" />
      </Button>
      <Button type="button" size="sm" aria-pressed={selected} onClick={onSelect}
        className={"min-w-20 " + (selected ? "bg-blue-600 text-white hover:bg-blue-600/90 dark:bg-blue-500 dark:hover:bg-blue-500/90" : "")}>
        {selected ? <><CheckCircle2 className="size-4" /> Đã chọn</> : "Chọn"}
      </Button>
    </div>
  </article>;
}

