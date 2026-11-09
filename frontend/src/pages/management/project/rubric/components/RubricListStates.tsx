import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import axios from "axios";
import { AlertCircle, FileCheck2, Plus, RefreshCw, SearchX } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";

interface RubricEmptyStateProps {
  filtered: boolean;
  canCreate: boolean;
  onClear: () => void;
}

export function RubricEmptyState({ filtered, canCreate, onClear }: RubricEmptyStateProps) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="rounded-full bg-primary/10 p-4 text-primary">
        {filtered ? <SearchX className="size-8" /> : <FileCheck2 className="size-8" />}
      </div>
      <h2 className="mt-5 text-xl font-semibold">
        {filtered ? "No matching rubrics" : "No rubrics yet"}
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {filtered
          ? "Try another search term or clear the active status filter."
          : "Create a draft rubric, add its criteria, then publish it for milestone use."}
      </p>
      {filtered ? (
        <Button type="button" variant="outline" className="mt-6" onClick={onClear}>
          <RefreshCw /> Clear search and filters
        </Button>
      ) : canCreate ? (
        <Button asChild className="mt-6">
          <Link to="/rubrics/new"><Plus /> Create the first rubric</Link>
        </Button>
      ) : null}
    </div>
  );
}

interface RubricListErrorProps {
  error: unknown;
  onRetry: () => void;
}

export function RubricListError({ error, onRetry }: RubricListErrorProps) {
  const details = useMemo(() => {
    if (!axios.isAxiosError(error)) {
      return { title: "Could not load rubrics", message: "Check your connection and try again.", retry: true };
    }
    const status = error.response?.status;
    if (status === 403) {
      return {
        title: "Rubric access is unavailable",
        message: "You no longer have permission to view rubrics.",
        retry: false,
      };
    }
    return {
      title: "Could not load rubrics",
      message: error.response?.data?.message || error.message || "Check your connection and try again.",
      retry: true,
    };
  }, [error]);

  return (
    <div className="w-full p-5">
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>{details.title}</AlertTitle>
        <AlertDescription>
          <p>{details.message}</p>
          {details.retry ? (
            <Button className="mt-3" variant="outline" onClick={onRetry}>
              <RefreshCw /> Try again
            </Button>
          ) : null}
        </AlertDescription>
      </Alert>
    </div>
  );
}
