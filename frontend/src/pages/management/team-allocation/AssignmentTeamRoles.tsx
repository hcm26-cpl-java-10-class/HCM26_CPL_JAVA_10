import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { AssignmentMember, AssignmentRole, AssignmentRolePolicy, AssignmentTeam } from "@/types/features/project-assignment";

export type MemberRoleChoices = Record<number, AssignmentRole[]>;
const roles: AssignmentRole[] = ["PM", "BA", "DEV", "QA"];

export function assignmentMemberRoles(member: AssignmentMember, policy: AssignmentRolePolicy,
    choices: MemberRoleChoices, leaderId: number | null): AssignmentRole[] {
  const selected = (choices[member.memberId] ?? member.roles).filter(role => role !== "PM");
  if (leaderId !== member.memberId) return selected;
  return policy.allowMultiRole ? ["PM", ...selected] : ["PM"];
}

export function assignmentRoleErrors(team: AssignmentTeam, policy: AssignmentRolePolicy, choices: MemberRoleChoices, leaderId: number | null): string[] {
  const errors: string[] = [];
  if (!team.members.some(member => member.memberId === leaderId)) {
    errors.push(team.status === "DRAFT" ? "Choose a Leader / PM." : "Set an active Leader / PM in Team allocation.");
  }
  const counts = new Map<AssignmentRole, number>();
  for (const member of team.members) {
    const selected = assignmentMemberRoles(member, policy, choices, leaderId);
    if (!selected.length) errors.push(`Choose a role for ${member.name}.`);
    else if (!policy.allowMultiRole && selected.length !== 1) errors.push(`${member.name} must have exactly one role.`);
    selected.forEach(role => counts.set(role, (counts.get(role) ?? 0) + 1));
  }
  for (const quota of policy.quotas) {
    const count = counts.get(quota.role) ?? 0;
    if (count < quota.min) errors.push(`${quota.role}: requires at least ${quota.min}; currently ${count}.`);
    else if (count > quota.max) errors.push(`${quota.role}: allows at most ${quota.max}; currently ${count}.`);
  }
  return errors;
}

export function AssignmentTeamRoles({ team, projectName, policy, choices, leaderId, readOnly, onLeaderChange, onChange }: {
  team: AssignmentTeam; projectName: string; policy: AssignmentRolePolicy; choices: MemberRoleChoices;
  leaderId: number | null; readOnly: boolean; onLeaderChange: (memberId: number | null) => void;
  onChange: (memberId: number, roles: AssignmentRole[]) => void;
}) {
  const errors = assignmentRoleErrors(team, policy, choices, leaderId);
  const counts = new Map<AssignmentRole, number>();
  team.members.forEach(member => assignmentMemberRoles(member, policy, choices, leaderId).forEach(role => counts.set(role, (counts.get(role) ?? 0) + 1)));
  return <section className="space-y-3 rounded-lg border p-4" aria-label={`Member roles for ${team.name}`}>
    <div className="space-y-1"><p className="text-sm font-semibold">{team.name} · {projectName}</p>
      <p className="text-xs text-muted-foreground">{policy.allowMultiRole ? "Members can hold multiple roles." : "Choose one role for each active member."}</p></div>
    <label className="grid gap-1 text-sm">Leader / PM
      <select className="h-10 w-full rounded-md border bg-background px-3" value={leaderId ?? ""}
        disabled={readOnly || team.leaderMemberId != null || team.status !== "DRAFT"}
        onChange={event => onLeaderChange(event.target.value ? Number(event.target.value) : null)}>
        <option value="">Select a Leader</option>
        {team.members.map(member => <option key={member.memberId} value={member.memberId}>{member.name}</option>)}
      </select>
    </label>
    {policy.quotas.length > 0 && <div className="flex flex-wrap gap-2" aria-label="Required role quotas">{policy.quotas.map(quota => {
      const count = counts.get(quota.role) ?? 0;
      return <Badge key={quota.role} variant={count < quota.min || count > quota.max ? "destructive" : "outline"}>
        {quota.role}: {count} selected · {quota.max === quota.min ? `${quota.min} required`
          : quota.max >= 2147483647 ? `at least ${quota.min} required` : `${quota.min}–${quota.max} allowed`}
      </Badge>;
    })}</div>}
    <div className="divide-y rounded-md border">{team.members.map(member => {
      const selected = assignmentMemberRoles(member, policy, choices, leaderId);
      const label = `Role for ${member.name} in ${team.name}`;
      return <div key={member.memberId} className="grid items-center gap-3 p-3 sm:grid-cols-2">
        <div className="min-w-0"><p className="text-sm font-medium">{member.name}</p><p className="text-xs text-muted-foreground">{member.userCode}</p></div>
        {readOnly ? <p className="text-sm">{selected.join(", ") || "No role selected"}</p> : policy.allowMultiRole
          ? <fieldset className="flex flex-wrap gap-3"><legend className="sr-only">{label}</legend>{roles.map(role =>
              <label key={role} className="flex items-center gap-2 text-sm"><Checkbox aria-label={`${role} for ${member.name} in ${team.name}`}
                checked={selected.includes(role)} disabled={role === "PM"} onCheckedChange={checked => onChange(member.memberId,
                  checked === true ? roles.filter(value => value === role || selected.includes(value)) : selected.filter(value => value !== role))} />{role}</label>)}</fieldset>
          : <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" aria-label={label}
              aria-invalid={selected.length !== 1} disabled={leaderId === member.memberId} value={selected.length === 1 ? selected[0] : ""}
              onChange={event => onChange(member.memberId, event.target.value ? [event.target.value as AssignmentRole] : [])}>
              <option value="">Select a role</option>{roles.filter(role => (role === "PM") === (leaderId === member.memberId)).map(role => <option key={role} value={role}>{role}</option>)}
            </select>}
      </div>;
    })}</div>
    {errors.length > 0 && <ul className="space-y-1 text-xs text-destructive" aria-live="polite">{errors.map(error => <li key={error}>{error}</li>)}</ul>}
  </section>;
}
