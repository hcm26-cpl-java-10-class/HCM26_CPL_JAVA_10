import { communicationApi } from "@/api";
import { ApiErrorState } from "@/components/exam/ApiErrorState";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/usePermissions";
import type { EmailDeliveryStatus, NotificationCategory } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Mail, RefreshCw, RotateCcw, Send } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const STATUSES: EmailDeliveryStatus[] = [
  "QUEUED",
  "SENT",
  "DELIVERED",
  "FAILED",
  "SKIPPED_BY_PREFERENCE",
];
const CATEGORIES: NotificationCategory[] = ["EXAM", "COURSE", "PROJECT", "CLASS", "SYSTEM"];

export default function EmailHistoryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canSend = hasPermission("EMAIL_SEND");

  const [recipient, setRecipient] = useState("");
  const [contextRef, setContextRef] = useState("");
  const [status, setStatus] = useState<EmailDeliveryStatus | "">("");
  const [category, setCategory] = useState<NotificationCategory | "">("");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const query = useQuery({
    queryKey: ["email-history", recipient, contextRef, status, category, page],
    queryFn: () =>
      communicationApi.searchHistory({
        recipient: recipient.trim() || undefined,
        contextRef: contextRef.trim() || undefined,
        status: status || undefined,
        category: category || undefined,
        page,
        size: 15,
      }),
    placeholderData: (prev) => prev,
  });

  const detailQuery = useQuery({
    queryKey: ["email-history-detail", selectedId],
    queryFn: () => communicationApi.getHistoryDetail(selectedId!),
    enabled: selectedId !== null,
  });

  const retryMutation = useMutation({
    mutationFn: communicationApi.retryHistory,
    onSuccess: () => {
      toast.success("Email re-queued for delivery");
      void queryClient.invalidateQueries({ queryKey: ["email-history"] });
      void queryClient.invalidateQueries({ queryKey: ["email-history-detail", selectedId] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Failed to retry email");
    },
  });

  const rows = query.data?.content ?? [];
  const totalPages = query.data?.totalPages ?? 0;

  return (
    <MainLayout pathName={{ communications: "Communications", "email-history": "Email History" }}>
      <div className="w-full space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Email History</h1>
            <p className="text-sm text-muted-foreground">
              Audit trail of all queued, delivered, skipped and failed emails across the system.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
              <RefreshCw className="mr-1 size-4" /> Refresh
            </Button>
            {canSend && (
              <Button
                size="sm"
                className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                onClick={() => navigate("/communications/email-compose")}
              >
                <Send className="mr-1 size-4" /> Compose Email
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 rounded-xl border bg-card p-4 md:grid-cols-4">
          <Input
            placeholder="Filter by recipient email..."
            value={recipient}
            onChange={(e) => {
              setRecipient(e.target.value);
              setPage(0);
            }}
          />
          <Input
            placeholder="Filter by context (e.g. EXAM:1, CLASS:6)..."
            value={contextRef}
            onChange={(e) => {
              setContextRef(e.target.value);
              setPage(0);
            }}
          />
          <select
            aria-label="Filter by delivery status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as EmailDeliveryStatus | "");
              setPage(0);
            }}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as NotificationCategory | "");
              setPage(0);
            }}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <section className="rounded-xl border bg-card">
          {query.isError && !query.data ? (
            <ApiErrorState error={query.error} onRetry={() => void query.refetch()} />
          ) : query.isLoading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 p-12 text-center">
              <Mail className="size-10 text-muted-foreground" />
              <p className="text-base font-medium">No email attempts found</p>
              <p className="text-sm text-muted-foreground">Try adjusting filters or send an email to see delivery logs here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Recipient</th>
                    <th className="px-4 py-3">Subject & Template</th>
                    <th className="px-4 py-3">Context</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{row.recipientEmail}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{row.subject}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.templateCode ?? "CUSTOM"}
                          {row.templateVersion ? ` · v${row.templateVersion}` : ""} · {row.category}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{row.contextRef ?? "-"}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-white dark:bg-slate-100 dark:text-slate-900">
                          {row.deliveryStatus}
                        </span>
                        {row.retryCount > 0 && (
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            ({row.retryCount}/{row.maxRetries})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(row.sentAt ?? row.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedId(row.id)}>
                            <Eye className="mr-1 size-3.5" /> Detail
                          </Button>
                          {canSend && row.deliveryStatus === "FAILED" && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={retryMutation.isPending}
                              onClick={() => retryMutation.mutate(row.id)}
                            >
                              <RotateCcw className="mr-1 size-3.5" /> Retry
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                Previous
              </Button>
              <span className="text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </section>
      </div>

      <Dialog open={selectedId !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-w-6xl p-0">
          <DialogHeader className="sticky top-0 border-b bg-background px-6 py-4">
            <DialogTitle>Email Delivery Detail</DialogTitle>
            <DialogDescription>
              Immutable snapshot captured at dispatch time (template version & sanitized content).
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-4">
            {detailQuery.isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : detailQuery.isError || !detailQuery.data ? (
              <p className="text-sm text-muted-foreground">Could not load email details.</p>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 rounded-lg border bg-muted/30 p-4 text-sm md:grid-cols-3">
                  <div>
                    <span className="block text-xs text-muted-foreground">Recipient</span>
                    <span className="font-medium">{detailQuery.data.recipientEmail}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-muted-foreground">Status</span>
                    <span className="inline-flex rounded bg-slate-900 px-2 py-0.5 text-xs font-medium text-white dark:bg-slate-100 dark:text-slate-900">
                      {detailQuery.data.deliveryStatus}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-muted-foreground">Template / Version</span>
                    <span className="font-medium">
                      {detailQuery.data.templateCode ?? "CUSTOM"}
                      {detailQuery.data.templateVersion ? ` (v${detailQuery.data.templateVersion})` : ""}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-muted-foreground">Context</span>
                    <span>{detailQuery.data.contextRef ?? "-"}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-muted-foreground">Idempotency Key</span>
                    <span className="break-all font-mono text-xs">{detailQuery.data.idempotencyKey}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-muted-foreground">Sent At</span>
                    <span>{detailQuery.data.sentAt ? new Date(detailQuery.data.sentAt).toLocaleString() : "-"}</span>
                  </div>
                </div>
                {detailQuery.data.lastError && (
                  <div className="rounded-lg border border-slate-300 bg-slate-100 p-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                    <strong>Last Error (sanitized):</strong> {detailQuery.data.lastError}
                  </div>
                )}
                <div className="space-y-1">
                  <div className="text-xs font-medium uppercase text-muted-foreground">Subject</div>
                  <div className="rounded-md border px-3 py-2 text-sm font-medium">{detailQuery.data.subject}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-medium uppercase text-muted-foreground">Rendered HTML Snapshot</div>
                  <div
                    className="prose prose-sm max-w-none rounded-md border bg-background p-4 dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: detailQuery.data.renderedBodyHtml ?? "" }}
                  />
                </div>
              </>
            )}
          </div>
          <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-background px-6 py-3">
            {canSend && detailQuery.data?.deliveryStatus === "FAILED" && (
              <Button
                size="sm"
                className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                disabled={retryMutation.isPending}
                onClick={() => {
                  if (detailQuery.data) retryMutation.mutate(detailQuery.data.id);
                }}
              >
                <RotateCcw className="mr-1 size-4" /> Retry Delivery
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setSelectedId(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
