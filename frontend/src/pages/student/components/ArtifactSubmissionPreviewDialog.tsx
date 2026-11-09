import { useState, type RefObject } from "react";
import { AlertCircle, Check, Clock, Copy, ExternalLink, FileText, GitBranch, Globe, Loader2, Send, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { countReleaseNoteCharacters, RELEASE_NOTES_MAX_CHARACTERS } from "@/lib/release-notes";

function PreviewLink({ label, url }: { label: string; url: string }) {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [copyError, setCopyError] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  };
  return <div className="min-w-0 space-y-1.5">
    <div className="flex items-center justify-between gap-2">
      <h4 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">{label === "Repository URL" ? <GitBranch className="size-3.5" /> : <Globe className="size-3.5" />}{label}</h4>
      {url && <Button type="button" variant="ghost" size="sm" onClick={() => void copy()} aria-label={`Copy ${label.toLowerCase()}`} className="h-7 gap-1 px-2 text-xs text-blue-600 dark:text-blue-300">{copiedUrl === url ? <Check className="size-3" /> : <Copy className="size-3" />}{copiedUrl === url ? "Copied" : "Copy"}</Button>}
    </div>
    {url ? <>
      <a href={url} target="_blank" rel="noopener noreferrer" title={url} className="flex min-w-0 items-start gap-2 rounded-lg border bg-muted/25 px-3 py-2.5 text-sm text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-blue-300 dark:hover:bg-blue-950/30">
        <span className="line-clamp-2 min-w-0 flex-1 break-all">{url}</span><ExternalLink className="mt-0.5 size-3.5 shrink-0" /><span className="sr-only">Open {label.toLowerCase()} in a new tab</span>
      </a>
      <details className="group text-xs text-muted-foreground">
        <summary className="w-fit cursor-pointer rounded py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">View full URL</summary>
        <p tabIndex={0} className="mt-1 max-h-28 overflow-y-auto overscroll-contain break-all rounded-lg border bg-muted/20 p-2.5 text-foreground">{url}</p>
      </details>
    </> : <p className="rounded-lg bg-muted/25 px-3 py-2.5 text-sm text-muted-foreground">Not provided</p>}
    {copyError && <p role="alert" className="text-xs text-destructive">Could not copy. Open “View full URL” to select and copy the link.</p>}
  </div>;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  fallbackFocusRef: RefObject<HTMLHeadingElement | null>;
  version: number;
  milestoneTitle: string;
  deadline: string;
  checklist: Array<{ id: string; content: string; mandatory: boolean }>;
  repositoryUrl: string;
  deploymentUrl: string;
  releaseNotes: string;
  attachments?: Array<{ id: string; fileName: string; sizeBytes: number }>;
  pastDeadline: boolean;
  pending: boolean;
  error?: string | null;
};

export function ArtifactSubmissionPreviewDialog({ open, onOpenChange, onConfirm, triggerRef, fallbackFocusRef, version, milestoneTitle, deadline, checklist, repositoryUrl, deploymentUrl, releaseNotes, attachments, pastDeadline, pending, error }: Props) {
  return <Dialog open={open} onOpenChange={(next) => { if (!pending) onOpenChange(next); }}>
    <DialogContent
      className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[700px] flex-col gap-0 overflow-hidden rounded-xl border p-0 shadow-2xl sm:max-w-[700px]"
      overlayClassName="bg-slate-950/40 backdrop-blur-sm"
      showCloseButton={!pending}
      onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }}
      onInteractOutside={(event) => { if (pending) event.preventDefault(); }}
      onCloseAutoFocus={(event) => { event.preventDefault(); if (triggerRef.current && !triggerRef.current.disabled) triggerRef.current.focus(); else fallbackFocusRef.current?.focus(); }}
      aria-busy={pending}
    >
      <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12 sm:px-6 sm:pr-12">
        <div className="flex min-w-0 items-start gap-3">
          <span className="rounded-lg border border-blue-100 bg-blue-50 p-2 text-blue-600 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300"><FileText className="size-5" /></span>
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2"><DialogTitle className="text-lg font-semibold tracking-tight">Confirm submission</DialogTitle><Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">Version v{version}</Badge></div>
            <DialogDescription className="text-xs leading-relaxed">Review the submission summary before sending it to the reviewer.</DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="min-h-0 min-w-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6" aria-label="Submission summary" tabIndex={0}>
        <section className="flex flex-col items-start justify-between gap-3 rounded-lg border bg-muted/25 p-3.5 sm:flex-row sm:items-center">
          <div className="min-w-0 space-y-1"><p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Milestone</p><h3 className="break-words text-sm font-semibold [overflow-wrap:anywhere]">{milestoneTitle}</h3></div>
          <p className="flex shrink-0 items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 text-xs text-muted-foreground"><Clock className="size-3.5 text-amber-600" />Due: {deadline}</p>
        </section>

        <section className="min-w-0 space-y-2.5">
          <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">Acceptance criteria</h3><Badge variant="secondary">{checklist.length} {checklist.length === 1 ? "criterion" : "criteria"}</Badge></div>
          <p className="text-xs leading-relaxed text-muted-foreground">Read-only. Your reviewer will assess these criteria after submission.</p>
          {checklist.length ? <ul className="space-y-2">{checklist.map((item) => <li key={item.id} className="flex min-w-0 items-start gap-2 rounded-lg border bg-muted/20 px-3 py-2.5"><span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-blue-600" /><p className="min-w-0 flex-1 break-words text-sm leading-relaxed [overflow-wrap:anywhere]">{item.content}</p>{item.mandatory && <Badge variant="outline" className="shrink-0 border-amber-200 bg-amber-50 text-[10px] text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">Required</Badge>}</li>)}</ul> : <p className="text-sm text-muted-foreground">No acceptance criteria configured.</p>}
        </section>

        <section className="min-w-0 space-y-3 border-t pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Artifact links</h3><span className="text-xs text-muted-foreground">Read-only preview</span></div>
          <PreviewLink label="Repository URL" url={repositoryUrl.trim()} />
          <PreviewLink label="Deployment URL" url={deploymentUrl.trim()} />
        </section>

        <section className="min-w-0 space-y-2 border-t pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Release notes</h3><span className="text-xs tabular-nums text-muted-foreground">{countReleaseNoteCharacters(releaseNotes).toLocaleString("en-GB")} / {RELEASE_NOTES_MAX_CHARACTERS.toLocaleString("en-GB")} characters</span></div>
          <div tabIndex={0} aria-label="Release notes content" className="max-h-40 min-w-0 overflow-y-auto overscroll-contain whitespace-pre-wrap break-words rounded-lg border bg-muted/25 px-3 py-2.5 text-sm leading-relaxed [overflow-wrap:anywhere]">{releaseNotes.trim() || <span className="text-muted-foreground">No release notes provided.</span>}</div>
        </section>
        {!!attachments?.length && <section className="space-y-2 border-t pt-4"><h3 className="text-sm font-semibold">Attachments ({attachments.length})</h3><ul className="space-y-2">{attachments.map(file => <li key={file.id} className="min-w-0 rounded-lg bg-muted/25 px-3 py-2 text-sm [overflow-wrap:anywhere]">{file.fileName}<span className="ml-2 text-xs text-muted-foreground">{file.sizeBytes.toLocaleString()} bytes</span></li>)}</ul></section>}
        {pastDeadline && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">The deadline has passed. Submission eligibility and any penalty follow the milestone's late-submission policy.</p>}
      </div>

      <DialogFooter className="m-0 shrink-0 flex-col gap-3 rounded-none border-t bg-muted/20 px-5 py-4 sm:flex-col sm:px-6">
        {error && <div role="alert" className="flex max-h-24 shrink-0 items-start gap-2 overflow-y-auto rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"><AlertCircle className="mt-0.5 size-4 shrink-0" /><p className="min-w-0 break-words [overflow-wrap:anywhere]">{error}</p></div>}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p role="status" className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground"><ShieldCheck className="mt-0.5 size-3.5 shrink-0" />{pending ? "Submitting. Please keep this window open." : "This version will be submitted for review."}</p>
          <div className="flex shrink-0 gap-2 max-[380px]:flex-col">
            <Button type="button" className="flex-1 sm:flex-none" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>Back to edit</Button>
            <Button type="button" className="flex-1 sm:flex-none" disabled={pending} onClick={onConfirm}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}{pending ? "Submitting..." : "Confirm & submit"}</Button>
          </div>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
