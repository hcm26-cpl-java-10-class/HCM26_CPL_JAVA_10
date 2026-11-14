import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Layers3,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

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
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="border-b bg-muted/20">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="text-primary">{icon}</span>
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="min-w-0">{children}</CardContent>
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
      <div className="space-y-4">
        {project.description && <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{project.description}</p>}
        {details.length > 0 && (
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {details.map(([label, value]) => (
              <div key={label} className="min-w-0 rounded-lg border bg-background p-3">
                <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                <dd className="mt-1 break-words text-sm font-medium">{value}</dd>
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
        <Badge variant="secondary">{constraints.minMembers}–{constraints.maxMembers} members</Badge>
        <Badge variant="outline">{constraints.allowMultiRole ? "Multiple roles allowed" : "One role per member"}</Badge>
        {quotas.map(([role, count]) => (
          <Badge key={role} variant="outline">{role}: {count}</Badge>
        ))}
      </div>
    </SectionCard>
  );
}

function MilestoneCard({ milestone, index }: { milestone: MilestoneOutput; index: number }) {
  const checklist = milestone.checklistItems ?? [];
  const criteria = milestone.rubricCriteria ?? [];

  return (
    <article className="rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold">{milestone.title || `Milestone ${index + 1}`}</h3>
          {milestone.description && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{milestone.description}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {milestone.dueAfter != null && <Badge variant="outline">Due after {milestone.dueAfter} {milestone.dueUnit?.toLowerCase() || "days"}</Badge>}
          {milestone.weight != null && <Badge variant="secondary">{milestone.weight}%</Badge>}
          {milestone.mandatory && <Badge>Required</Badge>}
        </div>
      </div>

      {checklist.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Checklist</h4>
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
        <div className="mt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rubric criteria</h4>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {criteria.map((criterion, criterionIndex) => (
              <div key={`${criterion.code ?? criterionIndex}`} className="rounded-md bg-muted/40 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{criterion.name || criterion.code || `Criterion ${criterionIndex + 1}`}</p>
                  <span className="text-xs text-muted-foreground">
                    {criterion.weight ?? 0}% · {criterion.maxScore ?? 0} pts
                  </span>
                </div>
                {criterion.description && <p className="mt-1 text-sm text-muted-foreground">{criterion.description}</p>}
                {criterion.ratings && criterion.ratings.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {criterion.ratings.map((rating, ratingIndex) => (
                      <li key={`${rating.level ?? ratingIndex}-${ratingIndex}`}>
                        <span className="font-medium text-foreground">{rating.level || "Rating"}:</span> {rating.description}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

function Milestones({ milestones }: { milestones: MilestoneOutput[] | null }) {
  if (!milestones?.length) return null;

  return (
    <SectionCard icon={<BookOpenCheck className="size-4" />} title="Milestones and rubrics" description={`${milestones.length} milestones`}>
      <div className="space-y-3">
        {milestones.map((milestone, index) => (
          <MilestoneCard key={`${milestone.orderIndex ?? index}-${milestone.title}`} milestone={milestone} index={index} />
        ))}
      </div>
    </SectionCard>
  );
}

function Backlog({ items }: { items: BacklogItemOutput[] | null }) {
  if (!items?.length) return null;

  return (
    <SectionCard icon={<ClipboardList className="size-4" />} title="Backlog" description={`${items.length} suggested items`}>
      <ol className="space-y-3">
        {items.map((item, index) => (
          <li key={`${item.orderIndex ?? index}-${item.title}`} className="flex gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-medium">{item.title || `Backlog item ${index + 1}`}</h3>
                {item.suggestedRole && <Badge variant="outline">{item.suggestedRole}</Badge>}
              </div>
              {item.description && <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>}
            </div>
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}

function Modules({ modules }: { modules: ModuleOutput[] | null }) {
  if (!modules?.length) return null;

  return (
    <SectionCard icon={<Boxes className="size-4" />} title="Modules" description={`${modules.length} project modules`}>
      <div className="grid gap-3 sm:grid-cols-2">
        {modules.map((module, index) => (
          <article key={`${module.code ?? index}-${module.name}`} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2">
              {module.code && <span className="font-mono text-xs text-muted-foreground">{module.code}</span>}
              <h3 className="font-medium">{module.name || `Module ${index + 1}`}</h3>
            </div>
            {module.description && <p className="mt-2 text-sm text-muted-foreground">{module.description}</p>}
            <p className="mt-2 text-xs text-muted-foreground">
              {[module.category, module.level, module.estimatedDurationWeeks ? `${module.estimatedDurationWeeks} weeks` : null, module.technologyStack]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </article>
        ))}
      </div>
    </SectionCard>
  );
}

function Resources({ resources }: { resources: ResourceOutput[] | null }) {
  if (!resources?.length) return null;

  return (
    <SectionCard icon={<ExternalLink className="size-4" />} title="Resources" description={`${resources.length} references`}>
      <ul className="space-y-3">
        {resources.map((resource, index) => {
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
            <li key={`${resource.orderIndex ?? index}-${resource.url}`} className="min-w-0">
              {href ? (
                <a href={href} target="_blank" rel="noreferrer" className="break-all font-medium text-primary hover:underline">
                  {resource.title || resource.url || `Resource ${index + 1}`}
                </a>
              ) : (
                <span className="break-all font-medium">{resource.title || resource.url || `Resource ${index + 1}`}</span>
              )}
              {resource.description && <p className="mt-1 text-sm text-muted-foreground">{resource.description}</p>}
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

export function AiTemplateResult({ output }: { output: GeneratedTemplateOutput }) {
  return (
    <div className="grid min-w-0 gap-4">
      <ProjectOverview project={output.projectTemplate} />
      <TeamConstraints constraints={output.teamConstraints} />
      <Milestones milestones={output.milestones} />
      <Backlog items={output.backlogItems} />
      <Modules modules={output.modules} />
      <Resources resources={output.resources} />
    </div>
  );
}
