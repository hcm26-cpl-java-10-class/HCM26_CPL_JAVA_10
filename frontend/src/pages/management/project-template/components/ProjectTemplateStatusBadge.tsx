import { Badge } from "@/components/ui/badge";
import type { ProjectTemplateStatus } from "@/types/features/project-template";
import { templateStatusOptions } from "../project-template.utils";

const statusTone: Record<ProjectTemplateStatus, string> = {
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  DRAFT: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  ARCHIVED: "border-border bg-muted text-muted-foreground",
};

export function ProjectTemplateStatusBadge({ status }: { status: ProjectTemplateStatus }) {
  return (
    <Badge variant="outline" className={statusTone[status]}>
      {templateStatusOptions.find((option) => option.value === status)?.label ?? status}
    </Badge>
  );
}
