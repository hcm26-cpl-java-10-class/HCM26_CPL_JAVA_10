import { Badge } from "@/components/ui/badge";
import type { ProjectTemplateStatus } from "@/types/features/project-template";
import { templateStatusOptions } from "../project-template.utils";

export function ProjectTemplateStatusBadge({ status }: { status: ProjectTemplateStatus }) {
  return (
    <Badge variant={status === "ACTIVE" ? "default" : status === "DRAFT" ? "secondary" : "outline"}>
      {templateStatusOptions.find((option) => option.value === status)?.label ?? status}
    </Badge>
  );
}
