import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2 } from "lucide-react";
import { getTemplateError } from "../project-template.utils";

export function ProjectTemplateLoading() {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
      <Loader2 className="size-5 animate-spin" /> Loading project templates...
    </div>
  );
}

export function ProjectTemplateError({ error, denied, onRetry }: {
  error?: unknown;
  denied?: boolean;
  onRetry?: () => void;
}) {
  const result = getTemplateError(error);
  const forbidden = denied || result.status === 403;
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>{forbidden ? "Access denied" : "Unable to load project templates"}</AlertTitle>
      <AlertDescription>
        <p>{forbidden ? "You need Program Manager or Admin access within a valid tenant scope." : result.message}</p>
        {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>}
      </AlertDescription>
    </Alert>
  );
}
