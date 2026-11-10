import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, Flag, GitBranch, LoaderCircle, Replace } from "lucide-react";
import { projectAssignmentApi } from "@/api/features/project-assignment.api";
import { usePermissions } from "@/hooks/usePermissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { AssignmentModule, AssignmentOwner, AssignmentRole, AssignmentRolePolicy, AssignmentTeam, AssignmentTemplate, ProjectAssignmentMode, ProjectAssignmentRequest } from "@/types/features/project-assignment";
import { AssignmentTeamRoles, assignmentMemberRoles, assignmentRoleErrors, type MemberRoleChoices } from "./AssignmentTeamRoles";
import { MasterBriefDialog } from "./master-catalog/MasterBriefDialog";
import { LevelPill } from "./master-catalog/CatalogBits";
import { MasterTemplateCatalog } from "./master-catalog/MasterTemplateCatalog";
import { assignmentFailure } from "./master-catalog/master-catalog.utils";

const selectClass = "h-10 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50";
const primaryActionClass = "bg-indigo-700 text-white hover:bg-indigo-800 dark:bg-indigo-600 dark:hover:bg-indigo-700";
const modeOptions = [
  { id: "SPLIT", title: "Phân công theo module", description: "Mỗi module giao cho một Team. Một Team có thể nhận nhiều module." },
  { id: "WHOLE", title: "Giao trọn Master cho một Team", description: "Một Team phụ trách cả Master và toàn bộ module trong cùng Workspace." },
] as const;
const assignmentSteps = [
  { id: "project", title: "Chọn Project và Team" },
  { id: "roles", title: "Chọn Leader và vai trò" },
  { id: "review", title: "Xác nhận phân công" },
] as const;
type AssignmentStep = (typeof assignmentSteps)[number]["id"];

const failure = (error: unknown) => assignmentFailure(error);

function fits(team: AssignmentTeam, min: number, max: number) {
  return team.eligible && team.memberCount >= min && team.memberCount <= max;
}

function matchesOwners(teamId: number, owners: AssignmentOwner[]) {
  return owners.every(owner => owner.teamId === teamId);
}

function currentOwnerId(owners: AssignmentOwner[]) {
  const owner = owners[0];
  return owner && matchesOwners(owner.teamId, owners) ? String(owner.teamId) : "";
}

function includesModule(branch: AssignmentModule, templateId: number): boolean {
  return branch.templateId === templateId || branch.modules.some(child => includesModule(child, templateId));
}

function OwnerNotice({ owners }: { owners: AssignmentOwner[] }) {
  if (owners.length === 0) return null;
  return <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
    Đã phân công trong lớp cho {[...new Set(owners.map(owner => owner.teamName))].join(", ")}.
  </p>;
}

function ModuleBranch({ module }: { module: AssignmentModule }) {
  return <li className="space-y-1">
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-indigo-500/15 bg-card px-2.5 py-1.5">
      <GitBranch className="size-4 shrink-0 text-indigo-600 dark:text-indigo-400" aria-hidden />
      <span className="min-w-0 break-words font-medium">{module.name}</span>
      <Badge variant="outline" className="border-teal-500/25 bg-teal-500/10 text-teal-800 dark:text-teal-300">
        <Flag aria-hidden />{module.milestoneCount} milestone
      </Badge>
    </div>
    {module.modules.length > 0 && <ul className="space-y-1 border-l border-indigo-500/25 pl-4">
      {module.modules.map(child => <ModuleBranch key={child.templateId} module={child} />)}
    </ul>}
  </li>;
}

function sharedRolePolicy(policies: AssignmentRolePolicy[]): AssignmentRolePolicy {
  const quotas = new Map<AssignmentRole, AssignmentRolePolicy["quotas"][number]>();
  for (const policy of policies) {
    for (const quota of policy.quotas) {
      const previous = quotas.get(quota.role);
      quotas.set(quota.role, previous ? {
        role: quota.role, min: Math.max(previous.min, quota.min), max: Math.min(previous.max, quota.max),
      } : quota);
    }
  }
  return { allowMultiRole: policies.every(policy => policy.allowMultiRole), quotas: [...quotas.values()] };
}

function TeamSelect({ id, teams, value, min, max, owners, checkingOwnership, onChange }: {
  id: string;
  teams: AssignmentTeam[];
  value: string;
  min: number;
  max: number;
  owners: AssignmentOwner[];
  checkingOwnership: boolean;
  onChange: (value: string) => void;
}) {
  const locked = owners.length > 0;
  return <select id={id} className={selectClass + " disabled:opacity-60"} value={value}
    disabled={locked || checkingOwnership} onChange={event => onChange(event.target.value)}>
    <option value="" disabled={locked}>{locked ? "Đã có Team phụ trách" : "Chọn Team"}</option>
    {teams.map(team => {
      const teamId = String(team.id);
      const unavailable = !matchesOwners(team.id, owners) ? "Đã giao cho Team khác"
        : !team.eligible ? team.reason ?? "Team không sẵn sàng" : !fits(team, min, max) ? "Sĩ số không phù hợp" : null;
      return <option key={team.id} value={teamId} disabled={!!unavailable}>
        {team.name} · {team.memberCount} người{team.assignedProjectName && ` · Đã gán: ${team.assignedProjectName}`}
        {unavailable && " · " + unavailable}
      </option>;
    })}
  </select>;
}

export function MasterProjectAssignmentForm({ classId, sessionId, initialTeamId, backTo }: {
  classId: number;
  sessionId: number;
  initialTeamId: number | null;
  backTo: string;
}) {
  const { user, activeRole } = usePermissions();
  const teamScoped = initialTeamId != null;
  const client = useQueryClient();
  const [selected, setSelected] = useState<AssignmentTemplate | null>(null);
  const [browsing, setBrowsing] = useState(false);
  const [briefTemplate, setBriefTemplate] = useState<AssignmentTemplate | null>(null);
  const [preferredMode, setPreferredMode] = useState<ProjectAssignmentMode>(initialTeamId == null ? "SPLIT" : "WHOLE");
  const [teamId, setTeamId] = useState(initialTeamId?.toString() ?? "");
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [leaderChoices, setLeaderChoices] = useState<Record<number, number | null>>({});
  const [roleChoices, setRoleChoices] = useState<Record<number, MemberRoleChoices>>({});
  const [step, setStep] = useState<AssignmentStep>("project");
  const [roleTeamId, setRoleTeamId] = useState<number | null>(null);
  const stepList = useRef<HTMLOListElement>(null);
  const sending = useRef(false);
  const requestKey = useRef<{ fingerprint: string; key: string } | null>(null);

  const preview = useQuery({
    queryKey: ["master-assignment-preview", classId, sessionId, user.email, activeRole, selected?.id, selected?.versionId],
    queryFn: ({ signal }) => projectAssignmentApi.preview(classId, sessionId, selected!, signal),
    enabled: selected !== null,
    retry: false,
    refetchOnMount: "always",
  });
  const assignment = useMutation({
    mutationKey: ["project-brief-assignment", classId, sessionId],
    mutationFn: ({ request, key }: { request: ProjectAssignmentRequest; key: string }) =>
      projectAssignmentApi.assign(classId, sessionId, request, key),
    onSuccess: () => {
      for (const section of ["teams", "unassigned-members", "class-roster"]) {
        void client.invalidateQueries({ queryKey: ["team-allocation", section, classId, sessionId] });
      }
      void client.invalidateQueries({ queryKey: ["master-assignment-preview", classId, sessionId] });
    },
    onSettled: () => { sending.current = false; },
  });

  const data = preview.data;
  const mode = teamScoped || data?.modules.length === 0 ? "WHOLE" : preferredMode;
  const hasOwnershipData = Array.isArray(data?.owners);
  const owners = hasOwnershipData ? data.owners : [];
  const ownershipReady = hasOwnershipData && !preview.isFetching && !preview.isError;
  const mappedTeams = data?.modules.map(module => {
    const moduleOwners = owners.filter(owner => owner.templateId === data.master.id || includesModule(module, owner.templateId));
    const selectedId = step === "project" && moduleOwners.length > 0
      ? currentOwnerId(moduleOwners) : mapping[module.templateId] ?? currentOwnerId(moduleOwners);
    const team = data.teams.find(item => String(item.id) === selectedId);
    return { module, team, owners: moduleOwners,
      valid: !!team && fits(team, module.minMembers, module.maxMembers) && matchesOwners(team.id, moduleOwners) };
  }) ?? [];
  const mapped = mappedTeams.length > 0 && mappedTeams.every(({ valid }) => valid);
  const wholeOwnerId = currentOwnerId(owners);
  const wholeTeamId = teamScoped ? String(initialTeamId)
    : step === "project" && owners.length > 0 ? wholeOwnerId : teamId || wholeOwnerId;
  const wholeTeam = data?.teams.find(team => String(team.id) === wholeTeamId);
  const wholeValid = !!data && !!wholeTeam && fits(wholeTeam, data.minMembers, data.maxMembers) && matchesOwners(wholeTeam.id, owners);
  const briefsByTeam = new Map<number, { team: AssignmentTeam; briefs: Array<{ name: string; rolePolicy: AssignmentRolePolicy }> }>();
  if (mode === "WHOLE" && data && wholeValid && wholeTeam) {
    briefsByTeam.set(wholeTeam.id, { team: wholeTeam, briefs: [{ name: data.master.name, rolePolicy: data.rolePolicy }] });
  } else if (mode === "SPLIT") {
    for (const { module, team, valid } of mappedTeams) {
      if (!valid || !team) continue;
      const existing = briefsByTeam.get(team.id);
      if (existing) existing.briefs.push(module);
      else briefsByTeam.set(team.id, { team, briefs: [module] });
    }
  }
  const roleTeams = [...briefsByTeam.values()].map(({ team, briefs }) => {
    const policy = sharedRolePolicy(briefs.map(brief => brief.rolePolicy));
    const projectName = briefs.map(brief => brief.name).join(" + ");
    const choices = roleChoices[team.id] ?? {};
    const leaderId = leaderChoices[team.id] === undefined ? team.leaderMemberId : leaderChoices[team.id];
    const errors = policy.quotas.some(quota => quota.min > quota.max)
      ? ["Các module của Team có định suất vai trò xung đột. Quay lại để đổi cách phân công."]
      : assignmentRoleErrors(team, policy, choices, leaderId);
    return { team, policy, projectName, choices, leaderId, errors };
  });
  const roleTeam = roleTeams.find(({ team }) => team.id === roleTeamId) ?? roleTeams[0];
  const readyRoleCount = roleTeams.filter(({ errors }) => errors.length === 0).length;
  const canConfigureRoles = ownershipReady && (mode === "SPLIT" ? mapped : wholeValid);
  const ready = canConfigureRoles && readyRoleCount === roleTeams.length;
  const review = step === "review";

  function goToStep(next: AssignmentStep) {
    if (next === "roles" && step === "project") {
      if (mode === "WHOLE") setTeamId(wholeTeamId);
      else setMapping(Object.fromEntries(mappedTeams.map(({ module, team }) => [module.templateId, team ? String(team.id) : ""])));
    }
    if (next === "roles" && !roleTeams.some(({ team }) => team.id === roleTeamId)) {
      const first = roleTeams.find(({ errors }) => errors.length > 0) ?? roleTeams[0];
      setRoleTeamId(first?.team.id ?? null);
    }
    setStep(next);
    requestAnimationFrame(() => stepList.current?.focus());
  }

  function selectTemplate(template: AssignmentTemplate | null) {
    setSelected(template);
    setMapping({});
    setTeamId(initialTeamId?.toString() ?? "");
    setLeaderChoices({});
    setRoleChoices({});
    setRoleTeamId(null);
    setStep("project");
    assignment.reset();
  }

  function submit() {
    if (!ready || !data || sending.current || assignment.isPending) return;
    const request: ProjectAssignmentRequest = {
      masterTemplateId: data.master.id,
      versionId: data.master.versionId,
      mode,
      ...(mode === "WHOLE" ? { teamId: wholeTeam!.id } : {}),
      modules: mode === "SPLIT" ? mappedTeams.map(({ module, team }) => ({
        moduleTemplateId: module.templateId, teamId: team!.id,
      })) : [],
      teamRoles: roleTeams.map(({ team, choices, leaderId }) => ({
        teamId: team.id,
        expectedVersion: team.version,
        leaderMemberId: leaderId,
        members: team.members.map(member => ({
          memberId: member.memberId, roles: assignmentMemberRoles(member, choices),
        })),
      })),
    };
    const fingerprint = JSON.stringify(request);
    if (requestKey.current?.fingerprint !== fingerprint) requestKey.current = { fingerprint, key: crypto.randomUUID() };
    sending.current = true;
    assignment.mutate({ request, key: requestKey.current.key });
  }

  function chooseTemplate(template: AssignmentTemplate) {
    if (template.id !== selected?.id || template.versionId !== selected?.versionId) selectTemplate(template);
    setBrowsing(false);
    setBriefTemplate(null);
  }

  /** Re-resolves the selected master's published version; switches to a newer one if it was republished. */
  async function reloadTemplates() {
    void client.invalidateQueries({ queryKey: ["master-assignment-templates", classId, sessionId] });
    if (selected) {
      try {
        const found = await projectAssignmentApi.templates(classId, sessionId, { search: selected.code || selected.name, size: 50 });
        const current = found.items.find(item => item.id === selected.id) ?? null;
        if (current?.versionId !== selected.versionId) {
          selectTemplate(current);
          setBrowsing(current === null);
        } else await preview.refetch();
      } catch {
        await preview.refetch();
      }
    }
    goToStep("project");
    assignment.reset();
  }

  function closeStaleBrief() {
    setBriefTemplate(null);
    void reloadTemplates();
  }

  if (assignment.isSuccess) return <Card role="status" className="border-emerald-500/30 bg-emerald-500/5">
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><CheckCircle2 className="size-5 text-emerald-600" /> Đã lưu phân công Master</CardTitle>
      <CardDescription>Về danh sách nhóm để chọn Mentor cho từng Team và kiểm tra điều kiện công bố. Workspace được tạo sau khi công bố thành công.</CardDescription>
    </CardHeader>
    <CardContent>
      <Button asChild className={primaryActionClass}><Link to={backTo}>Về danh sách nhóm</Link></Button>
    </CardContent>
  </Card>;

  const currentStepIndex = assignmentSteps.findIndex(item => item.id === step);
  return <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
    <ol ref={stepList} tabIndex={-1} aria-label="Các bước gán Master Project"
      className="grid scroll-mt-4 grid-cols-3 gap-2 rounded-xl border border-indigo-500/20 bg-card p-2 xl:col-span-2">
      {assignmentSteps.map(({ id, title }, index) => {
        const current = step === id;
        const complete = index < currentStepIndex;
        return <li key={id} aria-current={current ? "step" : undefined}
          className={"flex items-center gap-2 rounded-lg px-2 py-2 text-xs sm:px-3 sm:text-sm "
            + (current ? "bg-indigo-500/10 font-semibold text-indigo-700 dark:text-indigo-300"
              : complete ? "bg-emerald-500/5 text-emerald-700 dark:text-emerald-300" : "text-muted-foreground")}>
          <span className={"grid size-6 shrink-0 place-items-center rounded-full text-xs "
            + (current ? "bg-indigo-700 text-white" : complete ? "bg-emerald-500/15" : "bg-muted")}>{index + 1}</span>
          <span>{title}</span>
        </li>;
      })}
    </ol>
    <div className="grid min-w-0 gap-5">
      {step === "project" && (selected === null || browsing) && <MasterTemplateCatalog classId={classId} sessionId={sessionId}
        teamId={initialTeamId} selectedId={selected?.id ?? null} onSelect={chooseTemplate} onPreview={setBriefTemplate}
        onCancel={selected && browsing ? () => setBrowsing(false) : undefined} />}
      {selected && preview.isPending && <p role="status" className="text-sm text-muted-foreground">Đang tải cây dự án…</p>}
      {preview.isError && <div role="alert" className="grid gap-2 rounded-lg border p-4 text-sm text-destructive">
        <p>{failure(preview.error)}</p><Button className="w-fit" variant="outline" size="sm" onClick={() => void reloadTemplates()}>Tải lại đề bài</Button>
      </div>}
      {data && !preview.isError && step !== "roles" && !(step === "project" && browsing) && <Card className="border-indigo-500/20 border-l-4 border-l-indigo-500 dark:border-l-indigo-400">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <CardTitle className="flex flex-wrap items-center gap-2">{data.master.name} <Badge variant="outline">{data.master.version}</Badge>
              <LevelPill level={selected && "level" in selected ? selected.level as string | null : null} /></CardTitle>
            <CardDescription>{data.modules.length} module trực tiếp · {data.masterMilestoneCount} milestone cấp Master</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setBriefTemplate(data.master)}>
              <Eye className="size-4" /> Xem đề bài
            </Button>
            {!review && <Button type="button" variant="ghost" size="sm" onClick={() => setBrowsing(true)}>
              <Replace className="size-4" /> Đổi đề bài
            </Button>}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {!review && data.modules.length > 0 && <details className="rounded-lg border border-indigo-500/25 bg-indigo-500/5 p-3 text-sm">
            <summary className="cursor-pointer font-medium text-indigo-700 dark:text-indigo-300">Xem cây module</summary>
            <ul className="mt-3 space-y-2">{data.modules.map(module => <ModuleBranch key={module.templateId} module={module} />)}</ul>
          </details>}
          {!review && !teamScoped && data.modules.length > 0 && <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-medium">Cách phân công Master</legend>
            {modeOptions.map(option => <label key={option.id} className={"flex gap-3 rounded-lg border p-3 "
              + (mode === option.id ? "border-indigo-500/60 bg-indigo-500/10" : "hover:border-indigo-500/40 hover:bg-indigo-500/5")}>
              <input type="radio" name="master-distribution" value={option.id} checked={mode === option.id} className="accent-indigo-600"
                onChange={() => { setPreferredMode(option.id); assignment.reset(); }} />
              <span><span className="block text-sm font-medium">{option.title}</span>
                <span className="text-xs text-muted-foreground">{option.description}</span></span>
            </label>)}
          </fieldset>}
          {preview.isFetching && <p role="status" className="text-xs text-muted-foreground">Đang kiểm tra phân công trong lớp…</p>}
          {!hasOwnershipData && !preview.isFetching && <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
            Chưa tải được thông tin Team phụ trách.
            <Button type="button" variant="outline" size="sm" onClick={() => void preview.refetch()}>Kiểm tra lại</Button>
          </div>}
          {mode === "SPLIT" ? <>
            {mappedTeams.map(({ module, team, owners: moduleOwners }) => {
              const id = "module-team-" + module.templateId;
              return <div key={module.templateId} className="grid min-w-0 items-center gap-3 rounded-lg border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_minmax(16rem,1fr)]">
                <div className="min-w-0 space-y-1">
                  <Label htmlFor={review ? undefined : id} className="text-sm font-semibold">{module.name}</Label>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span>{module.code}</span>
                    <span aria-hidden="true">·</span>
                    <span>{module.milestoneCount} milestone</span>
                    <Badge variant="outline" className="font-normal">{module.minMembers}–{module.maxMembers} thành viên</Badge>
                  </div>
                </div>
                {review ? <div className="rounded-md bg-muted/40 px-3 py-2 text-sm font-medium">
                  {team?.name ?? "Chưa chọn Team"}
                </div> : <div className="grid min-w-0 gap-1.5">
                    <TeamSelect id={id} teams={data.teams} value={team ? String(team.id) : ""}
                      min={module.minMembers} max={module.maxMembers} owners={moduleOwners} checkingOwnership={!ownershipReady}
                      onChange={value => { setMapping(current => ({ ...current, [module.templateId]: value })); assignment.reset(); }} />
                    <OwnerNotice owners={moduleOwners} />
                  </div>}
              </div>;
            })}
            <p className="rounded-md bg-indigo-500/5 p-3 text-sm text-indigo-800 dark:text-indigo-200">
              Mỗi Team thực hiện milestone của các module được giao. Mentor lớp quản lý milestone Master ở cấp lớp.
            </p>
          </> : <div className="grid gap-2">
            <Label htmlFor={review || teamScoped ? undefined : "whole-project-team"}>Team nhận toàn bộ đề bài</Label>
            {review || teamScoped ? <p className="text-sm">{wholeTeam?.name ?? "Không tìm thấy Team trong phiên này"}</p>
              : <TeamSelect id="whole-project-team" teams={data.teams} value={wholeTeam ? String(wholeTeam.id) : ""}
                  min={data.minMembers} max={data.maxMembers} owners={owners} checkingOwnership={!ownershipReady}
                  onChange={value => { setTeamId(value); assignment.reset(); }} />}
            <p className="text-xs text-muted-foreground">Sĩ số yêu cầu: {data.minMembers}–{data.maxMembers} thành viên.</p>
            <OwnerNotice owners={owners} />
            {teamScoped && wholeTeam?.assignedProjectName && <p className="text-xs text-muted-foreground">
              Đề bài đã gán: {wholeTeam.assignedProjectName}
            </p>}
            {!teamScoped && owners.length > 0 && !wholeOwnerId && <p role="alert" className="text-sm text-destructive">
              Các module đã thuộc nhiều Team. Hãy dùng chế độ Phân công theo module.
            </p>}
            {teamScoped && wholeTeam && !wholeValid && <p role="alert" className="text-sm text-destructive">
              {!matchesOwners(wholeTeam.id, owners) ? "Đề bài hoặc module đã được giao cho Team khác trong lớp."
                : wholeTeam.reason ?? `Team có ${wholeTeam.memberCount} thành viên. Hãy điều chỉnh sĩ số trước khi gán.`}
            </p>}
          </div>}
        </CardContent>
      </Card>}
      {step !== "project" && roleTeam && <Card className="min-w-0 border-indigo-500/20">
        <CardHeader>
          <CardTitle>{review ? "Leader và vai trò đã chọn" : "Phân vai cho Team"}</CardTitle>
          <CardDescription>{roleTeams.length > 1
            ? "Chọn từng Team để xem Leader và vai trò của các thành viên."
            : "Leader và vai trò của Team nhận Project."}</CardDescription>
        </CardHeader>
        <CardContent className="grid min-w-0 gap-3">
          {roleTeams.length > 1 && <div role="group" aria-label="Team cần phân vai" className="flex min-w-0 gap-2 overflow-x-auto p-0.5">
            {roleTeams.map(({ team, projectName, errors }) => {
              const selectedTeam = roleTeam.team.id === team.id;
              return <button key={team.id} type="button" aria-pressed={selectedTeam}
                className={"grid min-w-40 flex-1 content-start gap-1 rounded-lg border p-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring "
                  + (selectedTeam ? "border-indigo-500/60 bg-indigo-500/10" : "bg-muted/20 hover:border-indigo-500/40 hover:bg-indigo-500/5")}
                onClick={() => setRoleTeamId(team.id)}>
                <span className="break-words font-medium">{team.name}</span>
                <span className="break-words text-xs text-muted-foreground">{projectName}</span>
                <span className={"text-xs font-medium " + (errors.length ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300")}>
                  {errors.length ? "Cần phân vai" : "Sẵn sàng"}
                </span>
              </button>;
            })}
          </div>}
          <AssignmentTeamRoles key={roleTeam.team.id} team={roleTeam.team} policy={roleTeam.policy}
            projectName={roleTeam.projectName} choices={roleTeam.choices} leaderId={roleTeam.leaderId} errors={roleTeam.errors}
            readOnly={review || assignment.isPending}
            onLeaderChange={memberId => {
              setLeaderChoices(previous => ({ ...previous, [roleTeam.team.id]: memberId }));
              assignment.reset();
            }}
            onChange={(memberId, roles) => {
              setRoleChoices(previous => ({ ...previous, [roleTeam.team.id]: { ...previous[roleTeam.team.id], [memberId]: roles } }));
              assignment.reset();
            }} />
        </CardContent>
      </Card>}
    </div>
    <Card className="border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 via-indigo-500/[0.03] to-transparent xl:sticky xl:top-4">
      <CardHeader>
        <CardTitle>{review ? "Kiểm tra trước khi gán" : "Tóm tắt phân công"}</CardTitle>
        <CardDescription>{selected ? selected.name + " · " + selected.version : "Chọn đề bài Master để bắt đầu."}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        {selected && step !== "project" && <Button type="button" variant="link" size="sm" className="h-auto w-fit p-0"
          onClick={() => setBriefTemplate(selected)}><Eye className="size-4" /> Xem đề bài</Button>}
        {data && <>
          <p className="font-medium">{modeOptions.find(option => option.id === mode)?.title}</p>
          <p className="text-muted-foreground">{mode === "SPLIT"
            ? mappedTeams.filter(item => item.valid).length + "/" + data.modules.length + " module đã chọn Team"
            : wholeTeam?.name ?? "Chưa chọn Team"}</p>
          {step !== "project" && <p aria-live="polite" className={ready ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}>
            {readyRoleCount}/{roleTeams.length} Team đã đủ Leader và vai trò.
          </p>}
        </>}
        {review && <p className="rounded-md bg-indigo-500/10 p-3 text-xs text-indigo-800 dark:text-indigo-200">
          Lưu đề bài và vai trò cho các nhóm nháp. Workspace và hạn milestone bắt đầu từ lúc công bố chính thức.
        </p>}
        {step !== "project" && ownershipReady && !canConfigureRoles && <p role="alert" className="text-destructive">
          Phân công của lớp đã thay đổi. Quay lại bước chọn Team để kiểm tra.
        </p>}
        {assignment.isError && <div role="alert" className="grid gap-2 text-destructive">
          <p>{failure(assignment.error)}</p>
          <Button variant="outline" size="sm" onClick={() => void reloadTemplates()}>Tải lại dữ liệu phân công</Button>
        </div>}
        {step === "project"
          ? <Button className={primaryActionClass} disabled={!canConfigureRoles} onClick={() => goToStep("roles")}>Tiếp tục phân vai <ArrowRight /></Button>
          : <>
            <Button className={primaryActionClass} disabled={!ready || assignment.isPending} onClick={() => review ? submit() : goToStep("review")}>
              {assignment.isPending && <LoaderCircle className="size-4 animate-spin" />}
              {assignment.isPending ? "Đang lưu phân công…" : review ? "Lưu phân công" : "Xem lại phân công"}
            </Button>
            <Button variant="outline" disabled={assignment.isPending} onClick={() => goToStep(review ? "roles" : "project")}>
              <ArrowLeft />{review ? "Quay lại phân vai" : "Quay lại chọn Project"}
            </Button>
          </>}
      </CardContent>
    </Card>
    <MasterBriefDialog classId={classId} sessionId={sessionId} template={briefTemplate} selectedId={selected?.id ?? null}
      onClose={() => setBriefTemplate(null)} onVersionChanged={closeStaleBrief}
      onSelect={step === "project" && !assignment.isPending ? chooseTemplate : undefined} />
  </div>;
}
