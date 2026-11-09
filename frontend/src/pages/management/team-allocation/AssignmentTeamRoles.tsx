import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { AssignmentMember, AssignmentRole, AssignmentRolePolicy, AssignmentTeam } from "@/types/features/project-assignment";
import type { TeamMemberRole } from "@/types/features/team-allocation";

export type MemberRoleChoices = Record<number, AssignmentRole[]>;
const roles: TeamMemberRole[] = ["PM", "BA", "DEV", "QA"];

export function assignmentMemberRoles(member: AssignmentMember, choices: MemberRoleChoices): AssignmentRole[] {
  return choices[member.memberId] ?? member.roles;
}

export function assignmentRoleErrors(team: AssignmentTeam, policy: AssignmentRolePolicy, choices: MemberRoleChoices, leaderId: number | null): string[] {
  const errors: string[] = [];
  if (!team.members.some(member => member.memberId === leaderId)) {
    errors.push(team.status === "DRAFT" ? "Chọn Leader cho Team." : "Chọn một Leader đang hoạt động trong màn Phân nhóm dự án.");
  }
  const counts = new Map<AssignmentRole, number>();
  for (const member of team.members) {
    const selected = assignmentMemberRoles(member, choices);
    if (!selected.length) errors.push(`Chọn vai trò cho ${member.name}.`);
    else if (!policy.allowMultiRole && selected.length !== 1) errors.push(`${member.name} cần có đúng một vai trò.`);
    selected.forEach(role => counts.set(role, (counts.get(role) ?? 0) + 1));
  }
  for (const quota of policy.quotas) {
    const count = counts.get(quota.role) ?? 0;
    if (count < quota.min) errors.push(`${quota.role} cần ít nhất ${quota.min} người, hiện có ${count}.`);
    else if (count > quota.max) errors.push(`${quota.role} cho phép tối đa ${quota.max} người, hiện có ${count}.`);
  }
  return errors;
}

export function TeamMemberRoleInput({ label, selected, multiple, disabled, placeholder = "Select a role", onChange }: {
  label: string; selected: TeamMemberRole[]; multiple: boolean; disabled?: boolean;
  placeholder?: string; onChange: (roles: TeamMemberRole[]) => void;
}) {
  if (multiple) {
    return <fieldset className="flex flex-wrap gap-3" disabled={disabled}>
      <legend className="sr-only">{label}</legend>
      {roles.map(role => <label key={role} className="flex items-center gap-2 text-sm">
        <Checkbox checked={selected.includes(role)} disabled={disabled}
          aria-label={`${role} · ${label}`}
          onCheckedChange={checked => onChange(checked === true ? [...selected, role] : selected.filter(value => value !== role))} />
        {role}
      </label>)}
    </fieldset>;
  }
  return <select className="h-9 rounded-md border bg-background px-2 text-sm" aria-label={label}
    aria-invalid={selected.length !== 1} disabled={disabled} value={selected.length === 1 ? selected[0] : ""}
    onChange={event => onChange(event.target.value ? [event.target.value as TeamMemberRole] : [])}>
    <option value="">{placeholder}</option>
    {roles.map(role => <option key={role} value={role}>{role}</option>)}
  </select>;
}

export function AssignmentTeamRoles({ team, projectName, policy, choices, leaderId, errors, readOnly, onLeaderChange, onChange }: {
  team: AssignmentTeam; projectName: string; policy: AssignmentRolePolicy; choices: MemberRoleChoices;
  leaderId: number | null; errors: string[]; readOnly: boolean; onLeaderChange: (memberId: number | null) => void;
  onChange: (memberId: number, roles: AssignmentRole[]) => void;
}) {
  const leader = team.members.find(member => member.memberId === leaderId);
  const leaderFieldId = "assignment-leader-" + team.id;
  const counts = new Map<AssignmentRole, number>();
  team.members.forEach(member => assignmentMemberRoles(member, choices).forEach(role => counts.set(role, (counts.get(role) ?? 0) + 1)));
  return <section className="grid min-w-0 gap-3 rounded-lg border p-3 sm:p-4" aria-label={`Vai trò thành viên của ${team.name}`}>
    <div>
      <p className="break-words text-sm font-semibold">{team.name} · {projectName}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {team.memberCount} thành viên · {policy.allowMultiRole ? "Có thể chọn nhiều vai trò cho mỗi người." : "Mỗi người chọn một vai trò."}
      </p>
    </div>
    <div className="grid items-start gap-3 sm:grid-cols-2">
      {readOnly ? <div className="space-y-1">
        <p className="text-sm font-medium">Leader</p>
        <p className="text-sm">{leader?.name ?? "Chưa chọn"}</p>
      </div> : <div className="grid min-w-0 gap-1 text-sm">
        <label htmlFor={leaderFieldId} className="font-medium">Leader</label>
        <select id={leaderFieldId} className="h-9 w-full min-w-0 rounded-md border bg-background px-2" value={leaderId ?? ""}
          aria-invalid={!leader} disabled={team.status !== "DRAFT"}
          onChange={event => onLeaderChange(event.target.value ? Number(event.target.value) : null)}>
          <option value="">Chọn Leader</option>
          {team.members.map(member => <option key={member.memberId} value={member.memberId}>{member.name}</option>)}
        </select>
      </div>}
      {policy.quotas.length > 0 && <div className="grid gap-1">
        <p className="text-sm font-medium">Yêu cầu vai trò</p>
        <div className="flex flex-wrap gap-1.5">{policy.quotas.map(quota => {
          const count = counts.get(quota.role) ?? 0;
          const limit = quota.max === quota.min ? `cần ${quota.min}`
            : quota.max >= 2147483647 ? `tối thiểu ${quota.min}` : `cần ${quota.min}–${quota.max}`;
          return <Badge key={quota.role} variant={count < quota.min || count > quota.max ? "destructive" : "outline"}>
            {quota.role} {count} · {limit}
          </Badge>;
        })}</div>
      </div>}
    </div>
    <ul className="max-h-72 divide-y overflow-y-auto rounded-md border">
      {team.members.map(member => {
        const selected = assignmentMemberRoles(member, choices);
        return <li key={member.memberId} className={"grid items-center gap-2 px-3 py-2 "
          + (policy.allowMultiRole ? "lg:grid-cols-[minmax(0,1fr)_auto]" : "sm:grid-cols-[minmax(0,1fr)_8rem]")}>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-1.5 break-words text-sm font-medium">
              {member.name}{leaderId === member.memberId && <Badge variant="secondary">Leader</Badge>}
            </p>
            <p className="truncate text-xs text-muted-foreground">{member.userCode}</p>
          </div>
          {readOnly ? <p className="text-sm">{selected.join(", ") || "Chưa chọn vai trò"}</p>
            : <TeamMemberRoleInput label={`Vai trò của ${member.name}`} selected={selected} multiple={policy.allowMultiRole}
                placeholder="Chọn vai trò" onChange={next => onChange(member.memberId, next)} />}
        </li>;
      })}
    </ul>
    {errors.length > 0 && <ul className="space-y-1 text-xs text-destructive" aria-live="polite">
      {errors.map(error => <li key={error}>{error}</li>)}
    </ul>}
  </section>;
}
