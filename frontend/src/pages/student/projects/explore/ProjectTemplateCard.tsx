import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProjectTemplate } from "@/types";
import { Check, Clock3, Users } from "lucide-react";
import {
  LEVEL_META,
  formatGroupSize,
  resolveDomainIcon,
} from "./explore.constants";

interface ProjectTemplateCardProps {
  template: ProjectTemplate;
  isSelected: boolean;
  onOpenDetail: (template: ProjectTemplate) => void;
  onSelect: (template: ProjectTemplate) => void;
}

/**
 * Catalogue card for one ACTIVE template (US-09 / AC01).
 * Mirrors the mock-up: icon tile, level badge, title, teaser, tag chips and a
 * full-width action. The whole card opens the detail view (AC02).
 */
export function ProjectTemplateCard({
  template,
  isSelected,
  onOpenDetail,
  onSelect,
}: ProjectTemplateCardProps) {
  const level = LEVEL_META[template.level];
  const DomainIcon = resolveDomainIcon(template.domain);

  return (
    <article
      data-selected={isSelected}
      onClick={() => onOpenDetail(template)}
      className={cn(
        "group flex h-full cursor-pointer flex-col rounded-2xl border bg-white p-4 shadow-sm transition duration-200 dark:bg-card",
        "hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md dark:hover:border-muted-foreground/30",
        isSelected
          ? "border-sky-400 ring-2 ring-sky-100 dark:border-ring dark:ring-ring/30"
          : "border-slate-200 dark:border-border",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-100 via-cyan-50 to-white text-sky-600 dark:from-muted dark:via-muted/60 dark:to-card dark:text-sky-400">
          <DomainIcon className="h-5 w-5" aria-hidden="true" />
        </span>

        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
            level.badgeClass,
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", level.dotClass)} />
          {level.label}
        </span>
      </div>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onOpenDetail(template);
        }}
        className="mt-4 text-left focus-visible:outline-none"
      >
        <h3 className="text-[15px] font-semibold leading-snug text-slate-900 transition-colors group-hover:text-sky-700 dark:text-foreground dark:group-hover:text-sky-400">
          {template.name}
        </h3>
      </button>

      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500 dark:text-muted-foreground">
        {template.description}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {template.technologies.map((tag) => (
          <Badge
            key={tag}
            variant="secondary"
            className="rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
          >
            {tag}
          </Badge>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-[11px] text-slate-500 dark:text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
          {template.durationWeeks} weeks
        </span>
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          {formatGroupSize(template.minMembers, template.maxMembers)}
        </span>
      </div>

      <Button
        type="button"
        variant={isSelected ? "default" : "outline"}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(template);
        }}
        className={cn(
          "mt-3 w-full rounded-xl",
          isSelected
            ? "bg-slate-900 text-white hover:bg-slate-800 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
            : "border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 dark:border-border dark:bg-card dark:text-foreground dark:hover:bg-muted/60 dark:hover:text-foreground",
        )}
        aria-pressed={isSelected}
      >
        {isSelected ? (
          <>
            <Check className="h-4 w-4" aria-hidden="true" />
            Selected
          </>
        ) : (
          "Select project"
        )}
      </Button>
    </article>
  );
}
