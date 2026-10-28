import { projectTemplateApi, teamAllocationApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import type {
  ProjectTemplateOption,
  TeamMemberRole,
  TeamProjectTemplate,
  TeamRoleQuotaViolation,
  TeamTemplateApiError,
} from "@/types/features/team-allocation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { AlertCircle, ClipboardList, LoaderCircle, Save, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface RoleFailure {
  status: number;
  errorCode: string;
  message: string;
  violations: TeamRoleQuotaViolation[];
  multiRoleMemberIds: number[];
}

const TEAM_ROLE_OPTIONS: TeamMemberRole[] = ["PM", "BA", "DEV", "QA"];
const UNBOUNDED_ROLE_QUOTA = 2_147_483_647;
const TEAM_ROLE_LABEL: Record<TeamMemberRole, string> = {
  PM: "PM (Leader)",
  BA: "BA",
  DEV: "Dev",
  QA: "QA",
};

function roleFailure(error: unknown): RoleFailure {
  if (axios.isAxiosError<RoleFailure>(error)) {
    const data = error.response?.data;
    return {
      status: error.response?.status ?? 0,
      errorCode: data?.errorCode ?? "ERR_REQUEST_FAILED",
      message: data?.message ?? error.message ?? "Không thể lưu vai trò.",
      violations: data?.violations ?? [],
      multiRoleMemberIds: data?.multiRoleMemberIds ?? [],
    };
  }
  return {
    status: 0,
    errorCode: "ERR_REQUEST_FAILED",
    message: error instanceof Error ? error.message : "Không thể lưu vai trò.",
    violations: [],
    multiRoleMemberIds: [],
  };
}

/**
 * US-10 — Student (Team Leader) view.
 * <p>
 * Route: `/student/draft-team`. Lists the DRAFT teams the signed-in student
 * leads (team role `PM`) and lets them pick the official project template for
 * the team. The capacity window (`min_members`..`max_members`) is enforced by
 * the backend; violations come back as HTTP 400
 * `ERR_TEAM_CAPACITY_EXCEEDED` and are rendered per team.
 */
function getTemplateFailure(error: unknown): TeamTemplateApiError {
  if (axios.isAxiosError<TeamTemplateApiError>(error)) {
    const data = error.response?.data;
    return {
      status: error.response?.status ?? 0,
      errorCode: data?.errorCode ?? "ERR_REQUEST_FAILED",
      reason: data?.reason ?? null,
      message: data?.message ?? error.message ?? "Không thể gán đề bài. Vui lòng thử lại.",
      teamId: data?.teamId ?? null,
      projectTemplateId: data?.projectTemplateId ?? null,
      projectTemplateName: data?.projectTemplateName ?? null,
      memberCount: data?.memberCount ?? null,
      minMembers: data?.minMembers ?? null,
      maxMembers: data?.maxMembers ?? null,
    };
  }

  return {
    status: 0,
    errorCode: "ERR_REQUEST_FAILED",
    message: error instanceof Error
      ? error.message
      : "Không thể gán đề bài. Vui lòng thử lại.",
  };
}

export default function StudentDraftTeamPage() {
  const queryClient = useQueryClient();
  const [selection, setSelection] = useState<Record<number, string>>({});
  const [failures, setFailures] = useState<Record<number, TeamTemplateApiError>>({});
  const [roleFailures, setRoleFailures] = useState<Record<number, RoleFailure>>({});

  const teamsQuery = useQuery({
    queryKey: ["student", "draft-teams"],
    queryFn: () => teamAllocationApi.getMyDraftTeams(),
  });
  const templatesQuery = useQuery({
    queryKey: ["project-templates", "options"],
    queryFn: () => projectTemplateApi.getAssignableOptions(),
  });

  const assignMutation = useMutation({
    mutationFn: ({
      teamId,
      projectTemplateId,
    }: {
      teamId: number;
      projectTemplateId: number;
    }) => teamAllocationApi.assignMyDraftTeamTemplate(teamId, projectTemplateId),
    onSuccess: async (updated) => {
      setFailures((current) => {
        const next = { ...current };
        delete next[updated.teamId];
        return next;
      });
      setSelection((current) => {
        const next = { ...current };
        delete next[updated.teamId];
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ["student", "draft-teams"] });
      toast.success(
        `Đã gán đề bài “${updated.projectTemplateName ?? "đề bài"}” cho nhóm ${updated.teamName}.`,
      );
    },
    onError: (error, variables) => {
      const failure = getTemplateFailure(error);
      setFailures((current) => ({ ...current, [variables.teamId]: failure }));
      toast.error(failure.message ?? "Không thể gán đề bài.");
    },
  });

  // US-11: save roles for a DRAFT team the signed-in student leads.
  const updateRolesMutation = useMutation({
    mutationFn: ({
      teamId,
      expectedVersion,
      members,
    }: {
      teamId: number;
      expectedVersion: number;
      members: Array<{ memberId: number; roles: TeamMemberRole[] }>;
    }) => teamAllocationApi.updateMyDraftTeamRoles(teamId, {
      expectedVersion,
      members: members.map((member) => ({
        memberId: member.memberId,
        roles: member.roles,
        role: member.roles[0] ?? null,
      })),
    }),
    onSuccess: async (_, variables) => {
      setRoleFailures((current) => {
        const next = { ...current };
        delete next[variables.teamId];
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ["student", "draft-teams"] });
      await queryClient.invalidateQueries({ queryKey: ["team-member-history"] });
      toast.success("Đã lưu vai trò thành viên trong nhóm.");
    },
    onError: (error, variables) => {
      const failure = roleFailure(error);
      setRoleFailures((current) => ({ ...current, [variables.teamId]: failure }));
      toast.error(failure.message);
    },
  });

  const templates = templatesQuery.data ?? [];
  const teams = teamsQuery.data ?? [];

  return (
    <MainLayout pathName={{ student: "Sinh viên", "draft-team": "Nhóm nháp của tôi" }}>
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-900 px-6 py-8 text-white sm:px-9 sm:py-10">
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <Badge className="mb-4 border border-white/20 bg-white/10 text-blue-100 hover:bg-white/10">
                TRƯỞNG NHÓM
              </Badge>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Gán đề bài cho nhóm nháp
              </h1>
              <p className="mt-3 text-sm leading-6 text-blue-100/80 sm:text-base">
                Chọn Project Template chính thức cho nhóm đang ở trạng thái DRAFT.
                Hệ thống kiểm tra sĩ số nhóm so với khoảng tối thiểu – tối đa của đề bài
                trước khi lưu.
              </p>
            </div>
            <div className="hidden size-24 shrink-0 items-center justify-center rounded-3xl border border-white/15 bg-white/10 sm:flex">
              <UsersRound className="size-12 text-blue-100" />
            </div>
          </div>
        </section>

        {teamsQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            Đang tải nhóm nháp...
          </div>
        ) : teamsQuery.isError ? (
          <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Không tải được danh sách nhóm nháp của bạn.
            <Button
              className="ml-3"
              size="sm"
              variant="outline"
              onClick={() => void teamsQuery.refetch()}
            >
              Thử lại
            </Button>
          </div>
        ) : teams.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ClipboardList className="mx-auto size-9 text-muted-foreground" />
              <p className="mt-3 font-medium">Bạn chưa có nhóm nháp nào</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Bạn chỉ thấy nhóm ở trạng thái DRAFT mà bạn là Trưởng nhóm (vai trò PM).
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {teams.map((team) => (
              <DraftTeamTemplateCard
                key={team.teamId}
                team={team}
                templates={templates}
                templatesLoading={templatesQuery.isLoading}
                selection={selection[team.teamId] ?? ""}
                onSelect={(value) => {
                  setSelection((current) => ({ ...current, [team.teamId]: value }));
                  setFailures((current) => {
                    const next = { ...current };
                    delete next[team.teamId];
                    return next;
                  });
                }}
                failure={failures[team.teamId]}
                pending={
                  assignMutation.isPending &&
                  assignMutation.variables?.teamId === team.teamId
                }
                onAssign={(projectTemplateId) =>
                  assignMutation.mutate({ teamId: team.teamId, projectTemplateId })
                }
                roleFailure={roleFailures[team.teamId]}
                rolesPending={
                  updateRolesMutation.isPending &&
                  updateRolesMutation.variables?.teamId === team.teamId
                }
                onUpdateRoles={(members) =>
                  updateRolesMutation.mutate({
                    teamId: team.teamId,
                    expectedVersion: team.version,
                    members,
                  })
                }
              />
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}

function DraftTeamTemplateCard({
  team,
  templates,
  templatesLoading,
  selection,
  onSelect,
  failure,
  pending,
  onAssign,
  roleFailure,
  rolesPending,
  onUpdateRoles,
}: {
  team: TeamProjectTemplate;
  templates: ProjectTemplateOption[];
  templatesLoading: boolean;
  selection: string;
  onSelect: (value: string) => void;
  failure?: TeamTemplateApiError;
  pending: boolean;
  onAssign: (projectTemplateId: number) => void;
  roleFailure?: RoleFailure;
  rolesPending: boolean;
  onUpdateRoles: (
    members: Array<{ memberId: number; roles: TeamMemberRole[] }>,
  ) => void;
}) {
  const currentTemplateId =
    team.projectTemplateId == null ? "" : String(team.projectTemplateId);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              {team.teamName}
              <Badge variant="secondary">{team.teamStatus}</Badge>
            </CardTitle>
            <CardDescription>
              {team.className ?? `Lớp #${team.classId ?? "?"}`} · {team.memberCount} thành viên
            </CardDescription>
          </div>
          <Badge variant={team.projectTemplateId ? "default" : "outline"}>
            {team.projectTemplateId ? "Đã gán đề bài" : "Chưa gán đề bài"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm font-medium">
          {team.projectTemplateName ?? "Chưa có đề bài"}
        </p>
        <p className="text-xs text-muted-foreground">
          Sĩ số hiện tại: {team.memberCount} thành viên
          {team.minMembers != null && team.maxMembers != null
            ? ` · Đề bài hiện tại yêu cầu ${team.minMembers}–${team.maxMembers} thành viên`
            : ""}
        </p>

        {failure && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          >
            <p className="flex items-center gap-2 font-medium">
              <AlertCircle className="size-4" />
              {failure.errorCode === "ERR_TEAM_NOT_DRAFT"
                ? "Nhóm không còn ở trạng thái DRAFT"
                : failure.reason === "MIN_MEMBERS_NOT_MET"
                  ? "Nhóm chưa đủ sĩ số tối thiểu"
                  : "Sĩ số nhóm vượt quá sức chứa của đề bài"}
            </p>
            <p className="mt-1 text-muted-foreground">{failure.message}</p>
            {failure.minMembers != null && failure.maxMembers != null && (
              <p className="mt-1 text-muted-foreground">
                Yêu cầu {failure.minMembers}–{failure.maxMembers} thành viên · hiện có{" "}
                {failure.memberCount ?? 0}.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <select
            aria-label={`Chọn đề bài cho ${team.teamName}`}
            className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
            value={selection}
            disabled={pending || templatesLoading}
            onChange={(event) => onSelect(event.target.value)}
          >
            <option value="">
              {templatesLoading ? "Đang tải đề bài..." : "Chọn đề bài"}
            </option>
            {templates.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name} ({option.minMembers}–{option.maxMembers} thành viên)
              </option>
            ))}
          </select>
          <Button
            size="sm"
            disabled={pending || !selection || selection === currentTemplateId}
            onClick={() => onAssign(Number(selection))}
          >
            {pending
              ? <LoaderCircle className="size-4 animate-spin" />
              : <Save className="size-4" />}
            Gán đề bài
          </Button>
        </div>

        <TeamRoleEditor
          team={team}
          failure={roleFailure}
          pending={rolesPending}
          onSave={onUpdateRoles}
        />
      </CardContent>
    </Card>
  );
}

/**
 * US-11 — role editor for the student team leader.
 * <p>
 * Every member needs at least one role. When the template says
 * {@code allow_multi_role = false} the UI only allows one role per member;
 * otherwise the roles are toggles. Quota violations are rendered from the
 * backend 422 payload ({@code ERR_TEAM_ROLE_QUOTA_NOT_MET}).
 */
function TeamRoleEditor({
  team,
  failure,
  pending,
  onSave,
}: {
  team: TeamProjectTemplate;
  failure?: RoleFailure;
  pending: boolean;
  onSave: (members: Array<{ memberId: number; roles: TeamMemberRole[] }>) => void;
}) {
  const [rolesByMember, setRolesByMember] = useState<
    Record<number, TeamMemberRole[]>
  >(() => Object.fromEntries(
    team.members.map((member) => [member.memberId, member.roles]),
  ));
  const [localErrors, setLocalErrors] = useState<number[]>([]);

  useEffect(() => {
    setRolesByMember(Object.fromEntries(
      team.members.map((member) => [member.memberId, member.roles]),
    ));
    setLocalErrors([]);
  }, [team.version, team.members]);

  if (team.teamStatus !== "DRAFT") {
    return null;
  }

  const allowMultiRole = team.allowMultiRole;
  const invalidMemberIds = new Set([
    ...localErrors,
    ...(failure?.multiRoleMemberIds ?? []),
  ]);

  const updateRoles = (memberId: number, roles: TeamMemberRole[]) => {
    setRolesByMember((current) => ({
      ...current,
      [memberId]: TEAM_ROLE_OPTIONS.filter((role) => roles.includes(role)),
    }));
    setLocalErrors((current) => current.filter((id) => id !== memberId));
  };

  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Vai trò thành viên</p>
        <Badge variant={allowMultiRole ? "secondary" : "outline"}>
          {allowMultiRole ? "Cho phép kiêm nhiệm" : "Không kiêm nhiệm"}
        </Badge>
      </div>

      {team.roleQuotas.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {team.roleQuotas.map((quota) => (
            <li key={quota.role}>
              <Badge variant="outline" className="font-normal">
                {quota.role}:{" "}
                {quota.max >= UNBOUNDED_ROLE_QUOTA
                  ? `${quota.min}+`
                  : `${quota.min}-${quota.max}`}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      {team.projectTemplateId == null && (
        <p className="text-xs text-muted-foreground">
          Nhóm chưa gán đề bài: mặc định mỗi thành viên chỉ chọn 1 vai trò.
          Gán đề bài để áp dụng định suất và quy tắc kiêm nhiệm của đề bài.
        </p>
      )}

      {failure && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive"
        >
          {failure.status === 409
            ? "Dữ liệu nhóm đã thay đổi, vui lòng tải lại trang."
            : failure.message}
          {failure.violations.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {failure.violations.map((violation) => (
                <li key={`${violation.role}-${violation.reason}`}>
                  {violation.role}:{" "}
                  {violation.reason === "MISSING_REQUIRED_ROLE"
                    ? `cần tối thiểu ${violation.required}, hiện có ${violation.actual}`
                    : `tối đa ${violation.required}, hiện có ${violation.actual}`}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {localErrors.length > 0 && (
        <p className="text-xs text-destructive">
          Mỗi thành viên cần ít nhất một vai trò.
        </p>
      )}

      <ul className="space-y-1.5">
        {team.members.map((member) => {
          const selected = rolesByMember[member.memberId] ?? member.roles;
          const invalid = invalidMemberIds.has(member.memberId);
          return (
            <li
              key={member.memberId}
              className={`flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-2.5 py-2 text-sm ${
                invalid ? "border-destructive" : ""
              }`}
            >
              <span className="min-w-0 truncate">{member.fullName}</span>
              {allowMultiRole ? (
                <span
                  role="group"
                  aria-label={`Vai trò của ${member.fullName}`}
                  className="flex flex-wrap gap-1"
                >
                  {TEAM_ROLE_OPTIONS.map((role) => (
                    <label
                      key={role}
                      className={`flex cursor-pointer items-center gap-1 rounded-md border px-1.5 py-1 text-xs ${
                        selected.includes(role)
                          ? "border-primary/50 bg-primary/10 font-medium text-primary"
                          : "text-muted-foreground"
                      } ${pending ? "cursor-not-allowed opacity-60" : ""}`}
                    >
                      <Checkbox
                        checked={selected.includes(role)}
                        disabled={pending}
                        onCheckedChange={() => updateRoles(
                          member.memberId,
                          selected.includes(role)
                            ? selected.filter((value) => value !== role)
                            : [...selected, role],
                        )}
                        aria-label={`${TEAM_ROLE_LABEL[role]} của ${member.fullName}`}
                      />
                      {TEAM_ROLE_LABEL[role]}
                    </label>
                  ))}
                </span>
              ) : (
                <select
                  aria-label={`Vai trò của ${member.fullName}`}
                  className={`h-8 rounded-md border bg-background px-2 text-xs ${
                    invalid ? "border-destructive" : ""
                  }`}
                  value={selected[0] ?? ""}
                  disabled={pending}
                  onChange={(event) => updateRoles(
                    member.memberId,
                    event.target.value
                      ? [event.target.value as TeamMemberRole]
                      : [],
                  )}
                >
                  <option value="">Chọn vai trò</option>
                  {TEAM_ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {TEAM_ROLE_LABEL[role]}
                    </option>
                  ))}
                </select>
              )}
            </li>
          );
        })}
      </ul>

      <Button
        size="sm"
        disabled={pending}
        onClick={() => {
          const missing = team.members
            .filter((member) =>
              (rolesByMember[member.memberId] ?? member.roles).length === 0)
            .map((member) => member.memberId);
          if (missing.length > 0) {
            setLocalErrors(missing);
            toast.error("Mỗi thành viên cần ít nhất một vai trò.");
            return;
          }
          onSave(team.members.map((member) => ({
            memberId: member.memberId,
            roles: rolesByMember[member.memberId] ?? member.roles,
          })));
        }}
      >
        {pending
          ? <LoaderCircle className="size-4 animate-spin" />
          : <Save className="size-4" />}
        Lưu vai trò
      </Button>
    </div>
  );
}
