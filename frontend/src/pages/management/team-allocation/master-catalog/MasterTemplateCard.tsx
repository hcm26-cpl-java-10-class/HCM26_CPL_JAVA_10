import { AlertTriangle, CheckCircle2, Clock, Eye, Flag, Layers, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AssignmentTemplateSummary } from "@/types/features/project-assignment";
import { HighlightText, LevelPill } from "./CatalogBits";
import { assignedPill, levelStyle, selectedCard, statStyles } from "./catalog-styles";
import { formatPublishedAt } from "./master-catalog.utils";

export function MasterTemplateCard({ template, selected, keyword, onPreview, onSelect }: {
  template: AssignmentTemplateSummary;
  selected: boolean;
  keyword: string;
  onPreview: () => void;
  onSelect: () => void;
}) {
  const published = formatPublishedAt(template.publishedAt);
  const stats = [
    { key: "modules", icon: Layers, label: "Module", value: template.moduleCount > 0 ? `${template.moduleCount} module` : "Không chia module" },
    { key: "milestones", icon: Flag, label: "Milestone", value: `${template.milestoneCount} milestone` },
    { key: "members", icon: Users, label: "Sĩ số", value: `${template.minMembers}–${template.maxMembers} người` },
    { key: "duration", icon: Clock, label: "Thời lượng", value: template.estimatedDurationWeeks ? `${template.estimatedDurationWeeks} tuần` : "Chưa ước lượng" },
  ] as const;
  return <article aria-label={template.name} className={"group relative flex h-full min-w-0 flex-col overflow-hidden rounded-xl border bg-card transition-all "
    + (selected ? selectedCard : "hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md")}>
    <span aria-hidden="true" className={"h-1 w-full " + levelStyle(template.level).strip} />
    <div className="flex flex-1 flex-col gap-3 p-4">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
        {template.code && <span className="font-mono font-medium text-muted-foreground">
          <HighlightText text={template.code} keyword={keyword} /></span>}
        <Badge variant="outline" className="font-normal">{template.version}</Badge>
        <LevelPill level={template.level} />
        {selected && <span className="ml-auto inline-flex items-center gap-1 font-medium text-blue-700 dark:text-blue-300">
          <CheckCircle2 className="size-3.5" /> Đang chọn</span>}
      </div>
      <div className="min-w-0 space-y-1">
        <h3 className="break-words text-base font-semibold leading-snug">
          <HighlightText text={template.name} keyword={keyword} /></h3>
        {template.technologyStack && <p className="line-clamp-2 text-xs text-muted-foreground">
          <HighlightText text={template.technologyStack} keyword={keyword} /></p>}
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg bg-muted/40 p-2.5 text-xs">
        {stats.map(({ key, icon: Icon, label, value }) => <div key={key} className="flex min-w-0 items-center gap-1.5">
          <Icon className={"size-3.5 shrink-0 " + statStyles[key].icon} aria-hidden="true" />
          <dt className="sr-only">{label}</dt><dd className="truncate text-muted-foreground">{value}</dd>
        </div>)}
      </dl>
      {(template.category || template.assignedTeams.length > 0) && <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {template.category && <span className="rounded-full border px-2 py-0.5 text-muted-foreground">{template.category}</span>}
        {template.assignedTeams.length > 0 && <span className={"inline-flex min-w-0 items-center gap-1 rounded-full border px-2 py-0.5 font-medium " + assignedPill}>
          <AlertTriangle className="size-3 shrink-0" /><span className="truncate">Đã gán: {template.assignedTeams.join(", ")}</span>
        </span>}
      </div>}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <span className="text-xs text-muted-foreground">{published ? `Công bố ${published}` : ""}</span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onPreview}
            aria-label={`Xem đề bài ${template.name}`}><Eye className="size-4" /> Xem đề bài</Button>
          <Button type="button" size="sm" aria-pressed={selected} onClick={onSelect}
            className={selected ? "bg-blue-600 text-white hover:bg-blue-600/90 dark:bg-blue-500 dark:hover:bg-blue-500/90" : ""}>
            {selected ? <><CheckCircle2 className="size-4" /> Đã chọn</> : "Chọn"}
          </Button>
        </div>
      </div>
    </div>
  </article>;
}
