import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { SubmissionDetail } from "@/types";
import { ExternalLink, FileText, Github, MonitorPlay, Paperclip } from "lucide-react";
import { useState } from "react";

const size = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function SubmissionEvidence({ submission, compact = false }: { submission: SubmissionDetail; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const { product, currentVersion } = submission;
  const links = product
    ? [{ label: "Repository", url: product.repositoryUrl, icon: Github }, { label: "Deployment", url: product.deploymentUrl, icon: MonitorPlay }].filter((item) => Boolean(item.url))
    : currentVersion.artifacts.map((item) => ({ label: item.name, url: item.url, icon: item.type === "REPOSITORY" ? Github : item.type === "DEMO" ? MonitorPlay : FileText }));
  const notes = product?.releaseNotes || currentVersion.notes;
  const attachments = product?.attachments ?? [];
  const linkList = <div className="grid gap-2">{links.length ? links.map(({ label, url, icon: Icon }, index) => <a key={`${label}-${index}`} href={url || undefined} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm text-primary hover:bg-primary/5"><Icon className="size-4 shrink-0" /><span className="min-w-0 flex-1 break-all font-medium">{label}{compact ? "" : ` · ${url}`}</span><ExternalLink className="size-3.5 shrink-0" /><span className="sr-only">opens in a new tab</span></a>) : <p className="text-sm text-muted-foreground">No artifact links submitted.</p>}</div>;

  return <>
    <Card className="min-w-0 border-sky-200/70 dark:border-sky-900/70">
      <CardHeader className="pb-3"><div className="flex items-center justify-between gap-2"><CardTitle className="text-base">Submission evidence</CardTitle><span className="text-xs text-muted-foreground">Version {currentVersion.versionNumber}</span></div></CardHeader>
      <CardContent className="grid gap-3">
        <div className={compact ? "hidden lg:block" : ""}>{linkList}</div>
        {notes ? <p className={`line-clamp-3 whitespace-pre-wrap break-words text-sm text-muted-foreground ${compact ? "hidden lg:block" : ""}`}>{notes}</p> : null}
        {product ? <p className={`items-center gap-2 text-xs text-muted-foreground ${compact ? "hidden lg:flex" : "flex"}`}><Paperclip className="size-3.5" /> {attachments.length} attachment{attachments.length === 1 ? "" : "s"}</p> : null}
        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setOpen(true)}>View all evidence</Button>
      </CardContent>
    </Card>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85vh] min-w-0 overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Submission evidence</DialogTitle><DialogDescription>{submission.milestoneTitle} · Version {currentVersion.versionNumber}</DialogDescription></DialogHeader>
        <div className="grid min-w-0 gap-5">
          <section><h3 className="mb-2 text-sm font-semibold">Links</h3>{linkList}</section>
          <section><h3 className="mb-2 text-sm font-semibold">{product ? "Release notes" : "Submission notes"}</h3><p className="whitespace-pre-wrap break-words rounded-lg border p-3 text-sm">{notes || "No notes provided."}</p></section>
          {product ? <section><h3 className="mb-2 text-sm font-semibold">Attachments ({attachments.length})</h3>{attachments.length ? <ul className="grid gap-2">{attachments.map((file) => <li key={file.id} className="flex min-w-0 items-start justify-between gap-3 rounded-lg border p-3 text-sm"><span className="min-w-0 break-all font-medium">{file.fileName}</span><span className="shrink-0 text-xs text-muted-foreground">{size(file.sizeBytes)}</span></li>)}</ul> : <p className="text-sm text-muted-foreground">No files attached.</p>}</section> : null}
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
