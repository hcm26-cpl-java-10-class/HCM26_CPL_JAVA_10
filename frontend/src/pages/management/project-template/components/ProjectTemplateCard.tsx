import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { EntityCardRendererProps } from "@/types";
import type { ProjectTemplateListItem } from "@/types/features/project-template";
import { ArrowRight, CalendarDays, GitBranch, LayoutTemplate } from "lucide-react";
import { templateLevelLabel } from "../project-template.utils";
import { ProjectTemplateStatusBadge } from "./ProjectTemplateStatusBadge";

export function ProjectTemplateCard({ row, onView, renderRowActions }: EntityCardRendererProps) {
  const template = row as ProjectTemplateListItem;
  const Icon = template.parentTemplateId == null ? LayoutTemplate : GitBranch;
  return (
    <Card className="group h-full min-w-0 overflow-hidden py-0 pb-5 transition-shadow hover:shadow-md">
      <CardHeader className="gap-3 border-b bg-gradient-to-r from-indigo-50 via-background to-sky-50/60 py-4 dark:from-indigo-950/50 dark:to-sky-950/20">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {template.parentTemplateId != null && <Badge variant="secondary">Module</Badge>}
            <ProjectTemplateStatusBadge status={template.status} />
            <Badge variant="outline">{template.versionLabel ?? `v${template.templateVersion}.0`}</Badge>
          </div>
          <div className="flex gap-1">{renderRowActions?.(template)}</div>
        </div>
        <div className="flex items-start gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-200">
            <Icon className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate font-mono text-xs text-muted-foreground">{template.code}</p>
            <CardTitle className="mt-1 line-clamp-2 break-words text-base">{template.name}</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm">
        <p className="line-clamp-3 break-words text-muted-foreground">{template.description}</p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="max-w-full"><span className="truncate">{template.category}</span></Badge>
          <Badge variant="outline">{templateLevelLabel(template.level)}</Badge>
        </div>
        <p className="flex items-center gap-2 text-muted-foreground">
          <CalendarDays className="size-4" /> {template.estimatedDurationWeeks} weeks
        </p>
      </CardContent>
      <CardFooter className="mt-auto">
        <Button variant="outline" className="w-full justify-between" onClick={() => onView(template)}>
          View details <ArrowRight className="size-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
