import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { workspaceApi } from "@/api/features/workspace.api";
import type { ProjectLog, ProjectLogAuthorOption, ProjectLogAttendeeOption, ProjectLogTargetType, ProjectLogType, ProjectLogOption } from "@/types/features/workspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WorkspaceEmptyState, getWorkspaceError } from "./workspace.shared";
import { FileText } from "lucide-react";

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
const LOG_TABS: { label: string; value?: ProjectLogType }[] = [
  { label: "All logs" }, { label: "Decisions", value: "DECISION" },
  { label: "Risks & issues", value: "RISK_ISSUE" }, { label: "Meeting notes", value: "MEETING_NOTE" }
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

export function WorkspaceProjectLogsPanel({ workspaceId }: { workspaceId: number }) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<ProjectLogType>();
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
    retry: false
  });
  const activityItems = activity.data?.items ?? [];
  const activityPageCount = Math.ceil(activityItems.length / ACTIVITY_PAGE_SIZE);
  const visibleActivityItems = activityItems.slice(
    activityPage * ACTIVITY_PAGE_SIZE,
    (activityPage + 1) * ACTIVITY_PAGE_SIZE
  );
  useEffect(() => {
    setActivityPage(0);
  }, [activityItems.length]);
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
    onSuccess: async () => {
      setCreating(false);
      setForm(emptyForm);
      await queryClient.invalidateQueries({ queryKey: ["project-logs", workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ["workspace-section", workspaceId, "activity"] });
    }
  });
  const riskMutation = useMutation({
    mutationFn: ({ item, status }: { item: ProjectLog; status: string }) =>
      workspaceApi.updateRiskLog(workspaceId, item.id, { status }, item.version, crypto.randomUUID()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["project-logs", workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ["workspace-section", workspaceId, "activity"] });
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
  return <div className="space-y-5">
    <Card>
      <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Input aria-label="Search title, content or rationale" placeholder="Search title, content or rationale"
          value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} />
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
        <Button type="button" variant="outline" className="md:justify-self-start" onClick={() => {
          setSearch(""); setCreatedBy(""); setCreatedFrom(""); setCreatedTo(""); setLinkedTarget("");
          setDecisionStatus(""); setDecisionLinkType(""); setRiskCategory(""); setRiskSeverity("");
          setRiskStatus(""); setRiskTarget(""); setMeetingFrom(""); setMeetingTo(""); setAttendeeId("");
          setHasActionItems(""); setPage(0);
        }}>Clear filters</Button>
      </CardContent>
    </Card>
    <Card>
      <CardHeader><div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle>Risks, Decisions & Logs</CardTitle>
        <div className="flex gap-2">
          <Button type="button" onClick={() => {
            setCreating(value => !value);
            createMutation.reset();
            if (!creating) void options.refetch();
          }}>
            {creating ? "Cancel" : "Create log"}
          </Button>
        </div>
      </div></CardHeader>
      {creating && <CardContent>
        <form className="space-y-4" onSubmit={submit}>
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
          <Button type="submit" disabled={createMutation.isPending || options.isPending}>
            {createMutation.isPending ? "Saving..." : "Save log"}
          </Button>
        </form>
      </CardContent>}
    </Card>
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Project log type">
      {LOG_TABS.map(tab => <Button key={tab.label} type="button" variant={type === tab.value ? "default" : "outline"}
        onClick={() => { setType(tab.value); setPage(0); }}>{tab.label}</Button>)}
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
        {(options.data?.authors ?? []).map(author => <option key={author.id} value={author.id}>{author.label} ({authorRoleLabel(author.role)})</option>)}
      </select>
      <select aria-label="Filter meetings with action items" className="rounded-md border bg-background px-3 py-2" value={hasActionItems}
        onChange={event => { setHasActionItems(event.target.value); setPage(0); }}>
        <option value="">All meetings</option><option value="true">Has action items</option><option value="false">No action items</option>
      </select>
    </div>}
    {query.isPending ? <div className="space-y-3" aria-label="Loading project logs">
      {[1, 2, 3].map(item => <div key={item} className="h-24 animate-pulse rounded-lg bg-muted" />)}
    </div> : query.isError ? <Card><CardContent className="space-y-3 py-8 text-center">
      <p role="alert" className="text-sm text-destructive">{getWorkspaceError(query.error)}</p>
      <Button variant="outline" onClick={() => void query.refetch()}>Retry</Button>
    </CardContent></Card> : query.data?.content.length === 0 ? <Card><WorkspaceEmptyState icon={FileText}
      title="No project logs yet" description="Create the first decision, risk or meeting note for this project."
      action={<Button onClick={() => setCreating(true)}>Create first log</Button>} /></Card>
      : <div className="space-y-3">{query.data?.content.map(item =>
        <LogCard key={item.id} item={item}
          onUpdateRisk={status => riskMutation.mutate({ item, status })}
          updating={riskMutation.isPending && riskMutation.variables?.item.id === item.id}
          updateError={riskMutation.isError && riskMutation.variables?.item.id === item.id ? riskMutation.error : undefined} />)}</div>}
    {query.data && query.data.totalPages > 1 && <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">Page {query.data.number + 1} of {query.data.totalPages} · {query.data.totalElements} logs</p>
      <div className="flex gap-2"><Button variant="outline" disabled={page === 0} onClick={() => setPage(current => current - 1)}>Previous</Button>
        <Button variant="outline" disabled={page + 1 >= query.data.totalPages} onClick={() => setPage(current => current + 1)}>Next</Button></div>
    </div>}
    <Card>
      <CardHeader><CardTitle>Activity feed</CardTitle></CardHeader>
      <CardContent>{activity.isPending ? <div className="h-16 animate-pulse rounded-lg bg-muted" />
        : activity.isError ? <p role="alert" className="text-sm text-destructive">{getWorkspaceError(activity.error)}</p>
          : activityItems.length ? <>
            <div className="divide-y">{visibleActivityItems.map(event => <div key={event.id} className="py-3">
              <p className="text-sm font-medium">{event.title}</p>
              <p className="text-xs text-muted-foreground">{event.description} · {event.occurredAt ? new Date(event.occurredAt).toLocaleString() : ""}</p>
            </div>)}</div>
            {activityPageCount > 1 && <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Page {activityPage + 1} of {activityPageCount} · {activityItems.length} activities</p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" disabled={activityPage === 0}
                  onClick={() => setActivityPage(current => current - 1)}>Previous</Button>
                <Button type="button" variant="outline" disabled={activityPage + 1 >= activityPageCount}
                  onClick={() => setActivityPage(current => current + 1)}>Next</Button>
              </div>
            </div>}
          </> : <p className="text-sm text-muted-foreground">No activity recorded yet.</p>}</CardContent>
    </Card>
  </div>;
}

function LogCard({ item, onUpdateRisk, updating, updateError }: {
  item: ProjectLog; onUpdateRisk: (status: string) => void; updating: boolean; updateError?: unknown;
}) {
  const [status, setStatus] = useState(item.status);
  const typeLabel = item.type === "RISK_ISSUE"
    ? item.category === "ISSUE" ? "Issue" : "Risk"
    : item.type === "DECISION" ? "Decision" : "Meeting note";
  const linkLabel = item.targetType === "MILESTONE" ? "Milestone"
    : item.targetType === "SPRINT" ? "Sprint"
      : item.targetType === "TASK" ? "Task" : "Backlog item";
  return <details className="rounded-xl border bg-card">
    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
      <span className="min-w-0 flex-1 truncate font-semibold">{item.title}</span>
      <span className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{typeLabel}</Badge><Badge>{item.status}</Badge>
        <span className="text-xs text-muted-foreground">{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}</span>
      </span>
    </summary>
    <div className="space-y-3 border-t p-4">
      <p className="whitespace-pre-wrap text-sm text-muted-foreground">{item.content}</p>
      {item.rationale && <p className="text-sm"><strong>Rationale:</strong> {item.rationale}</p>}
      {item.severity && <p className="text-sm"><strong>Severity:</strong> {item.severity} · {item.category}</p>}
      {item.mitigationPlan && <p className="whitespace-pre-wrap text-sm"><strong>Mitigation:</strong> {item.mitigationPlan}</p>}
      {item.meetingDate && <p className="text-sm"><strong>Meeting:</strong> {new Date(item.meetingDate).toLocaleString()} · {item.attendees?.map(attendee => attendee.name).join(", ")}</p>}
      {item.actionItems && <p className="whitespace-pre-wrap text-sm"><strong>Action items:</strong> {item.actionItems}</p>}
      <p className="text-xs text-muted-foreground">
        {item.targetType && item.targetId ? <>{linkLabel} · {item.targetId} · </> : null}
        {item.authorName ?? `Author ${item.createdBy ?? ""}`} · {item.createdAt ? new Date(item.createdAt).toLocaleString() : ""}
      </p>
      {item.type === "RISK_ISSUE" && <form className="grid gap-2 border-t pt-3 md:grid-cols-[1fr_auto]" onSubmit={event => {
        event.preventDefault(); onUpdateRisk(status);
      }}>
        <select aria-label="Risk status" className="h-10 rounded-md border bg-background px-3" value={status} onChange={event => setStatus(event.target.value)}>
          <option value="OPEN">Open</option><option value="IN_MITIGATION">In mitigation</option><option value="CLOSED">Closed</option>
        </select>
        <Button type="submit" variant="outline" disabled={updating || status === item.status}>{updating ? "Saving..." : "Update status"}</Button>
      </form>}
      {updateError !== undefined && <p role="alert" className="text-sm text-destructive">{getWorkspaceError(updateError)}</p>}
    </div>
  </details>;
}
