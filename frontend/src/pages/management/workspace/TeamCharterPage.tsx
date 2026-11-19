import { useId, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, CheckCircle2, Eye, History, Loader2, RefreshCw, Save, Users } from "lucide-react";
import { toast } from "sonner";
import { projectHubApi } from "@/api/features/project-hub.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePermissions } from "@/hooks/usePermissions";
import type { TeamCharter, TeamCharterView } from "@/types/features/project-hub";
import { getWorkspaceError } from "./workspace.shared";
import { isAxiosError } from "axios";

const fields = [
  {key: "mission", label: "Team mission", max: 2000},
  {key: "definitionOfDone", label: "Definition of done", max: 2000},
  {key: "primaryChannel", label: "Primary channel", max: 255},
  {key: "coreHours", label: "Core hours", max: 255},
  {key: "conflictResolution", label: "Conflict resolution", max: 2000},
] as const;
const progressLabels = {NOT_SAVED: "Not saved", NEEDS_REVIEW: "Needs review", PENDING: "Pending confirmation", FULLY_CONFIRMED: "Fully confirmed"};
const formatDate = (value?: string | null) => value ? new Date(value).toLocaleString("en-GB") : "Not available";
const formOf = (view: TeamCharterView): TeamCharter => ({...view.charter, responsibilities: view.members.map(m => ({membershipId: m.membershipId, responsibility: m.responsibility}))});

function ErrorBox({error, retry}: {error: unknown; retry?: () => void}) {
  return <Alert variant="destructive"><AlertDescription>{getWorkspaceError(error)}{retry && <Button type="button" variant="outline" size="sm" onClick={retry}>Try again</Button>}</AlertDescription></Alert>;
}

export default function TeamCharterPage() {
  const [params, setParams] = useSearchParams();
  const {user, activeRole} = usePermissions();
  const scope = [user.email, activeRole];
  const teams = useQuery({queryKey: ["charter-teams", ...scope], queryFn: projectHubApi.getCharterTeams, refetchOnWindowFocus: false, retry: false});
  const requestedId = Number(params.get("teamId"));
  const teamId = Number.isSafeInteger(requestedId) && requestedId > 0 ? requestedId : teams.data?.[0]?.teamId;
  const workspaceId = Number(params.get("workspaceId"));
  const validWorkspaceId = Number.isSafeInteger(workspaceId) && workspaceId > 0 ? workspaceId : undefined;
  const detail = useQuery({queryKey: ["team-charter", teamId, validWorkspaceId, ...scope], queryFn: () => projectHubApi.getCharter(teamId!, validWorkspaceId), enabled: !!teamId, refetchOnWindowFocus: false, retry: false});
  const back = Number.isSafeInteger(workspaceId) && workspaceId > 0 ? `/management/workspaces/${workspaceId}` : "/management/workspaces/candidates";
  const lostAccess = isAxiosError(detail.error) && [401, 403, 404].includes(detail.error.response?.status ?? 0);
  return <MainLayout pathName={{student: "Student", team: "Team", charter: "Team charter", mentor: "Mentor", teams: "Team charters"}}>
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-5 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><Button variant="outline" asChild><Link to={back}><ArrowLeft />Back to workspace</Link></Button><Button variant="outline" disabled={teams.isFetching || detail.isFetching} onClick={() => { void teams.refetch(); if (teamId) void detail.refetch(); }}><RefreshCw />Refresh</Button></div>
      <Card><CardHeader className="gap-3"><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle className="flex items-center gap-2"><BookOpen className="size-5 text-blue-600" />Team charter</CardTitle>{detail.data && <Badge variant="outline">{detail.data.teamStatus === "ARCHIVED" ? "Archived · Read-only" : "Active"}</Badge>}</div><p className="text-sm text-muted-foreground">Agree on working rules, roles and responsibilities. Every member confirms for themselves.</p>
        {teams.data && teams.data.length > 0 && <div className="space-y-2"><Label htmlFor="charter-team">Team</Label><select id="charter-team" className="h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm" value={teamId ?? ""} onChange={e => { const next = new URLSearchParams(params); next.set("teamId", e.target.value); next.delete("workspaceId"); setParams(next); }}>{teams.data.map(t => <option key={t.teamId} value={t.teamId}>{t.teamName} · {t.confirmedCount}/{t.memberCount} confirmed · {progressLabels[t.progress]}</option>)}</select></div>}
      </CardHeader></Card>
      {teams.isPending ? <p role="status">Loading teams...</p> : teams.isError && !teams.data ? <ErrorBox error={teams.error} retry={() => void teams.refetch()} /> : !teams.data?.length ? <Card><CardContent className="py-8 text-sm text-muted-foreground">No accessible active or archived teams. Your Team Allocation membership or Mentor scope must be configured first.</CardContent></Card> : detail.isPending ? <p role="status">Loading charter...</p> : detail.isError && (!detail.data || lostAccess) ? <ErrorBox error={detail.error} retry={() => void detail.refetch()} /> : detail.data && <>{detail.isError && <ErrorBox error={detail.error} retry={() => void detail.refetch()} />}<CharterContent key={`${teamId}:${user.email}:${activeRole}`} view={detail.data} onRefresh={async () => { await detail.refetch(); await teams.refetch(); }} /></>}
    </div>
  </MainLayout>;
}

export function CharterContent({view, onRefresh}: {view: TeamCharterView; onRefresh: () => Promise<void>}) {
  const confirmationId = useId();
  const confirmationHintId = `${confirmationId}-hint`;
  const queryClient = useQueryClient();
  const {user, activeRole} = usePermissions();
  const [form, setForm] = useState(() => formOf(view));
  const [baseline, setBaseline] = useState(() => JSON.stringify(formOf(view)));
  const [preview, setPreview] = useState(false);
  const [acknowledgedFor, setAcknowledgedFor] = useState<string | null>(null);
  const agreementId = `${view.revision}:${view.rosterToken}`;
  const acknowledged = acknowledgedFor === agreementId;
  const [tab, setTab] = useState<"current" | "history">("current");
  const [page, setPage] = useState(0);
  const dirty = JSON.stringify(form) !== baseline;
  const stale = form.version !== view.charter.version;
  // Adopt newer server content only when clean; never overwrite unsaved edits or a just-saved newer token.
  if (!dirty && (view.charter.version ?? 0) > (form.version ?? 0)) {
    const next = formOf(view); setForm(next); setBaseline(JSON.stringify(next)); setAcknowledgedFor(null);
  }
  const refreshAfterRejectedMutation = async (error: unknown) => {
    if (isAxiosError(error) && [401, 403, 404, 409, 422].includes(error.response?.status ?? 0)) await onRefresh();
  };
  const save = useMutation({mutationFn: () => projectHubApi.saveCharter(view.teamId, form), onError: refreshAfterRejectedMutation, onSuccess: async response => {
    const next = {...form, ...response.charter, responsibilities: form.responsibilities}; setForm(next); setBaseline(JSON.stringify(next)); setPreview(false); setAcknowledgedFor(null);
    toast.success("Team charter saved. Members must confirm the current revision."); await onRefresh();
    await queryClient.invalidateQueries({queryKey: ["charter-history", view.teamId]});
  }});
  const confirm = useMutation({mutationFn: () => projectHubApi.confirmCharter(view.teamId, {version: view.charter.version!, revision: view.revision, rosterToken: view.rosterToken}), onError: async error => {
    setAcknowledgedFor(null); await refreshAfterRejectedMutation(error);
  }, onSuccess: async () => {
    setAcknowledgedFor(null); toast.success("Your role and charter confirmation was recorded."); await onRefresh();
    await queryClient.invalidateQueries({queryKey: ["charter-history", view.teamId]});
  }});
  const reload = useMutation({mutationFn: () => projectHubApi.getCharter(view.teamId), onSuccess: async latest => {
    const next = formOf(latest); setForm(next); setBaseline(JSON.stringify(next)); setAcknowledgedFor(null); save.reset(); confirm.reset(); await onRefresh();
  }});
  const history = useQuery({queryKey: ["charter-history", view.teamId, view.revision, page, user.email, activeRole], queryFn: () => projectHubApi.getCharterHistory(view.teamId, page), enabled: tab === "history", refetchOnWindowFocus: false});
  const busy = save.isPending || confirm.isPending || reload.isPending;
  const confirmationDisabled = busy || !view.canConfirm || dirty || stale;
  const editable = view.canEdit && !busy;
  const percentage = view.memberCount > 0 ? Math.round(view.confirmedCount / view.memberCount * 100) : 0;
  return <>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4"><div><p className="font-semibold">{view.teamName} <Badge variant="outline">Revision {view.revision}</Badge></p><p className="mt-1 text-sm text-muted-foreground">{view.memberCount === 0 ? "No members" : `${view.confirmedCount} of ${view.memberCount} members confirmed`} · {progressLabels[view.progress]}</p></div><div className="h-2 w-44 max-w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Member confirmations" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-blue-600" style={{width: `${percentage}%`}} /></div></div>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Charter sections"><Button variant={tab === "current" ? "default" : "outline"} aria-pressed={tab === "current"} onClick={() => setTab("current")}><BookOpen />Current charter</Button><Button variant={tab === "history" ? "default" : "outline"} aria-pressed={tab === "history"} onClick={() => setTab("history")}><History />Revision history</Button></div>
    <section hidden={tab !== "current"} className="space-y-4">
      {stale && dirty && <Alert><AlertDescription>The saved charter changed. Your edits have been kept. Reload the saved charter to compare before saving.</AlertDescription></Alert>}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card className="min-w-0"><CardHeader><CardTitle>Working agreement</CardTitle><p className="text-sm text-muted-foreground">Partial drafts can be saved. All five fields, roles and responsibilities must be complete before confirmation.</p></CardHeader><CardContent>
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (view.canEdit && !busy && (dirty || view.revision === 0) && form.version != null) save.mutate(); }}>
            {view.confirmedCount > 0 && view.canEdit && <Alert><AlertDescription>Saving a meaningful change creates a new revision and requires every member to confirm again. Previous confirmations remain in revision history.</AlertDescription></Alert>}
            <fieldset disabled={!editable} className="space-y-4">
              {fields.map(field => <div key={field.key} className="space-y-2"><Label htmlFor={`charter-${field.key}`}>{field.label}</Label>{field.key === "primaryChannel" ? <select id={`charter-${field.key}`} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.primaryChannel ?? ""} onChange={e => setForm({...form, primaryChannel: e.target.value})}><option value="">Select a channel</option>{!["", "Microsoft Teams", "Slack", "Discord", "Google Chat", "Email"].includes(form.primaryChannel) && <option value={form.primaryChannel}>{form.primaryChannel}</option>}{["Microsoft Teams", "Slack", "Discord", "Google Chat", "Email"].map(c => <option key={c}>{c}</option>)}</select> : field.key === "coreHours" ? <Input id={`charter-${field.key}`} maxLength={field.max} value={form[field.key] ?? ""} onChange={e => setForm({...form, [field.key]: e.target.value})} placeholder="Mon–Fri, 19:00–21:00" /> : <Textarea id={`charter-${field.key}`} rows={4} className="max-h-48 resize-y overflow-y-auto [field-sizing:fixed]" maxLength={field.max} value={form[field.key] ?? ""} onChange={e => setForm({...form, [field.key]: e.target.value})} />}<p className="text-xs text-muted-foreground">{(form[field.key] ?? "").length.toLocaleString()} / {field.max.toLocaleString()} characters</p></div>)}
            </fieldset>
            {save.isError && <ErrorBox error={save.error} />}{reload.isError && <ErrorBox error={reload.error} />}
            <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setPreview(true)}><Eye />Preview</Button>{view.canEdit && <Button type="submit" disabled={busy || (!dirty && view.revision > 0) || form.version == null}>{save.isPending ? <Loader2 className="animate-spin" /> : <Save />}Save charter</Button>}{(dirty || save.isError || confirm.isError) && <Button type="button" variant="outline" disabled={busy} onClick={() => reload.mutate()}>Reload saved (replace edits)</Button>}</div>
            {!view.canEdit && <p className="text-sm text-muted-foreground">Read-only. An authorized team editor, assigned Mentor with edit permission or active Team Leader manages this agreement.</p>}
          </form>
        </CardContent></Card>
        <Card className="min-w-0"><CardHeader><CardTitle className="flex items-center gap-2"><Users className="size-5" />Roles & confirmation</CardTitle><p className="text-sm text-muted-foreground">Roles come from Team Allocation. Responsibilities form part of this charter revision.</p></CardHeader><CardContent className="space-y-4">
          {!view.members.length && <p className="text-sm text-muted-foreground">No member assignments. Confirmation progress is not 100%.</p>}
          {view.members.map(member => <section key={member.membershipId} className="min-w-0 space-y-2 rounded-lg border p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="break-words text-sm font-semibold">{member.name}</p><p className="break-all text-xs text-muted-foreground">{member.email}</p></div><Badge variant={member.confirmed ? "secondary" : "outline"}>{member.confirmed ? "Confirmed" : "Pending"}</Badge></div><div className="flex flex-wrap gap-1">{member.roles.length ? member.roles.map(role => <Badge variant="outline" key={role}>{role}</Badge>) : <span className="text-xs text-amber-700">No valid role assigned</span>}</div>
            <Label htmlFor={`duty-${member.membershipId}`}>Responsibility</Label><Textarea id={`duty-${member.membershipId}`} disabled={!editable} rows={2} maxLength={1000} className="max-h-36 resize-y overflow-y-auto [field-sizing:fixed]" value={form.responsibilities?.find(r => r.membershipId === member.membershipId)?.responsibility ?? ""} onChange={e => setForm({...form, responsibilities: form.responsibilities?.map(r => r.membershipId === member.membershipId ? {...r, responsibility: e.target.value} : r)})} /><p className="text-xs text-muted-foreground">{(form.responsibilities?.find(r => r.membershipId === member.membershipId)?.responsibility ?? "").length}/1,000 characters</p>
            {member.issue && <p className="text-xs text-amber-700 dark:text-amber-400">{member.issue}</p>}{member.confirmedAt && <p className="text-xs text-muted-foreground">Confirmed {formatDate(member.confirmedAt)}</p>}
          </section>)}
          <div className="space-y-3 border-t pt-4">
            <div className={`flex items-start gap-3 rounded-lg bg-muted/30 p-3 select-none ${confirmationDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
              <Checkbox
                id={confirmationId}
                aria-describedby={confirmationHintId}
                className="mt-1 cursor-pointer disabled:cursor-not-allowed"
                checked={acknowledged}
                disabled={confirmationDisabled}
                onCheckedChange={checked => { if (!confirmationDisabled) setAcknowledgedFor(checked === true ? agreementId : null); }}
              />
              <Label htmlFor={confirmationId} className={`min-w-0 text-sm leading-6 font-normal ${confirmationDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
                I have read this saved charter and agree to my assigned roles and responsibilities.
              </Label>
            </div>
            <Button className="w-full" disabled={confirmationDisabled || !acknowledged} onClick={() => { if (!confirmationDisabled && acknowledged) confirm.mutate(); }}>{confirm.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}Confirm my role & charter</Button>
            <p id={confirmationHintId} className="text-xs text-muted-foreground">{dirty ? "Save or discard local edits before confirming." : stale ? "Reload the saved charter before confirming." : view.confirmationBlockReason ?? "Your confirmation applies only to the saved revision shown above."}</p>{confirm.isError && <ErrorBox error={confirm.error} />}
          </div>
        </CardContent></Card>
      </div>
    </section>
    <section hidden={tab !== "history"} className="space-y-3" aria-label="Charter revision history">
      {history.isPending ? <p role="status">Loading revision history...</p> : history.isError ? <ErrorBox error={history.error} retry={() => void history.refetch()} /> : history.data && <>
        <p className="text-sm text-muted-foreground">{history.data.totalElements} saved revisions. Times are shown in your browser's time zone. Previous confirmations are evidence, not consent to the current revision.</p>
        {!history.data.content.length && <p className="rounded-lg border p-6 text-sm">No saved revisions yet.</p>}
        {history.data.content.map((r, index) => <details key={r.revision} open={index === 0} className="rounded-xl border bg-card p-4"><summary className="cursor-pointer text-sm font-semibold">Revision {r.revision} · {formatDate(r.savedAt)} · {r.confirmations.length} confirmations</summary><div className="mt-4 space-y-4"><p className="text-xs text-muted-foreground">Saved by User #{r.actorId}</p><CharterSummary charter={r.charter} />{r.members.length ? r.members.map(m => <div key={m.membershipId} className="rounded-lg border p-3 text-sm"><p className="font-medium">{m.name} · {m.roles.join(", ") || "No role"}</p><p className="whitespace-pre-wrap break-words">{m.responsibility || "Responsibility not defined"}</p></div>) : <p className="text-sm text-muted-foreground">This legacy revision has no roster snapshot.</p>}<div className="border-t pt-3"><p className="text-sm font-semibold">Recorded confirmations</p>{r.confirmations.length ? r.confirmations.map(c => <p className="mt-2 break-words text-sm" key={c.userId}>{c.name} · {c.roles.join(", ")} · {formatDate(c.confirmedAt)}</p>) : <p className="text-sm text-muted-foreground">No confirmations recorded for this revision.</p>}</div></div></details>)}
        <div className="flex items-center justify-between gap-3"><Button variant="outline" disabled={page === 0 || history.isFetching} onClick={() => setPage(p => p - 1)}>Previous</Button><span className="text-sm">Page {page + 1} / {Math.max(1, history.data.totalPages)}</span><Button variant="outline" disabled={page + 1 >= history.data.totalPages || history.isFetching} onClick={() => setPage(p => p + 1)}>Next</Button></div>
      </>}
    </section>
    <Dialog open={preview} onOpenChange={open => { if (!save.isPending) setPreview(open); }}><DialogContent className="flex max-h-[85dvh] flex-col overflow-hidden sm:max-w-2xl" onEscapeKeyDown={e => { if (save.isPending) e.preventDefault(); }} onInteractOutside={e => { if (save.isPending) e.preventDefault(); }}><DialogHeader><DialogTitle>Preview team charter</DialogTitle><DialogDescription>{dirty ? "Unsaved preview. Save before asking members to confirm." : `Saved revision ${view.revision}.`} This preview does not record anyone's confirmation.</DialogDescription></DialogHeader><div className="min-h-0 space-y-4 overflow-y-auto p-1"><CharterSummary charter={form} />{view.members.map(m => <div key={m.membershipId} className="rounded-lg border p-3 text-sm"><p className="font-semibold">{m.name} · {m.roles.join(", ") || "No role"}</p><p className="whitespace-pre-wrap break-words">{form.responsibilities?.find(r => r.membershipId === m.membershipId)?.responsibility || "Responsibility not defined"}</p></div>)}{save.isError && <ErrorBox error={save.error} />}</div><DialogFooter><Button variant="outline" disabled={save.isPending} onClick={() => setPreview(false)}>Back to charter</Button>{view.canEdit && <Button disabled={busy || (!dirty && view.revision > 0)} onClick={() => save.mutate()}>{save.isPending && <Loader2 className="animate-spin" />}Save charter</Button>}</DialogFooter></DialogContent></Dialog>
  </>;
}

function CharterSummary({charter}: {charter: TeamCharter}) {
  return <dl className="space-y-3">{fields.map(f => <div key={f.key}><dt className="text-sm font-semibold">{f.label}</dt><dd className="mt-1 whitespace-pre-wrap break-words rounded-md bg-muted/40 p-3 text-sm [overflow-wrap:anywhere]">{charter[f.key]?.trim() || "Not provided"}</dd></div>)}</dl>;
}
