import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ProjectTemplate } from "@/types";
import dayjs from "dayjs";
import {
  CalendarDays,
  Check,
  Clock3,
  Gauge,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  LEVEL_META,
  formatGroupSize,
  formatMilestoneWeek,
  formatQuota,
  resolveDomainIcon,
} from "./explore.constants";

interface ProjectTemplateDetailDialogProps {
  template: ProjectTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSelected: boolean;
  onSelect: (template: ProjectTemplate) => void;
}

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-border dark:bg-card">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </div>
      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-foreground">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-slate-500 dark:text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * AC02: full brief of the selected template - description, team size,
 * role quotas (PM / BA / DEV / QA) and the relative milestones with their
 * rubric weights.
 */
export function ProjectTemplateDetailDialog({
  template,
  open,
  onOpenChange,
  isSelected,
  onSelect,
}: ProjectTemplateDetailDialogProps) {
  const level = template ? LEVEL_META[template.level] : null;
  const DomainIcon = template ? resolveDomainIcon(template.domain) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
        {template && level && DomainIcon ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-start gap-3 pr-8 text-left">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-100 via-cyan-50 to-white text-sky-600 dark:from-muted dark:via-muted/60 dark:to-card dark:text-sky-400">
                  <DomainIcon className="h-6 w-6" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xl font-bold leading-tight text-slate-900 dark:text-foreground">
                    {template.name}
                  </span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge
                      variant="secondary"
                      className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-muted dark:text-muted-foreground"
                    >
                      {template.code}
                    </Badge>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                        level.badgeClass,
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", level.dotClass)} />
                      {level.label}
                    </span>
                    <Badge
                      variant="secondary"
                      className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    >
                      <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                      ACTIVE
                    </Badge>
                  </span>
                </span>
              </DialogTitle>
              <DialogDescription className="pt-3 text-[13px] leading-6 text-slate-600 dark:text-muted-foreground">
                {template.description}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                icon={Users}
                label="Team size"
                value={formatGroupSize(template.minMembers, template.maxMembers)}
                hint={`${template.minMembers} min · ${template.maxMembers} max`}
              />
              <StatTile
                icon={Clock3}
                label="Duration"
                value={`${template.durationWeeks} weeks`}
                hint="Relative to kick-off"
              />
              <StatTile
                icon={Gauge}
                label="Domain"
                value={template.domain}
                hint={level.label}
              />
              <StatTile
                icon={CalendarDays}
                label="Timeline"
                value={`${dayjs(template.startDate).format("DD MMM")} – ${dayjs(template.endDate).format("DD MMM YYYY")}`}
                hint={`Updated ${dayjs(template.updatedAt).format("DD MMM YYYY")}`}
              />
            </div>

            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-foreground">Team composition</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {template.roleQuotas.map((quota) => (
                  <div
                    key={quota.role}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-border dark:bg-card"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-800 dark:text-foreground">
                        {quota.label}
                      </p>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-muted-foreground">
                        {quota.role}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                      {formatQuota(quota.min, quota.max)}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-foreground">Skills</h3>
              <div className="flex flex-wrap gap-1.5">
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
            </section>

            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-foreground">
                  Milestones & rubric
                </h3>
                <span className="text-[11px] text-slate-500 dark:text-muted-foreground">
                  {template.milestones.length} milestone
                  {template.milestones.length === 1 ? "" : "s"}
                </span>
              </div>

              {template.milestones.length > 0 ? (
                <ol className="flex flex-col gap-4 border-l border-slate-200 pl-5 dark:border-border">
                  {template.milestones.map((milestone) => (
                    <li key={milestone.id} className="relative">
                      <span className="absolute -left-[25px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-sky-500 dark:border-card" />
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-foreground">
                            {milestone.name}
                          </p>
                          <p className="mt-0.5 text-[11px] leading-5 text-slate-500 dark:text-muted-foreground">
                            {formatMilestoneWeek(milestone.offsetWeeks)} · {milestone.deliverable}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-muted dark:text-muted-foreground">
                          {milestone.weight}% of grade
                        </span>
                      </div>

                      {milestone.rubric.length > 0 && (
                        <ul className="mt-2 flex flex-col gap-1">
                          {milestone.rubric.map((criterion) => (
                            <li
                              key={`${milestone.id}-${criterion.criterion}`}
                              className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-600 dark:bg-muted/50 dark:text-muted-foreground"
                            >
                              <span>{criterion.criterion}</span>
                              <span className="shrink-0 font-semibold text-slate-700 dark:text-foreground">
                                {criterion.weight}%
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500 dark:border-border dark:bg-card/50 dark:text-muted-foreground">
                  No milestones configured for this template yet.
                </p>
              )}
            </section>

            <DialogFooter className="gap-2 sm:justify-between">
              <p className="text-[11px] text-muted-foreground">
                Mock catalogue · registration API ships with the Project module.
              </p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <DialogClose asChild>
                  <Button
                    variant="outline"
                    className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-border dark:bg-card dark:text-foreground dark:hover:bg-muted/60"
                  >
                    Close
                  </Button>
                </DialogClose>
                <Button
                  type="button"
                  onClick={() => onSelect(template)}
                  className={cn(
                    isSelected
                      ? "bg-slate-900 text-white hover:bg-slate-800 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                      : "bg-sky-600 text-white hover:bg-sky-500 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90",
                  )}
                  aria-pressed={isSelected}
                >
                  {isSelected ? (
                    <>
                      <Check className="h-4 w-4" aria-hidden="true" />
                      Selected for your team
                    </>
                  ) : (
                    "Select this project"
                  )}
                </Button>
              </div>
            </DialogFooter>
          </>
        ) : (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No template selected.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
