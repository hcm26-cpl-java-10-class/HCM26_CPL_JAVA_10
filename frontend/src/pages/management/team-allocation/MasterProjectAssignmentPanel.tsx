import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { FolderTree, LoaderCircle, Search } from "lucide-react";
import { projectAssignmentApi } from "@/api/features/project-assignment.api";
import { usePermissions } from "@/hooks/usePermissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AssignmentModule, AssignmentTemplate, ProjectAssignmentMode, ProjectAssignmentRequest, ProjectAssignmentResult } from "@/types/features/project-assignment";
import { WorkspaceMasterMilestonesPanel } from "../workspace/WorkspaceMasterMilestonesPanel";
import { AssignmentTeamRoles, assignmentRoleErrors, type MemberRoleChoices } from "./AssignmentTeamRoles";

const selectClass = "h-10 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-50";
function failure(error: unknown) {
  return axios.isAxiosError<{ message?: string }>(error)
    ? error.response?.data?.message ?? "Unable to complete the assignment. Please try again."
    : "Unable to complete the assignment. Please try again.";
}
function ModuleBranch({ module }: { module: AssignmentModule }) {
  return <li className="space-y-1"><span className="font-medium">{module.name}</span>
    <span className="ml-2 text-xs text-muted-foreground">{module.code} · {module.milestoneCount} milestones</span>
    {module.modules.length > 0 && <ul className="space-y-1 border-l pl-4">{module.modules.map(child => <ModuleBranch key={child.templateId} module={child} />)}</ul>}
  </li>;
}

export function MasterProjectAssignmentPanel({ classId, sessionId, onAssigned }: {
  classId: number; sessionId: number; onAssigned: () => void;
}) {
  const { user, activeRole } = usePermissions();
  return <AssignmentPanel key={`${classId}:${sessionId}:${user.email}:${activeRole}`}
    classId={classId} sessionId={sessionId} onAssigned={onAssigned} />;
}

function AssignmentPanel({ classId, sessionId, onAssigned }: { classId: number; sessionId: number; onAssigned: () => void }) {
  const { user, activeRole, hasPermission } = usePermissions();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [keyword, setKeyword] = useState("");
  const [selected, setSelected] = useState<AssignmentTemplate | null>(null);
  const [mode, setMode] = useState<ProjectAssignmentMode>("SPLIT");
  const [teamId, setTeamId] = useState("");
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [roleChoices, setRoleChoices] = useState<Record<number, MemberRoleChoices>>({});
  const [review, setReview] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [result, setResult] = useState<ProjectAssignmentResult | null>(null);
  const [managedMaster, setManagedMaster] = useState<number | null>(null);
  const sending = useRef(false);
  const requestKey = useRef<{ fingerprint: string; key: string } | null>(null);
  const classMasters = useQuery({
    queryKey: ["class-master-projects", classId, sessionId, user.email, activeRole],
    queryFn: ({ signal }) => projectAssignmentApi.classMasters(classId, sessionId, signal), retry: false,
    enabled: hasPermission("MILESTONE_WRITE") || hasPermission("PRJ_WORKSPACE_MANAGE"),
  });
  const catalog = useQuery({
    queryKey: ["master-assignment-templates", classId, sessionId, user.email, activeRole, keyword],
    queryFn: ({ signal }) => projectAssignmentApi.templates(classId, sessionId, keyword, signal),
    enabled: open && !blocked, retry: false,
  });
  const preview = useQuery({
    queryKey: ["master-assignment-preview", classId, sessionId, user.email, activeRole, selected?.id, selected?.versionId],
    queryFn: ({ signal }) => projectAssignmentApi.preview(classId, sessionId, selected!, signal),
    enabled: open && selected !== null && !blocked, retry: false,
  });
  const assignment = useMutation({
    mutationFn: ({ request, key }: { request: ProjectAssignmentRequest; key: string }) =>
      projectAssignmentApi.assign(classId, sessionId, request, key),
    onSuccess: data => {
      setResult(data); setOpen(false); setReview(false); requestKey.current = null;
      void client.invalidateQueries({ queryKey: ["workspace-candidates"] });
      void client.invalidateQueries({ queryKey: ["master-assignment-preview", classId, sessionId] });
      void client.invalidateQueries({ queryKey: ["class-master-projects", classId, sessionId] });
      onAssigned();
    },
    onError: error => {
      if (axios.isAxiosError(error) && error.response?.status === 403) setBlocked(true);
    },
    onSettled: () => { sending.current = false; },
  });
  const data = preview.data;
  const selectedTeamIds = data?.modules.map(module => mapping[module.templateId]).filter(Boolean) ?? [];
  const mapped = data !== undefined && data.modules.length > 0
    && selectedTeamIds.length === data.modules.length && new Set(selectedTeamIds).size === selectedTeamIds.length;
  const wholeTeam = data?.teams.find(team => String(team.id) === teamId);
  const draftTeams = data?.teams.filter(team => team.status === "DRAFT"
    && (mode === "WHOLE" ? String(team.id) === teamId : selectedTeamIds.includes(String(team.id)))) ?? [];
  const wholeValid = wholeTeam?.eligible && data !== undefined
    && wholeTeam.memberCount >= data.minMembers && wholeTeam.memberCount <= data.maxMembers;
  const roleTeams = !data ? [] : mode === "WHOLE"
    ? wholeTeam ? [{ team: wholeTeam, policy: data.rolePolicy, projectName: data.master.name }] : []
    : data.modules.flatMap(module => {
      const team = data.teams.find(value => String(value.id) === mapping[module.templateId]);
      return team ? [{ team, policy: module.rolePolicy, projectName: module.name }] : [];
    });
  const rolesReady = roleTeams.every(({ team, policy }) => assignmentRoleErrors(team, policy, roleChoices[team.id] ?? {}).length === 0);
  const ready = !!data && !preview.isError && !preview.isFetching && rolesReady && (mode === "SPLIT" ? mapped : wholeValid);
  function submit() {
    if (!ready || !data || sending.current || assignment.isPending) return;
    const request: ProjectAssignmentRequest = {
      masterTemplateId: data.master.id, versionId: data.master.versionId, mode,
      ...(mode === "WHOLE" ? { teamId: Number(teamId) } : {}),
      modules: mode === "WHOLE" ? [] : data.modules.map(module => ({ moduleTemplateId: module.templateId, teamId: Number(mapping[module.templateId]) })),
      teamRoles: roleTeams.map(({ team }) => ({ teamId: team.id, expectedVersion: team.version,
        members: team.members.map(member => ({ memberId: member.memberId, roles: roleChoices[team.id]?.[member.memberId] ?? member.roles })) })),
    };
    const fingerprint = JSON.stringify(request);
    if (requestKey.current?.fingerprint !== fingerprint) requestKey.current = { fingerprint, key: crypto.randomUUID() };
    sending.current = true;
    assignment.mutate({ request, key: requestKey.current.key });
  }
  async function reloadTemplates() {
    const refreshed = await catalog.refetch();
    const current = refreshed.data?.find(item => item.id === selected?.id);
    if (current) {
      setSelected(current);
      if (current.versionId === selected?.versionId) await preview.refetch();
    }
    setReview(false); assignment.reset();
  }

  return <Card>
    <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1"><CardTitle className="flex items-center gap-2"><FolderTree className="size-5 text-primary" />Master project assignment</CardTitle>
        <CardDescription>Assign teams to separate modules, or give the complete master project to one team.</CardDescription></div>
      <Button onClick={() => { setOpen(true); setReview(false); assignment.reset(); }}>Assign master project</Button>
    </CardHeader>
    {result && <CardContent><div role="status" className="space-y-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
      <p className="font-medium">Assignment completed. {result.workspaces.length} workspace{result.workspaces.length === 1 ? "" : "s"} ready.</p>
      <div className="flex flex-wrap gap-2">{result.workspaces.map(workspace => <Button key={workspace.id} asChild size="sm" variant="outline">
        <Link to={`/management/workspaces/${workspace.id}`}>{workspace.teamName} · {workspace.projectName}</Link></Button>)}</div>
    </div></CardContent>}
    {classMasters.isError && <CardContent><p role="alert" className="text-sm">Unable to load class master projects.</p>
      <Button variant="outline" size="sm" onClick={() => void classMasters.refetch()}>Retry</Button></CardContent>}
    {!!classMasters.data?.length && <CardContent className="space-y-3"><p className="text-sm font-medium">Class master projects</p>
      <p className="text-xs text-muted-foreground">Class mentors manage shared master work here. Each team continues working on its own module.</p>
      {classMasters.data.map(master => <div key={master.projectId} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
        <div className="space-y-1"><p className="text-sm font-medium">{master.name}</p><Badge variant="outline">{master.status}</Badge></div>
        <Button size="sm" variant="outline" onClick={() => setManagedMaster(master.projectId)}>Manage master milestones</Button>
      </div>)}
    </CardContent>}
    <Dialog open={managedMaster != null} onOpenChange={value => { if (!value) setManagedMaster(null); }}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-4xl">
        <DialogHeader><DialogTitle>Class master milestones</DialogTitle>
          <DialogDescription>Manage shared deliverables and the master assessment independently of team workspaces.</DialogDescription></DialogHeader>
        <div className="min-h-0 space-y-4 overflow-y-auto pr-1">{managedMaster != null &&
          <WorkspaceMasterMilestonesPanel masterProjectId={managedMaster} returnTo={`/team-allocation/classes/${classId}?sessionId=${sessionId}`}
            onChanged={() => { void classMasters.refetch(); void client.invalidateQueries({ queryKey: ["workspace-project-hierarchy"] }); }} />}</div>
      </DialogContent>
    </Dialog>
    <Dialog open={open} onOpenChange={value => { if (!assignment.isPending) setOpen(value); }}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-3xl">
        <DialogHeader><DialogTitle>{review ? "Review project assignment" : "Assign a master project"}</DialogTitle>
          <DialogDescription>{review ? "Check the version and module owners before confirming."
            : "Select a published master template and map its modules to eligible teams in this class."}</DialogDescription></DialogHeader>
        <div className="min-h-0 space-y-5 overflow-y-auto pr-1">
          {blocked ? <p role="alert" className="text-destructive">Your permission to assign projects has changed. Reload this page.</p> : <>
            {!review && <>
              <form className="flex gap-2" onSubmit={event => { event.preventDefault(); setKeyword(search.trim()); }}>
                <Input aria-label="Search master templates" placeholder="Search master templates" value={search} onChange={event => setSearch(event.target.value)} />
                <Button type="submit" variant="outline"><Search className="size-4" />Search</Button>
              </form>
              {catalog.isPending ? <p role="status">Loading master templates…</p> : catalog.isError
                ? <div role="alert">{failure(catalog.error)} <Button variant="outline" size="sm" onClick={() => void catalog.refetch()}>Retry</Button></div>
                : <div className="space-y-2"><Label htmlFor="master-template">Master template</Label>
                  <select id="master-template" className={selectClass} value={selected?.id ?? ""} onChange={event => {
                    setSelected(catalog.data?.find(item => item.id === Number(event.target.value)) ?? null);
                    setMapping({}); setTeamId(""); setRoleChoices({}); assignment.reset();
                  }}><option value="">Select a master template</option>{catalog.data?.map(template =>
                    <option key={template.id} value={template.id}>{template.code} · {template.name} · {template.version}</option>)}</select>
                  {catalog.data?.length === 0 && <p className="text-sm text-muted-foreground">No published master templates match this search.</p>}</div>}
            </>}
            {selected && preview.isPending && <p role="status">Loading the saved project hierarchy…</p>}
            {preview.isError && <div role="alert" className="space-y-2 text-destructive"><p>{failure(preview.error)}</p>
              <Button variant="outline" size="sm" onClick={() => void reloadTemplates()}>Reload templates</Button></div>}
            {data && !preview.isError && <>
              <div className="rounded-lg border bg-muted/20 p-4"><div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{data.master.name}</p><Badge variant="outline">{data.master.version}</Badge></div>
                <p className="mt-1 text-sm text-muted-foreground">{data.modules.length} direct modules · {data.masterMilestoneCount} master milestones</p>
                <p className="mt-2 text-xs text-muted-foreground">Master milestones cover shared project work. Module milestones belong to each module and stay separate.</p>
                <ul className="mt-3 space-y-2 text-sm">{data.modules.map(module => <ModuleBranch key={module.templateId} module={module} />)}</ul></div>
              {!review && <fieldset className="grid gap-3 sm:grid-cols-2"><legend className="mb-2 text-sm font-medium">Assignment option</legend>
                {(["SPLIT", "WHOLE"] as const).map(option => <label key={option} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${mode === option ? "border-primary bg-primary/5" : ""}`}>
                  <input type="radio" name="assignment-option" value={option} checked={mode === option} onChange={() => { setMode(option); assignment.reset(); }} />
                  <span><span className="block text-sm font-medium">{option === "SPLIT" ? "Separate teams per module" : "Complete master to one team"}</span>
                    <span className="text-xs text-muted-foreground">{option === "SPLIT" ? "Each direct module and its descendants belong to one different team." : "One workspace contains the master and every child module."}</span></span>
                </label>)}</fieldset>}
              <p className="text-sm font-medium">{review && (mode === "SPLIT" ? "Separate teams per module" : "Complete master to one team")}</p>
              {mode === "SPLIT" ? <div className="space-y-4">
                {data.modules.length === 0 && <p role="alert">This template has no child modules. Select the complete-master option.</p>}
                {data.modules.map(module => <div key={module.templateId} className="grid items-center gap-2 sm:grid-cols-2">
                  <Label htmlFor={`module-team-${module.templateId}`}>{module.name}<span className="block text-xs font-normal text-muted-foreground">{module.minMembers}–{module.maxMembers} members</span></Label>
                  {review ? <p className="text-sm">{data.teams.find(team => String(team.id) === mapping[module.templateId])?.name}</p>
                    : <select id={`module-team-${module.templateId}`} className={selectClass} value={mapping[module.templateId] ?? ""}
                        onChange={event => { setMapping(previous => ({ ...previous, [module.templateId]: event.target.value })); assignment.reset(); }}>
                        <option value="">Select a team</option>{data.teams.map(team => {
                          const incompatible = team.memberCount < module.minMembers || team.memberCount > module.maxMembers;
                          const used = selectedTeamIds.includes(String(team.id)) && mapping[module.templateId] !== String(team.id);
                          return <option key={team.id} value={team.id} disabled={!team.eligible || incompatible || used}>
                            {team.name} · {team.memberCount} members{!team.eligible ? ` · ${team.reason}` : incompatible ? " · Outside team size" : used ? " · Already selected" : ""}</option>;
                        })}</select>}
                </div>)}
                <p className="rounded-md border bg-muted/20 p-3 text-sm">The master project stays at class level. Class mentors manage its shared milestones and final assessment. Every assigned team can view the same master milestones in its workspace.</p>
              </div> : <div className="space-y-2"><Label htmlFor="whole-project-team">Team for the complete master</Label>
                {review ? <p className="text-sm">{wholeTeam?.name}</p> : <select id="whole-project-team" className={selectClass} value={teamId} onChange={event => { setTeamId(event.target.value); assignment.reset(); }}>
                  <option value="">Select a team</option>{data.teams.map(team => {
                    const incompatible = team.memberCount < data.minMembers || team.memberCount > data.maxMembers;
                    return <option key={team.id} value={team.id} disabled={!team.eligible || incompatible}>{team.name} · {team.memberCount} members{!team.eligible ? ` · ${team.reason}` : incompatible ? " · Outside master team size" : ""}</option>;
                  })}</select>}
                <p className="text-xs text-muted-foreground">Master team size: {data.minMembers}–{data.maxMembers}. This team owns the master milestones and all child modules.</p></div>}
              {roleTeams.length > 0 && <div className="space-y-3"><p className="text-sm font-medium">Member roles</p>
                <p className="text-xs text-muted-foreground">Check roles against the selected project requirements. Role changes are saved when you confirm this assignment.</p>
                {roleTeams.map(({ team, policy, projectName }) => <AssignmentTeamRoles key={team.id} team={team} policy={policy}
                  projectName={projectName} choices={roleChoices[team.id] ?? {}} readOnly={review || assignment.isPending}
                  onChange={(memberId, roles) => {
                    setRoleChoices(previous => ({ ...previous, [team.id]: { ...previous[team.id], [memberId]: roles } })); assignment.reset();
                  }} />)}
              </div>}
              <p className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">Milestone deadlines start from the same assignment time. Saved project briefs and resources remain independent of future library changes.</p>
              {draftTeams.length > 0 && <p className="rounded-md border border-amber-500/40 p-3 text-sm" role="status">
                Draft teams will be published when you confirm: {draftTeams.map(team => team.name).join(", ")}. Their members, roles and assigned mentors must be valid.
              </p>}
            </>}
            {assignment.isError && <div role="alert" className="space-y-2 text-destructive"><p>{failure(assignment.error)}</p>
              <Button type="button" size="sm" variant="outline" onClick={() => void reloadTemplates()}>Reload assignment options</Button></div>}
          </>}
        </div>
        <DialogFooter><Button variant="outline" disabled={assignment.isPending} onClick={() => review ? setReview(false) : setOpen(false)}>{review ? "Back" : "Cancel"}</Button>
          {!blocked && <Button disabled={!ready || assignment.isPending} onClick={() => review ? submit() : setReview(true)}>
            {assignment.isPending && <LoaderCircle className="size-4 animate-spin" />}{assignment.isPending ? "Creating workspaces…" : review ? "Confirm assignment" : "Review assignment"}</Button>}</DialogFooter>
      </DialogContent>
    </Dialog>
  </Card>;
}
