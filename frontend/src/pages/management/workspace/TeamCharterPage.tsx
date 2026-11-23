import { useEffect, useId, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, CheckCircle2, ChevronLeft, ChevronRight, Clock, Eye, FileText, History, Info, Loader2, LockKeyhole, MessagesSquare, RefreshCw, Save, ShieldCheck, Users, X } from "lucide-react";
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
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/hooks/usePermissions";
import { normalizeRole, STUDENT_ROLE } from "@/utils/rbac.utils";
import type { CharterHistory, CharterHistoryPage, TeamCharter, TeamCharterView } from "@/types/features/project-hub";
import { getWorkspaceError } from "./workspace.shared";
import { isAxiosError } from "axios";
import { charterProgressLabel, charterTimeZone, coreHourDays, formatCharterDate, formatCoreHours, parseClockTime, parseCoreHours, validateCoreHours } from "./team-charter.utils";

const fields = [
  {key: "mission", label: "Team mission", max: 2000},
  {key: "definitionOfDone", label: "Definition of done", max: 2000},
  {key: "primaryChannel", label: "Primary channel", max: 255},
  {key: "coreHours", label: "Core hours", max: 255},
  {key: "conflictResolution", label: "Conflict resolution", max: 2000},
] as const;
const channels = ["Microsoft Teams", "Slack", "Discord", "Google Chat", "Email"];
const formOf = (view: TeamCharterView): TeamCharter => ({
  ...view.charter,
  responsibilities: (view.members ?? []).map(m => ({membershipId: m.membershipId, responsibility: m.responsibility})),
});

function ErrorBox({error, retry}: {error: unknown; retry?: () => void}) {
  return <Alert variant="destructive"><AlertDescription>{getWorkspaceError(error)}{retry && <Button type="button" variant="outline" size="sm" onClick={retry}>Try again</Button>}</AlertDescription></Alert>;
}

type CharterNavigation = {
  back: string;
  teamId?: number;
  teams: TeamCharterView[];
  fetching: boolean;
  refresh: () => void;
  selectTeam: (teamId: string) => void;
};

function CharterHeader({view, navigation, dirty = false, busy = false}: {
  view?: TeamCharterView;
  navigation?: CharterNavigation;
  dirty?: boolean;
  busy?: boolean;
}) {
  const teamSelectId = useId();
  const percentage = view && view.memberCount > 0
    ? Math.round(view.confirmedCount / view.memberCount * 100)
    : 0;
  const archived = view?.teamStatus === "ARCHIVED";
  const canLeave = () => !busy && (!dirty || window.confirm("Discard your unsaved charter changes?"));

  return (
    <div className="min-w-0 space-y-3">
      {navigation && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to={navigation.back} aria-disabled={busy || undefined} onClick={event => { if (!canLeave()) event.preventDefault(); }}>
              <ArrowLeft />Back to workspace
            </Link>
          </Button>
          <Button variant="outline" size="sm" disabled={busy || navigation.fetching} onClick={navigation.refresh}>
            <RefreshCw className={navigation.fetching ? "animate-spin" : undefined} />Refresh
          </Button>
        </div>
      )}
      <Card className="gap-0 overflow-hidden py-0">
        {navigation && (
          <div className={`grid gap-4 p-4 sm:p-5 ${navigation.teams.length > 0 ? "@min-[700px]:grid-cols-[minmax(0,1fr)_minmax(15rem,0.65fr)] @min-[700px]:items-center" : ""}`}>
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                <BookOpen className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-semibold leading-tight">Team charter</h1>
                  {view && <Badge variant="outline" className={archived ? undefined : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"}>{archived ? "Archived · Read-only" : "Active"}</Badge>}
                  {view && !view.canEdit && !archived && <ReadOnlyBadge />}
                </div>
                <p className="text-sm text-muted-foreground">Agree on working rules, roles and responsibilities. Each member confirms their own agreement.</p>
              </div>
            </div>
            {navigation.teams.length > 0 && (
              <div className="min-w-0 space-y-2">
                <Label htmlFor={teamSelectId}>Team</Label>
                <select id={teamSelectId} className="h-9 w-full min-w-0 truncate rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
                  disabled={busy} value={navigation.teamId ?? ""}
                  onChange={event => { if (canLeave()) navigation.selectTeam(event.target.value); }}
                >
                  {!navigation.teams.some(team => team.teamId === navigation.teamId) && <option value={navigation.teamId ?? ""}>{view?.teamName ?? "Selected team"}</option>}
                  {navigation.teams.map(team => <option key={team.teamId} value={team.teamId}>{team.teamName} · {team.confirmedCount}/{team.memberCount} confirmed</option>)}
                </select>
              </div>
            )}
          </div>
        )}
        {view && (
          <div className={`flex flex-wrap items-center justify-between gap-3 bg-muted/30 px-4 py-3 sm:px-5 ${navigation ? "border-t" : ""}`}>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="break-words text-sm font-semibold [overflow-wrap:anywhere]">{view.teamName}</p>
                <Badge variant="outline">Revision {view.revision}</Badge>
                <Badge variant="secondary">{charterProgressLabel(view)}</Badge>
                {!navigation && !view.canEdit && <ReadOnlyBadge />}
              </div>
              <p className="text-xs text-muted-foreground">{dirty ? "Unsaved changes" : view.revision > 0 ? "Saved revision" : "No saved charter yet"}</p>
            </div>
            <div className="w-full min-w-0 space-y-1.5 sm:w-56">
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{view.memberCount === 0 ? "No members" : `${view.confirmedCount} of ${view.memberCount} members confirmed`}</span>
                <span className="font-medium tabular-nums text-foreground">{percentage}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Member confirmations" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-blue-600" style={{width: `${percentage}%`}} />
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function ReadOnlyBadge() {
  return <Badge variant="secondary"><LockKeyhole aria-hidden="true" />Read-only</Badge>;
}

export default function TeamCharterPage() {
  const [params, setParams] = useSearchParams();
  const {user, activeRole} = usePermissions();
  const scope = [user.email, activeRole];
  const workspaceScoped = params.has("workspaceId");
  const canSwitchTeam = !workspaceScoped && normalizeRole(activeRole) !== STUDENT_ROLE;
  const workspaceId = Number(params.get("workspaceId"));
  const validWorkspaceId = Number.isSafeInteger(workspaceId) && workspaceId > 0 ? workspaceId : undefined;
  const requestedId = Number(params.get("teamId"));
  const requestedTeamId = Number.isSafeInteger(requestedId) && requestedId > 0 ? requestedId : undefined;
  const invalidWorkspaceLink = workspaceScoped && (!validWorkspaceId || !requestedTeamId);
  const teams = useQuery({queryKey: ["charter-teams", ...scope], queryFn: projectHubApi.getCharterTeams, enabled: !workspaceScoped, refetchOnWindowFocus: false, retry: false});
  const teamId = workspaceScoped ? requestedTeamId : requestedTeamId ?? teams.data?.[0]?.teamId;
  const detail = useQuery({queryKey: ["team-charter", teamId, validWorkspaceId, ...scope], queryFn: () => projectHubApi.getCharter(teamId!, validWorkspaceId), enabled: !!teamId && !invalidWorkspaceLink, refetchOnWindowFocus: false, retry: false});
  const back = validWorkspaceId ? `/management/workspaces/${validWorkspaceId}` : "/management/workspaces/candidates";
  const lostAccess = isAxiosError(detail.error) && [401, 403, 404].includes(detail.error.response?.status ?? 0);
  const refreshTeams = async () => { if (!workspaceScoped) await teams.refetch(); };
  const navigation: CharterNavigation = {
    back, teamId, teams: canSwitchTeam ? teams.data ?? [] : [], fetching: (!workspaceScoped && teams.isFetching) || detail.isFetching,
    refresh: () => { void refreshTeams(); if (teamId && !invalidWorkspaceLink) void detail.refetch(); },
    selectTeam: selected => {
      if (!canSwitchTeam) return;
      const next = new URLSearchParams(params);
      next.set("teamId", selected);
      setParams(next);
    },
  };
  const hasContent = !invalidWorkspaceLink && (workspaceScoped || !!teams.data?.length) && !!detail.data && !lostAccess;
  return <MainLayout pathName={{student: "Student", team: "Team", charter: "Team charter", mentor: "Mentor", teams: "Team charters"}}>
    <div className="@container mx-auto w-full min-w-0 max-w-[1200px] space-y-4 pb-6">
      {!hasContent && <CharterHeader navigation={navigation} />}
      {invalidWorkspaceLink ? <Alert variant="destructive"><AlertDescription>Open the team charter from its Workspace to load the correct team.</AlertDescription></Alert>
        : !workspaceScoped && teams.isPending ? <p role="status">Loading teams...</p>
        : !workspaceScoped && teams.isError && !teams.data ? <ErrorBox error={teams.error} retry={() => void refreshTeams()} />
        : !workspaceScoped && !teams.data?.length ? <Card><CardContent className="py-8 text-sm text-muted-foreground">No accessible active or archived teams. Your Team Allocation membership or Mentor scope must be configured first.</CardContent></Card>
        : detail.isPending ? <p role="status">Loading charter...</p>
        : detail.isError && (!detail.data || lostAccess) ? <ErrorBox error={detail.error} retry={() => void detail.refetch()} />
        : detail.data && <>
        {detail.isError && <ErrorBox error={detail.error} retry={() => void detail.refetch()} />}
        <CharterContent
          key={`${teamId}:${validWorkspaceId ?? "overview"}:${user.email}:${activeRole}`}
          view={detail.data}
          navigation={navigation}
          onRefresh={async () => { await detail.refetch(); await refreshTeams(); }}
          onReload={async () => {
            const latest = await detail.refetch({throwOnError: true});
            void refreshTeams();
            return latest.data;
          }}
        />
      </>}
    </div>
  </MainLayout>;
}

export function CharterContent({view, onRefresh, onReload, navigation}: {
  view: TeamCharterView;
  onRefresh: () => Promise<void>;
  onReload: () => Promise<TeamCharterView | undefined>;
  navigation?: CharterNavigation;
}) {
  const confirmationId = useId();
  const confirmationHintId = `${confirmationId}-hint`;
  const queryClient = useQueryClient();
  const {user, activeRole} = usePermissions();
  const [form, setForm] = useState(() => formOf(view));
  const [timeDrafts, setTimeDrafts] = useState<Partial<Record<"start" | "end", string>>>({});
  const [baseline, setBaseline] = useState(() => formOf(view));
  const [preview, setPreview] = useState(false);
  const previewTrigger = useRef<HTMLButtonElement | null>(null);
  const previewTitle = useRef<HTMLHeadingElement | null>(null);
  const restorePreviewFocus = useRef(false);
  const saveInFlight = useRef(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [acknowledgedFor, setAcknowledgedFor] = useState<string | null>(null);
  const agreementId = `${view.revision}:${view.rosterToken}`;
  const acknowledged = acknowledgedFor === agreementId;
  const [tab, setTab] = useState<"current" | "history">("current");
  const [page, setPage] = useState(0);
  const [selectedRevision, setSelectedRevision] = useState<number | null>(null);
  const invalidTimeDraft = Object.values(timeDrafts).some(value => value !== undefined && parseClockTime(value) === null);
  const dirty = invalidTimeDraft || JSON.stringify(form) !== JSON.stringify(baseline);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const coreHoursError = invalidTimeDraft ? "Enter a time like 204, 14:04, or 2:04 PM."
    : form.coreHours !== baseline.coreHours ? validateCoreHours(form.coreHours ?? "") : null;
  const stale = form.version !== view.charter.version;
  // Adopt newer server content only when clean; never overwrite unsaved edits or a just-saved newer token.
  if (!dirty && (view.charter.version ?? 0) > (form.version ?? 0)) {
    const next = formOf(view); setForm(next); setBaseline(next); setAcknowledgedFor(null);
  }
  const refreshAfterRejectedMutation = async (error: unknown) => {
    if (isAxiosError(error) && [401, 403, 404, 409, 422].includes(error.response?.status ?? 0)) await onRefresh();
  };
  const revisionRequest = () => ({version: view.charter.version!, revision: view.revision, rosterToken: view.rosterToken});
  const refreshCharter = async () => {
    await onRefresh();
    await queryClient.invalidateQueries({queryKey: ["charter-history", view.teamId]});
    await queryClient.invalidateQueries({queryKey: ["workspace-detail"], refetchType: "none"});
    await queryClient.invalidateQueries({queryKey: ["team-charter", view.teamId], refetchType: "none"});
  };
  const save = useMutation({mutationFn: () => projectHubApi.saveCharter(view.teamId, form), onError: refreshAfterRejectedMutation, onSuccess: async response => {
    const next = {...form, ...response.charter, responsibilities: form.responsibilities}; setForm(next); setBaseline(next); setPreview(false); setAcknowledgedFor(null);
    setTimeDrafts({});
    toast.success(view.workflow ? "Draft saved." : "Team charter saved."); await refreshCharter();
  }});
  const confirm = useMutation({mutationFn: () => projectHubApi.confirmCharter(view.teamId, revisionRequest()), onError: async error => {
    setAcknowledgedFor(null); await refreshAfterRejectedMutation(error);
  }, onSuccess: async () => {
    setAcknowledgedFor(null); toast.success(view.confirmationKind === "ADMIN" ? "Your Admin acknowledgement was recorded." : "Your role and charter confirmation was recorded."); await refreshCharter();
  }});
  const publication = useMutation({
    mutationFn: (action: "approve" | "publish") => action === "approve"
      ? projectHubApi.approveCharter(view.teamId, revisionRequest())
      : projectHubApi.publishCharter(view.teamId, revisionRequest()),
    onError: refreshAfterRejectedMutation,
    onSuccess: async (response, action) => {
      toast.success(action === "approve" ? `Revision ${response.revision} is open for signing.` : `Revision ${response.revision} is now in effect.`);
      await refreshCharter();
    },
  });
  const reload = useMutation({
    mutationFn: async () => {
      const latest = await onReload();
      if (!latest) throw new Error("The saved charter could not be loaded.");
      return latest;
    },
    onSuccess: latest => {
      const next = formOf(latest);
      setForm(next);
      setBaseline(next);
      setTimeDrafts({});
      setAcknowledgedFor(null);
      setDiscardOpen(false);
      save.reset();
      confirm.reset();
      publication.reset();
    },
  });
  const history = useQuery({queryKey: ["charter-history", view.teamId, view.revision, page, user.email, activeRole], queryFn: () => projectHubApi.getCharterHistory(view.teamId, page), enabled: tab === "history", refetchOnWindowFocus: false});
  const busy = save.isPending || confirm.isPending || publication.isPending || reload.isPending;
  const confirmationDisabled = busy || !view.canConfirm || dirty || stale;
  const adminAcknowledgement = view.confirmationKind === "ADMIN";
  const editable = view.canEdit && !busy;
  const canSave = editable && !coreHoursError && (dirty || view.revision === 0) && form.version != null;
  const submitCharter = () => {
    if (!canSave || saveInFlight.current) return;
    saveInFlight.current = true;
    save.mutate(undefined, {onSettled: () => { saveInFlight.current = false; }});
  };
  const closePreview = () => { if (!saveInFlight.current && !save.isPending) setPreview(false); };
  const focusPreviewTrigger = () => {
    if (!previewTrigger.current?.disabled) {
      previewTrigger.current?.focus();
      restorePreviewFocus.current = false;
    }
  };
  useEffect(() => {
    if (!busy && !preview && restorePreviewFocus.current) focusPreviewTrigger();
  }, [busy, preview]);
  const previewButton = <Button type="button" size="sm" variant="outline" disabled={busy} onClick={event => {
    previewTrigger.current = event.currentTarget;
    setPreview(true);
  }}><Eye />Preview</Button>;
  const requestReload = () => {
    if (dirty) {
      reload.reset();
      setDiscardOpen(true);
    } else {
      reload.mutate();
    }
  };
  const reloadLabel = reload.isPending ? "Reloading…" : dirty ? "Discard changes & reload" : "Reload saved charter";
  const reloadButton = (dirty || stale || save.isError || confirm.isError || publication.isError || reload.isError || reload.isPending) && (
    <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={requestReload}>
      <RefreshCw className={reload.isPending ? "animate-spin" : undefined} />{reloadLabel}
    </Button>
  );
  const members = view.members ?? [];
  const workflow = view.workflow;
  const published = view.publishedCharter;
  const workflowHint = dirty ? "Save or discard local edits before continuing."
    : stale ? "Reload the saved charter before continuing." : workflow?.blockReason;
  const saveLabel = save.isPending ? "Saving…" : workflow ? "Save draft" : "Save charter";
  const confirmationHint = dirty ? "Save or discard local edits before confirming."
    : stale ? "Reload the saved charter before confirming."
    : view.confirmationBlockReason
      ?? (view.canConfirm ? "Your confirmation applies to the saved revision shown above." : "Confirmation is unavailable for this account.");
  return <>
    <CharterHeader view={view} navigation={navigation} dirty={dirty} busy={busy} />
    <Tabs value={tab} onValueChange={value => setTab(value === "history" ? "history" : "current")} className="@container gap-4">
      <div className="border-b">
        <TabsList variant="line" aria-label="Charter sections" className="max-w-full gap-2">
          <TabsTrigger value="current" className="data-[state=active]:text-blue-700 after:bg-blue-600 dark:data-[state=active]:text-blue-300"><BookOpen />{workflow ? "Working revision" : "Current charter"}</TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:text-blue-700 after:bg-blue-600 dark:data-[state=active]:text-blue-300"><History />Revision history</TabsTrigger>
        </TabsList>
      </div>
    <TabsContent value="current" forceMount className="min-w-0 space-y-4 data-[state=inactive]:hidden">
      {stale && dirty && <Alert><AlertDescription>The saved charter changed while you were editing. Your unsaved changes are still here. Discard them to load the latest saved charter.</AlertDescription></Alert>}
      {workflow && (
        <Card className="min-w-0 gap-3 py-4">
          <CardContent className="space-y-3 px-4 sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <h2 className="text-sm font-semibold">{published ? `Revision ${published.revision} is in effect` : "No published charter"}</h2>
                <p className="text-sm text-muted-foreground">
                  {workflow.phase === "DRAFT" ? "An Admin or Team Leader can approve the saved draft to open signing."
                    : workflow.phase === "AWAITING_SIGNATURES" ? "Team members can now sign this revision. Publication requires every member’s signature."
                    : workflow.phase === "READY_TO_PUBLISH" ? "Every team member has signed. An Admin or Team Leader can now publish this revision."
                    : workflow.phase === "PUBLISHED" ? `Published ${formatCharterDate(published?.publishedAt, view.timeZone)}.`
                    : "Save a draft to begin."}
                </p>
              </div>
              {workflow.canManagePublication && workflow.phase === "DRAFT" && (
                <Button type="button" size="sm" disabled={busy || dirty || stale || !workflow.canApprove} onClick={() => publication.mutate("approve")}>
                  {publication.isPending ? "Approving…" : "Approve for signing"}
                </Button>
              )}
              {workflow.canManagePublication && (workflow.phase === "AWAITING_SIGNATURES" || workflow.phase === "READY_TO_PUBLISH") && (
                <Button type="button" size="sm" disabled={busy || dirty || stale || !workflow.canPublish} onClick={() => publication.mutate("publish")}>
                  {publication.isPending ? "Publishing…" : "Publish charter"}
                </Button>
              )}
            </div>
            {workflow.canManagePublication && workflowHint && workflow.phase !== "PUBLISHED" && (
              <p className="text-sm text-muted-foreground">{workflowHint}</p>
            )}
            {publication.isError && <ErrorBox error={publication.error} />}
            {published && (
              <details className="min-w-0 rounded-md border p-3">
                <summary className="cursor-pointer text-sm font-medium">View published charter</summary>
                <div className="mt-3 space-y-4">
                  <CharterSummary charter={published.charter} layout="agreement" />
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Published roles & responsibilities</h3>
                    {published.members.map(member => (
                      <div key={member.membershipId} className="min-w-0 rounded-md border p-3">
                        <p className="text-sm font-medium [overflow-wrap:anywhere]">{member.name} · {member.roles.join(", ")}</p>
                        <SavedCharterText value={member.responsibility} />
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            )}
          </CardContent>
        </Card>
      )}
      <div className="grid items-start gap-4 @min-[840px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] @min-[840px]:grid-rows-[auto_1fr]">
        <Card className="min-w-0 gap-4 py-4">
          <CardHeader className="px-4 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle><h2 className="text-base">Working agreement</h2></CardTitle>
              {dirty && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">Unsaved changes</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">{view.canEdit
              ? "Save a partial draft at any time. Complete all five fields, roles and responsibilities before opening signing."
              : "The team’s saved working rules, communication channel and shared hours."}</p>
          </CardHeader>
          <CardContent className="px-4 sm:px-5">
          {view.canEdit ? (
          <form className="space-y-4" onSubmit={event => { event.preventDefault(); submitCharter(); }}>
            {(view.confirmedCount > 0 || workflow?.phase === "AWAITING_SIGNATURES") && <Alert><AlertDescription>Saving a change starts a new draft. Previous signatures stay in revision history. The new draft must be approved and signed separately.</AlertDescription></Alert>}
            <fieldset disabled={!editable} className="space-y-4">
              {fields.map(field => {
                if (field.key === "coreHours") return <CoreHoursField
                  key={field.key}
                  value={form.coreHours ?? ""}
                  error={coreHoursError}
                  timeDrafts={timeDrafts}
                  onTimeDraftsChange={setTimeDrafts}
                  editable={view.canEdit}
                  timeZone={view.timeZone}
                  onChange={coreHours => setForm(current => ({...current, coreHours}))}
                />;
                const id = `${confirmationId}-${field.key}`;
                const value = form[field.key] ?? "";
                const update = (nextValue: string) => setForm(current => ({...current, [field.key]: nextValue}));
                return (
                  <div key={field.key} className="space-y-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-1">
                      <Label htmlFor={id}>{field.label}</Label>
                      <span id={`${id}-count`} className="text-xs tabular-nums text-muted-foreground">{value.length.toLocaleString()} / {field.max.toLocaleString()} characters</span>
                    </div>
                    {field.key === "primaryChannel" ? (
                      <select id={id} aria-describedby={`${id}-count`} className="h-9 w-full min-w-0 truncate rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring" value={value} onChange={event => update(event.target.value)}>
                        <option value="">Select a channel</option>
                        {value && !channels.includes(value) && <option value={value}>{value}</option>}
                        {channels.map(channel => <option key={channel}>{channel}</option>)}
                      </select>
                    ) : (
                      <Textarea id={id} aria-describedby={`${id}-count`} rows={3} maxLength={field.max} value={value}
                        className="max-h-48 resize-y overflow-y-auto [field-sizing:fixed]" onChange={event => update(event.target.value)} />
                    )}
                  </div>
                );
              })}
            </fieldset>
            {save.isError && <ErrorBox error={save.error} />}
            {reload.isError && !discardOpen && <ErrorBox error={reload.error} />}
            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              {previewButton}
              {reloadButton}
              <Button type="submit" size="sm" className="ml-auto bg-blue-600 text-white hover:bg-blue-700" disabled={!canSave}>
                {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}
                {saveLabel}
              </Button>
            </div>
          </form>
          ) : (
            <div className="space-y-4">
              <CharterSummary charter={view.charter} layout="agreement" />
              <div className="flex flex-wrap items-center gap-3 border-t pt-3">
                {previewButton}
                {reloadButton}
              </div>
              {save.isError && <ErrorBox error={save.error} />}
              {reload.isError && !discardOpen && <ErrorBox error={reload.error} />}
            </div>
          )}
        </CardContent></Card>
          <Card className="min-w-0 gap-4 py-4 @min-[840px]:col-start-2 @min-[840px]:row-span-2 @min-[840px]:row-start-1">
            <CardHeader className="px-4 sm:px-5">
              <CardTitle><h2 className="flex items-center gap-2 text-base"><Users className="size-4 text-blue-600" />Roles & responsibilities</h2></CardTitle>
              <p className="text-sm text-muted-foreground">Roles come from Team Allocation. Responsibilities are saved with the charter.</p>
            </CardHeader>
            <CardContent className="space-y-3 px-4 sm:px-5">
              {!members.length && <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">No members assigned to this team.</p>}
              {members.map(member => {
                const name = member.name?.trim() || "Unnamed member";
                const initials = name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
                const roles = member.roles ?? [];
                const responsibility = view.canEdit
                  ? form.responsibilities?.find(item => item.membershipId === member.membershipId)?.responsibility ?? ""
                  : member.responsibility;
                const dutyId = `duty-${confirmationId}-${member.membershipId}`;
                return (
                  <section key={member.membershipId} className="min-w-0 space-y-2.5 rounded-lg border bg-muted/20 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-blue-100 text-xs font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-300">{initials}</span>
                        <div className="min-w-0">
                          <p className="break-words text-sm font-semibold [overflow-wrap:anywhere]">{name}</p>
                          {member.email && <p className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">{member.email}</p>}
                        </div>
                      </div>
                      <Badge variant="outline" className={member.confirmed
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                        : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"}>
                        {member.confirmed ? "Confirmed" : workflow?.phase === "DRAFT" || workflow?.phase === "NOT_SAVED" ? "Signing not open" : "Pending"}
                      </Badge>
                    </div>
                    {roles.length > 0 && <div className="flex flex-wrap gap-1">{roles.map(role => <Badge variant="secondary" key={role}>{role}</Badge>)}</div>}
                    {(!roles.length || member.issue) && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                        {!roles.length && <p className="font-medium">No valid role assigned</p>}
                        {member.issue && <p>{member.issue}</p>}
                      </div>
                    )}
                    {view.canEdit ? <>
                    <div className="flex flex-wrap items-baseline justify-between gap-1">
                      <Label htmlFor={dutyId}>Responsibility<span className="sr-only"> for {name}</span></Label>
                      <span id={`${dutyId}-count`} className="text-xs tabular-nums text-muted-foreground">{responsibility.length} / 1,000 characters</span>
                    </div>
                    <Textarea id={dutyId} aria-describedby={`${dutyId}-count`} disabled={busy}
                      rows={2} maxLength={1000} className="max-h-36 resize-y overflow-y-auto bg-background [field-sizing:fixed]" value={responsibility}
                      onChange={event => setForm({...form, responsibilities: form.responsibilities?.map(item =>
                        item.membershipId === member.membershipId ? {...item, responsibility: event.target.value} : item)})}
                    />
                    </> : (
                      <dl className="space-y-1 border-t pt-2">
                        <dt className="text-sm font-medium">Responsibility</dt>
                        <dd className="min-w-0"><SavedCharterText value={responsibility} fallback="Responsibility not defined" /></dd>
                      </dl>
                    )}
                    {member.confirmedAt && <p className="text-xs text-muted-foreground">Confirmed {formatCharterDate(member.confirmedAt, view.timeZone)}</p>}
                  </section>
                );
              })}
            </CardContent>
          </Card>
          <Card className="min-w-0 gap-3 py-4 @min-[840px]:col-start-1 @min-[840px]:row-start-2">
            <CardHeader className="px-4 sm:px-5">
              <CardTitle><h2 className="flex items-center gap-2 text-base"><ShieldCheck className="size-4 text-blue-600" />{adminAcknowledgement ? "Admin acknowledgement" : "Charter confirmation"}</h2></CardTitle>
              {user.email && <p className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">Signed in as {user.email}</p>}
            </CardHeader>
            <CardContent className="space-y-3 px-4 sm:px-5">
            {adminAcknowledgement && <Alert><AlertDescription>You are confirming as Admin using your own account. This acknowledgement does not replace any member's consent or increase the team's confirmation progress.</AlertDescription></Alert>}
            {view.selfConfirmedAt && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">Your {adminAcknowledgement ? "Admin acknowledgement" : "confirmation"} was recorded: {formatCharterDate(view.selfConfirmedAt, view.timeZone)}.</p>}
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
                {adminAcknowledgement ? "I have read this saved charter and acknowledge it as Admin using my own account." : "I have read this saved charter and agree to my assigned roles and responsibilities."}
              </Label>
            </div>
            <p id={confirmationHintId} className={`rounded-md px-3 py-2 text-xs ${confirmationDisabled && !view.selfConfirmedAt ? "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200" : "text-muted-foreground"}`}>{confirmationHint}</p>
            <Button aria-describedby={confirmationHintId} className="h-auto min-h-9 w-full whitespace-normal py-2" disabled={confirmationDisabled || !acknowledged} onClick={() => { if (!confirmationDisabled && acknowledged) confirm.mutate(); }}>
              {confirm.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
              {confirm.isPending ? "Confirming…" : adminAcknowledgement ? "Confirm charter as Admin" : "Confirm my role & charter"}
            </Button>
            {confirm.isError && <ErrorBox error={confirm.error} />}
            </CardContent>
          </Card>
      </div>
    </TabsContent>
    <Dialog open={discardOpen} onOpenChange={open => { if (!reload.isPending) setDiscardOpen(open); }}>
      <DialogContent
        role="alertdialog"
        showCloseButton={false}
        onEscapeKeyDown={event => { if (reload.isPending) event.preventDefault(); }}
        onInteractOutside={event => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Discard unsaved changes?</DialogTitle>
          <DialogDescription>The latest saved charter will replace your edits, including any changes to member responsibilities.</DialogDescription>
        </DialogHeader>
        {reload.isError && <ErrorBox error={reload.error} />}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => setDiscardOpen(false)}>Keep editing</Button>
          <Button type="button" variant="destructive" disabled={busy} onClick={() => reload.mutate()}>
            {reload.isPending ? "Reloading…" : "Discard & reload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <TabsContent value="history" className="min-w-0">
      {history.isPending ? <p role="status" className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">Loading revision history…</p>
        : history.isError ? <ErrorBox error={history.error} retry={() => void history.refetch()} />
        : history.data && <RevisionHistoryViewer
            data={history.data}
            currentRevision={view.revision}
            selectedRevision={selectedRevision}
            onSelect={setSelectedRevision}
            page={page}
            fetching={history.isFetching}
            onPageChange={next => { setSelectedRevision(null); setPage(next); }}
            timeZone={view.timeZone}
          />}
    </TabsContent>
    </Tabs>
    <Dialog open={preview} onOpenChange={open => { if (!open) closePreview(); }}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-slate-950/50"
        className="flex max-h-[90dvh] w-[calc(100%_-_1rem)] max-w-[920px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[920px]"
        onOpenAutoFocus={event => { event.preventDefault(); previewTitle.current?.focus(); }}
        onCloseAutoFocus={event => {
          event.preventDefault();
          restorePreviewFocus.current = true;
          focusPreviewTrigger();
        }}
        onEscapeKeyDown={event => { if (saveInFlight.current || save.isPending) event.preventDefault(); }}
        onInteractOutside={event => { if (saveInFlight.current || save.isPending) event.preventDefault(); }}
      >
        <DialogHeader className="shrink-0 border-b px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-start gap-3">
            <span className="hidden size-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700 sm:grid dark:bg-blue-950 dark:text-blue-300">
              <FileText aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <DialogTitle asChild>
                  <h2 ref={previewTitle} tabIndex={-1} className="text-lg font-semibold leading-tight">Preview team charter</h2>
                </DialogTitle>
                {dirty ? <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">Unsaved changes</Badge>
                  : <Badge variant="secondary">{view.revision > 0 ? `Saved revision ${view.revision}` : "Not saved yet"}</Badge>}
              </div>
              {view.teamName && <p className="text-sm font-medium [overflow-wrap:anywhere]">{view.teamName}</p>}
              <DialogDescription>Previewing does not record anyone’s confirmation.</DialogDescription>
            </div>
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Close preview" disabled={save.isPending}><X /></Button>
            </DialogClose>
          </div>
        </DialogHeader>
        <div className="min-h-0 min-w-0 space-y-4 overflow-y-auto overscroll-contain bg-muted/25 px-4 py-4 sm:px-6">
          <section className="min-w-0 space-y-3 rounded-xl border bg-card p-3 sm:p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><BookOpen className="size-4 text-blue-600" aria-hidden="true" />Working agreement</h3>
            <CharterSummary charter={invalidTimeDraft ? {...form, coreHours: ""} : form} layout="agreement" />
          </section>
          <section className="min-w-0 space-y-3 rounded-xl border bg-card p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold"><Users className="size-4 text-blue-600" aria-hidden="true" />Roles & responsibilities</h3>
              <Badge variant="secondary">{members.length} {members.length === 1 ? "member" : "members"}</Badge>
            </div>
            {members.length === 0 ? <p className="text-sm text-muted-foreground">No members assigned to this team.</p> : (
              <ul className="grid min-w-0 gap-2.5 sm:grid-cols-2">
                {members.map(member => {
                  const roles = member.roles ?? [];
                  const responsibility = form.responsibilities?.find(item => item.membershipId === member.membershipId)?.responsibility;
                  return (
                    <li key={member.membershipId} className="min-w-0 space-y-2 rounded-lg border bg-muted/20 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="min-w-0 text-sm font-semibold [overflow-wrap:anywhere]">{member.name?.trim() || "Unnamed member"}</p>
                        {roles.length ? roles.map(role => <Badge key={role} variant="secondary">{role}</Badge>) : <span className="text-xs text-muted-foreground">No role assigned</span>}
                      </div>
                      <SavedCharterText value={responsibility} fallback="Responsibility not defined" />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
        <DialogFooter className="m-0 shrink-0 gap-2 bg-background px-4 py-3 sm:flex-col sm:px-6">
          {coreHoursError && <Alert variant="destructive"><AlertDescription>{coreHoursError}</AlertDescription></Alert>}
          {save.isError && <ErrorBox error={save.error} />}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" disabled={save.isPending} onClick={closePreview}>Back to charter</Button>
            {view.canEdit && <Button type="button" size="sm" className="bg-blue-600 text-white hover:bg-blue-700" disabled={!canSave} onClick={submitCharter}>
              {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}
              {saveLabel}
            </Button>}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}

function RevisionHistoryViewer({data, currentRevision, selectedRevision, onSelect, page, fetching, onPageChange, timeZone}: {
  data: CharterHistoryPage;
  currentRevision: number;
  selectedRevision: number | null;
  onSelect: (revision: number) => void;
  page: number;
  fetching: boolean;
  onPageChange: (page: number) => void;
  timeZone?: string;
}) {
  const id = useId();
  const revisions = data.content ?? [];
  const selected = revisions.find(item => item.revision === selectedRevision)
    ?? revisions.find(item => item.revision === currentRevision)
    ?? revisions[0]; // The API returns the newest saved revision first on each page.

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5 text-sm text-blue-950 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-100">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-blue-600 dark:text-blue-300" />
        <p>Times are shown in {charterTimeZone(timeZone)}. Recorded confirmations apply only to the revision on which they were given. Members confirm the current revision separately.</p>
      </div>
      <div className="grid min-w-0 items-start gap-4 @min-[840px]:grid-cols-[minmax(0,3fr)_minmax(0,7fr)]">
        <section className="min-w-0 space-y-3" aria-labelledby={`${id}-title`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id={`${id}-title`} className="text-sm font-semibold">Saved revisions</h2>
            <Badge variant="secondary">{data.totalElements}</Badge>
          </div>
          {selected ? (
            <>
              <div className="space-y-2 @min-[840px]:hidden">
                <Label htmlFor={`${id}-revision`}>Revision to view</Label>
                <select id={`${id}-revision`} value={selected.revision} onChange={event => onSelect(Number(event.target.value))}
                  className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring">
                  {revisions.map(item => <option key={item.revision} value={item.revision}>
                    Revision {item.revision}{item.revision === currentRevision ? " · Latest revision" : ""}{item.publishedAt ? " · Published" : ""}
                  </option>)}
                </select>
              </div>
              <fieldset className="hidden min-w-0 space-y-2 @min-[840px]:block">
                <legend className="sr-only">Revision to view</legend>
                {revisions.map(item => {
                  const viewed = selected.revision === item.revision;
                  return (
                    <label key={item.revision} className={`relative block min-w-0 cursor-pointer space-y-1.5 rounded-lg border p-3 text-sm shadow-sm hover:bg-muted/60 focus-within:ring-2 focus-within:ring-ring ${viewed ? "border-blue-400 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/50" : "bg-card"}`}>
                      <input type="radio" name={`${id}-history`} className="sr-only" aria-label={`Revision ${item.revision}`}
                        checked={viewed} onChange={() => onSelect(item.revision)} />
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold">Revision {item.revision}</span>
                        {item.revision === currentRevision && <Badge variant="outline">Latest revision</Badge>}
                      </span>
                      <span className="block text-xs text-muted-foreground">{formatCharterDate(item.savedAt, timeZone)}</span>
                      <span className="flex flex-wrap items-center justify-between gap-1 text-xs text-muted-foreground">
                        <span>{item.confirmations?.length ?? "—"} confirmation records</span>
                        {viewed && <span className="font-medium text-blue-700 dark:text-blue-300">Viewing</span>}
                      </span>
                    </label>
                  );
                })}
              </fieldset>
            </>
          ) : <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">{page === 0 ? "No saved revisions yet." : "No revisions on this page."}</p>}
          {(data.totalPages > 1 || page > 0) && (
            <nav aria-label="Revision history pages" className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
              <Button type="button" variant="outline" size="icon-sm" aria-label="Previous page" disabled={page === 0 || fetching} onClick={() => onPageChange(page - 1)}><ChevronLeft /></Button>
              <span role="status" className="text-sm text-muted-foreground">Page {page + 1} of {Math.max(1, data.totalPages)}</span>
              <Button type="button" variant="outline" size="icon-sm" aria-label="Next page" disabled={page + 1 >= data.totalPages || fetching} onClick={() => onPageChange(page + 1)}><ChevronRight /></Button>
            </nav>
          )}
        </section>
        {selected && <RevisionSnapshot revision={selected} isCurrent={selected.revision === currentRevision} timeZone={timeZone} />}
      </div>
    </div>
  );
}

function RevisionSnapshot({revision, isCurrent, timeZone}: {revision: CharterHistory; isCurrent: boolean; timeZone?: string}) {
  return (
    <Card className="min-w-0 gap-4 py-4">
      <CardHeader className="border-b px-4 pb-4 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle><h2 className="text-lg">Revision {revision.revision}</h2></CardTitle>
          <ReadOnlyBadge />
          {isCurrent && <Badge variant="outline" className="border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-300">Latest revision</Badge>}
          {revision.publishedAt && <Badge variant="secondary">Published</Badge>}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Saved {formatCharterDate(revision.savedAt, timeZone)}</span>
          <span>{revision.actorId == null ? "Saved by an unrecorded user" : `Saved by User #${revision.actorId}`}</span>
          {revision.approvedAt && <span>Approved for signing {formatCharterDate(revision.approvedAt, timeZone)} · User #{revision.approvedBy}</span>}
          {revision.publishedAt && <span>Published {formatCharterDate(revision.publishedAt, timeZone)} · User #{revision.publishedBy}</span>}
        </div>
      </CardHeader>
      <CardContent className="space-y-5 px-4 sm:px-5">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Working agreement snapshot</h3>
          <CharterSummary charter={revision.charter} layout="agreement" historical />
        </section>
        <section className="space-y-3 border-t pt-4">
          <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">Team snapshot
            {revision.members != null && <Badge variant="secondary">{revision.members.length} members</Badge>}
          </h3>
          {revision.members?.length ? (
            <ul className="space-y-2">
              {revision.members.map(member => (
                <li key={member.membershipId ?? member.userId} className="min-w-0 space-y-1.5 rounded-lg border bg-muted/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 text-sm font-semibold [overflow-wrap:anywhere]">{member.name?.trim() || "Member name not recorded"}</p>
                    <div className="flex flex-wrap gap-1">
                      {member.roles?.length ? member.roles.map(role => <Badge variant="secondary" key={role}>{role}</Badge>)
                        : <span className="text-xs text-muted-foreground">{member.roles == null ? "Roles not recorded" : "No assigned role"}</span>}
                    </div>
                  </div>
                  <SavedCharterText value={member.responsibility} fallback={member.responsibility == null ? "Responsibility not recorded" : "No responsibility provided"} />
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">{revision.members == null ? "Member snapshot not recorded." : "No members listed in the snapshot."}</p>}
        </section>
        <section className="space-y-3 border-t pt-4">
          <h3 className="text-sm font-semibold">Recorded confirmations</h3>
          {revision.confirmations?.length ? (
            <ul className="divide-y rounded-lg border">
              {revision.confirmations.map(record => {
                const admin = record.roles?.includes("ADMIN");
                return (
                  <li key={record.userId} className="min-w-0 space-y-1.5 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="min-w-0 text-sm font-semibold [overflow-wrap:anywhere]">{record.name?.trim() || (record.userId == null ? "Signer not recorded" : `User #${record.userId}`)}</p>
                      <Badge variant="outline">{admin ? "Admin acknowledgement" : record.roles?.length ? "Member confirmation" : "Confirmation"}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                      <span>{record.roles?.length ? record.roles.join(", ") : record.roles == null ? "Roles not recorded" : "No roles listed"}</span>
                      <span>{formatCharterDate(record.confirmedAt, timeZone)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : <p className="text-sm text-muted-foreground">{revision.confirmations == null ? "Confirmation records unavailable." : "No confirmations recorded for this revision."}</p>}
        </section>
      </CardContent>
    </Card>
  );
}

function CoreHoursField({value, error, editable, timeZone, onChange, timeDrafts, onTimeDraftsChange}: {
  value: string;
  error: string | null;
  editable: boolean;
  timeZone?: string;
  onChange: (value: string) => void;
  timeDrafts: Partial<Record<"start" | "end", string>>;
  onTimeDraftsChange: (value: Partial<Record<"start" | "end", string>>) => void;
}) {
  const id = useId();
  const parsed = parseCoreHours(value);
  const legacy = !!value && (!parsed || (!error && !!validateCoreHours(value)));
  const schedule = legacy || !parsed ? {days: [], start: "", end: ""} : parsed;
  const weekdays = coreHourDays.slice(0, 5);
  const weekdaysSelected = weekdays.every(day => schedule.days.includes(day));
  const complete = !legacy && !error && schedule.days.length > 0 && !!schedule.start && !!schedule.end;
  const updateTime = (field: "start" | "end", text: string, finished = false) => {
    const time = parseClockTime(text);
    onTimeDraftsChange({...timeDrafts, [field]: finished && time !== null ? undefined : text});
    if (time !== null) onChange(formatCoreHours({...schedule, [field]: time}));
  };
  return (
    <fieldset className="min-w-0 space-y-2" aria-describedby={editable ? `${id}-hint${error ? ` ${id}-error` : ""}` : undefined}>
      <legend className="text-sm font-medium">Core hours</legend>
      {legacy && <p className="break-words rounded-md bg-muted/40 px-3 py-2 text-sm [overflow-wrap:anywhere]">Saved hours: {value}</p>}
      {editable && (
        <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
          <p id={`${id}-hint`} className="text-xs text-muted-foreground">
            {legacy && "Picking a day or time replaces the saved text when you save. "}
            Choose the days that share the same hours ({charterTimeZone(timeZone)}). Type 204 for 2:04 AM or pick a time.
          </p>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">Working days</span>
              <Button type="button" size="sm" variant="outline" className="h-8 bg-background text-xs"
                aria-pressed={weekdaysSelected}
              onClick={() => onChange(formatCoreHours({
                ...schedule,
                days: weekdaysSelected ? schedule.days.filter(day => !weekdays.includes(day)) : [...schedule.days, ...weekdays],
              }))}>
                Mon–Fri
              </Button>
            </div>
            <div role="group" aria-label="Working days" className="flex flex-wrap gap-1.5">
            {coreHourDays.map(day => (
              <Button
                key={day}
                type="button"
                size="sm"
                variant="outline"
                className="h-9 w-10 px-0 text-xs aria-pressed:border-blue-300 aria-pressed:bg-blue-50 aria-pressed:text-blue-800 dark:aria-pressed:border-blue-700 dark:aria-pressed:bg-blue-950 dark:aria-pressed:text-blue-200"
                aria-pressed={schedule.days.includes(day)}
                onClick={() => onChange(formatCoreHours({
                  ...schedule,
                  days: schedule.days.includes(day) ? schedule.days.filter(item => item !== day) : [...schedule.days, day],
                }))}
              >
                {day}
              </Button>
            ))}
            </div>
          </div>
          <div className="grid gap-3 border-t pt-3 sm:grid-cols-2">
            <CoreTimePicker label="Start time" value={formatClockLabel(schedule.start)} draft={timeDrafts.start} errorId={error ? `${id}-error` : undefined}
              onChange={(text, finished) => updateTime("start", text, finished)} />
            <CoreTimePicker label="End time" value={formatClockLabel(schedule.end)} draft={timeDrafts.end} errorId={error ? `${id}-error` : undefined}
              onChange={(text, finished) => updateTime("end", text, finished)} />
          </div>
          {(value || error) && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
              {error ? <p id={`${id}-error`} role="status" className="text-sm text-destructive">{error}</p>
                : complete && <p className="flex min-w-0 items-start gap-1.5 text-xs text-muted-foreground">
                    <Clock aria-hidden="true" className="size-3.5 shrink-0" />
                    <span>{schedule.days.join(", ")} · <span className="font-medium text-foreground">{formatClockLabel(schedule.start)}–{formatClockLabel(schedule.end)}</span></span>
                  </p>}
              <Button type="button" variant="ghost" size="sm" className="ml-auto h-8 text-xs" onClick={() => {
                onTimeDraftsChange({});
                onChange("");
              }}>Clear hours</Button>
            </div>
          )}
        </div>
      )}
      {!editable && !legacy && <p className="text-sm">{value ? `${value} (${charterTimeZone(timeZone)})` : "Not provided"}</p>}
    </fieldset>
  );
}

function formatClockLabel(value: string) {
  if (!value) return "";
  const [hour, minute] = value.split(":");
  const number = Number(hour);
  return `${number % 12 || 12}:${minute} ${number < 12 ? "AM" : "PM"}`;
}

const suggestedTimes = Array.from({length: 96}, (_, slot) => {
  const hour = Math.floor(slot / 4);
  const minute = String(slot % 4 * 15).padStart(2, "0");
  return formatClockLabel(`${hour}:${minute}`);
});

function CoreTimePicker({label, value, draft, errorId, onChange}: {
  label: string;
  value: string;
  draft?: string;
  errorId?: string;
  onChange: (value: string, finished?: boolean) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const selected = formatClockLabel(parseClockTime(draft ?? value) ?? "");
  const finishTyping = () => {
    if (draft !== undefined) onChange(draft, true);
  };
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor className="relative">
          <Input id={id} value={draft ?? value} onChange={event => onChange(event.target.value)}
            onBlur={finishTyping}
            onKeyDown={event => {
              if (event.key === "Enter") {
                event.preventDefault();
                finishTyping();
              }
            }}
            autoComplete="off" maxLength={16} placeholder="e.g. 204" className="bg-background pr-10 tabular-nums"
            aria-invalid={!!errorId} aria-describedby={errorId} />
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="absolute inset-y-1 right-1 size-7"
              aria-label={`Choose ${label.toLowerCase()}`}>
              <Clock aria-hidden="true" className="size-4" />
            </Button>
          </PopoverTrigger>
        </PopoverAnchor>
        <PopoverContent align="start" collisionPadding={12} aria-label={`Suggested ${label.toLowerCase()}s`}
          className="w-(--radix-popover-trigger-width) min-w-40 max-w-[calc(100vw-1.5rem)] p-2">
          <div className="grid max-h-[min(12rem,var(--radix-popover-content-available-height)-1rem)] grid-cols-2 gap-1 overflow-y-auto overscroll-contain">
            {suggestedTimes.map(time => (
              <Button key={time} type="button" size="sm" variant={selected === time ? "secondary" : "ghost"}
                aria-pressed={selected === time} className="h-8 justify-start px-2 text-xs tabular-nums" onClick={() => {
                  onChange(time, true);
                  setOpen(false);
                }}>
                {time}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function SavedCharterText({value, fallback = "Not provided"}: {value?: string | null; fallback?: string}) {
  return <p className={`whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere] ${value?.trim() ? "" : "text-muted-foreground"}`}>{value?.trim() ? value : fallback}</p>;
}

function CharterSummary({charter, layout = "stack", historical = false}: {
  charter: CharterHistory["charter"];
  layout?: "stack" | "agreement";
  historical?: boolean;
}) {
  return (
    <dl className={layout === "agreement" ? "grid gap-4 sm:grid-cols-2" : "space-y-3"}>
      {fields.map(field => {
        const Icon = layout === "agreement" && (field.key === "primaryChannel" ? MessagesSquare : field.key === "coreHours" ? Clock : null);
        return (
          <div key={field.key} className={layout === "agreement" && !Icon ? "min-w-0 sm:col-span-2" : "min-w-0"}>
            <dt className="text-sm font-semibold">{field.label}</dt>
            <dd className="mt-1.5 flex min-w-0 items-start gap-2 rounded-lg bg-muted/50 p-3">
              {Icon && <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-blue-600 dark:text-blue-300" />}
              <SavedCharterText value={charter?.[field.key]} fallback={historical && charter?.[field.key] == null ? "Not recorded in this snapshot" : undefined} />
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
