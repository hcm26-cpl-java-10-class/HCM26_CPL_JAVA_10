import { aiAssistantApi } from "@/api/features/ai-assistant.api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MainLayout } from "@/components/layout/MainLayout";
import type { AiSuggestionListItem, AiSuggestionStatus } from "@/types/features/ai-assistant";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

type StatusFilter = AiSuggestionStatus | "ALL";
type BulkAction = "approve" | "reject";

const filters: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "APPLIED", label: "Applied" },
];

const statusStyles: Record<AiSuggestionStatus, string> = {
  PENDING: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
  APPROVED: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  REJECTED: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200",
  APPLIED: "border-indigo-300 bg-indigo-50 text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-200",
};
const PAGE_SIZE = 8;

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function SuggestionCard({
  suggestion,
  selected,
  onSelect,
}: {
  suggestion: AiSuggestionListItem;
  selected: boolean;
  onSelect: (checked: boolean) => void;
}) {
  const pending = suggestion.status === "PENDING";

  return (
    <article className="group flex min-w-0 items-start gap-3 rounded-xl border border-slate-200 bg-card p-3.5 shadow-sm transition-all hover:border-indigo-200 hover:shadow-md dark:border-slate-800 dark:hover:border-indigo-900 sm:p-4">
      {pending ? (
        <Checkbox
          aria-label={`Select suggestion ${suggestion.projectTitle}`}
          checked={selected}
          onCheckedChange={(checked) => onSelect(checked === true)}
          className="mt-1"
        />
      ) : <span className="mt-1 size-4 shrink-0" aria-hidden="true" />}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/ai-assistant/suggestions/${suggestion.suggestionId}`}
            className="min-w-0 break-words font-semibold text-slate-900 transition-colors group-hover:text-indigo-700 hover:underline dark:text-slate-100 dark:group-hover:text-indigo-300"
          >
            {suggestion.projectTitle}
          </Link>
          <Badge variant="outline" className={statusStyles[suggestion.status]}>{suggestion.status}</Badge>
        </div>
        <p className="mt-1 text-sm font-medium text-sky-800 dark:text-sky-300">{suggestion.projectType}</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Clock3 className="size-3.5 text-indigo-500" />{formatDate(suggestion.createdAt)}</span>
          {suggestion.model && <span>Model: <span className="font-medium text-slate-700 dark:text-slate-300">{suggestion.model}</span></span>}
          <span className="font-mono font-medium text-indigo-700 dark:text-indigo-300">ID: {suggestion.suggestionId}</span>
        </div>
      </div>
      <Button asChild size="sm" variant="outline" className="shrink-0 border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950">
        <Link to={`/ai-assistant/suggestions/${suggestion.suggestionId}`}>Review</Link>
      </Button>
    </article>
  );
}

export default function AiSuggestionWorkspacePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [bulkError, setBulkError] = useState("");
  const suggestionsQuery = useQuery({
    queryKey: ["ai-assistant", "suggestions"],
    queryFn: () => aiAssistantApi.getSuggestions(),
    retry: false,
  });

  const suggestions = useMemo(() => suggestionsQuery.data ?? [], [suggestionsQuery.data]);
  const pendingSuggestions = suggestions.filter((item) => item.status === "PENDING");
  const visibleSuggestions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return suggestions.filter((item) =>
      (status === "ALL" || item.status === status)
      && (!query || `${item.projectTitle} ${item.projectType} ${item.suggestionId}`.toLocaleLowerCase().includes(query)),
    );
  }, [search, status, suggestions]);
  const pageCount = Math.max(1, Math.ceil(visibleSuggestions.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageStart = currentPage * PAGE_SIZE;
  const pageSuggestions = visibleSuggestions.slice(pageStart, pageStart + PAGE_SIZE);

  const bulkMutation = useMutation({
    mutationFn: async ({ ids, action, reason }: { ids: number[]; action: BulkAction; reason?: string }) => {
      const results = await Promise.allSettled(ids.map((id) =>
        action === "approve"
          ? aiAssistantApi.approveSuggestion(id)
          : aiAssistantApi.rejectSuggestion(id, reason ?? ""),
      ));
      return results.reduce(
        (summary, result) => {
          if (result.status === "fulfilled") summary.succeeded += 1;
          else {
            summary.failed += 1;
            if (result.reason instanceof Error && !summary.firstError) summary.firstError = result.reason.message;
          }
          return summary;
        },
        { succeeded: 0, failed: 0, firstError: "" },
      );
    },
    onSuccess: async (summary, variables) => {
      setSelectedIds([]);
      setBulkAction(null);
      setRejectReason("");
      await queryClient.invalidateQueries({ queryKey: ["ai-assistant", "suggestions"] });
      if (summary.failed === 0) {
        toast.success(`${summary.succeeded} suggestion${summary.succeeded === 1 ? "" : "s"} ${variables.action === "approve" ? "accepted" : "rejected"}.`);
        setBulkError("");
      } else {
        const message = `${summary.succeeded} completed; ${summary.failed} failed. ${summary.firstError}`;
        setBulkError(message);
        toast.error(message);
      }
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "The selected suggestions could not be updated.";
      setBulkError(message);
      toast.error(message);
    },
  });

  const pagePendingSuggestions = pageSuggestions.filter((item) => item.status === "PENDING");
  const allVisiblePendingSelected = pagePendingSuggestions.length > 0
    && pagePendingSuggestions.every((item) => selectedIds.includes(item.suggestionId));

  const toggleSelected = (suggestionId: number, checked: boolean) => {
    setSelectedIds((current) => checked
      ? current.includes(suggestionId) ? current : [...current, suggestionId]
      : current.filter((id) => id !== suggestionId));
  };

  const submitBulkAction = () => {
    if (selectedIds.length === 0) return;
    if (bulkAction === "reject" && !rejectReason.trim()) {
      setBulkError("Enter a reason before rejecting selected suggestions.");
      return;
    }
    setBulkError("");
    bulkMutation.mutate({
      ids: selectedIds,
      action: bulkAction ?? "approve",
      reason: rejectReason.trim(),
    });
  };

  return (
    <MainLayout pathName={{ "ai-assistant": "AI Assistant", suggestions: "Suggestions" }}>
      <section className="mx-auto grid w-full max-w-7xl min-w-0 gap-4 pb-6">
        <header className="flex flex-col justify-between gap-4 rounded-xl border border-indigo-200/70 bg-gradient-to-r from-indigo-50 via-background to-sky-50/70 p-4 dark:border-indigo-900/60 dark:from-indigo-950/30 dark:to-sky-950/20 sm:flex-row sm:items-center sm:p-5">
          <div className="min-w-0">
            <Badge className="mb-2 gap-1.5 border-indigo-200 bg-indigo-100 text-indigo-800 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-200"><Bot className="size-3.5" /> AI Suggestion Workspace</Badge>
            <h1 className="text-xl font-semibold tracking-tight text-indigo-950 dark:text-indigo-100 sm:text-2xl">Suggestion workspace</h1>
            <p className="mt-1 text-sm text-muted-foreground">Review generated project templates, edit pending suggestions, and apply approved drafts.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="border-indigo-200 bg-white/80 text-indigo-800 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200 dark:hover:bg-indigo-900/60" onClick={() => navigate("/ai-assistant")}><ArrowLeft className="size-4" />Generator</Button>
            <Button type="button" className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500" onClick={() => navigate("/project-templates")}><Plus className="size-4" />Project templates</Button>
          </div>
        </header>

        <Card className="overflow-hidden border-indigo-200/70 shadow-sm dark:border-indigo-900/60">
          <CardHeader className="gap-4 border-b border-indigo-100 bg-gradient-to-r from-indigo-50/60 to-background sm:flex-row sm:items-center sm:justify-between dark:border-indigo-900/60 dark:from-indigo-950/20">
            <div>
              <CardTitle className="text-indigo-950 dark:text-indigo-100">Generated suggestions</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="font-semibold text-indigo-700 dark:text-indigo-300">{suggestions.length} total</span> · <span className="font-semibold text-amber-700 dark:text-amber-300">{pendingSuggestions.length} awaiting review</span>
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950" disabled={suggestionsQuery.isFetching} onClick={() => void suggestionsQuery.refetch()}>
              <RefreshCw className={`size-4 ${suggestionsQuery.isFetching ? "animate-spin" : ""}`} />Refresh
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4">
            {bulkError && (
              <Alert variant="destructive" role="alert">
                <AlertCircle />
                <AlertTitle>Some review actions need attention</AlertTitle>
                <AlertDescription>{bulkError}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/30 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap gap-1">
                {filters.map((item) => (
                  <Button key={item.value} type="button" size="sm"
                    variant={status === item.value ? "default" : "ghost"}
                    className={status === item.value ? "bg-indigo-600 text-white hover:bg-indigo-700" : "text-slate-600 hover:bg-white hover:text-indigo-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-indigo-300"}
                    onClick={() => { setStatus(item.value); setPage(0); }}>
                    {item.label}{item.value === "PENDING" && <span className="ml-1 opacity-80">({pendingSuggestions.length})</span>}
                  </Button>
                ))}
              </div>
              <div className="relative w-full md:max-w-xs">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} placeholder="Search suggestions" className="border-slate-200 bg-background pl-9 focus-visible:ring-indigo-500 dark:border-slate-700" />
              </div>
            </div>

            {pagePendingSuggestions.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900/60 dark:bg-amber-950/20">
                <Checkbox
                  id="select-visible-pending"
                  checked={allVisiblePendingSelected}
                  onCheckedChange={(checked) => {
                    const visiblePendingIds = pagePendingSuggestions
                      .filter((item) => item.status === "PENDING")
                      .map((item) => item.suggestionId);
                    setSelectedIds((current) => checked === true
                      ? [...new Set([...current, ...visiblePendingIds])]
                      : current.filter((id) => !visiblePendingIds.includes(id)));
                  }}
                />
                <Label htmlFor="select-visible-pending" className="cursor-pointer text-sm">
                  Select pending on this page ({selectedIds.length} selected total)
                </Label>
                {selectedIds.length > 0 && (
                  <>
                    <Button type="button" size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" disabled={bulkMutation.isPending}
                      onClick={() => { setBulkError(""); setBulkAction("approve"); }}>
                      <Check className="size-4" />Accept selected
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950" disabled={bulkMutation.isPending}
                      onClick={() => { setBulkError(""); setBulkAction("reject"); }}>
                      <X className="size-4" />Reject selected
                    </Button>
                  </>
                )}
              </div>
            )}

            {bulkAction && (
              <div className={`grid gap-3 rounded-xl border p-4 ${bulkAction === "approve" ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/20" : "border-rose-200 bg-rose-50/70 dark:border-rose-900 dark:bg-rose-950/20"}`}>
                <p className={`text-sm font-semibold ${bulkAction === "approve" ? "text-emerald-900 dark:text-emerald-200" : "text-rose-900 dark:text-rose-200"}`}>
                  {bulkAction === "approve"
                    ? `Accept ${selectedIds.length} selected suggestion${selectedIds.length === 1 ? "" : "s"}?`
                    : `Reject ${selectedIds.length} selected suggestion${selectedIds.length === 1 ? "" : "s"}?`}
                </p>
                {bulkAction === "reject" && (
                  <div className="grid gap-2">
                    <Label htmlFor="bulk-reject-reason">Rejection reason</Label>
                    <Input id="bulk-reject-reason" maxLength={2000} value={rejectReason}
                      onChange={(event) => setRejectReason(event.target.value)} placeholder="Explain why these suggestions are rejected" />
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" className={bulkAction === "approve" ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-rose-600 text-white hover:bg-rose-700"} disabled={bulkMutation.isPending} onClick={submitBulkAction}>
                    {bulkMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : bulkAction === "approve" ? <Check className="size-4" /> : <X className="size-4" />}
                    {bulkMutation.isPending ? "Updating..." : bulkAction === "approve" ? "Confirm accept" : "Confirm reject"}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" disabled={bulkMutation.isPending}
                    onClick={() => { setBulkAction(null); setRejectReason(""); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {suggestionsQuery.isPending ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground" role="status">
                <Loader2 className="size-4 animate-spin" />Loading suggestions...
              </div>
            ) : suggestionsQuery.isError ? (
              <Alert variant="destructive" role="alert">
                <AlertCircle />
                <AlertTitle>Could not load suggestions</AlertTitle>
                <AlertDescription>
                  {suggestionsQuery.error instanceof Error ? suggestionsQuery.error.message : "Please try again."}
                </AlertDescription>
              </Alert>
            ) : visibleSuggestions.length > 0 ? (
              <div className="grid gap-3">
                {pageSuggestions.map((suggestion) => (
                  <SuggestionCard key={suggestion.suggestionId} suggestion={suggestion}
                    selected={selectedIds.includes(suggestion.suggestionId)}
                    onSelect={(checked) => toggleSelected(suggestion.suggestionId, checked)} />
                ))}
                {pageCount > 1 && (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-indigo-100 pt-3 text-sm text-muted-foreground dark:border-indigo-900/60">
                    <span>Showing <strong className="font-semibold text-slate-800 dark:text-slate-200">{pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, visibleSuggestions.length)}</strong> of <strong className="font-semibold text-slate-800 dark:text-slate-200">{visibleSuggestions.length}</strong> suggestions <span className="hidden sm:inline">· {PAGE_SIZE} per page</span></span>
                    <nav aria-label="Suggestion pagination" className="flex items-center gap-2">
                      <Button type="button" size="sm" variant="outline" className="h-8 gap-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950"
                        disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} aria-label="Previous page">
                        <ChevronLeft className="size-4" /><span className="hidden sm:inline">Previous</span>
                      </Button>
                      <span className="whitespace-nowrap font-medium tabular-nums text-indigo-700 dark:text-indigo-300">Page {currentPage + 1} of {pageCount}</span>
                      <Button type="button" size="sm" variant="outline" className="h-8 gap-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950"
                        disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)} aria-label="Next page">
                        <span className="hidden sm:inline">Next</span><ChevronRight className="size-4" />
                      </Button>
                    </nav>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid justify-items-center gap-2 py-12 text-center">
                <Bot className="size-8 text-indigo-500" />
                <h2 className="font-semibold text-indigo-950 dark:text-indigo-100">No suggestions found</h2>
                <p className="text-sm text-muted-foreground">
                  {suggestions.length === 0 ? "Generate a project template suggestion to start your review." : "Try another status filter or search term."}
                </p>
                {suggestions.length === 0 && (
                  <Button type="button" className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-500 hover:to-violet-500" onClick={() => navigate("/ai-assistant")}>Open generator</Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </MainLayout>
  );
}
