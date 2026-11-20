import { aiTemplateReviewApi } from "@/api/features/ai-template-review.api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MainLayout } from "@/components/layout/MainLayout";
import type {
  AIReviewFinding,
  AIReviewFindingSeverity,
  AIReviewFindingStatus,
  AIReviewSuggestion,
} from "@/types/features/ai-template-review";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleX,
  Clock3,
  FileSearch,
  Loader2,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

type ApiErrorBody = { message?: unknown; error?: unknown; errors?: unknown };

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    const body = error.response?.data;
    if (body && typeof body === "object") {
      if (typeof body.message === "string" && body.message.trim()) return body.message;
      if (typeof body.error === "string" && body.error.trim()) return body.error;
      if (body.errors && typeof body.errors === "object") {
        const messages = Object.values(body.errors as Record<string, unknown>)
          .flatMap(value => Array.isArray(value) ? value : [value])
          .filter((value): value is string => typeof value === "string");
        if (messages.length) return messages.join(" ");
      }
    }
    return error.message || "The request could not be completed.";
  }
  return error instanceof Error ? error.message : "The request could not be completed.";
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

const severityStyles: Record<AIReviewFindingSeverity, string> = {
  CRITICAL: "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200",
  HIGH: "border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-200",
  MEDIUM: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  LOW: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200",
};

const statusStyles: Record<AIReviewFindingStatus, string> = {
  OPEN: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  ACCEPTED: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
  DISMISSED: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  RESOLVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
};

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

function SuggestionCard({
  templateId,
  reportId,
  finding,
  suggestion,
}: {
  templateId: number;
  reportId: number;
  finding: AIReviewFinding;
  suggestion: AIReviewSuggestion;
}) {
  const queryClient = useQueryClient();
  const [rejectReason, setRejectReason] = useState("");
  const suggestionKey = ["ai-template-review", templateId, reportId, finding.findingId, "suggestions"];
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: suggestionKey });
    await queryClient.invalidateQueries({ queryKey: ["ai-template-review", templateId, reportId] });
  };
  const approve = useMutation({
    mutationFn: () => aiTemplateReviewApi.approveSuggestion(
      templateId, reportId, finding.findingId, suggestion.suggestionId,
    ),
    onSuccess: async () => { toast.success("Suggestion approved."); await invalidate(); },
    onError: error => toast.error(getErrorMessage(error)),
  });
  const reject = useMutation({
    mutationFn: () => aiTemplateReviewApi.rejectSuggestion(
      templateId, reportId, finding.findingId, suggestion.suggestionId, rejectReason.trim(),
    ),
    onSuccess: async () => { toast.success("Suggestion rejected."); setRejectReason(""); await invalidate(); },
    onError: error => toast.error(getErrorMessage(error)),
  });
  const apply = useMutation({
    mutationFn: () => aiTemplateReviewApi.applySuggestion(
      templateId, reportId, finding.findingId, suggestion.suggestionId,
    ),
    onSuccess: async result => {
      if (!result.snapshot) {
        toast.error(result.suggestion.validationErrors.join(" ") || "This suggestion could not be applied.");
      } else {
        toast.success("Suggestion applied to a new draft snapshot.");
        await queryClient.invalidateQueries({ queryKey: ["project-templates"] });
        await queryClient.invalidateQueries({ queryKey: ["project-template-versions"] });
      }
      await invalidate();
    },
    onError: async error => {
      const response = axios.isAxiosError<{ suggestion?: AIReviewSuggestion }>(error)
        ? error.response?.data
        : undefined;
      if (response?.suggestion) {
        await queryClient.setQueryData<AIReviewSuggestion[]>(suggestionKey, current =>
          current?.map(item => item.suggestionId === response.suggestion?.suggestionId
            ? response.suggestion : item),
        );
        await invalidate();
        toast.error(response.suggestion.validationErrors.join(" ") || getErrorMessage(error));
        return;
      }
      toast.error(getErrorMessage(error));
    },
  });
  const regenerate = useMutation({
    mutationFn: () => aiTemplateReviewApi.regenerateSuggestion(
      templateId, reportId, finding.findingId, suggestion.suggestionId,
    ),
    onSuccess: async created => {
      if (created.status === "INVALID") {
        toast.error(created.validationErrors.join(" ") || "The generated suggestion did not pass validation.");
      } else {
        toast.success("A new suggestion was generated.");
      }
      await invalidate();
    },
    onError: error => toast.error(getErrorMessage(error)),
  });
  const busy = approve.isPending || reject.isPending || apply.isPending || regenerate.isPending;
  const canRegenerate = finding.status === "OPEN" || finding.status === "ACCEPTED";

  return (
    <article className="rounded-lg border bg-background p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Suggestion #{suggestion.suggestionId}</Badge>
          <Badge variant="secondary">{statusLabel(suggestion.status)}</Badge>
          <span className="text-xs text-muted-foreground">{formatDate(suggestion.createdAt)}</span>
        </div>
        {suggestion.sourceSnapshotId > 0 && (
          <span className="text-xs text-muted-foreground">Source snapshot #{suggestion.sourceSnapshotId}</span>
        )}
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{suggestion.rationale}</p>
      <details className="mt-3 rounded-md border bg-muted/30">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Proposed changes</summary>
        <pre className="max-h-80 overflow-auto border-t p-3 text-xs leading-5">{JSON.stringify(suggestion.changes, null, 2)}</pre>
      </details>
      {suggestion.validationErrors.length > 0 && (
        <Alert variant="destructive" className="mt-3">
          <AlertCircle />
          <AlertTitle>Suggestion needs attention</AlertTitle>
          <AlertDescription>
            <ul className="list-inside list-disc">{suggestion.validationErrors.map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}</ul>
          </AlertDescription>
        </Alert>
      )}
      {suggestion.rejectionReason && (
        <p className="mt-3 rounded-md bg-muted px-3 py-2 text-sm"><strong>Rejection reason:</strong> {suggestion.rejectionReason}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {suggestion.status === "PENDING" && (
          <>
            <Button size="sm" onClick={() => approve.mutate()} disabled={busy}>
              {approve.isPending ? <Loader2 className="animate-spin" /> : <ThumbsUp />} Approve
            </Button>
            <div className="flex min-w-[min(100%,22rem)] flex-1 items-end gap-2">
              <div className="min-w-0 flex-1">
                <Label className="sr-only" htmlFor={`reject-${suggestion.suggestionId}`}>Rejection reason</Label>
                <Input
                  id={`reject-${suggestion.suggestionId}`}
                  value={rejectReason}
                  onChange={event => setRejectReason(event.target.value)}
                  maxLength={2000}
                  placeholder="Reason for rejecting"
                  disabled={busy}
                />
              </div>
              <Button size="sm" variant="outline" onClick={() => reject.mutate()}
                disabled={busy || !rejectReason.trim()}>
                {reject.isPending ? <Loader2 className="animate-spin" /> : <ThumbsDown />} Reject
              </Button>
            </div>
          </>
        )}
        {suggestion.status === "APPROVED" && (
          <Button size="sm" onClick={() => apply.mutate()} disabled={busy}>
            {apply.isPending ? <Loader2 className="animate-spin" /> : <Check />} Apply to new draft
          </Button>
        )}
        {canRegenerate && (
          <Button size="sm" variant="outline" onClick={() => regenerate.mutate()} disabled={busy}>
            {regenerate.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />} Regenerate
          </Button>
        )}
        {suggestion.status === "APPLIED" && suggestion.appliedSnapshotId != null && (
          <>
            <Badge className="gap-1 bg-emerald-600"><CheckCircle2 />Applied to snapshot #{suggestion.appliedSnapshotId}</Badge>
            <Button asChild size="sm" variant="outline">
              <Link to={`/project-templates/${templateId}/detail?tab=versions&version=${suggestion.appliedSnapshotId}`}>
                Open draft snapshot
              </Link>
            </Button>
          </>
        )}
        {suggestion.status === "INVALID" && (
          <Badge variant="destructive" className="gap-1"><CircleX />Invalid and cannot be changed</Badge>
        )}
      </div>
    </article>
  );
}

function FindingCard({
  templateId,
  reportId,
  finding,
}: {
  templateId: number;
  reportId: number;
  finding: AIReviewFinding;
}) {
  const queryClient = useQueryClient();
  const [dismissReason, setDismissReason] = useState("");
  const reportKey = ["ai-template-review", templateId, reportId];
  const suggestionKey = [...reportKey, finding.findingId, "suggestions"];
  const suggestions = useQuery({
    queryKey: suggestionKey,
    queryFn: ({ signal }) => aiTemplateReviewApi.getSuggestions(
      templateId, reportId, finding.findingId, signal,
    ),
  });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: reportKey });
  };
  const accept = useMutation({
    mutationFn: () => aiTemplateReviewApi.acceptFinding(templateId, reportId, finding.findingId),
    onSuccess: async () => { toast.success("Finding accepted."); await refresh(); },
    onError: error => toast.error(getErrorMessage(error)),
  });
  const dismiss = useMutation({
    mutationFn: () => aiTemplateReviewApi.dismissFinding(
      templateId, reportId, finding.findingId, dismissReason.trim(),
    ),
    onSuccess: async () => { toast.success("Finding dismissed."); setDismissReason(""); await refresh(); },
    onError: error => toast.error(getErrorMessage(error)),
  });
  const resolve = useMutation({
    mutationFn: () => aiTemplateReviewApi.resolveFinding(templateId, reportId, finding.findingId),
    onSuccess: async () => { toast.success("Finding marked as resolved."); await refresh(); },
    onError: error => toast.error(getErrorMessage(error)),
  });
  const generate = useMutation({
    mutationFn: () => aiTemplateReviewApi.createSuggestion(templateId, reportId, finding.findingId),
    onSuccess: async suggestion => {
      if (suggestion.status === "INVALID") {
        toast.error(suggestion.validationErrors.join(" ") || "The generated suggestion did not pass validation.");
      } else {
        toast.success("Suggestion generated.");
      }
      await queryClient.invalidateQueries({ queryKey: suggestionKey });
    },
    onError: error => toast.error(getErrorMessage(error)),
  });
  const findingBusy = accept.isPending || dismiss.isPending || resolve.isPending;
  const canSuggest = finding.status === "OPEN" || finding.status === "ACCEPTED";

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-3 border-b bg-muted/20 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge className={severityStyles[finding.severity]}>{finding.severity}</Badge>
              <Badge variant="secondary">{finding.category.replaceAll("_", " ")}</Badge>
              <Badge className={statusStyles[finding.status]}>{statusLabel(finding.status)}</Badge>
            </div>
            <CardTitle className="text-base leading-6">{finding.title}</CardTitle>
          </div>
          <span className="text-xs text-muted-foreground">Finding #{finding.findingId}</span>
        </div>
        <CardDescription className="whitespace-pre-wrap text-sm leading-6 text-foreground/80">
          {finding.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 p-4">
        {finding.recommendation && (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-3 dark:border-indigo-900 dark:bg-indigo-950/30">
            <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-indigo-600" />AI recommendation</h3>
            <p className="whitespace-pre-wrap text-sm leading-6">{finding.recommendation}</p>
          </div>
        )}
        {(finding.targetType || finding.targetId) && (
          <p className="text-xs text-muted-foreground">
            Target: <span className="font-medium text-foreground">{finding.targetType ?? "Unknown"}</span>
            {finding.targetId ? ` · ${finding.targetId}` : ""}
          </p>
        )}
        {finding.status === "OPEN" && (
          <div className="flex flex-wrap items-end gap-2">
            <Button size="sm" onClick={() => accept.mutate()} disabled={findingBusy}>
              {accept.isPending ? <Loader2 className="animate-spin" /> : <ThumbsUp />} Accept
            </Button>
            <div className="flex min-w-[min(100%,24rem)] flex-1 items-end gap-2">
              <div className="min-w-0 flex-1">
                <Label className="sr-only" htmlFor={`dismiss-${finding.findingId}`}>Dismiss reason</Label>
                <Input
                  id={`dismiss-${finding.findingId}`}
                  value={dismissReason}
                  onChange={event => setDismissReason(event.target.value)}
                  maxLength={2000}
                  placeholder="Reason for dismissing"
                  disabled={findingBusy}
                />
              </div>
              <Button size="sm" variant="outline" onClick={() => dismiss.mutate()}
                disabled={findingBusy || !dismissReason.trim()}>
                {dismiss.isPending ? <Loader2 className="animate-spin" /> : <ThumbsDown />} Dismiss
              </Button>
            </div>
          </div>
        )}
        {finding.status === "ACCEPTED" && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => resolve.mutate()} disabled={findingBusy}>
              {resolve.isPending ? <Loader2 className="animate-spin" /> : <Check />} Mark resolved
            </Button>
          </div>
        )}

        <section className="grid gap-3 border-t pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><Bot className="size-4 text-indigo-600" />Suggestions</h3>
            <Button size="sm" variant="outline" onClick={() => generate.mutate()}
              disabled={!canSuggest || generate.isPending}>
              {generate.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {generate.isPending ? "Generating..." : suggestions.data?.length ? "Generate another" : "Generate suggestion"}
            </Button>
          </div>
          {suggestions.isPending ? (
            <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground" role="status">
              <Loader2 className="size-4 animate-spin" />Loading suggestions…
            </div>
          ) : suggestions.isError ? (
            <Alert variant="destructive">
              <AlertCircle /><AlertDescription>{getErrorMessage(suggestions.error)}</AlertDescription>
            </Alert>
          ) : suggestions.data?.length ? (
            <div className="grid gap-3">
              {suggestions.data.map(suggestion => (
                <SuggestionCard key={suggestion.suggestionId} templateId={templateId}
                  reportId={reportId} finding={finding} suggestion={suggestion} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No suggestions have been generated for this Finding yet.</p>
          )}
        </section>
      </CardContent>
    </Card>
  );
}

function HistoryList({ templateId }: { templateId: number }) {
  const reports = useQuery({
    queryKey: ["ai-template-review", templateId, "reports"],
    queryFn: ({ signal }) => aiTemplateReviewApi.getReports(templateId, signal),
  });

  if (reports.isPending) {
    return <Card><CardContent className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />Loading review history…
    </CardContent></Card>;
  }
  if (reports.isError) {
    return <Alert variant="destructive"><AlertCircle /><AlertTitle>Could not load review history</AlertTitle>
      <AlertDescription>{getErrorMessage(reports.error)}</AlertDescription></Alert>;
  }
  if (!reports.data.length) {
    return <Card><CardContent className="grid justify-items-center gap-2 py-12 text-center">
      <FileSearch className="size-9 text-muted-foreground" />
      <h2 className="font-semibold">No AI reviews yet</h2>
      <p className="max-w-lg text-sm text-muted-foreground">Start a review from the project template details page. Each report remains linked to the snapshot that was reviewed.</p>
      <Button asChild variant="outline" className="mt-2"><Link to={`/project-templates/${templateId}/detail`}>Open template</Link></Button>
    </CardContent></Card>;
  }
  return <div className="grid gap-3">
    {reports.data.map(report => (
      <Link key={report.reportId} to={`/project-templates/${templateId}/reviews/${report.reportId}`}
        className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Card className="transition-colors hover:border-indigo-300 dark:hover:border-indigo-800">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">Review #{report.reportId}</span>
                <Badge variant={report.status === "STALE" ? "destructive" : "secondary"}>{report.status}</Badge>
                <Badge variant="outline">Snapshot #{report.snapshotId}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{formatDate(report.createdAt)}</p>
              {report.summary && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{report.summary}</p>}
            </div>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
          </CardContent>
        </Card>
      </Link>
    ))}
  </div>;
}

export default function ProjectTemplateReviewPage() {
  const { templateId: templateIdParam, reportId: reportIdParam } = useParams();
  const templateId = Number(templateIdParam);
  const reportId = reportIdParam ? Number(reportIdParam) : undefined;
  const navigate = useNavigate();
  const validTemplateId = Number.isSafeInteger(templateId) && templateId > 0;
  const report = useQuery({
    queryKey: ["ai-template-review", templateId, reportId],
    queryFn: ({ signal }) => aiTemplateReviewApi.getReport(templateId, reportId!, signal),
    enabled: validTemplateId && Number.isSafeInteger(reportId) && (reportId ?? 0) > 0,
    retry: false,
  });
  const findings = report.data?.findings ?? [];
  const countByStatus = (status: AIReviewFindingStatus) =>
    findings.filter(finding => finding.status === status).length;
  const title = report.data ? `AI Review #${report.data.reportId}` : "AI Project Template Review";

  return (
    <MainLayout pathName={{
      "project-templates": "Project Templates",
      [String(templateId)]: "Template",
      reviews: reportId ? title : "AI Review History",
    }}>
      <section className="mx-auto grid min-w-0 w-full max-w-6xl gap-5 pb-6">
        <header className="flex flex-col justify-between gap-3 rounded-xl border border-indigo-200/70 bg-gradient-to-r from-indigo-50 via-background to-sky-50/70 p-4 dark:border-indigo-900/60 dark:from-indigo-950/30 dark:to-sky-950/20 sm:flex-row sm:items-center sm:p-5">
          <div className="min-w-0">
            <Badge className="mb-2 gap-1.5 border-indigo-200 bg-indigo-100 text-indigo-800 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">
              <Bot className="size-3.5" /> AI Template Review
            </Badge>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Review findings are tied to the exact template snapshot analyzed by AI. Accepted findings can be turned into suggestions and applied as a new draft version.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(`/project-templates/${templateId}/detail`)}>
              <ArrowLeft /> Template
            </Button>
            {reportId && <Button variant="outline" size="sm" onClick={() => navigate(`/project-templates/${templateId}/reviews`)}>
              Review history
            </Button>}
          </div>
        </header>

        {!validTemplateId ? (
          <Alert variant="destructive"><AlertCircle /><AlertTitle>Invalid template</AlertTitle>
            <AlertDescription>The template identifier in this URL is invalid.</AlertDescription></Alert>
        ) : !reportId ? (
          <HistoryList templateId={templateId} />
        ) : report.isPending ? (
          <Card role="status" aria-label="Loading AI review report">
            <CardContent className="grid justify-items-center gap-4 py-14 text-center">
              <Loader2 className="size-9 animate-spin text-indigo-600" />
              <div><h2 className="font-semibold">Loading review report</h2><p className="mt-1 text-sm text-muted-foreground">Fetching findings and report details…</p></div>
            </CardContent>
          </Card>
        ) : report.isError ? (
          <Alert variant="destructive"><AlertCircle /><AlertTitle>Could not load this review</AlertTitle>
            <AlertDescription>{getErrorMessage(report.error)}</AlertDescription></Alert>
        ) : report.data ? (
          <>
            <Card className={report.data.status === "STALE"
              ? "border-amber-300 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20"
              : "border-indigo-200 dark:border-indigo-900"}>
              <CardContent className="grid gap-4 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={report.data.status === "STALE" ? "destructive" : "secondary"}>{report.data.status}</Badge>
                    <Badge variant="outline">Snapshot #{report.data.snapshotId}</Badge>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="size-3.5" />{formatDate(report.data.createdAt)}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/project-templates/${templateId}/detail?tab=versions&version=${report.data?.snapshotId}`)}>
                    View reviewed version
                  </Button>
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Review summary</h2>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                    {report.data.summary || "No summary was provided for this review."}
                  </p>
                </div>
                {report.data.status === "STALE" && (
                  <Alert>
                    <AlertCircle /><AlertTitle>This report is based on an older snapshot</AlertTitle>
                    <AlertDescription>Suggestions from this report cannot be safely applied to a newer template version. Run a fresh AI review from the current template.</AlertDescription>
                  </Alert>
                )}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {([
                    ["Total findings", findings.length, "bg-muted"],
                    ["Open", countByStatus("OPEN"), "bg-slate-100 dark:bg-slate-800"],
                    ["Accepted", countByStatus("ACCEPTED"), "bg-indigo-100 dark:bg-indigo-950"],
                      ["Dismissed", countByStatus("DISMISSED"), "bg-zinc-100 dark:bg-zinc-900"],
                      ["Resolved", countByStatus("RESOLVED"), "bg-emerald-100 dark:bg-emerald-950"],
                    ] as const).map(([label, count, className]) => (
                      <div key={label} className={`rounded-lg p-3 ${className}`}>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="mt-1 text-xl font-semibold tabular-nums">{count}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><h2 className="text-lg font-semibold">Findings</h2><p className="text-sm text-muted-foreground">Accept or dismiss each issue, then generate an actionable suggestion when appropriate.</p></div>
              <Badge variant="outline">{findings.length} total</Badge>
            </div>
            {findings.length ? (
              <div className="grid gap-4">
                {findings.map(finding => (
                  <FindingCard key={finding.findingId} templateId={templateId}
                    reportId={report.data!.reportId} finding={finding} />
                ))}
              </div>
            ) : (
              <Card><CardContent className="grid justify-items-center gap-2 py-12 text-center">
                <CheckCircle2 className="size-9 text-emerald-600" />
                <h3 className="font-semibold">No findings in this report</h3>
                <p className="text-sm text-muted-foreground">The reviewed template has no recorded improvement findings.</p>
              </CardContent></Card>
            )}
          </>
        ) : null}
      </section>
    </MainLayout>
  );
}
