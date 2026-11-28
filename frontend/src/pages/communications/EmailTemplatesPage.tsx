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
import { Switch } from "@/components/ui/switch";
import { usePermissions } from "@/hooks/usePermissions";
import type { EmailTemplateDTO, EmailTemplateUpsertRequest, NotificationCategory } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, FileText, History, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const CATEGORIES: NotificationCategory[] = ["EXAM", "COURSE", "PROJECT", "CLASS", "SYSTEM"];

const EMPTY_FORM: EmailTemplateUpsertRequest = {
  code: "",
  name: "",
  category: "SYSTEM",
  description: "",
  subjectTemplate: "",
  bodyHtml: "<p>Hello {{studentName}},</p>\n<p></p>",
  sampleVariablesJson: "{\"studentName\":\"Nguyen Van A\"}",
  changeNote: "",
};

export default function EmailTemplatesPage() {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("EMAIL_TEMPLATE_MANAGE");

  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState<NotificationCategory | "">("");
  const [page, setPage] = useState(0);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<EmailTemplateDTO | null>(null);
  const [form, setForm] = useState<EmailTemplateUpsertRequest>(EMPTY_FORM);
  const [preview, setPreview] = useState<{ subject: string; body: string } | null>(null);
  const [versionsTarget, setVersionsTarget] = useState<EmailTemplateDTO | null>(null);

  const query = useQuery({
    queryKey: ["email-templates", keyword, category, page],
    queryFn: () =>
      communicationApi.searchTemplates({
        keyword: keyword.trim() || undefined,
        category: category || undefined,
        page,
        size: 15,
      }),
    placeholderData: (prev) => prev,
  });

  const versionsQuery = useQuery({
    queryKey: ["email-template-versions", versionsTarget?.id],
    queryFn: () => communicationApi.listTemplateVersions(versionsTarget!.id),
    enabled: versionsTarget !== null,
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      editing
        ? communicationApi.updateTemplate(editing.id, form)
        : communicationApi.createTemplate(form),
    onSuccess: (saved) => {
      toast.success(editing ? `Updated ${saved.code} to v${saved.currentVersion}` : `Created template ${saved.code}`);
      setEditorOpen(false);
      setEditing(null);
      setPreview(null);
      void queryClient.invalidateQueries({ queryKey: ["email-templates"] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Could not save email template");
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      communicationApi.updateTemplateStatus(id, active),
    onSuccess: () => {
      toast.success("Template status updated");
      void queryClient.invalidateQueries({ queryKey: ["email-templates"] });
    },
    onError: () => toast.error("Could not update template status"),
  });

  const previewMutation = useMutation({
    mutationFn: () => {
      let variables: Record<string, string> = {};
      try {
        const parsed = JSON.parse(form.sampleVariablesJson || "{}");
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          variables = Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, String(v ?? "")]));
        }
      } catch {
        toast.error("Sample variables JSON is invalid");
      }
      return communicationApi.previewTemplate({
        subjectTemplate: form.subjectTemplate,
        bodyHtml: form.bodyHtml,
        variables,
      });
    },
    onSuccess: (res) => setPreview({ subject: res.renderedSubject, body: res.renderedBodyHtml }),
    onError: () => toast.error("Could not render preview"),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setPreview(null);
    setEditorOpen(true);
  };

  const openEdit = (tpl: EmailTemplateDTO) => {
    setEditing(tpl);
    setForm({
      code: tpl.code,
      name: tpl.name,
      category: tpl.category,
      description: tpl.description ?? "",
      subjectTemplate: tpl.subjectTemplate,
      bodyHtml: tpl.bodyHtml,
      sampleVariablesJson: tpl.sampleVariablesJson ?? "{}",
      changeNote: "",
    });
    setPreview(null);
    setEditorOpen(true);
  };

  const rows = query.data?.content ?? [];
  const totalPages = query.data?.totalPages ?? 0;

  return (
    <MainLayout pathName={{ communications: "Communications", "email-templates": "Email Templates" }}>
      <div className="w-full space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Email Templates</h1>
            <p className="text-sm text-muted-foreground">
              Manage versioned, HTML-sanitized message templates. Updating a template creates a new version without altering sent history.
            </p>
          </div>
          {canManage && (
            <Button
              size="sm"
              className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
              onClick={openCreate}
            >
              <Plus className="mr-1 size-4" /> New Template
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 rounded-xl border bg-card p-4 md:grid-cols-3">
          <Input
            placeholder="Search by code or name..."
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setPage(0);
            }}
          />
          <select
            aria-label="Filter templates by category"
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
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 p-12 text-center">
              <FileText className="size-10 text-muted-foreground" />
              <p className="text-base font-medium">No email templates found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Code & Name</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Version</th>
                    <th className="px-4 py-3">Active</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((tpl) => (
                    <tr key={tpl.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-medium">{tpl.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{tpl.code}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-white dark:bg-slate-100 dark:text-slate-900">
                          {tpl.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">v{tpl.currentVersion}</td>
                      <td className="px-4 py-3">
                        <Switch
                          aria-label={`Toggle ${tpl.code}`}
                          checked={tpl.active}
                          disabled={!canManage || statusMutation.isPending}
                          onCheckedChange={(checked) => statusMutation.mutate({ id: tpl.id, active: checked })}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setVersionsTarget(tpl)}>
                            <History className="mr-1 size-3.5" /> Versions
                          </Button>
                          {canManage && (
                            <Button variant="outline" size="sm" onClick={() => openEdit(tpl)}>
                              <Pencil className="mr-1 size-3.5" /> Edit
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

      {/* Create / Edit Modal (max-w-6xl, sticky header & footer) */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-6xl p-0">
          <DialogHeader className="sticky top-0 border-b bg-background px-6 py-4">
            <DialogTitle>{editing ? `Edit Template: ${editing.code} (creates v${editing.currentVersion + 1})` : "Create Email Template"}</DialogTitle>
            <DialogDescription>
              HTML is automatically sanitized on save and preview. Use {"{{variableName}}"} for dynamic placeholders.
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[70vh] grid-cols-1 gap-5 overflow-y-auto px-6 py-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Code</label>
                  <Input
                    disabled={Boolean(editing)}
                    value={form.code}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder="CLASS_WELCOME"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as NotificationCategory }))}
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
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Name</label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Subject Template</label>
                <Input
                  value={form.subjectTemplate}
                  onChange={(e) => setForm((f) => ({ ...f, subjectTemplate: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">HTML Body</label>
                <textarea
                  rows={8}
                  value={form.bodyHtml}
                  onChange={(e) => setForm((f) => ({ ...f, bodyHtml: e.target.value }))}
                  className="w-full rounded-md border bg-background p-2.5 font-mono text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Sample Variables (JSON)</label>
                <textarea
                  rows={2}
                  value={form.sampleVariablesJson ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, sampleVariablesJson: e.target.value }))}
                  className="w-full rounded-md border bg-background p-2 font-mono text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Version Change Note</label>
                <Input
                  value={form.changeNote ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, changeNote: e.target.value }))}
                  placeholder="Describe what changed in this revision..."
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live Sanitized Preview</span>
                <Button variant="outline" size="sm" disabled={previewMutation.isPending} onClick={() => previewMutation.mutate()}>
                  <Eye className="mr-1 size-3.5" /> Render Preview
                </Button>
              </div>
              {preview ? (
                <div className="space-y-3">
                  <div className="rounded-md border px-3 py-2 text-sm font-medium">{preview.subject}</div>
                  <div
                    className="prose prose-sm max-w-none rounded-md border bg-background p-4 dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: preview.body }}
                  />
                </div>
              ) : (
                <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Click <strong>Render Preview</strong> to verify placeholders and HTML sanitization.
                </div>
              )}
            </div>
          </div>
          <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-background px-6 py-3">
            <Button variant="outline" size="sm" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {editing ? `Save as v${editing.currentVersion + 1}` : "Create Template"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Version History Modal */}
      <Dialog open={versionsTarget !== null} onOpenChange={(open) => !open && setVersionsTarget(null)}>
        <DialogContent className="max-w-4xl p-0">
          <DialogHeader className="sticky top-0 border-b bg-background px-6 py-4">
            <DialogTitle>Version History — {versionsTarget?.code}</DialogTitle>
            <DialogDescription>Immutable snapshots preserved for historical email traceability.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] space-y-3 overflow-y-auto px-6 py-4">
            {versionsQuery.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (versionsQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No version snapshots recorded.</p>
            ) : (
              (versionsQuery.data ?? []).map((v) => (
                <div key={v.id} className="space-y-2 rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-xs font-medium text-white dark:bg-slate-100 dark:text-slate-900">
                      v{v.version}
                    </span>
                    <span className="text-xs text-muted-foreground">{new Date(v.createdAt).toLocaleString()}</span>
                  </div>
                  {v.changeNote && <p className="text-xs text-muted-foreground">Note: {v.changeNote}</p>}
                  <div className="text-sm font-medium">{v.subjectTemplate}</div>
                  <div
                    className="prose prose-sm max-w-none rounded border bg-muted/20 p-3 dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: v.bodyHtml }}
                  />
                </div>
              ))
            )}
          </div>
          <div className="sticky bottom-0 flex justify-end border-t bg-background px-6 py-3">
            <Button variant="outline" size="sm" onClick={() => setVersionsTarget(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
