import { communicationApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { EmailBatchResult, EmailTemplateDTO, NotificationCategory } from "@/types";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Eye, History, RotateCcw, Send } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const CATEGORIES: NotificationCategory[] = ["EXAM", "COURSE", "PROJECT", "CLASS", "SYSTEM"];

function generateKey() {
  return `compose-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function EmailComposePage() {
  const navigate = useNavigate();
  const [templateId, setTemplateId] = useState<number | undefined>();
  const [category, setCategory] = useState<NotificationCategory>("SYSTEM");
  const [contextRef, setContextRef] = useState("MANUAL");
  const [classIdInput, setClassIdInput] = useState("");
  const [emailsText, setEmailsText] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [variablesJson, setVariablesJson] = useState("{}");
  const [respectPreference, setRespectPreference] = useState(true);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(generateKey);
  const [preview, setPreview] = useState<{ subject: string; body: string } | null>(null);
  const [batchResult, setBatchResult] = useState<EmailBatchResult | null>(null);

  const templatesQuery = useQuery({
    queryKey: ["email-templates-active"],
    queryFn: () => communicationApi.searchTemplates({ active: true, page: 0, size: 100 }),
  });

  const parseVariables = (): Record<string, string> => {
    try {
      const parsed = JSON.parse(variablesJson || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, String(v ?? "")]));
      }
    } catch {
      toast.error("Variables JSON is invalid");
    }
    return {};
  };

  const buildPayload = () => {
    const recipientEmails = emailsText
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const parsedClassId = classIdInput.trim() ? Number.parseInt(classIdInput.trim(), 10) : undefined;
    return {
      templateId,
      subject,
      bodyHtml,
      category,
      contextRef: contextRef.trim() || undefined,
      classId: parsedClassId && !Number.isNaN(parsedClassId) ? parsedClassId : undefined,
      recipientEmails,
      variables: parseVariables(),
      idempotencyKey,
      respectPreference,
    };
  };

  const previewMutation = useMutation({
    mutationFn: () => communicationApi.previewCompose(buildPayload()),
    onSuccess: (res) => setPreview({ subject: res.renderedSubject, body: res.renderedBodyHtml }),
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Could not preview email");
    },
  });

  const sendMutation = useMutation({
    mutationFn: () => communicationApi.sendEmails(buildPayload(), idempotencyKey),
    onSuccess: (res) => {
      setBatchResult(res);
      if (res.duplicateRequest) {
        toast.info("Duplicate submission prevented — returning original batch result.");
      } else {
        toast.success(`Batch queued: ${res.queuedCount} queued, ${res.skippedCount} skipped, ${res.failedCount} failed.`);
      }
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Failed to send email batch");
    },
  });

  const handleSelectTemplate = (rawId: string) => {
    if (!rawId) {
      setTemplateId(undefined);
      return;
    }
    const id = Number.parseInt(rawId, 10);
    const found: EmailTemplateDTO | undefined = templatesQuery.data?.content.find((t) => t.id === id);
    if (!found) return;
    setTemplateId(found.id);
    setCategory(found.category);
    setSubject(found.subjectTemplate);
    setBodyHtml(found.bodyHtml);
    if (found.sampleVariablesJson) {
      setVariablesJson(found.sampleVariablesJson);
    }
    setPreview(null);
  };

  const resetDraft = () => {
    setIdempotencyKey(generateKey());
    setBatchResult(null);
    setPreview(null);
  };

  return (
    <MainLayout pathName={{ communications: "Communications", "email-compose": "Compose & Bulk Send" }}>
      <div className="w-full space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Compose & Bulk Send Email</h1>
            <p className="text-sm text-muted-foreground">
              Send single or bulk emails using versioned templates with preview, double-submit protection, and partial result reporting.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetDraft}>
              <RotateCcw className="mr-1 size-4" /> New Draft Key
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/communications/email-history")}>
              <History className="mr-1 size-4" /> Email History
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <section className="space-y-4 rounded-xl border bg-card p-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Template (optional)</label>
                <select
                  aria-label="Email template"
                  value={templateId ?? ""}
                  onChange={(e) => handleSelectTemplate(e.target.value)}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">Custom email (no template)</option>
                  {(templatesQuery.data?.content ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code} · v{t.currentVersion})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Category</label>
                <select
                  aria-label="Notification category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as NotificationCategory)}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Target Class ID (bulk enrolled trainees)</label>
                <Input
                  type="number"
                  placeholder="Optional class ID (e.g. 6)"
                  value={classIdInput}
                  onChange={(e) => setClassIdInput(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Context Reference</label>
                <Input
                  placeholder="e.g. CLASS:6 or EXAM:12"
                  value={contextRef}
                  onChange={(e) => setContextRef(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Recipient Emails (comma, semicolon or newline separated)
              </label>
              <textarea
                rows={3}
                value={emailsText}
                onChange={(e) => setEmailsText(e.target.value)}
                placeholder="student1@example.com, student2@example.com"
                className="w-full rounded-md border bg-background p-2.5 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Subject</label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="[FAMS] Announcement..." />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                HTML Body (supports {"{{studentName}}"}, {"{{recipientEmail}}"} & custom variables)
              </label>
              <textarea
                rows={6}
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                placeholder="<p>Hello {{studentName}},</p><p>...</p>"
                className="w-full rounded-md border bg-background p-2.5 font-mono text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Variables (JSON object)</label>
              <textarea
                rows={2}
                value={variablesJson}
                onChange={(e) => setVariablesJson(e.target.value)}
                className="w-full rounded-md border bg-background p-2 font-mono text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={respectPreference} onCheckedChange={setRespectPreference} />
                Respect user email preferences
              </label>
              <span className="font-mono text-[11px] text-muted-foreground">Key: {idempotencyKey}</span>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" disabled={previewMutation.isPending} onClick={() => previewMutation.mutate()}>
                <Eye className="mr-1 size-4" /> Preview
              </Button>
              <Button
                size="sm"
                className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                disabled={sendMutation.isPending}
                onClick={() => sendMutation.mutate()}
              >
                <Send className="mr-1 size-4" /> Send Email(s)
              </Button>
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-xl border bg-card p-5">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Sanitized Preview</h2>
              {!preview ? (
                <p className="text-sm text-muted-foreground">
                  Click <strong>Preview</strong> to inspect variable interpolation and HTML sanitization before dispatching.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-md border px-3 py-2 text-sm font-medium">{preview.subject}</div>
                  <div
                    className="prose prose-sm max-w-none rounded-md border bg-background p-4 dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: preview.body }}
                  />
                </div>
              )}
            </div>

            {batchResult && (
              <div className="space-y-3 rounded-xl border bg-card p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Batch Dispatch Result</h2>
                  {batchResult.duplicateRequest && (
                    <span className="rounded bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-white dark:bg-slate-100 dark:text-slate-900">
                      IDEMPOTENT REPLAY
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="rounded-lg border p-2.5">
                    <div className="text-lg font-semibold">{batchResult.total}</div>
                    <div className="text-[11px] text-muted-foreground">Total</div>
                  </div>
                  <div className="rounded-lg border p-2.5">
                    <div className="text-lg font-semibold">{batchResult.queuedCount}</div>
                    <div className="text-[11px] text-muted-foreground">Queued</div>
                  </div>
                  <div className="rounded-lg border p-2.5">
                    <div className="text-lg font-semibold">{batchResult.skippedCount}</div>
                    <div className="text-[11px] text-muted-foreground">Skipped</div>
                  </div>
                  <div className="rounded-lg border p-2.5">
                    <div className="text-lg font-semibold">{batchResult.failedCount}</div>
                    <div className="text-[11px] text-muted-foreground">Failed</div>
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto rounded-md border">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b bg-muted/40">
                      <tr>
                        <th className="px-3 py-2">Recipient</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {batchResult.items.map((item, idx) => (
                        <tr key={`${item.recipientEmail}-${idx}`}>
                          <td className="px-3 py-2 font-medium">{item.recipientEmail || "(empty)"}</td>
                          <td className="px-3 py-2">
                            <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-white dark:bg-slate-100 dark:text-slate-900">
                              {item.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{item.reason ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </MainLayout>
  );
}
