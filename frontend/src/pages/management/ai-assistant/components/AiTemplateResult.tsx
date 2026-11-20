import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  BacklogItemOutput,
  GeneratedTemplateOutput,
  MilestoneOutput,
  ModuleOutput,
  ProjectTemplateOutput,
  ResourceOutput,
  TeamConstraintsOutput,
} from "@/types/features/ai-assistant";
import {
  BookOpenCheck,
  Boxes,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Flag,
  LayoutDashboard,
  Layers3,
  ListChecks,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

const LIST_PAGE_SIZE = 5;

function PaginatedItems<T>({
  items,
  label,
  renderItem,
}: {
  items: T[];
  label: string;
  renderItem: (item: T, index: number) => ReactNode;
}) {
  const [page, setPage] = useState(0);
  const pageCount = Math.ceil(items.length / LIST_PAGE_SIZE);
  const currentPage = Math.max(0, Math.min(page, pageCount - 1));
  const start = currentPage * LIST_PAGE_SIZE;
  const visibleItems = items.slice(start, start + LIST_PAGE_SIZE);

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        {visibleItems.map((item, index) => renderItem(item, start + index))}
      </div>
      {pageCount > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-xs text-muted-foreground">
          <span>Showing {start + 1}–{Math.min(start + LIST_PAGE_SIZE, items.length)} of {items.length} {label}</span>
          <nav aria-label={`${label} pagination`} className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1 border-indigo-200 px-2 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950"
              aria-label={`Previous ${label} page`} disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}>
              <ChevronLeft className="size-4" /><span className="hidden sm:inline">Previous</span>
            </Button>
            <span className="whitespace-nowrap font-medium tabular-nums text-indigo-700 dark:text-indigo-300">Page {currentPage + 1} of {pageCount}</span>
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1 border-indigo-200 px-2 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950"
              aria-label={`Next ${label} page`} disabled={currentPage >= pageCount - 1}
              onClick={() => setPage(currentPage + 1)}>
              <span className="hidden sm:inline">Next</span><ChevronRight className="size-4" />
            </Button>
          </nav>
        </div>
      )}
    </div>
  );
}

function SectionCard({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card className="min-w-0 overflow-hidden shadow-sm">
      <CardHeader className="gap-1 border-b border-indigo-100 bg-gradient-to-r from-indigo-50/80 via-sky-50/40 to-background px-3.5 py-3 dark:border-indigo-900/60 dark:from-indigo-950/40 dark:via-sky-950/20">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-indigo-950 dark:text-indigo-100">
          <span className="flex size-7 items-center justify-center rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-900/70 dark:text-indigo-300">{icon}</span>
          {title}
        </CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent className="min-w-0 px-3.5 py-3">{children}</CardContent>
    </Card>
  );
}

function ProjectOverview({ project }: { project: ProjectTemplateOutput | null }) {
  if (!project) return null;

  const details = [
    ["Code", project.code],
    ["Category", project.category],
    ["Level", project.level],
    ["Duration", project.estimatedDurationWeeks ? `${project.estimatedDurationWeeks} weeks` : null],
    ["Technology stack", project.technologyStack],
  ].filter((detail): detail is [string, string] => Boolean(detail[1]));

  return (
    <SectionCard icon={<Layers3 className="size-4" />} title={project.name || "Project template"}>
      <div className="space-y-3">
        {project.description && <p className="whitespace-pre-wrap text-sm leading-5 text-muted-foreground">{project.description}</p>}
        {details.length > 0 && (
          <dl className="grid gap-2 sm:grid-cols-2">
            {details.map(([label, value]) => (
              <div key={label} className="min-w-0 rounded-lg border border-slate-200/80 bg-background p-2.5 dark:border-slate-800">
                <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</dt>
                <dd className={`mt-0.5 break-words text-sm font-semibold ${label === "Code" ? "font-mono text-indigo-700 dark:text-indigo-300" : "text-slate-800 dark:text-slate-100"}`}>{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </SectionCard>
  );
}

function TeamConstraints({ constraints }: { constraints: TeamConstraintsOutput | null }) {
  if (!constraints) return null;

  const quotas = constraints.roleQuotas
    ? [
        ["PM", constraints.roleQuotas.pm],
        ["BA", constraints.roleQuotas.ba],
        ["DEV", constraints.roleQuotas.dev],
        ["QA", constraints.roleQuotas.qa],
      ] as const
    : [];

  return (
    <SectionCard icon={<Users className="size-4" />} title="Team constraints">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="border border-indigo-200 bg-indigo-100 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">{constraints.minMembers}–{constraints.maxMembers} members</Badge>
        <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-200">{constraints.allowMultiRole ? "Multiple roles allowed" : "One role per member"}</Badge>
        {quotas.map(([role, count]) => (
          <Badge key={role} variant="outline" className="border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/50 dark:text-violet-200">{role}: {count}</Badge>
        ))}
      </div>
    </SectionCard>
  );
}

function MilestoneCard({ milestone, index }: { milestone: MilestoneOutput; index: number }) {
  const checklist = milestone.checklistItems ?? [];
  const criteria = milestone.rubricCriteria ?? [];

  return (
    <details className="group rounded-lg border bg-background">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 p-3 marker:hidden [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">{index + 1}</span>
          <span className="truncate text-sm font-semibold text-indigo-950 dark:text-indigo-100">{milestone.title || `Milestone ${index + 1}`}</span>
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          {milestone.dueAfter != null && <Badge variant="outline" className="border-sky-200 bg-sky-50 text-[10px] text-sky-800 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-200">Due {milestone.dueAfter} {milestone.dueUnit?.toLowerCase() || "days"}</Badge>}
          {milestone.weight != null && <Badge variant="secondary" className="bg-indigo-100 text-[10px] text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">{milestone.weight}%</Badge>}
          {milestone.mandatory && <Badge className="bg-emerald-600 text-[10px] text-white hover:bg-emerald-600">Required</Badge>}
          <span aria-hidden="true" className="ml-1 text-xs text-muted-foreground transition-transform group-open:rotate-180">⌄</span>
        </span>
      </summary>
      <div className="grid gap-3 border-t px-3 py-3">
        {milestone.description && <p className="whitespace-pre-wrap text-sm leading-5 text-muted-foreground">{milestone.description}</p>}

        {checklist.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Checklist · {checklist.length}</h4>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {checklist.map((item, itemIndex) => (
                <li key={`${item.orderIndex ?? itemIndex}-${item.content}`} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  <span className="min-w-0">{item.content}{item.mandatory && <span className="ml-1 text-xs text-muted-foreground">(required)</span>}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {criteria.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rubric criteria · {criteria.length}</h4>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {criteria.map((criterion, criterionIndex) => (
                <div key={`${criterion.code ?? criterionIndex}`} className="rounded-md border border-violet-100 bg-violet-50/50 p-2.5 dark:border-violet-900/60 dark:bg-violet-950/20">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-violet-950 dark:text-violet-100">{criterion.name || criterion.code || `Criterion ${criterionIndex + 1}`}</p>
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800 dark:bg-violet-900/60 dark:text-violet-200">{criterion.weight ?? 0}% · {criterion.maxScore ?? 0} pts</span>
                  </div>
                  {criterion.description && <p className="mt-1 text-sm text-muted-foreground">{criterion.description}</p>}
                  {criterion.ratings && criterion.ratings.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {criterion.ratings.map((rating, ratingIndex) => (
                        <li key={`${rating.level ?? ratingIndex}-${ratingIndex}`}>
                          <span className="font-semibold text-violet-800 dark:text-violet-300">{rating.level || "Rating"}:</span> {rating.description}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

function Milestones({ milestones }: { milestones: MilestoneOutput[] | null }) {
  if (!milestones?.length) return null;

  return (
    <SectionCard icon={<BookOpenCheck className="size-4" />} title="Milestones and rubrics" description={`${milestones.length} milestones`}>
      <PaginatedItems items={milestones} label="milestones" renderItem={(milestone, index) => (
          <MilestoneCard key={`${milestone.orderIndex ?? index}-${milestone.title}`} milestone={milestone} index={index} />
      )} />
    </SectionCard>
  );
}

function Backlog({ items }: { items: BacklogItemOutput[] | null }) {
  if (!items?.length) return null;

  return (
    <SectionCard icon={<ClipboardList className="size-4" />} title="Backlog" description={`${items.length} suggested items`}>
      <PaginatedItems items={items} label="backlog items" renderItem={(item, index) => (
          <article key={`${item.orderIndex ?? index}-${item.title}`} className="flex gap-2.5 rounded-lg border border-sky-100 bg-gradient-to-br from-sky-50/70 to-background p-2.5 dark:border-sky-900/60 dark:from-sky-950/25">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-800 dark:bg-sky-900/70 dark:text-sky-200">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-sky-950 dark:text-sky-100">{item.title || `Backlog item ${index + 1}`}</h3>
                {item.suggestedRole && <Badge variant="outline" className="border-sky-200 bg-white text-sky-800 dark:border-sky-800 dark:bg-slate-950 dark:text-sky-200">{item.suggestedRole}</Badge>}
              </div>
              {item.description && <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>}
            </div>
          </article>
      )} />
    </SectionCard>
  );
}

function Modules({ modules }: { modules: ModuleOutput[] | null }) {
  if (!modules?.length) return null;

  return (
    <SectionCard icon={<Boxes className="size-4" />} title="Modules" description={`${modules.length} project modules`}>
      <PaginatedItems items={modules} label="modules" renderItem={(module, index) => (
          <article key={`${module.code ?? index}-${module.name}`} className="rounded-lg border border-cyan-100 bg-gradient-to-br from-cyan-50/60 to-background p-2.5 dark:border-cyan-900/60 dark:from-cyan-950/20">
            <div className="flex flex-wrap items-center gap-2">
              {module.code && <span className="rounded bg-cyan-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-cyan-800 dark:bg-cyan-900/70 dark:text-cyan-200">{module.code}</span>}
              <h3 className="font-semibold text-cyan-950 dark:text-cyan-100">{module.name || `Module ${index + 1}`}</h3>
            </div>
            {module.description && <p className="mt-2 text-sm text-muted-foreground">{module.description}</p>}
            <p className="mt-2 text-xs text-muted-foreground">
              {[module.category, module.level, module.estimatedDurationWeeks ? `${module.estimatedDurationWeeks} weeks` : null, module.technologyStack]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </article>
      )} />
    </SectionCard>
  );
}

function Resources({ resources }: { resources: ResourceOutput[] | null }) {
  if (!resources?.length) return null;

  return (
    <SectionCard icon={<ExternalLink className="size-4" />} title="Resources" description={`${resources.length} references`}>
      <PaginatedItems items={resources} label="resources" renderItem={(resource, index) => {
          let href: string | undefined;
          try {
            const parsedUrl = new URL(resource.url ?? "");
            if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
              href = parsedUrl.href;
            }
          } catch {
            href = undefined;
          }

          return (
            <article key={`${resource.orderIndex ?? index}-${resource.url}`} className="min-w-0 rounded-lg border border-emerald-100 bg-gradient-to-br from-emerald-50/60 to-background p-2.5 dark:border-emerald-900/60 dark:from-emerald-950/20">
              {href ? (
                <a href={href} target="_blank" rel="noreferrer" className="break-all font-semibold text-emerald-800 hover:text-emerald-900 hover:underline dark:text-emerald-300 dark:hover:text-emerald-200">
                  {resource.title || resource.url || `Resource ${index + 1}`}
                </a>
              ) : (
                <span className="break-all font-semibold text-emerald-900 dark:text-emerald-200">{resource.title || resource.url || `Resource ${index + 1}`}</span>
              )}
              {resource.description && <p className="mt-1 text-sm text-muted-foreground">{resource.description}</p>}
            </article>
          );
      }} />
    </SectionCard>
  );
}

export function AiTemplateResult({ output }: { output: GeneratedTemplateOutput }) {
  const milestoneCount = output.milestones?.length ?? 0;
  const backlogCount = output.backlogItems?.length ?? 0;
  const moduleCount = output.modules?.length ?? 0;
  const resourceCount = output.resources?.length ?? 0;

  return (
    <Tabs defaultValue="overview" className="w-full min-w-0 max-w-full gap-3">
      <div className="w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-indigo-200/80 bg-gradient-to-r from-indigo-50/80 via-slate-50 to-sky-50/80 p-1 dark:border-indigo-900/70 dark:from-indigo-950/40 dark:via-slate-950 dark:to-sky-950/30">
        <TabsList aria-label="Generated project template sections" className="!grid !h-auto !w-full min-w-0 grid-cols-2 gap-1.5 bg-transparent sm:grid-cols-3">
          <TabsTrigger value="overview" className="h-auto min-h-12 !w-full min-w-0 flex-col gap-1 whitespace-normal px-2 py-2 text-center text-xs leading-tight data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-indigo-950 dark:data-[state=active]:text-indigo-200"><LayoutDashboard className="size-4" /><span className="max-w-full break-words">Overview</span></TabsTrigger>
          <TabsTrigger value="team" className="h-auto min-h-12 !w-full min-w-0 flex-col gap-1 whitespace-normal px-2 py-2 text-center text-xs leading-tight data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-indigo-950 dark:data-[state=active]:text-indigo-200"><Users className="size-4" /><span className="max-w-full break-words">Team constraints</span></TabsTrigger>
          <TabsTrigger value="milestones" className="h-auto min-h-12 !w-full min-w-0 flex-col gap-1 whitespace-normal px-2 py-2 text-center text-xs leading-tight data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-indigo-950 dark:data-[state=active]:text-indigo-200"><Flag className="size-4" /><span className="max-w-full break-words">Milestones{milestoneCount > 0 ? ` (${milestoneCount})` : ""}</span></TabsTrigger>
          <TabsTrigger value="backlog" className="h-auto min-h-12 !w-full min-w-0 flex-col gap-1 whitespace-normal px-2 py-2 text-center text-xs leading-tight data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-indigo-950 dark:data-[state=active]:text-indigo-200"><ListChecks className="size-4" /><span className="max-w-full break-words">Backlog{backlogCount > 0 ? ` (${backlogCount})` : ""}</span></TabsTrigger>
          <TabsTrigger value="modules" className="h-auto min-h-12 !w-full min-w-0 flex-col gap-1 whitespace-normal px-2 py-2 text-center text-xs leading-tight data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-indigo-950 dark:data-[state=active]:text-indigo-200"><Boxes className="size-4" /><span className="max-w-full break-words">Modules{moduleCount > 0 ? ` (${moduleCount})` : ""}</span></TabsTrigger>
          <TabsTrigger value="resources" className="h-auto min-h-12 !w-full min-w-0 flex-col gap-1 whitespace-normal px-2 py-2 text-center text-xs leading-tight data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-indigo-950 dark:data-[state=active]:text-indigo-200"><ExternalLink className="size-4" /><span className="max-w-full break-words">Resources{resourceCount > 0 ? ` (${resourceCount})` : ""}</span></TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="overview" className="mt-0 min-w-0">
        <ProjectOverview project={output.projectTemplate} />
      </TabsContent>
      <TabsContent value="team" className="mt-0 min-w-0">
        <TeamConstraints constraints={output.teamConstraints} />
      </TabsContent>
      <TabsContent value="milestones" className="mt-0 min-w-0">
        <Milestones milestones={output.milestones} />
      </TabsContent>
      <TabsContent value="backlog" className="mt-0 min-w-0">
        <Backlog items={output.backlogItems} />
      </TabsContent>
      <TabsContent value="modules" className="mt-0 min-w-0">
        <Modules modules={output.modules} />
      </TabsContent>
      <TabsContent value="resources" className="mt-0 min-w-0">
        <Resources resources={output.resources} />
      </TabsContent>
    </Tabs>
  );
}
