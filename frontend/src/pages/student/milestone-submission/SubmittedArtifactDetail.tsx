import { useState } from "react";
import { ArrowLeft, CalendarClock, ChevronDown, ExternalLink, FileText, GitBranch, Globe, History, LockKeyhole, MessageSquare, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArtifactReviewStatusBadge } from "@/pages/student/components/ArtifactReviewStatusBadge";
import type { SubmissionDetail } from "@/types";
import styles from "./SubmittedArtifactDetail.module.css";

const date = (value?: string | null) => value ? new Date(value).toLocaleString() : "Not available";

function ReadOnlyText({ label, value }: { label: string; value?: string | null }) {
  return <section className="min-w-0 space-y-2">
    <h2 className="text-sm font-semibold">{label}</h2>
    <div className={styles.text} tabIndex={value ? 0 : undefined} aria-label={label}>{value || "Not provided"}</div>
  </section>;
}

function ArtifactLink({ label, url, repository = false }: { label: string; url?: string | null; repository?: boolean }) {
  const Icon = repository ? GitBranch : Globe;
  return <div className={styles.link}>
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
      <span className="flex min-w-0 items-center gap-2 text-sm font-semibold"><Icon className="size-4 shrink-0 text-blue-600" />{label}</span>
      {url && <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-blue-300" aria-label={`Open ${label}`}><ExternalLink className="size-3.5" />Open link</a>}
    </div>
    {url ? <details className="mt-2 min-w-0 text-xs"><summary className="group flex cursor-pointer list-none items-start gap-2 rounded-md bg-background/70 px-3 py-2 focus-visible:outline-2 focus-visible:outline-blue-500" aria-label={`Show full ${label} URL`}><ChevronDown className="mt-0.5 size-3 shrink-0 transition group-open:rotate-180" /><span className="min-w-0 flex-1"><span className="block truncate">{url}</span><span className="mt-1 block text-xs text-muted-foreground">Full URL</span></span></summary><p className="mt-2 select-text rounded-md border bg-background p-3 [overflow-wrap:anywhere]">{url}</p></details> : <p className="mt-2 text-sm text-muted-foreground">Not provided</p>}
  </div>;
}

export function SubmittedArtifactDetail({ item, onBack }: { item: SubmissionDetail; onBack: () => void }) {
  const [selectedId, setSelectedId] = useState(item.currentVersion.id);
  const versions = [...item.versions];
  if (!versions.some(version => version.id === item.currentVersion.id)) versions.push(item.currentVersion);
  versions.sort((left, right) => right.versionNumber - left.versionNumber);
  const selected = versions.find(version => version.id === selectedId) ?? item.currentVersion;
  // Product info belongs only to the current version in the existing API model.
  const product = selected.id === item.currentVersion.id ? item.product : null;
  const links = selected.artifacts ?? [];
  const repository = product ? product.repositoryUrl : links.find(link => link.type === "REPOSITORY")?.url;
  const deployment = product ? product.deploymentUrl : links.find(link => link.type === "DEMO")?.url;
  const otherLinks = links.filter(link => link.url !== repository && link.url !== deployment);
  const reviews = item.reviews.filter(review => review.versionNumber === selected.versionNumber);
  const attachments = product?.attachments;
  return <main className={styles.page}>
    <Button type="button" variant="ghost" className="w-fit" onClick={onBack}><ArrowLeft className="size-4" />Back to My Submissions</Button>
    <header className={styles.header}>
      <div className="min-w-0 space-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2"><h1 className="text-xl font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-2xl">{selected.title || item.milestoneTitle || "Untitled submission"}</h1><ArtifactReviewStatusBadge status={selected.status} /><Badge variant="outline">Submission v{selected.versionNumber}</Badge></div>
        <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{item.milestoneTitle}{item.teamName ? ` · ${item.teamName}` : ""}</p>
        <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><LockKeyhole className="mt-0.5 size-3.5 shrink-0 text-blue-600" />{selected.status === "DRAFT" ? "Read-only preview. This draft has not been officially submitted." : `Version ${selected.versionNumber} is read-only because it has been submitted. Submitted does not mean accepted.`}</p>
      </div>
      <div className="min-w-0 space-y-2 rounded-lg bg-blue-50/70 p-3 text-xs dark:bg-blue-950/30"><p className="flex items-start gap-2"><CalendarClock className="size-4 shrink-0 text-blue-600" /><span><span className="block text-muted-foreground">Submitted at</span><time className="mt-1 block font-medium" dateTime={selected.submittedAt || undefined}>{date(selected.submittedAt)}</time></span></p>{product && <p className="text-muted-foreground">Artifact version: <span className="font-medium text-foreground">v{product.version}</span></p>}<details className="min-w-0"><summary className="cursor-pointer text-muted-foreground">Submission version ID</summary><p className="mt-1 select-text [overflow-wrap:anywhere]">{selected.id}</p></details></div>
    </header>
    <div className={styles.columns}>
      <article className={styles.content} aria-label={`Details for submission version ${selected.versionNumber}`}>
        <ReadOnlyText label="Summary" value={selected.notes} />
        <ReadOnlyText label="Release notes" value={product?.releaseNotes} />
        {!product && <p className="-mt-2 text-xs leading-5 text-muted-foreground">Separate release notes and attachment metadata are not available for this version.</p>}
        <section className="min-w-0 space-y-3"><h2 className="flex items-center gap-2 text-sm font-semibold"><GitBranch className="size-4 text-blue-600" />Source code and deployment</h2><ArtifactLink label="Repository" url={repository} repository /><ArtifactLink label="Deployment" url={deployment} />{otherLinks.map((link, index) => <ArtifactLink key={link.id ?? index} label={link.name || link.type.replaceAll("_", " ")} url={link.url} />)}{selected.submissionUrl && !links.some(link => link.url === selected.submissionUrl) && selected.submissionUrl !== repository && selected.submissionUrl !== deployment && <ArtifactLink label="Submission link" url={selected.submissionUrl} />}</section>
        <section className="min-w-0 space-y-3"><h2 className="flex items-center gap-2 text-sm font-semibold"><Paperclip className="size-4 text-blue-600" />Attachments {attachments ? `(${attachments.length})` : ""}</h2>{attachments?.length ? <ul className="space-y-2">{attachments.map(file => <li key={file.id} className={styles.link}><div className="flex items-start gap-2"><FileText className="mt-0.5 size-4 shrink-0 text-blue-600" /><span className="min-w-0 text-sm font-medium [overflow-wrap:anywhere]">{file.fileName}</span></div><p className="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">{file.contentType} · {file.sizeBytes.toLocaleString()} bytes</p></li>)}</ul> : <div className="grid justify-items-center gap-2 rounded-lg bg-muted/30 p-6 text-center text-sm text-muted-foreground"><Paperclip className="size-6 opacity-60" /><p>{attachments ? "No files attached to this artifact version." : "Attachment information is not available for this version."}</p></div>}</section>
        {reviews.map(review => <section key={review.id} className="min-w-0 space-y-3 rounded-lg border border-blue-100 bg-blue-50/40 p-4 dark:border-blue-900 dark:bg-blue-950/20"><h2 className="flex items-center gap-2 text-sm font-semibold"><MessageSquare className="size-4 text-blue-600" />Reviewer feedback</h2><p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{review.decision === "ACCEPT" ? "Accepted" : review.decision === "REJECT" ? "Rejected" : "Changes requested"}{review.reviewerName ? ` · ${review.reviewerName}` : ""}{review.reviewedAt ? ` · ${date(review.reviewedAt)}` : ""}</p><ReadOnlyText label="Overall feedback" value={review.overallFeedback} />{review.evaluations.filter(evaluation => evaluation.feedback).map(evaluation => <ReadOnlyText key={evaluation.criterionId} label={evaluation.criterionName} value={evaluation.feedback} />)}</section>)}
      </article>
      <aside className={styles.history} aria-label="Version history">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-sm font-semibold"><History className="size-4 text-blue-600" />Version history</h2><Badge variant="secondary">{versions.length}</Badge></div>
        <p className="text-xs leading-5 text-muted-foreground">Each version retains its own content and review outcome.</p>
        <ol className="space-y-2">{versions.map(version => <li key={version.id}><button type="button" className={`${styles.version} ${version.id === selected.id ? styles.selected : ""}`} aria-current={version.id === selected.id ? "true" : undefined} onClick={() => setSelectedId(version.id)}><span className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold">Submission v{version.versionNumber}</span>{version.id === selected.id && <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Viewing</span>}</span><span className="block text-sm [overflow-wrap:anywhere]">{version.title || "Untitled version"}</span><span className="block text-xs text-muted-foreground">{version.submittedAt ? date(version.submittedAt) : version.status === "DRAFT" ? "Not submitted" : "Submission time unavailable"}</span><ArtifactReviewStatusBadge status={version.status} /></button></li>)}</ol>
      </aside>
    </div>
  </main>;
}
