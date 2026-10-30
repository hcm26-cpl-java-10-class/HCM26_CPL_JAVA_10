import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { EntityCardRendererProps } from "@/types";
import type { ProjectTemplateListItem } from "@/types/features/project-template";
import { ArrowRight, CalendarDays } from "lucide-react";
import { templateLevelLabel } from "../project-template.utils";
import { ProjectTemplateStatusBadge } from "./ProjectTemplateStatusBadge";

export function ProjectTemplateCard({ row, onView, renderRowActions }: EntityCardRendererProps) {
  const template = row as ProjectTemplateListItem;
  return (
    <Card className="h-full min-w-0">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ProjectTemplateStatusBadge status={template.status} />
            <Badge variant="outline">{template.versionLabel ?? `v${template.templateVersion}.0`}</Badge>
          </div>
          <div className="flex gap-1">{renderRowActions?.(template)}</div>
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{template.code}</p>
          <CardTitle className="mt-1 line-clamp-2 break-words text-base">{template.name}</CardTitle>
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
