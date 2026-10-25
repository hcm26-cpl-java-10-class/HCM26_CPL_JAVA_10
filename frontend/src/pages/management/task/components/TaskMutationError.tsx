import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";
import type { TaskRequestError } from "../task-form.utils";

export function TaskMutationError({
  error,
  onReload,
}: {
  error: TaskRequestError | null;
  onReload?: () => void;
}) {
  if (!error) return null;
  const details = [...new Set(Object.values(error.fieldErrors).flat())].filter(
    (message) => message !== error.message,
  );
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>
        {error.status === 409 ? "Data has changed" : "Unable to complete this action"}
      </AlertTitle>
      <AlertDescription>
        <p>{error.message}</p>
        {details.map((message) => (
          <p key={message}>{message}</p>
        ))}
        {error.status === 409 && onReload && (
          <Button type="button" size="sm" variant="outline" onClick={onReload}>
            <RefreshCw className="size-4" /> Reload data
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
