import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { workspaceApi } from "@/api/features/workspace.api";
import type { ProjectLog, ProjectLogAuthorOption, ProjectLogAttendeeOption, ProjectLogTargetType, ProjectLogType, ProjectLogOption } from "@/types/features/workspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { WorkspaceEmptyState, getWorkspaceError } from "./workspace.shared";
import { Activity, ChevronRight, FileText, Plus, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

const LOG_TITLE_MAX_LENGTH = 100;
const LOG_TEXT_MAX_LENGTH = 2000;
const DECISION_FIELD_MAX_WORDS = 1000;
const ACTIVITY_PAGE_SIZE = 5;

function countWords(value: string) {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

type LogForm = {
  type: ProjectLogType; title: string; content: string; rationale: string; impactAnalysis: string;
  category: "RISK" | "ISSUE"; severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  mitigationPlan: string; meetingDate: string; attendees: string; actionItems: string;
  targetType: ProjectLogTargetType | ""; targetId: string;
};
const emptyForm: LogForm = {
  type: "DECISION", title: "", content: "", rationale: "", impactAnalysis: "", category: "RISK",
  severity: "MEDIUM", mitigationPlan: "", meetingDate: "", attendees: "", actionItems: "",
  targetType: "", targetId: ""
};
type LogView = ProjectLogType | "ALL" | "ACTIVITY";
const LOG_TABS: { label: string; value: LogView }[] = [
  { label: "All logs", value: "ALL" }, { label: "Decisions", value: "DECISION" },
  { label: "Risks & issues", value: "RISK_ISSUE" }, { label: "Meeting notes", value: "MEETING_NOTE" },
  { label: "Activity feed", value: "ACTIVITY" },
];
const authorRoleLabel = (role: ProjectLogAuthorOption["role"]) => ({
  MEMBER: "Team member",
  MENTOR: "Assigned mentor",
  TRAINER: "Class trainer",
  CLASS_ADMIN: "Class admin"
})[role];
const attendeeRoleLabel = (role: ProjectLogAttendeeOption["role"]) => ({
  MEMBER: "Team members",
  MENTOR: "Assigned team mentor",
  TRAINER: "Class trainer",
  CLASS_ADMIN: "Class administrators"
})[role];
const attendeeRoles: ProjectLogAttendeeOption["role"][] = ["MEMBER", "MENTOR", "TRAINER", "CLASS_ADMIN"];

export function WorkspaceProjectLogsPanel({ workspaceId, readOnly = false }: { workspaceId: number; readOnly?: boolean }) {
  const queryClient = useQueryClient();
  const [view, setView] = useState<LogView>("ALL");
  const type = view === "ALL" || view === "ACTIVITY" ? undefined : view;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);
  const detail = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [linkedTarget, setLinkedTarget] = useState("");
  const [decisionStatus, setDecisionStatus] = useState("");
  const [decisionLinkType, setDecisionLinkType] = useState("");
  const [riskCategory, setRiskCategory] = useState("");
  const [riskSeverity, setRiskSeverity] = useState("");
  const [riskStatus, setRiskStatus] = useState("");
  const [riskTarget, setRiskTarget] = useState("");
  const [meetingFrom, setMeetingFrom] = useState("");
  const [meetingTo, setMeetingTo] = useState("");
  const [attendeeId, setAttendeeId] = useState("");
  const [hasActionItems, setHasActionItems] = useState("");
  const [page, setPage] = useState(0);
  const [activityPage, setActivityPage] = useState(0);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<LogForm>(emptyForm);
  const [attendeeSearch, setAttendeeSearch] = useState("");
  const query = useQuery({
    queryKey: ["project-logs", workspaceId, type, search, createdBy, createdFrom, createdTo, linkedTarget,
      decisionStatus, decisionLinkType, riskCategory, riskSeverity, riskStatus, riskTarget,
      meetingFrom, meetingTo, attendeeId, hasActionItems, page],
    queryFn: ({ signal }) => {
      const [targetType, targetId] = linkedTarget ? linkedTarget.split(":") : ["", ""];
      const [itemTargetType, itemTargetId] = riskTarget ? riskTarget.split(":") : ["", ""];
      return workspaceApi.projectLogs(workspaceId, {
        type, search: search || undefined, createdBy: createdBy ? Number(createdBy) : undefined,
        createdFrom: createdFrom || undefined, createdTo: createdTo || undefined,
        targetType: targetType as ProjectLogTargetType || undefined, targetId: targetId || undefined,
        linkType: type === "DECISION" ? decisionLinkType as ProjectLogTargetType || undefined : undefined,
        itemTargetType: type === "RISK_ISSUE" ? itemTargetType as ProjectLogTargetType || undefined : undefined,
        itemTargetId: type === "RISK_ISSUE" ? itemTargetId || undefined : undefined,
        status: type === "DECISION" ? decisionStatus || undefined : type === "RISK_ISSUE" ? riskStatus || undefined : undefined,
        category: type === "RISK_ISSUE" ? riskCategory || undefined : undefined,
        severity: type === "RISK_ISSUE" ? riskSeverity || undefined : undefined,
        meetingFrom: type === "MEETING_NOTE" ? meetingFrom || undefined : undefined,
        meetingTo: type === "MEETING_NOTE" ? meetingTo || undefined : undefined,
        attendeeId: type === "MEETING_NOTE" && attendeeId ? Number(attendeeId) : undefined,
        hasActionItems: type === "MEETING_NOTE" && hasActionItems ? hasActionItems === "true" : undefined,
        page, size: 10
      }, signal);
    },
    enabled: view !== "ACTIVITY",
    retry: false
  });
  const options = useQuery({
    queryKey: ["project-log-options", workspaceId],
    queryFn: ({ signal }) => workspaceApi.projectLogOptions(workspaceId, signal),
    retry: false
  });
  const activity = useQuery({
    queryKey: ["workspace-section", workspaceId, "activity"],
    queryFn: ({ signal }) => workspaceApi.section(workspaceId, "activity", signal),
    enabled: view === "ACTIVITY",
    retry: false
  });
  const activityItems = activity.data?.items ?? [];
  const activityPageCount = Math.ceil(activityItems.length / ACTIVITY_PAGE_SIZE);
  const currentActivityPage = Math.min(activityPage, Math.max(0, activityPageCount - 1));
  const visibleActivityItems = activityItems.slice(
    currentActivityPage * ACTIVITY_PAGE_SIZE,
    (currentActivityPage + 1) * ACTIVITY_PAGE_SIZE
  );
  const createMutation = useMutation({
    mutationFn: () => workspaceApi.createProjectLog(workspaceId, {
      ...form,
      meetingDate: form.type === "MEETING_NOTE" ? new Date(form.meetingDate).toISOString() : undefined,
      attendees: form.type === "MEETING_NOTE"
        ? form.attendees.split("|").filter(Boolean).map(Number)
        : undefined,
      targetType: form.targetId ? form.targetType || undefined : undefined,
      targetId: form.targetId || undefined
    }),
    onSuccess: async (saved) => {
      setCreating(false);
      setForm(emptyForm);
      clearFilters();
      setSelectedLogId(saved.id);
      if (view !== "ALL") setView(saved.type);
      await queryClient.invalidateQueries({ queryKey: ["project-logs", workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ["workspace-section", workspaceId, "activity"] });
      toast.success("Project log saved.");
    }
  });
  const riskMutation = useMutation({
    mutationFn: ({ item, status }: { item: ProjectLog; status: string }) =>
      workspaceApi.updateRiskLog(workspaceId, item.id, { status }, item.version, crypto.randomUUID()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["project-logs", workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ["workspace-section", workspaceId, "activity"] });
      toast.success("Risk status updated.");
    }
  });
  const eligibleTargets = useMemo((): ProjectLogOption[] => {
    const data = options.data;
    if (!data) return [];
    if (form.type === "MEETING_NOTE") return [...data.milestones, ...data.sprints];
    return [...data.milestones, ...data.tasks, ...data.backlogItems];
  }, [form.type, options.data]);
  function changeType(next: ProjectLogType) {
    setForm(current => ({ ...current, type: next, targetType: "", targetId: "" }));
  }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly || createMutation.isPending || (form.type === "MEETING_NOTE" && !form.attendees)) return;
    createMutation.mutate();
  }
  const targetOptions = eligibleTargets.filter(option => option.type === form.targetType);
  const selectedAttendeeIds = form.attendees.split("|").filter(Boolean);
  const filteredAttendees = (options.data?.attendees ?? []).filter(person =>
    `${person.label} ${attendeeRoleLabel(person.role)}`.toLowerCase().includes(attendeeSearch.trim().toLowerCase()));
  const updateAttendeeSelection = (id: number, checked: boolean) => {
    const selected = new Set(selectedAttendeeIds);
    if (checked) selected.add(String(id));
    else selected.delete(String(id));
    const ids = [...selected];
    setForm(current => ({ ...current, attendees: ids.length ? `|${ids.join("|")}|` : "" }));
  };
  const commonTargets = [...(options.data?.milestones ?? []), ...(options.data?.sprints ?? [])];
  const riskTargets = [...(options.data?.milestones ?? []), ...(options.data?.tasks ?? []), ...(options.data?.backlogItems ?? [])];
  const allTargets = [...riskTargets, ...(options.data?.sprints ?? [])];
  const logs = query.data?.content ?? [];
  const selectedLog = logs.find(item => item.id === selectedLogId) ?? logs[0];
  const typeFilters = type === "DECISION" ? [decisionStatus, decisionLinkType]
    : type === "RISK_ISSUE" ? [riskCategory, riskSeverity, riskStatus, riskTarget]
      : type === "MEETING_NOTE" ? [meetingFrom, meetingTo, attendeeId, hasActionItems] : [];
  const filterCount = [createdBy, createdFrom, createdTo, linkedTarget, ...typeFilters].filter(Boolean).length;
  const filtered = !!search.trim() || filterCount > 0;
  const clearFilters = () => {
    setSearch(""); setCreatedBy(""); setCreatedFrom(""); setCreatedTo(""); setLinkedTarget("");
    setDecisionStatus(""); setDecisionLinkType(""); setRiskCategory(""); setRiskSeverity("");
    setRiskStatus(""); setRiskTarget(""); setMeetingFrom(""); setMeetingTo(""); setAttendeeId("");
    setHasActionItems(""); setPage(0); setSelectedLogId(null);
  };
  const openCreate = () => {
    setForm({ ...emptyForm, type: type ?? "DECISION" });
    setAttendeeSearch("");
    createMutation.reset();
    void options.refetch();
    setCreating(true);
  };
  return <>
    <Tabs value={view} onValueChange={value => {
      setView(value as LogView); setPage(0); setSelectedLogId(null);
    }} className="gap-4">
      <Card className="gap-4">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <CardTitle>Risks, Decisions &amp; Logs</CardTitle>
              <CardDescription>Review project decisions, track risks and issues, and revisit meeting notes.</CardDescription>
            </div>
            {!readOnly && <Button onClick={openCreate}><Plus className="size-4" />Create log</Button>}
          </div>
        </CardHeader>
        <CardContent>
          <TabsList aria-label="Workspace logs" className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-3 xl:grid-cols-5">
            {LOG_TABS.map(tab => <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>)}
          </TabsList>
        </CardContent>
      </Card>

      {view !== "ACTIVITY" && <TabsContent value={view} className="grid min-w-0 gap-4">
        <Card className="gap-0 py-0">
          <CardContent className="grid gap-4 px-4 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-48 flex-1">
                <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input aria-label="Search project logs" placeholder="Search title, content or rationale" className="pl-9"
                  value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} />
              </div>
              <Button type="button" variant={filtersOpen ? "secondary" : "outline"} aria-expanded={filtersOpen}
                aria-controls="workspace-log-filters" onClick={() => setFiltersOpen(open => !open)}>
                <SlidersHorizontal className="size-4" />Filters{filterCount > 0 && <Badge variant="secondary">{filterCount}</Badge>}
              </Button>
              {filtered && <Button type="button" variant="ghost" onClick={clearFilters}>Clear filters</Button>}
            </div>
            {filtersOpen && <div id="workspace-log-filters" className="grid gap-3 border-t pt-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <select aria-label="Filter by author" className="rounded-md border bg-background px-3 py-2" value={createdBy}
          onChange={event => { setCreatedBy(event.target.value); setPage(0); }}>
          <option value="">All authors</option>
          {(options.data?.authors ?? []).map(author => <option key={author.id} value={author.id}>{author.label} ({authorRoleLabel(author.role)})</option>)}
        </select>
        <div className="flex items-center gap-2">
          <Input aria-label="Created from" type="date" value={createdFrom}
            onChange={event => { setCreatedFrom(event.target.value); setPage(0); }} />
          <span className="text-sm text-muted-foreground">to</span>
          <Input aria-label="Created to" type="date" value={createdTo}
            onChange={event => { setCreatedTo(event.target.value); setPage(0); }} />
        </div>
        <select aria-label="Filter by linked milestone or sprint" className="rounded-md border bg-background px-3 py-2"
          value={linkedTarget} onChange={event => { setLinkedTarget(event.target.value); setPage(0); }}>
          <option value="">All linked milestones and sprints</option>
          {commonTargets.map(option => <option key={`${option.type}:${option.id}`} value={`${option.type}:${option.id}`}>
            {option.type === "SPRINT" ? "Sprint" : "Milestone"}: {option.label}
          </option>)}
        </select>
              </div>
    {type === "DECISION" && <div className="grid gap-3 md:grid-cols-2">
      <select aria-label="Filter decision status" className="rounded-md border bg-background px-3 py-2" value={decisionStatus}
        onChange={event => { setDecisionStatus(event.target.value); setPage(0); }}>
        <option value="">All decision statuses</option><option value="PROPOSED">Proposed</option>
        <option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="SUPERSEDED">Superseded</option>
      </select>
      <select aria-label="Filter decision linked item type" className="rounded-md border bg-background px-3 py-2" value={decisionLinkType}
        onChange={event => { setDecisionLinkType(event.target.value); setPage(0); }}>
        <option value="">All linked item types</option><option value="MILESTONE">Milestone</option>
        <option value="TASK">Task</option><option value="BACKLOG_ITEM">Backlog item</option>
      </select>
    </div>}
    {type === "RISK_ISSUE" && <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <select aria-label="Filter risk category" className="rounded-md border bg-background px-3 py-2" value={riskCategory}
        onChange={event => { setRiskCategory(event.target.value); setPage(0); }}>
        <option value="">All categories</option><option value="RISK">Risk</option><option value="ISSUE">Issue</option>
      </select>
      <select aria-label="Filter risk severity" className="rounded-md border bg-background px-3 py-2" value={riskSeverity}
        onChange={event => { setRiskSeverity(event.target.value); setPage(0); }}>
        <option value="">All severities</option><option value="LOW">Low</option><option value="MEDIUM">Medium</option>
        <option value="HIGH">High</option><option value="CRITICAL">Critical</option>
      </select>
      <select aria-label="Filter risk status" className="rounded-md border bg-background px-3 py-2" value={riskStatus}
        onChange={event => { setRiskStatus(event.target.value); setPage(0); }}>
        <option value="">All risk statuses</option><option value="OPEN">Open</option>
        <option value="IN_MITIGATION">In mitigation</option><option value="CLOSED">Closed</option>
      </select>
      <select aria-label="Filter risk target" className="rounded-md border bg-background px-3 py-2" value={riskTarget}
        onChange={event => { setRiskTarget(event.target.value); setPage(0); }}>
        <option value="">All affected items</option>
        {riskTargets.map(option => <option key={`${option.type}:${option.id}`} value={`${option.type}:${option.id}`}>
          {option.type === "MILESTONE" ? "Milestone" : option.type === "TASK" ? "Task" : "Backlog item"}: {option.label}
        </option>)}
      </select>
    </div>}
    {type === "MEETING_NOTE" && <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <Input aria-label="Meeting date from" type="date" value={meetingFrom} onChange={event => { setMeetingFrom(event.target.value); setPage(0); }} />
      <Input aria-label="Meeting date to" type="date" value={meetingTo} onChange={event => { setMeetingTo(event.target.value); setPage(0); }} />
      <select aria-label="Filter meeting attendee" className="rounded-md border bg-background px-3 py-2" value={attendeeId}
        onChange={event => { setAttendeeId(event.target.value); setPage(0); }}>
        <option value="">All attendees</option>
        {(options.data?.attendees ?? []).map(person => <option key={person.id} value={person.id}>{person.label} ({attendeeRoleLabel(person.role)})</option>)}
      </select>
      <select aria-label="Filter meetings with action items" className="rounded-md border bg-background px-3 py-2" value={hasActionItems}
        onChange={event => { setHasActionItems(event.target.value); setPage(0); }}>
        <option value="">All meetings</option><option value="true">Has action items</option><option value="false">No action items</option>
      </select>
    </div>}
            </div>}
          </CardContent>
        </Card>

        {query.isPending ? <div className="grid gap-3" aria-label="Loading project logs">
          {[1, 2, 3].map(item => <div key={item} className="h-20 animate-pulse rounded-lg bg-muted" />)}
        </div> : query.isError ? <Card><CardContent className="grid justify-items-center gap-3 py-8">
          <p role="alert" className="text-sm text-destructive">{getWorkspaceError(query.error)}</p>
          <Button variant="outline" onClick={() => void query.refetch()}>Retry</Button>
        </CardContent></Card> : selectedLog ? <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(15rem,0.8fr)_minmax(0,1.2fr)]">
          <Card className="min-w-0 gap-3">
            <CardHeader className="px-4">
              <CardTitle className="text-base">Log entries</CardTitle>
              <CardDescription aria-live="polite">{query.data.totalElements} results</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 px-4">
              <ul className="grid max-h-[42vh] gap-2 overflow-y-auto p-0.5 xl:max-h-[55vh]" aria-label="Log entries">
                {logs.map(item => <li key={item.id}>
                  <button type="button" aria-pressed={selectedLog.id === item.id}
                    className={"flex w-full items-start gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring "
                      + (selectedLog.id === item.id ? "border-primary bg-primary/5" : "hover:bg-muted/40")}
                    onClick={() => {
                      setSelectedLogId(item.id);
                      requestAnimationFrame(() => detail.current?.scrollIntoView({ block: "nearest" }));
                    }}>
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="block break-words text-sm font-medium">{item.title}</span>
                      <span className="block text-xs text-muted-foreground">{logTypeLabel(item)} · {displayLabel(item.status)}</span>
                      <span className="block text-xs text-muted-foreground">{item.authorName ?? "Unknown author"}
                        {item.createdAt && " · " + new Date(item.createdAt).toLocaleDateString()}</span>
                    </span>
                    <ChevronRight aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>)}
              </ul>
              {query.data.totalPages > 1 && <Pagination page={page} totalPages={query.data.totalPages} onChange={setPage} />}
            </CardContent>
          </Card>
          <div ref={detail} className="min-w-0 scroll-mt-4">
            <LogDetail key={selectedLog.id + ":" + selectedLog.version} item={selectedLog} readOnly={readOnly}
              target={allTargets.find(option => option.type === selectedLog.targetType && option.id === selectedLog.targetId)}
              onUpdateRisk={status => riskMutation.mutate({ item: selectedLog, status })}
              updating={riskMutation.isPending && riskMutation.variables?.item.id === selectedLog.id}
              updateError={riskMutation.isError && riskMutation.variables?.item.id === selectedLog.id ? riskMutation.error : undefined} />
          </div>
        </div> : <Card><WorkspaceEmptyState icon={FileText}
          title={filtered ? "No matching logs" : "No project logs yet"}
          description={filtered ? "Try a different search or clear your filters." : readOnly
            ? "No logs were recorded for this workspace." : "Create a decision, risk or meeting note for this project."}
          action={filtered ? <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
            : readOnly ? undefined : <Button onClick={openCreate}>Create log</Button>} /></Card>}
      </TabsContent>}

      <TabsContent value="ACTIVITY">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="size-5" />Activity feed</CardTitle>
            <CardDescription>Workspace changes recorded in chronological order.</CardDescription></CardHeader>
          <CardContent>
            {activity.isPending ? <div className="h-16 animate-pulse rounded-lg bg-muted" />
              : activity.isError ? <div className="grid justify-items-start gap-3">
                <p role="alert" className="text-sm text-destructive">{getWorkspaceError(activity.error)}</p>
                <Button variant="outline" size="sm" onClick={() => void activity.refetch()}>Retry</Button>
              </div> : activityItems.length > 0 ? <>
                <ol className="space-y-4 border-l pl-4">
                  {visibleActivityItems.map(event => <li key={event.id} className="grid gap-1 rounded-lg border bg-muted/15 p-3">
                    <p className="text-sm font-medium">{event.title}</p>
                    <p className="break-words text-sm text-muted-foreground">{event.description}</p>
                    {event.occurredAt && <time dateTime={event.occurredAt} className="text-xs text-muted-foreground">
                      {new Date(event.occurredAt).toLocaleString()}
                    </time>}
                  </li>)}
                </ol>
                {activityPageCount > 1 && <div className="mt-4">
                  <Pagination page={currentActivityPage} totalPages={activityPageCount} onChange={setActivityPage} />
                </div>}
              </> : <WorkspaceEmptyState icon={Activity} title="No activity yet" description="Recorded workspace changes will appear here." />}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>

    <Dialog open={creating && !readOnly} onOpenChange={open => { if (!createMutation.isPending) setCreating(open); }}>
      <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-3xl" showCloseButton={!createMutation.isPending}
        onEscapeKeyDown={event => { if (createMutation.isPending) event.preventDefault(); }}
        onInteractOutside={event => { if (createMutation.isPending) event.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>Create project log</DialogTitle>
          <DialogDescription>Record a decision, risk, issue or meeting note.</DialogDescription>
        </DialogHeader>
        <form className="flex min-h-0 flex-col gap-4" onSubmit={submit}>
          <div className="min-h-0 space-y-4 overflow-y-auto px-0.5 pr-2">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">Log type
              <select className="w-full rounded-md border bg-background px-3 py-2" value={form.type}
                onChange={event => changeType(event.target.value as ProjectLogType)}>
                <option value="DECISION">Decision</option><option value="RISK_ISSUE">Risk / issue</option><option value="MEETING_NOTE">Meeting note</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">Title
              <Input value={form.title} maxLength={LOG_TITLE_MAX_LENGTH} required onChange={event => setForm({ ...form, title: event.target.value })} />
            </label>
          </div>
          <label className="block space-y-1 text-sm">Content
            <Textarea value={form.content} maxLength={LOG_TEXT_MAX_LENGTH} required rows={3} onChange={event => setForm({ ...form, content: event.target.value })} />
          </label>
          {form.type === "DECISION" && <div className="space-y-3">
            <label className="block space-y-1 text-sm">Rationale
              <Textarea required rows={3} value={form.rationale} onChange={event => {
                const value = event.target.value;
                if (countWords(value) <= DECISION_FIELD_MAX_WORDS)
                  setForm(current => ({ ...current, rationale: value }));
              }} />
              <span className="block text-xs text-muted-foreground">
                {countWords(form.rationale).toLocaleString()} / {DECISION_FIELD_MAX_WORDS.toLocaleString()} words
              </span>
            </label>
            <label className="block space-y-1 text-sm">Impact analysis
              <Textarea rows={3} value={form.impactAnalysis} onChange={event => {
                const value = event.target.value;
                if (countWords(value) <= DECISION_FIELD_MAX_WORDS)
                  setForm(current => ({ ...current, impactAnalysis: value }));
              }} />
              <span className="block text-xs text-muted-foreground">
                {countWords(form.impactAnalysis).toLocaleString()} / {DECISION_FIELD_MAX_WORDS.toLocaleString()} words
              </span>
            </label>
          </div>}
          {form.type === "RISK_ISSUE" && <>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">Category
                <select className="w-full rounded-md border bg-background px-3 py-2" value={form.category}
                  onChange={event => setForm({ ...form, category: event.target.value as LogForm["category"] })}>
                  <option value="RISK">Risk</option><option value="ISSUE">Issue</option>
                </select>
              </label>
              <label className="space-y-1 text-sm">Severity
                <select className="w-full rounded-md border bg-background px-3 py-2" value={form.severity}
                  onChange={event => setForm({ ...form, severity: event.target.value as LogForm["severity"] })}>
                  <option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option>
                </select>
              </label>
            </div>
            <label className="block space-y-1 text-sm">Mitigation plan
              <Textarea value={form.mitigationPlan} maxLength={LOG_TEXT_MAX_LENGTH} rows={3}
                onChange={event => setForm({ ...form, mitigationPlan: event.target.value })} />
            </label>
          </>}
          {form.type === "MEETING_NOTE" && <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-1 text-sm">Meeting date
              <Input type="datetime-local" required value={form.meetingDate} onChange={event => setForm({ ...form, meetingDate: event.target.value })} />
            </label>
            <fieldset className="space-y-2 md:col-span-3">
              <legend className="text-sm font-medium">Attendees <span className="text-destructive">*</span></legend>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">Select who participated. {selectedAttendeeIds.length} selected.</p>
                {selectedAttendeeIds.length > 0 && <Button type="button" size="sm" variant="ghost"
                  onClick={() => setForm(current => ({ ...current, attendees: "" }))}>Clear selection</Button>}
              </div>
              <Input aria-label="Search attendees" placeholder="Search people by name or role"
                value={attendeeSearch} onChange={event => setAttendeeSearch(event.target.value)} />
              <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border bg-muted/20 p-3">
                {options.isLoading ? <p className="py-4 text-center text-sm text-muted-foreground">Loading eligible people...</p>
                  : options.isError ? <p role="alert" className="py-4 text-center text-sm text-destructive">Could not load attendee options. Please retry.</p>
                    : attendeeRoles.map(role => {
                      const people = filteredAttendees.filter(person => person.role === role);
                      if (people.length === 0) return null;
                      return <section key={role} className="space-y-1.5">
                        <h4 className="sticky top-0 rounded bg-background/95 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {attendeeRoleLabel(role)} <span className="font-normal">({people.length})</span>
                        </h4>
                        <div className="grid gap-1 sm:grid-cols-2">
                          {people.map(person => {
                            const selected = selectedAttendeeIds.includes(String(person.id));
                            return <label key={person.id} className={`flex cursor-pointer items-center gap-3 rounded-md border p-2.5 transition-colors ${
                              selected ? "border-primary bg-primary/5" : "border-transparent bg-background hover:border-border"
                            }`}>
                              <input type="checkbox" className="size-4 shrink-0 accent-primary"
                                checked={selected} onChange={event => updateAttendeeSelection(person.id, event.target.checked)} />
                              <span className="min-w-0 flex-1 truncate text-sm font-medium">{person.label}</span>
                              <Badge variant="outline" className="shrink-0 text-[10px]">{attendeeRoleLabel(role)}</Badge>
                            </label>;
                          })}
                        </div>
                      </section>;
                    })}
                {!options.isLoading && !options.isError && filteredAttendees.length === 0 &&
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    {(options.data?.attendees ?? []).length === 0 ? "No eligible people found for this team or class." : "No people match your search."}
                  </p>}
              </div>
            </fieldset>
            <label className="space-y-1 text-sm md:col-span-3">Action items
              <Textarea value={form.actionItems} maxLength={LOG_TEXT_MAX_LENGTH} rows={3}
                onChange={event => setForm({ ...form, actionItems: event.target.value })} />
            </label>
          </div>}
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">Link type <span className="text-muted-foreground">(optional)</span>
              <select className="w-full rounded-md border bg-background px-3 py-2" value={form.targetType}
                onChange={event => setForm({ ...form, targetType: event.target.value as ProjectLogTargetType | "", targetId: "" })}>
                <option value="">No link (optional)</option>
                {form.type === "MEETING_NOTE" ? <><option value="MILESTONE">Milestone</option><option value="SPRINT">Sprint</option></>
                  : <><option value="MILESTONE">Milestone</option><option value="TASK">Task</option><option value="BACKLOG_ITEM">Backlog item</option></>}
              </select>
            </label>
            <label className="space-y-1 text-sm">Linked item <span className="text-muted-foreground">(optional)</span>
              <select className="w-full rounded-md border bg-background px-3 py-2" value={form.targetId} disabled={!form.targetType}
                onChange={event => setForm({ ...form, targetId: event.target.value })}>
                <option value="">{form.targetType ? "No linked item (optional)" : "Choose a link type (optional)"}</option>
                {targetOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </label>
          </div>
          {options.isError && <p role="alert" className="text-sm text-destructive">{getWorkspaceError(options.error)}</p>}
          {createMutation.isError && <p role="alert" className="text-sm text-destructive">{getWorkspaceError(createMutation.error)}</p>}
          </div>
          <DialogFooter className="shrink-0 border-t pt-3">
            <Button type="button" variant="outline" disabled={createMutation.isPending} onClick={() => setCreating(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending || options.isPending || (form.type === "MEETING_NOTE" && !form.attendees)}>
              {createMutation.isPending ? "Saving..." : "Save log"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}

function logTypeLabel(item: ProjectLog) {
  if (item.type === "RISK_ISSUE") return item.category === "ISSUE" ? "Issue" : "Risk";
  return item.type === "DECISION" ? "Decision" : "Meeting note";
}

function displayLabel(value: string) {
  const label = value.toLowerCase().replaceAll("_", " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function Pagination({ page, totalPages, onChange }: {
  page: number; totalPages: number; onChange: (page: number) => void;
}) {
  return <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
    <p className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</p>
    <div className="flex gap-2">
      <Button type="button" variant="outline" size="sm" disabled={page === 0} onClick={() => onChange(page - 1)}>Previous</Button>
      <Button type="button" variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => onChange(page + 1)}>Next</Button>
    </div>
  </div>;
}

function LogDetail({ item, target, onUpdateRisk, updating, updateError, readOnly }: {
  item: ProjectLog; target?: ProjectLogOption; onUpdateRisk: (status: string) => void;
  updating: boolean; updateError?: unknown; readOnly: boolean;
}) {
  const [status, setStatus] = useState(item.status);
  const targetName = target?.label ?? item.targetId;
  const fields = [
    { label: "Content", value: item.content },
    { label: "Rationale", value: item.rationale },
    { label: "Impact analysis", value: item.impactAnalysis },
    { label: "Mitigation plan", value: item.mitigationPlan },
    { label: "Action items", value: item.actionItems },
  ];
  return <Card className="min-w-0 gap-4" aria-label="Log details">
    <CardHeader className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{logTypeLabel(item)}</Badge>
        <Badge variant={item.status === "CLOSED" ? "secondary" : "default"}>{displayLabel(item.status)}</Badge>
        {item.severity && <Badge variant={item.severity === "HIGH" || item.severity === "CRITICAL" ? "destructive" : "outline"}>
          {displayLabel(item.severity)} severity
        </Badge>}
      </div>
      <CardTitle className="break-words text-lg leading-snug">{item.title}</CardTitle>
      <CardDescription>{item.authorName ?? "Unknown author"}
        {item.createdAt && " · " + new Date(item.createdAt).toLocaleString()}</CardDescription>
    </CardHeader>
    <CardContent className="grid gap-4">
      {(item.targetType && targetName || item.meetingDate) && <dl className="grid gap-3 rounded-lg bg-muted/30 p-3 text-sm">
        {item.targetType && targetName && <div>
          <dt className="text-xs text-muted-foreground">Linked {displayLabel(item.targetType).toLowerCase()}</dt>
          <dd className="mt-1 break-words font-medium">{targetName}</dd>
        </div>}
        {item.meetingDate && <div>
          <dt className="text-xs text-muted-foreground">Meeting</dt>
          <dd className="mt-1 break-words">{new Date(item.meetingDate).toLocaleString()}
            {!!item.attendees?.length && " · " + item.attendees.map(person => person.name).join(", ")}</dd>
        </div>}
      </dl>}
      {fields.filter(field => field.value).map(field => <section key={field.label} className="grid gap-1">
        <h3 className="text-sm font-semibold">{field.label}</h3>
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{field.value}</p>
      </section>)}
      {item.type === "RISK_ISSUE" && !readOnly && <form className="grid gap-2 border-t pt-4 sm:grid-cols-[1fr_auto]" onSubmit={event => {
        event.preventDefault();
        if (!updating && status !== item.status) onUpdateRisk(status);
      }}>
        <select aria-label="Risk status" className="h-10 min-w-0 rounded-md border bg-background px-3 text-sm"
          value={status} disabled={updating} onChange={event => setStatus(event.target.value)}>
          <option value="OPEN">Open</option><option value="IN_MITIGATION">In mitigation</option><option value="CLOSED">Closed</option>
        </select>
        <Button type="submit" variant="outline" disabled={updating || status === item.status}>{updating ? "Saving..." : "Update status"}</Button>
      </form>}
      {updateError !== undefined && <p role="alert" className="text-sm text-destructive">{getWorkspaceError(updateError)}</p>}
    </CardContent>
  </Card>;
}
