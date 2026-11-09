import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { ArrowLeft, ArrowRight, CheckCircle2, LoaderCircle, Search } from "lucide-react";
import { projectAssignmentApi } from "@/api/features/project-assignment.api";
import { usePermissions } from "@/hooks/usePermissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AssignmentModule, AssignmentRole, AssignmentRolePolicy, AssignmentTeam, AssignmentTemplate, ProjectAssignmentMode, ProjectAssignmentRequest } from "@/types/features/project-assignment";
import { AssignmentTeamRoles, assignmentMemberRoles, assignmentRoleErrors, type MemberRoleChoices } from "./AssignmentTeamRoles";

const selectClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";
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

function failure(error: unknown) {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    if (error.response?.status === 403) return "Bạn không có quyền gán đề bài cho phiên này.";
    return error.response?.data?.message ?? "Không thể gán đề bài. Vui lòng thử lại.";
  }
  return "Không thể gán đề bài. Vui lòng thử lại.";
}

function fits(team: AssignmentTeam, min: number, max: number) {
  return team.eligible && team.memberCount >= min && team.memberCount <= max;
}

function ModuleBranch({ module }: { module: AssignmentModule }) {
  return <li className="space-y-1">
    <span className="font-medium">{module.name}</span>
    <span className="ml-2 text-xs text-muted-foreground">{module.code} · {module.milestoneCount} milestone</span>
    {module.modules.length > 0 && <ul className="space-y-1 border-l pl-4">
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

function TeamSelect({ id, teams, value, min, max, onChange }: {
  id: string;
  teams: AssignmentTeam[];
  value: string;
  min: number;
  max: number;
  onChange: (value: string) => void;
}) {
  return <select id={id} className={selectClass} value={value} onChange={event => onChange(event.target.value)}>
    <option value="">Chọn Team</option>
    {teams.map(team => {
      const teamId = String(team.id);
      const unavailable = !team.eligible ? team.reason ?? "Team không sẵn sàng" : !fits(team, min, max) ? "Sĩ số không phù hợp" : null;
      return <option key={team.id} value={teamId} disabled={!!unavailable}>
        {team.name} · {team.memberCount} người{unavailable && " · " + unavailable}
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
  const [search, setSearch] = useState("");
  const [keyword, setKeyword] = useState("");
  const [selected, setSelected] = useState<AssignmentTemplate | null>(null);
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

  const catalog = useQuery({
    queryKey: ["master-assignment-templates", classId, sessionId, user.email, activeRole, keyword],
    queryFn: ({ signal }) => projectAssignmentApi.templates(classId, sessionId, keyword, signal),
    retry: false,
  });
  const preview = useQuery({
    queryKey: ["master-assignment-preview", classId, sessionId, user.email, activeRole, selected?.id, selected?.versionId],
    queryFn: ({ signal }) => projectAssignmentApi.preview(classId, sessionId, selected!, signal),
    enabled: selected !== null,
    retry: false,
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
  const mappedTeams = data?.modules.map(module => {
    const team = data.teams.find(item => String(item.id) === mapping[module.templateId]);
    return { module, team, valid: !!team && fits(team, module.minMembers, module.maxMembers) };
  }) ?? [];
  const mapped = mappedTeams.length > 0 && mappedTeams.every(({ valid }) => valid);
  const wholeTeam = data?.teams.find(team => teamScoped ? team.id === initialTeamId : String(team.id) === teamId);
  const wholeValid = !!data && !!wholeTeam && fits(wholeTeam, data.minMembers, data.maxMembers);
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
  const canConfigureRoles = !!data && !preview.isError && !preview.isFetching && (mode === "SPLIT" ? mapped : wholeValid);
  const ready = canConfigureRoles && readyRoleCount === roleTeams.length;
  const review = step === "review";

  function goToStep(next: AssignmentStep) {
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
      modules: mode === "SPLIT" ? data.modules.map(module => ({
        moduleTemplateId: module.templateId, teamId: Number(mapping[module.templateId]),
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

  async function reloadTemplates() {
    const refreshed = await catalog.refetch();
    if (refreshed.isError) return;
    const current = refreshed.data?.find(item => item.id === selected?.id);
    if (current?.versionId !== selected?.versionId) selectTemplate(current ?? null);
    else if (current) await preview.refetch();
    goToStep("project");
    assignment.reset();
  }

  if (assignment.isSuccess) return <Card role="status">
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><CheckCircle2 className="size-5 text-emerald-600" /> Đã lưu phân công Master</CardTitle>
      <CardDescription>Về danh sách nhóm để chọn Mentor cho từng Team và kiểm tra điều kiện công bố. Workspace được tạo sau khi công bố thành công.</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="flex flex-wrap gap-2">
        <Button asChild><Link to={backTo}>Về danh sách nhóm</Link></Button>
        <Button variant="outline" onClick={() => selectTemplate(null)}>Gán Project khác</Button>
      </div>
    </CardContent>
  </Card>;

  return <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
    <ol ref={stepList} tabIndex={-1} aria-label="Các bước gán Master Project"
      className="grid scroll-mt-4 grid-cols-3 gap-2 rounded-xl border bg-card p-2 xl:col-span-2">
      {assignmentSteps.map(({ id, title }, index) => (
        <li key={id} aria-current={step === id ? "step" : undefined}
          className={"flex items-center gap-2 rounded-lg px-2 py-2 text-xs sm:px-3 sm:text-sm "
            + (step === id ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground")}>
          <span className={"grid size-6 shrink-0 place-items-center rounded-full text-xs "
            + (step === id ? "bg-primary text-primary-foreground" : "bg-muted")}>{index + 1}</span>
          <span>{title}</span>
        </li>
      ))}
    </ol>
    <div className="grid min-w-0 gap-5">
      {step === "project" && <Card>
        <CardHeader><CardTitle>Đề bài Master</CardTitle><CardDescription>Chọn phiên bản đã công bố trong thư viện.</CardDescription></CardHeader>
        <CardContent className="grid gap-3">
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={event => { event.preventDefault(); setKeyword(search.trim()); }}>
            <Input aria-label="Tìm đề bài Master" placeholder="Mã hoặc tên đề bài" value={search} onChange={event => setSearch(event.target.value)} />
            <Button type="submit" variant="outline"><Search className="size-4" /> Tìm kiếm</Button>
          </form>
          {catalog.isPending ? <p role="status" className="text-sm text-muted-foreground">Đang tải thư viện…</p>
            : catalog.isError ? <div role="alert" className="flex flex-wrap gap-2 text-sm text-destructive">
              {failure(catalog.error)} <Button variant="outline" size="sm" onClick={() => void catalog.refetch()}>Thử lại</Button>
            </div> : <>
              <Label htmlFor="master-template">Master Project</Label>
              <select id="master-template" className={selectClass} value={selected?.id ?? ""}
                onChange={event => selectTemplate(catalog.data.find(item => item.id === Number(event.target.value)) ?? null)}>
                <option value="">Chọn đề bài Master</option>
                {selected && !catalog.data.some(item => item.id === selected.id) &&
                  <option value={selected.id}>{selected.code} · {selected.name} · {selected.version}</option>}
                {catalog.data.map(template => <option key={template.id} value={template.id}>{template.code} · {template.name} · {template.version}</option>)}
              </select>
              {catalog.data.length === 0 && <p className="text-sm text-muted-foreground">Không tìm thấy đề bài phù hợp.</p>}
            </>}
        </CardContent>
      </Card>}
      {selected && preview.isPending && <p role="status" className="text-sm text-muted-foreground">Đang tải cây dự án…</p>}
      {preview.isError && <div role="alert" className="grid gap-2 rounded-lg border p-4 text-sm text-destructive">
        <p>{failure(preview.error)}</p><Button className="w-fit" variant="outline" size="sm" onClick={() => void reloadTemplates()}>Tải lại đề bài</Button>
      </div>}
      {data && !preview.isError && step !== "roles" && <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">{data.master.name} <Badge variant="outline">{data.master.version}</Badge></CardTitle>
          <CardDescription>{data.modules.length} module trực tiếp · {data.masterMilestoneCount} milestone cấp Master</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {!review && data.modules.length > 0 && <details className="rounded-lg border bg-muted/20 p-3 text-sm">
            <summary className="cursor-pointer font-medium">Xem cây module</summary>
            <ul className="mt-3 space-y-2">{data.modules.map(module => <ModuleBranch key={module.templateId} module={module} />)}</ul>
          </details>}
          {!review && !teamScoped && data.modules.length > 0 && <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-medium">Cách phân công Master</legend>
            {modeOptions.map(option => <label key={option.id} className={"flex gap-3 rounded-lg border p-3 "
              + (mode === option.id ? "border-primary bg-primary/5" : "")}>
              <input type="radio" name="master-distribution" value={option.id} checked={mode === option.id}
                onChange={() => { setPreferredMode(option.id); assignment.reset(); }} />
              <span><span className="block text-sm font-medium">{option.title}</span>
                <span className="text-xs text-muted-foreground">{option.description}</span></span>
            </label>)}
          </fieldset>}
          {mode === "SPLIT" ? <>
            {mappedTeams.map(({ module, team }) => {
              const id = "module-team-" + module.templateId;
              return <div key={module.templateId} className="grid items-center gap-2 sm:grid-cols-2">
                <Label htmlFor={review ? undefined : id}>{module.name}
                  <span className="text-xs font-normal text-muted-foreground">{module.minMembers}–{module.maxMembers} người</span>
                </Label>
                {review ? <p className="text-sm">{team?.name}</p>
                  : <TeamSelect id={id} teams={data.teams} value={mapping[module.templateId] ?? ""}
                      min={module.minMembers} max={module.maxMembers}
                      onChange={value => { setMapping(current => ({ ...current, [module.templateId]: value })); assignment.reset(); }} />}
              </div>;
            })}
            <p className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
              Mỗi Team thực hiện milestone của các module được giao. Mentor lớp quản lý milestone Master ở cấp lớp.
            </p>
          </> : <div className="grid gap-2">
            <Label htmlFor={review || teamScoped ? undefined : "whole-project-team"}>Team nhận toàn bộ đề bài</Label>
            {review || teamScoped ? <p className="text-sm">{wholeTeam?.name ?? "Không tìm thấy Team trong phiên này"}</p>
              : <TeamSelect id="whole-project-team" teams={data.teams} value={wholeTeam ? teamId : ""}
                  min={data.minMembers} max={data.maxMembers}
                  onChange={value => { setTeamId(value); assignment.reset(); }} />}
            <p className="text-xs text-muted-foreground">Sĩ số yêu cầu: {data.minMembers}–{data.maxMembers} thành viên.</p>
            {teamScoped && wholeTeam && !wholeValid && <p role="alert" className="text-sm text-destructive">
              {wholeTeam.reason ?? `Team có ${wholeTeam.memberCount} thành viên. Hãy điều chỉnh sĩ số trước khi gán.`}
            </p>}
          </div>}
        </CardContent>
      </Card>}
      {step !== "project" && roleTeam && <Card className="min-w-0">
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
                  + (selectedTeam ? "border-primary bg-primary/5" : "hover:bg-muted/40")}
                onClick={() => setRoleTeamId(team.id)}>
                <span className="break-words font-medium">{team.name}</span>
                <span className="break-words text-xs text-muted-foreground">{projectName}</span>
                <span className={"text-xs " + (errors.length ? "text-destructive" : "text-emerald-700 dark:text-emerald-400")}>
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
    <Card className="xl:sticky xl:top-4">
      <CardHeader>
        <CardTitle>{review ? "Kiểm tra trước khi gán" : "Tóm tắt phân công"}</CardTitle>
        <CardDescription>{selected ? selected.name + " · " + selected.version : "Chọn đề bài Master để bắt đầu."}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        {data && <>
          <p className="font-medium">{modeOptions.find(option => option.id === mode)?.title}</p>
          <p className="text-muted-foreground">{mode === "SPLIT"
            ? mappedTeams.filter(item => item.valid).length + "/" + data.modules.length + " module đã chọn Team"
            : wholeTeam?.name ?? "Chưa chọn Team"}</p>
          {step !== "project" && <p aria-live="polite" className={ready ? "text-muted-foreground" : "text-destructive"}>
            {readyRoleCount}/{roleTeams.length} Team đã đủ Leader và vai trò.
          </p>}
        </>}
        {review && <p className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
          Lưu đề bài và vai trò cho các nhóm nháp. Workspace và hạn milestone bắt đầu từ lúc công bố chính thức.
        </p>}
        {assignment.isError && <div role="alert" className="grid gap-2 text-destructive">
          <p>{failure(assignment.error)}</p>
          <Button variant="outline" size="sm" onClick={() => void reloadTemplates()}>Tải lại dữ liệu phân công</Button>
        </div>}
        {step === "project"
          ? <Button disabled={!canConfigureRoles} onClick={() => goToStep("roles")}>Tiếp tục phân vai <ArrowRight /></Button>
          : <>
            <Button disabled={!ready || assignment.isPending} onClick={() => review ? submit() : goToStep("review")}>
              {assignment.isPending && <LoaderCircle className="size-4 animate-spin" />}
              {assignment.isPending ? "Đang lưu phân công…" : review ? "Lưu phân công" : "Xem lại phân công"}
            </Button>
            <Button variant="outline" disabled={assignment.isPending} onClick={() => goToStep(review ? "roles" : "project")}>
              <ArrowLeft />{review ? "Quay lại phân vai" : "Quay lại chọn Project"}
            </Button>
          </>}
      </CardContent>
    </Card>
  </div>;
}
