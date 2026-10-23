import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { MilestoneApiError } from "@/types";
import { AlertCircle, ArrowLeft, Clipboard, Flag, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

export function MilestoneListSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6" aria-label="Loading milestones">
      <Card>
        <CardHeader className="gap-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-8 w-72 max-w-full" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </CardHeader>
      </Card>
      <Card className="overflow-hidden">
        <CardContent className="grid gap-3 p-4">
          {[1, 2, 3, 4, 5].map((item) => <Skeleton key={item} className="h-16 w-full" />)}
        </CardContent>
      </Card>
    </div>
  );
}

interface MilestoneEmptyStateProps {
  canCreate: boolean;
  projectActive: boolean;
  createUrl: string;
}

export function MilestoneEmptyState({ canCreate, projectActive, createUrl }: MilestoneEmptyStateProps) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="rounded-full bg-primary/10 p-4 text-primary"><Flag className="size-8" /></div>
      <h2 className="mt-5 text-xl font-semibold">No milestones yet</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {canCreate && projectActive
          ? "Create the first milestone to define a delivery deadline and clear acceptance criteria."
          : "Milestones will appear here when a project mentor creates one."}
      </p>
      {canCreate && projectActive ? (
        <Button asChild className="mt-6"><Link to={createUrl}><Plus /> Create the first milestone</Link></Button>
      ) : null}
    </div>
  );
}

interface MilestoneListErrorProps {
  error: MilestoneApiError;
  homeUrl: string;
  onRetry: () => void;
}

export function MilestoneListError({ error, homeUrl, onRetry }: MilestoneListErrorProps) {
  const [copied, setCopied] = useState(false);
  const forbidden = error.status === 403;
  const notFound = error.status === 404;
  const title = forbidden
    ? "Project access is unavailable"
    : notFound
      ? "Project not found"
      : "Could not load milestones";
  const message = forbidden
    ? "You no longer have permission or an active assignment for this project."
    : notFound
      ? "This project could not be found or is no longer available."
      : error.message || "Check your connection and try again.";

  const copyCorrelationId = async () => {
    if (!error.correlationId) return;
    await navigator.clipboard.writeText(error.correlationId);
    setCopied(true);
  };

  return (
    <Alert variant="destructive" className="mx-auto max-w-3xl">
      <AlertCircle />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>{message}</p>
        {error.correlationId ? (
          <button type="button" className="mt-2 inline-flex items-center gap-1 text-xs underline underline-offset-2" onClick={copyCorrelationId}>
            <Clipboard className="size-3" /> {copied ? "Correlation ID copied" : `Correlation ID: ${error.correlationId}`}
          </button>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link to={homeUrl}><ArrowLeft /> Back to Teacher Home</Link></Button>
          {!forbidden && !notFound ? <Button onClick={onRetry}><RefreshCw /> Try again</Button> : null}
        </div>
      </AlertDescription>
    </Alert>
  );
}
