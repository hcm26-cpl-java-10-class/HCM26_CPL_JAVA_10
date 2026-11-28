import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { MilestoneApiError } from "@/types";
import { AlertCircle, ArrowLeft, Clipboard, RefreshCw } from "lucide-react";
import { useState } from "react";

interface MilestoneDetailErrorProps {
  error: MilestoneApiError;
  onBack: () => void;
  onRetry: () => void;
}

export function MilestoneDetailError({ error, onBack, onRetry }: MilestoneDetailErrorProps) {
  const [copied, setCopied] = useState(false);
  const forbidden = error.status === 403;
  const notFound = error.status === 404;
  const title = forbidden ? "Milestone access is unavailable" : notFound ? "Milestone not found" : "Could not load milestone details";
  const message = forbidden
    ? "You no longer have permission or an active assignment for this project."
    : notFound
      ? "This milestone does not exist in the selected project."
      : error.message || "Check your connection and try again.";

  const copyCorrelationId = async () => {
    if (!error.correlationId) return;
    try {
      await navigator.clipboard.writeText(error.correlationId);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Alert variant="destructive" className="mx-auto max-w-3xl">
      <AlertCircle /><AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>{message}</p>
        {error.correlationId ? <button type="button" className="mt-2 inline-flex items-center gap-1 text-xs underline underline-offset-2" onClick={copyCorrelationId}><Clipboard className="size-3" /> {copied ? "Correlation ID copied" : `Correlation ID: ${error.correlationId}`}</button> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={onBack}><ArrowLeft /> Back to milestones</Button>
          {!forbidden && !notFound ? <Button onClick={onRetry}><RefreshCw /> Try again</Button> : null}
        </div>
      </AlertDescription>
    </Alert>
  );
}
