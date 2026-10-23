import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { MilestoneApiError } from "@/types";
import { AlertCircle, Copy } from "lucide-react";
import { toast } from "sonner";

interface MilestoneErrorSummaryProps {
  error: MilestoneApiError;
  networkUncertain?: boolean;
}

export function MilestoneErrorSummary({ error, networkUncertain }: MilestoneErrorSummaryProps) {
  const fieldErrorCount = Object.values(error.errors ?? {}).reduce(
    (count, messages) => count + messages.length,
    0,
  );

  const copyCorrelationId = async () => {
    if (!error.correlationId) return;
    await navigator.clipboard.writeText(error.correlationId);
    toast.success("Correlation ID copied.");
  };

  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>{networkUncertain ? "The create result is still unknown" : "Could not create milestone"}</AlertTitle>
      <AlertDescription>
        <p>
          {networkUncertain
            ? "The connection was interrupted. You can retry safely; the same request key will be used to prevent duplicates."
            : error.message || "Please review the form and try again."}
        </p>
        {fieldErrorCount > 0 ? <p>{fieldErrorCount} field error(s) require your attention.</p> : null}
        {error.correlationId ? (
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <span>Correlation ID: {error.correlationId}</span>
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={copyCorrelationId}>
              <Copy className="size-3.5" /> Copy
            </Button>
          </div>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
