import { teamAllocationApi, trainingClassApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePermissions } from "@/hooks/usePermissions";
import { MetricCard } from "./MetricCard";
import type {
  AllocationApiError,
  AllocationReadiness,
  AutoAllocationPreview,
  AllocationSession,
  AllocationTeam,
  ClassMember,
  ClassRosterMember,
  DraftWarning,
  MentorOption,
  PublishTeamsResponse,
  SaveDraftRequest,
  TeamMemberRole,
  TeamReadinessIssue,
  TeamRoleQuota,
  TeamRoleQuotaViolation,
  TeamTemplateApiError,
  TransferTeamMemberRequest,
  AllocationSessionStatus,
} from "@/types/features/team-allocation";
import type { TrainingClassDTO } from "@/types/features/training-class";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  ArrowLeft,
  Ban,
  CalendarDays,
  CircleAlert,
  ClipboardList,
  Info,
  LoaderCircle,
  Plus,
  Ban,
  Save,
  Search,
  Shuffle,
  Send,
  ShieldCheck,
  Trash2,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

const SESSION_STORAGE_KEY = "team-allocation-session";

const SESSION_STATUS_LABEL: Record<AllocationSessionStatus, string> = {
  OPEN: "Đang mở",
  PUBLISHED: "Đã công bố",
  CLOSED: "Đã đóng",
  CANCELLED: "Đã hủy",
};

const SESSION_STATUS_CLASS: Record<AllocationSessionStatus, string> = {
  OPEN: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  PUBLISHED: "border-primary/40 bg-primary/10 text-primary",
  CLOSED: "border-muted-foreground/30 bg-muted text-muted-foreground",
  CANCELLED: "border-destructive/40 bg-destructive/10 text-destructive",
};

function getApiFailure(error: unknown) {
  if (axios.isAxiosError<AllocationApiError>(error)) {
    const data = error.response?.data;
    return {
      status: error.response?.status ?? 0,
      code: data?.errorCode ?? "ERR_REQUEST_FAILED",
      message:
        data?.message ??
        data?.error ??
        error.message ??
        "Không thể hoàn tất yêu cầu. Vui lòng thử lại.",
      memberId: data?.memberId ?? null,
      unassignedCount: data?.unassignedCount,
      unassignedMemberIds: data?.unassignedMemberIds,
      unassignedMembers: data?.unassignedMembers,
      teamIssues: data?.teamIssues,
      blockers: data?.blockers,
      invalidMemberIds: data?.invalidMemberIds,
      violations: data?.violations,
      multiRoleMemberIds: data?.multiRoleMemberIds,
    };
  }

  return {
    status: 0,
    message:
      error instanceof Error
        ? error.message
        : "Không thể hoàn tất yêu cầu. Vui lòng thử lại.",
  };
}

function makeIdempotencyKey() {
  return crypto.randomUUID();
}

/** US-10: maps `ERR_TEAM_CAPACITY_EXCEEDED` / `ERR_TEAM_NOT_DRAFT` bodies. */
function getTemplateFailure(error: unknown): TeamTemplateApiError {
  if (axios.isAxiosError<TeamTemplateApiError>(error)) {
    const data = error.response?.data;
    return {
      status: error.response?.status ?? 0,
      errorCode: data?.errorCode ?? "ERR_REQUEST_FAILED",
      reason: data?.reason ?? null,
      message:
        data?.message ??
        error.message ??
        "Không thể gán đề bài. Vui lòng thử lại.",
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

function isTeamMemberRole(role: string | null | undefined): role is TeamMemberRole {
  return role === "PM" || role === "BA" || role === "DEV" || role === "QA";
}

const TEAM_ROLE_OPTIONS: TeamMemberRole[] = ["PM", "BA", "DEV", "QA"];

/** Backend uses Integer.MAX_VALUE for an unbounded max quota. */
const UNBOUNDED_ROLE_QUOTA = 2_147_483_647;

const TEAM_ROLE_LABEL: Record<TeamMemberRole, string> = {
  PM: "PM (Leader)",
  BA: "BA",
  DEV: "Dev",
  QA: "QA",
};

/** US-11: member roles from the new `roles` array, falling back to `role`. */
function memberRolesOf(member: {
  role?: string | null;
  roles?: TeamMemberRole[];
}): TeamMemberRole[] {
  if (member.roles?.length) return member.roles;
  return isTeamMemberRole(member.role) ? [member.role] : [];
}

function hasCompleteTeamRoles(team: AllocationTeam) {
  const rolesComplete = team.members?.length === team.memberIds.length &&
    team.members.every((member) => memberRolesOf(member).length > 0);
  return rolesComplete && roleQuotaGaps(team).length === 0;
}

/** US-11: local preview of the template quota gaps (backend is authoritative). */
function roleQuotaGaps(
  team: AllocationTeam,
  rolesByMember?: Record<number, TeamMemberRole[]>,
): TeamRoleQuotaViolation[] {
  const quotas = team.roleQuotas ?? [];
  if (!quotas.length) return [];
  const counts = new Map<string, number>();
  const memberRoles = rolesByMember
    ? Object.values(rolesByMember)
    : (team.members ?? []).map((member) => memberRolesOf(member));
  memberRoles.forEach((roles) =>
    roles.forEach((role) => counts.set(role, (counts.get(role) ?? 0) + 1)),
  );
  return quotas.flatMap((quota) => {
    const actual = counts.get(quota.role) ?? 0;
    if (actual < quota.min) {
      return [{
        role: quota.role,
        reason: "MISSING_REQUIRED_ROLE",
        required: quota.min,
        actual,
      } satisfies TeamRoleQuotaViolation];
    }
    if (quota.max != null && quota.max < UNBOUNDED_ROLE_QUOTA && actual > quota.max) {
      return [{
        role: quota.role,
        reason: "ROLE_QUOTA_EXCEEDED",
        required: quota.max,
        actual,
      } satisfies TeamRoleQuotaViolation];
    }
    return [];
  });
}

function quotaWindow(quota: TeamRoleQuota) {
  return quota.max >= UNBOUNDED_ROLE_QUOTA
    ? `${quota.min}+`
    : `${quota.min}-${quota.max}`;
}

function getStoredKey(
  ref: MutableRefObject<{ fingerprint: string; key: string } | null>,
  fingerprint: string,
) {
  if (ref.current?.fingerprint !== fingerprint) {
    ref.current = { fingerprint, key: makeIdempotencyKey() };
  }
  return ref.current.key;
}

export default function TeamAllocationPage() {
  const { hasPermission } = usePermissions();
  const { classId: classIdParam } = useParams<{ classId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const classId = Number(classIdParam);
  const allocationLink = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const sessionId = Number(params.get("sessionId"));
    const teamId = Number(params.get("teamId"));
    return {
      sessionId: Number.isSafeInteger(sessionId) && sessionId > 0 ? sessionId : null,
      teamId: Number.isSafeInteger(teamId) && teamId > 0 ? teamId : null,
    };
  }, [location.search]);
  const requestedSessionRef = useRef(allocationLink.sessionId);
  const selectedClass = (location.state as { trainingClass?: TrainingClassDTO } | null)
    ?.trainingClass;
  const queryClient = useQueryClient();
  const classId = Number(classIdParam);
  const canAllocate = hasPermission("PEO_TEAM_ALLOCATE");
  const [capacityInput, setCapacityInput] = useState("");
  const [cancelTarget, setCancelTarget] = useState<AllocationSession | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [summaryDialog, setSummaryDialog] = useState<
    "unassigned" | "saved" | "publishable" | null
  >(null);
  const [removeMemberTarget, setRemoveMemberTarget] = useState<{
    teamId: number;
    memberId: number;
    memberName: string;
  } | null>(null);
  const [removeMemberReason, setRemoveMemberReason] = useState("");
  const [activeMentorTarget, setActiveMentorTarget] = useState<{
    teamId: number;
    teamName: string;
    mentorId: number | null;
    active: boolean;
  } | null>(null);
  const [activeMentorReason, setActiveMentorReason] = useState("");
  const [activeMentorSelection, setActiveMentorSelection] = useState("");
  const [activeTab, setActiveTab] = useState<"teams" | "history">("teams");
  const [transferTarget, setTransferTarget] = useState<{
    teamId: number;
    memberId: number;
    memberName: string;
  } | null>(null);
  const [transferDestinationId, setTransferDestinationId] = useState("");
  const [transferMode, setTransferMode] = useState<"move" | "swap">("move");
  const [transferReplacementMemberId, setTransferReplacementMemberId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [roleAssignmentFailures, setRoleAssignmentFailures] =
    useState<Record<number, ApiFailure>>({});
  const [draftTeams, setDraftTeams] = useState<LocalDraftTeam[]>([]);
  const [leaderReplacement, setLeaderReplacement] = useState<{
    team: AllocationTeam; memberId: number; memberName: string; oldName: string;
  } | null>(null);
  const [autoPreview, setAutoPreview] = useState<AutoAllocationPreview | null>(null);
  const [expandedPreviewTeams, setExpandedPreviewTeams] = useState<Set<number>>(
    () => new Set(),
  );
  const [autoPreviewError, setAutoPreviewError] = useState("");
  const [autoConfirmKey, setAutoConfirmKey] = useState<string | null>(null);
  const [collapsedDraftTeamIds, setCollapsedDraftTeamIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [memberSearch, setMemberSearch] = useState("");
  const [memberPickerTeamId, setMemberPickerTeamId] = useState<string | null>(null);
  const [editingSavedTeamId, setEditingSavedTeamId] = useState<number | null>(null);
  const [saveFailure, setSaveFailure] = useState<ApiFailure | null>(null);
  const [publishFailure, setPublishFailure] = useState<ApiFailure | null>(null);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);
  /** US-12: latest strict-mode readiness report (null until checked). */
  const [readiness, setReadiness] = useState<AllocationReadiness | null>(null);
  const [readinessError, setReadinessError] = useState<ApiFailure | null>(null);
  const [publishItemFailures, setPublishItemFailures] = useState<
    PublishTeamsResponse["failedItems"]
  >([]);
  const [lastWarnings, setLastWarnings] = useState<DraftWarning[]>([]);
  const [templateAssignErrors, setTemplateAssignErrors] = useState<
    Record<number, TeamTemplateApiError>
  >({});
  const saveKeyRef = useRef<{ fingerprint: string; key: string } | null>(null);

  const classQuery = useQuery({
    queryKey: ["training-class", "detail", classId],
    queryFn: () => trainingClassApi.getById(String(classId)),
    enabled: Number.isSafeInteger(classId) && classId > 0,
    retry: false,
  });
  const trainingClass =
    (location.state as { trainingClass?: TrainingClassDTO } | null)?.trainingClass ??
    classQuery.data;

  const sessionsQuery = useQuery({
    queryKey: ["team-allocation", "sessions", classId],
    queryFn: () => teamAllocationApi.getSessions(classId),
    enabled: Number.isSafeInteger(classId) && classId > 0,
  });
  const sessions = useMemo(() => sessionsQuery.data ?? [], [sessionsQuery.data]);
  const selectedSession = useMemo(
    () =>
      sessions.find((item) => item.id === selectedSessionId) ??
      sessions[0] ??
      null,
    [sessions, selectedSessionId],
  );

  // Overview of the selected session (same figures as the allocation workspace).
  const sessionTeamsQuery = useQuery({
    queryKey: ["team-allocation", "teams", classId, selectedSession?.id ?? null],
    queryFn: () => teamAllocationApi.getTeams(classId, selectedSession!.id),
    enabled: Number.isSafeInteger(classId) && classId > 0 && selectedSession !== null,
    retry: false,
  });
  const unassignedQuery = useQuery({
    queryKey: [
      "team-allocation",
      "unassigned-members",
      classId,
      selectedSession?.id ?? null,
    ],
    queryFn: () =>
      teamAllocationApi.getUnassignedMembers(classId, selectedSession!.id),
    enabled:
      Number.isSafeInteger(classId) &&
      classId > 0 &&
      selectedSession !== null &&
      canAllocate,
  });
  const sessionTeams = sessionTeamsQuery.data?.teams ?? [];
  const unassignedMembers = canAllocate ? unassignedQuery.data ?? [] : [];
  const publishableTeams = sessionTeams.filter((team) => team.status === "DRAFT");

  const openSessionMutation = useMutation({
    mutationFn: (maxMembers: number) =>
      teamAllocationApi.openSession(classId, { maxMembers }),
    onSuccess: (openedSession) => {
      // Put the new session at the top of the cached list before it is
      // re-fetched: the session-sync effect below falls back to
      // `sessions[0]` when the selected id is not in the list yet, which used
      // to bounce the page back to a previous (e.g. PUBLISHED) session.
      queryClient.setQueryData<AllocationSession[]>(
        ["team-allocation", "sessions", classId],
        (current) =>
          current
            ? [openedSession, ...current.filter((item) => item.id !== openedSession.id)]
            : [openedSession],
      );
      setCapacityInput("");
      void queryClient.invalidateQueries({
        queryKey: ["team-allocation", "sessions", classId],
      });
      toast.success(
        `Đã tạo phiên phân nhóm #${openedSession.sessionNumber}. Bấm “Allocate Teams” để bắt đầu.`,
      );
    },
    onError: (error) => toast.error(getApiFailure(error).message),
  });

  const updateCapacityMutation = useMutation({
    mutationFn: () => {
      const maxMembers = Number(capacityInput);
      if (classId === null || sessionId === null) {
        throw new Error("Không có phiên phân nhóm đang mở.");
      }
      if (!Number.isSafeInteger(maxMembers) || maxMembers <= 0) {
        throw new Error("Sức chứa phải là số nguyên dương.");
      }
      return teamAllocationApi.updateSessionCapacity(classId, sessionId, maxMembers);
    },
    onSuccess: (updatedSession) => {
      queryClient.setQueryData<AllocationSession[]>(
        ["team-allocation", "sessions", classId],
        (current) => current
          ? current.map((item) =>
              item.id === updatedSession.id ? updatedSession : item,
            )
          : [updatedSession],
      );
      setSession(updatedSession);
      setCapacityInput(String(updatedSession.maxMembers));
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updatedSession));
      saveKeyRef.current = null;
      void queryClient.invalidateQueries({
        queryKey: ["team-allocation", "teams", classId, updatedSession.id],
      });
      toast.success(`Đã cập nhật sức chứa tối đa thành ${updatedSession.maxMembers} học viên/nhóm.`);
    },
    onError: (error) => toast.error(getApiFailure(error).message),
  });

  useEffect(() => {
    setAutoPreview(null);
    setAutoPreviewError("");
    setAutoConfirmKey(null);
  }, [sessionId, session?.maxMembers]);

  const autoPreviewMutation = useMutation({
    mutationFn: () => teamAllocationApi.previewAutoAllocation(classId, sessionId!),
    onSuccess: (preview) => {
      setExpandedPreviewTeams((current) => autoPreview === null
        ? new Set(preview.teams.map((_, index) => index))
        : new Set([...current].filter((index) => index < preview.teams.length)));
      setAutoPreview(preview);
      setAutoConfirmKey(crypto.randomUUID());
      setAutoPreviewError("");
    },
    onError: (error) => {
      setAutoPreview(null);
      setAutoConfirmKey(null);
      setAutoPreviewError(getApiFailure(error).message);
    },
  });

  const autoConfirmMutation = useMutation({
    mutationFn: () => teamAllocationApi.confirmAutoAllocation(
      classId, sessionId!, autoPreview!, autoConfirmKey!),
    onSuccess: async (result) => {
      setAutoPreview(null);
      setAutoConfirmKey(null);
      setAutoPreviewError("");
      setReadiness(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["team-allocation", "teams", classId, sessionId] }),
        queryClient.invalidateQueries({ queryKey: ["team-allocation", "unassigned-members", classId, sessionId] }),
        queryClient.invalidateQueries({ queryKey: ["team-allocation", "class-roster", classId, sessionId] }),
      ]);
      toast.success(`Đã tạo ${result.teams.length} nhóm Draft từ bản xem trước.`);
    },
    onError: (error) => {
      const failure = getApiFailure(error);
      setAutoPreviewError(failure.status === 409
        ? "Dữ liệu lớp đã thay đổi. Hãy tạo lại bản xem trước."
        : failure.message);
      if (failure.status === 409) setAutoConfirmKey(null);
    },
  });

  const saveDraftMutation = useMutation({
    mutationFn: async (teams: LocalDraftTeam[]): Promise<DraftWarning[]> => {
      if (classId === null || sessionId === null) {
        throw new Error("Hãy mở phiên phân nhóm trước khi lưu.");
      }
      const savedDrafts = teams.filter((team) => team.savedTeamId !== undefined);
      const newDrafts = teams.filter((team) => team.savedTeamId === undefined);
      for (const team of savedDrafts) {
        await teamAllocationApi.updateDraftTeam(
          classId,
          sessionId,
          team.savedTeamId!,
          {
            teamName: team.teamName.trim(),
            assignedMentorId: team.assignedMentorId,
            members: team.memberIds.map((memberId) => ({
              memberId,
              role: team.memberRoles[memberId] ?? "DEV",
            })),
          },
        );
      }
      if (newDrafts.length === 0) return [];

      const payload: SaveDraftRequest = {
        teams: newDrafts.map((team) => ({
          teamName: team.teamName.trim(),
          assignedMentorId: team.assignedMentorId,
          members: team.memberIds.map((memberId) => ({
            memberId,
            role: team.memberRoles[memberId] ?? "DEV",
          })),
        })),
      };
      const fingerprint = JSON.stringify({ classId, sessionId, payload });
      const key = getStoredKey(saveKeyRef, fingerprint);
      const response = await teamAllocationApi.saveDraft(classId, sessionId, payload, key);
      return response.warnings ?? [];
    },
    onSuccess: async (response) => {
      setDraftTeams([]);
      setMemberPickerTeamId(null);
      setEditingSavedTeamId(null);
      setSaveFailure(null);
      setLastWarnings(response);
      saveKeyRef.current = null;
      setReadiness(null);
      setReadinessError(null);
      await queryClient.invalidateQueries({
        queryKey: ["team-allocation", "teams", classId, sessionId],
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["team-allocation", "unassigned-members", classId, sessionId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["team-allocation", "class-roster", classId, sessionId],
        }),
      ]);
      toast.success("Đã lưu thay đổi nhóm DRAFT.");
      if (response.length) {
        toast.warning(`Đã lưu kèm ${response.length} cảnh báo học viên trùng DRAFT.`);
      }
    },
    onError: (error) => {
      const failure = getApiFailure(error);
      setSaveFailure(failure);
      toast.error(failure.message);
    },
  });

  const cancelSessionMutation = useMutation({
    mutationFn: (session: AllocationSession) =>
      teamAllocationApi.cancelSession(classId, session.id),
    onSuccess: async (cancelledSession) => {
      setCancelTarget(null);
      await queryClient.invalidateQueries({
        queryKey: ["team-allocation", "sessions", classId],
      });
      toast.success(`Đã hủy phiên #${cancelledSession.sessionNumber}.`);
    },
    onError: (error) => toast.error(getApiFailure(error).message),
  });

  const maxMembers = Number(capacityInput);
  const capacityValid = Number.isSafeInteger(maxMembers) && maxMembers > 0;

  const handleCreateSession = () => {
    if (!capacityValid) {
      toast.error("Sức chứa phải là số nguyên dương.");
      return;
    }
    openSessionMutation.mutate(maxMembers);
  };

  const openSetup = (session: AllocationSession) => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    navigate(`/team-allocation/classes/${classId}/setup?sessionId=${session.id}`);
  };

  return (
    <MainLayout pathName={{ "team-allocation": "Project Team Allocation" }}>
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <div className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <UsersRound className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Team allocation
              </p>
              <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight">
                {trainingClass?.name ?? `Lớp #${classId}`}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                <span>
                  {trainingClass
                    ? `${trainingClass.code} · ${trainingClass.memberCount} học viên`
                    : "Tạo phiên phân nhóm để bắt đầu chia nhóm dự án"}
                </span>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate("/team-allocation")}
            className="w-full gap-2 transition-colors hover:border-primary/40 sm:w-auto"
          >
            <ArrowLeft className="size-4" />
            Quay lại danh sách lớp
          </Button>
        </div>

        {!canAllocate && !hasPermission("PRJ_WORKSPACE_MANAGE") && (
          <div
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
          >
            Tài khoản hiện tại không có quyền phân nhóm dự án.
          </div>
        )}

        {selectedSession && (
          <section className="space-y-2" aria-label="Tổng quan phiên phân nhóm">
            <p className="text-xs text-muted-foreground">
              Tổng quan phiên #{selectedSession.sessionNumber}
              {sessionTeamsQuery.isFetching ? " · Đang đồng bộ…" : ""}
            </p>
            <div className="grid gap-2.5 sm:grid-cols-3">
              <MetricCard
                icon={<Users className="size-5" />}
                label="Học viên chưa vào nhóm ACTIVE"
                value={unassignedMembers.length}
                tone={unassignedMembers.length > 0 ? "warning" : "success"}
                onClick={() => setSummaryDialog("unassigned")}
              />
              <MetricCard
                icon={<ClipboardList className="size-5" />}
                label="Nhóm đã lưu trong phiên"
                value={sessionTeams.length}
                tone="primary"
                onClick={() => setSummaryDialog("saved")}
              />
              <MetricCard
                icon={<CircleAlert className="size-5" />}
                label="Nhóm chờ publish"
                value={publishableTeams.length}
                tone={publishableTeams.length > 0 ? "success" : "primary"}
                onClick={() => setSummaryDialog("publishable")}
              />
            </div>
          </section>
        )}

        <Card className="border-primary/15 shadow-sm">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1.5">
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="size-5 text-primary" />
                  Phiên phân nhóm
                  <Badge variant="secondary" className="tabular-nums">
                    {sessions.length}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Tạo phiên mới hoặc chọn một phiên bên dưới, rồi bấm “Allocate Team”
                  để mở màn hình phân nhóm.
                </CardDescription>
              </div>
              {sessionsQuery.isFetching && (
                <span
                  role="status"
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <LoaderCircle className="size-3.5 animate-spin" />
                  Đang đồng bộ…
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-3 sm:flex-row sm:items-end">
              <label className="block w-full max-w-xs space-y-1.5 text-sm font-medium">
                Sức chứa tối đa / nhóm
                <Input
                  inputMode="numeric"
                  min={1}
                  type="number"
                  placeholder="VD: 5"
                  aria-label="Sức chứa tối đa mỗi nhóm"
                  value={capacityInput}
                  onChange={(event) => setCapacityInput(event.target.value)}
                  disabled={!canAllocate || openSessionMutation.isPending}
                />
              </label>
              <Button
                onClick={handleCreateSession}
                disabled={!canAllocate || openSessionMutation.isPending || !capacityValid}
                className="gap-1.5"
              >
                {openSessionMutation.isPending ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Tạo phiên phân nhóm
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Lớp và project template được xác định tự động; số phiên do hệ thống tạo.
            </p>

            <div className="space-y-3 border-t pt-4">
              {sessionsQuery.isError ? (
                <div
                  role="alert"
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm"
                >
                  <span className="text-destructive">Không tải được danh sách phiên.</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void sessionsQuery.refetch()}
                  >
                    Thử lại
                  </Button>
                </div>
              ) : sessionsQuery.isLoading ? (
                <div className="space-y-2" aria-busy="true">
                  {[0, 1].map((row) => (
                    <div
                      key={row}
                      className="h-16 animate-pulse rounded-xl border bg-muted/40"
                    />
                  ))}
                </div>
              ) : sessions.length === 0 ? (
                <div className="rounded-xl border border-dashed px-5 py-10 text-center">
                  <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
                    <CalendarDays className="size-6 text-muted-foreground" />
                  </span>
                  <p className="mt-3 font-medium">Chưa có phiên phân nhóm</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                    Nhập sức chứa tối đa mỗi nhóm ở phía trên và tạo phiên đầu tiên cho
                    lớp này.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2.5">
                  {sessions.map((item) => {
                    const isSelected = selectedSession?.id === item.id;
                    return (
                    <li
                      key={item.id}
                      onClick={() => setSelectedSessionId(item.id)}
                      className={`flex cursor-pointer flex-col gap-3 rounded-xl border p-3 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "hover:border-primary/30"
                      }`}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <CalendarDays className="size-4" />
                        </span>
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">Phiên #{item.sessionNumber}</p>
                            <Badge
                              variant="outline"
                              className={SESSION_STATUS_CLASS[item.status]}
                            >
                              {SESSION_STATUS_LABEL[item.status]}
                            </Badge>
                            {isSelected && (
                              <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                                Đang xem
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Sức chứa {item.maxMembers}/nhóm · Phiên bản {item.version}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => openSetup(item)}
                          className="gap-1.5"
                          disabled={item.status === "CANCELLED"}
                        >
                          <UsersRound className="size-4" />
                          Allocate Team
                        </Button>
                        {item.status === "OPEN" && canAllocate && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setCancelTarget(item)}
                            disabled={cancelSessionMutation.isPending}
                            className="gap-1.5 border-destructive/30 text-destructive transition-colors hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Ban className="size-4" />
                            Hủy phiên
                          </Button>
                        )}
                      </div>
                    </li>
                    );
                  })}
                </ul>
              )}
              {sessions.some((item) => item.status === "CANCELLED") && (
                <p className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                  <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  <span>
                    Phiên đã hủy chỉ được giữ lại để tra cứu lịch sử. Hãy tạo phiên mới
                    nếu cần phân nhóm lại.
                  </span>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={cancelTarget !== null}
        onOpenChange={(open) => {
          if (!open && !cancelSessionMutation.isPending) setCancelTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hủy phiên phân nhóm?</DialogTitle>
            <DialogDescription>
              Phiên #{cancelTarget?.sessionNumber} sẽ chuyển sang CANCELLED và các nhóm
              DRAFT sẽ được lưu trữ (ARCHIVED). Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelTarget(null)}
              disabled={cancelSessionMutation.isPending}
            >
              Quay lại
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (cancelTarget) cancelSessionMutation.mutate(cancelTarget);
              }}
              disabled={cancelSessionMutation.isPending}
              className="gap-1.5"
            >
              {cancelSessionMutation.isPending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Ban className="size-4" />
              )}
              Xác nhận hủy phiên
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={summaryDialog !== null}
        onOpenChange={(open) => {
          if (!open) setSummaryDialog(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {summaryDialog === "unassigned"
                ? "Học viên chưa vào nhóm ACTIVE trong phiên"
                : summaryDialog === "publishable"
                  ? "Nhóm chờ publish"
                  : "Nhóm đã lưu"}
            </DialogTitle>
            <DialogDescription>
              {summaryDialog === "unassigned"
                ? `${unassignedMembers.length} học viên`
                : summaryDialog === "publishable"
                  ? `${publishableTeams.length} nhóm`
                  : `${sessionTeams.length} nhóm`}
            </DialogDescription>
          </DialogHeader>
          {summaryDialog === "unassigned" ? (
            unassignedMembers.length === 0 ? (
              <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
                Không có học viên nào trong danh sách này.
              </p>
            ) : (
              <ul className="max-h-[55vh] divide-y overflow-y-auto rounded-lg border">
                {unassignedMembers.map((member) => (
                  <li
                    key={member.memberId}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                  >
                    <span className="min-w-0 truncate">
                      {member.fullName}
                      {member.userCode ? ` · ${member.userCode}` : ""}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      #{member.memberId}
                    </span>
                  </li>
                ))}
              </ul>
            )
          ) : (
            (() => {
              const displayedTeams =
                summaryDialog === "publishable" ? publishableTeams : sessionTeams;
              return displayedTeams.length === 0 ? (
                <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
                  Không có nhóm nào trong danh sách này.
                </p>
              ) : (
                <ul className="max-h-[55vh] divide-y overflow-y-auto rounded-lg border">
                  {displayedTeams.map((team) => (
                    <li
                      key={team.teamId}
                      className="flex items-center justify-between gap-3 px-3 py-3 text-sm"
                    >
                      <span className="min-w-0 truncate font-medium">
                        {team.teamName}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {team.memberIds.length} thành viên
                      </span>
                    </li>
                  ))}
                </ul>
              );
            })()
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={transferTarget !== null}
        onOpenChange={(open) => {
          if (!open && !transferMemberMutation.isPending) {
            setTransferTarget(null);
            setTransferDestinationId("");
            setTransferReplacementMemberId("");
            setTransferMode("move");
            setTransferReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chuyển học viên giữa các nhóm</DialogTitle>
            <DialogDescription>
              Chọn chuyển trực tiếp nếu nhóm nhận còn chỗ, hoặc đổi vị trí với một thành viên của nhóm nhận.
              Lý do sẽ được ghi vào lịch sử.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm font-medium">
            Học viên: {transferTarget?.memberName}
          </p>
          <label className="space-y-2 text-sm font-medium">
            Hình thức
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={transferMode}
              onChange={(event) => {
                setTransferMode(event.target.value as "move" | "swap");
                setTransferDestinationId("");
                setTransferReplacementMemberId("");
              }}
              disabled={transferMemberMutation.isPending}
            >
              <option value="move">Chuyển trực tiếp</option>
              <option value="swap">Đổi vị trí hai học viên</option>
            </select>
          </label>
          <label className="space-y-2 text-sm font-medium">
            Nhóm nhận
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={transferDestinationId}
              onChange={(event) => {
                setTransferDestinationId(event.target.value);
                setTransferReplacementMemberId("");
              }}
              disabled={transferMemberMutation.isPending}
            >
              <option value="">Chọn nhóm</option>
              {savedTeams
                .filter((candidate) =>
                  candidate.teamId !== transferTarget?.teamId &&
                  candidate.status === "ACTIVE" &&
                  (transferMode === "swap" ||
                    candidate.memberIds.length < (session?.maxMembers ?? 0)),
                )
                .map((candidate) => (
                  <option key={candidate.teamId} value={candidate.teamId}>
                    {candidate.teamName} ({candidate.memberIds.length} thành viên)
                  </option>
                ))}
            </select>
          </label>
          {transferMode === "swap" && transferDestinationId && (
            <label className="space-y-2 text-sm font-medium">
              Học viên đổi vị trí
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={transferReplacementMemberId}
                onChange={(event) =>
                  setTransferReplacementMemberId(event.target.value)
                }
                disabled={transferMemberMutation.isPending}
              >
                <option value="">Chọn thành viên nhóm nhận</option>
                {savedTeams
                  .find((candidate) =>
                    candidate.teamId === Number(transferDestinationId),
                  )
                  ?.members?.map((member) => (
                    <option key={member.memberId} value={member.memberId}>
                      {member.fullName}{member.userCode ? ` · ${member.userCode}` : ""} · {member.role ?? "Chưa có role"}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <label className="space-y-2 text-sm font-medium">
            Lý do chuyển nhóm (bắt buộc)
            <Textarea
              maxLength={500}
              placeholder="Nhập lý do điều chuyển"
              value={transferReason}
              onChange={(event) => setTransferReason(event.target.value)}
              disabled={transferMemberMutation.isPending}
            />
          </label>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={transferMemberMutation.isPending}
              onClick={() => setTransferTarget(null)}
            >
              Hủy
            </Button>
            <Button
              type="button"
              disabled={
                !transferTarget ||
                !transferDestinationId ||
                !transferReason.trim() ||
                (transferMode === "swap" && !transferReplacementMemberId) ||
                transferMemberMutation.isPending
              }
              onClick={() => {
                if (!transferTarget || !transferDestinationId || !transferReason.trim()) {
                  return;
                }
                const sourceTeam = savedTeams.find(
                  (team) => team.teamId === transferTarget.teamId,
                );
                const destinationTeam = savedTeams.find(
                  (team) => team.teamId === Number(transferDestinationId),
                );
                if (!sourceTeam || !destinationTeam) return;
                transferMemberMutation.mutate({
                  teamId: sourceTeam.teamId,
                  memberId: transferTarget.memberId,
                  destinationTeamId: destinationTeam.teamId,
                  replacementMemberId: transferReplacementMemberId
                    ? Number(transferReplacementMemberId)
                    : undefined,
                  mode: transferMode,
                  payload: {
                    destinationTeamId: destinationTeam.teamId,
                    sourceTeamVersion: sourceTeam.version,
                    destinationTeamVersion: destinationTeam.version,
                    reason: transferReason.trim(),
                  },
                });
              }}
            >
              {transferMemberMutation.isPending
                ? <LoaderCircle className="size-4 animate-spin" />
                : <ArrowRightLeft className="size-4" />}
              Xác nhận chuyển nhóm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={removeMemberTarget !== null}
        onOpenChange={(open) => {
          if (!open && !removeActiveMemberMutation.isPending) {
            setRemoveMemberTarget(null);
            setRemoveMemberReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gỡ học viên khỏi nhóm?</DialogTitle>
            <DialogDescription>
              Nhập lý do gỡ {removeMemberTarget?.memberName ?? "học viên"}.
              Học viên sẽ trở về danh sách chưa được xếp nhóm trong phiên này.
            </DialogDescription>
          </DialogHeader>
          <label className="space-y-2 text-sm font-medium">
            Lý do gỡ
            <Textarea
              autoFocus
              maxLength={500}
              placeholder="Nhập lý do (bắt buộc)"
              value={removeMemberReason}
              onChange={(event) => setRemoveMemberReason(event.target.value)}
              disabled={removeActiveMemberMutation.isPending}
            />
            <span className="block text-xs font-normal text-muted-foreground">
              {removeMemberReason.length}/500 ký tự
            </span>
          </label>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRemoveMemberTarget(null);
                setRemoveMemberReason("");
              }}
              disabled={removeActiveMemberMutation.isPending}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                !removeMemberTarget ||
                !removeMemberReason.trim() ||
                removeActiveMemberMutation.isPending
              }
              onClick={() => {
                if (!removeMemberTarget || !removeMemberReason.trim()) return;
                removeActiveMemberMutation.mutate({
                  teamId: removeMemberTarget.teamId,
                  memberId: removeMemberTarget.memberId,
                  reason: removeMemberReason.trim(),
                }, {
                  onSuccess: () => {
                    setRemoveMemberTarget(null);
                    setRemoveMemberReason("");
                  },
                });
              }}
            >
              {removeActiveMemberMutation.isPending
                ? <LoaderCircle className="size-4 animate-spin" />
                : <Trash2 className="size-4" />}
              Xác nhận gỡ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={activeMentorTarget !== null}
        onOpenChange={(open) => {
          if (!open && !updateActiveMentorMutation.isPending) {
            setActiveMentorTarget(null);
            setActiveMentorReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thay đổi Mentor phụ trách</DialogTitle>
            <DialogDescription>
              Cập nhật Mentor cho nhóm {activeMentorTarget?.teamName}.
              {activeMentorTarget?.active
                ? " Lý do thay đổi là bắt buộc và được lưu vào lịch sử audit."
                : " Lý do thay đổi có thể được ghi lại trong lịch sử audit."}
            </DialogDescription>
          </DialogHeader>
          <label className="space-y-2 text-sm font-medium">
            Mentor phụ trách
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={activeMentorSelection}
              onChange={(event) => setActiveMentorSelection(event.target.value)}
              disabled={updateActiveMentorMutation.isPending}
            >
              <option value="">Chưa gán Mentor</option>
              {(mentorsQuery.data ?? []).map((mentor) => (
                <option key={mentor.mentorId} value={mentor.mentorId}>
                  {mentor.fullName}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm font-medium">
            Lý do thay đổi{activeMentorTarget?.active ? " (bắt buộc)" : " (không bắt buộc)"}
            <Textarea
              maxLength={500}
              placeholder={
                activeMentorTarget?.active
                  ? "Nhập lý do thay đổi (bắt buộc)"
                  : "Nhập lý do thay đổi (không bắt buộc)"
              }
              value={activeMentorReason}
              onChange={(event) => setActiveMentorReason(event.target.value)}
              disabled={updateActiveMentorMutation.isPending}
            />
            <span className="block text-xs font-normal text-muted-foreground">
              {activeMentorReason.length}/500 ký tự
            </span>
          </label>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setActiveMentorTarget(null)}
              disabled={updateActiveMentorMutation.isPending}
            >
              Hủy
            </Button>
            <Button
              type="button"
              disabled={
                (activeMentorTarget?.active === true && !activeMentorReason.trim()) ||
                (activeMentorTarget?.active === true && !activeMentorSelection) ||
                updateActiveMentorMutation.isPending
              }
              onClick={() => {
                if (
                  !activeMentorTarget ||
                  (activeMentorTarget.active && !activeMentorReason.trim()) ||
                  (activeMentorTarget.active && !activeMentorSelection)
                ) {
                  return;
                }
                updateActiveMentorMutation.mutate({
                  teamId: activeMentorTarget.teamId,
                  mentorId: activeMentorSelection
                    ? Number(activeMentorSelection)
                    : null,
                  reason: activeMentorReason.trim() || undefined,
                });
              }}
            >
              {updateActiveMentorMutation.isPending
                ? <LoaderCircle className="size-4 animate-spin" />
                : <Save className="size-4" />}
              Lưu Mentor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {activeTab === "teams" && session && (
        <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 py-3 shadow-lg backdrop-blur-md">
          <div className="mx-auto flex max-w-[1500px] flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <ShieldCheck className="size-4 shrink-0 text-emerald-500" />
              <span>Nhóm vượt giới hạn sẽ được backend kiểm tra; form không bị xóa nếu phát sinh lỗi.</span>
            </div>
            <div className="flex items-center gap-3">
              <Button
                className="rounded-xl bg-slate-900 px-5 text-xs font-bold text-white hover:bg-slate-800"
                onClick={saveDraft}
                disabled={
                  !hasPermission("PEO_TEAM_ALLOCATE") ||
                  saveDraftMutation.isPending ||
                  draftTeams.length === 0 ||
                  session.status !== "OPEN"
                }
              >
                {saveDraftMutation.isPending
                  ? <LoaderCircle className="size-4 animate-spin" />
                  : <Save className="size-4" />}
                {editingSavedTeamId !== null ? "Lưu chỉnh sửa nhóm" : "Lưu nhóm DRAFT"}
              </Button>
              <Button
                className="rounded-xl px-4 text-xs font-bold"
                variant="outline"
                disabled={
                  savedTeams.length === 0 ||
                  publishSessionMutation.isPending ||
                  !hasPermission("PEO_TEAM_ALLOCATE") ||
                  session.status !== "OPEN" ||
                  draftTeams.length > 0
                }
                onClick={() => {
                  setPublishItemFailures([]);
                  setPublishFailure(null);
                  setPublishSuccess(null);
                  publishSessionMutation.mutate();
                }}
              >
                {publishSessionMutation.isPending
                  ? <LoaderCircle className="size-4 animate-spin" />
                  : <Send className="size-4" />}
                Công bố chính thức
              </Button>
            </div>
          </div>
        </footer>
      )}
    </div>
    </MainLayout>
  );
}

function MetricCard({
  icon,
  label,
  value,
  description,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  description: string;
  onClick: () => void;
}) {
  const isUnassigned = label.includes("chưa vào nhóm");
  const isSaved = label === "Nhóm đã lưu";
  const colorClass = isUnassigned
    ? "bg-amber-50 text-amber-600 border-amber-100"
    : isSaved
      ? "bg-blue-50 text-blue-600 border-blue-100"
      : "bg-slate-100 text-slate-600 border-slate-200";
  const badgeLabel = isUnassigned ? "Cần phân nhóm" : isSaved ? "Bản ghi" : "Sẵn sàng";

  return (
    <button
      type="button"
      className="rounded-2xl text-left transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      onClick={onClick}
      aria-label={`${label}: ${value}. Nhấn để xem chi tiết.`}
    >
      <Card className="h-full rounded-2xl border-slate-200 bg-white shadow-none transition-colors hover:border-slate-300">
        <CardContent className="flex items-center justify-between gap-4 p-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {isUnassigned ? "Chưa vào nhóm ACTIVE" : label}
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-slate-900">{value}</span>
              <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${colorClass}`}>
                {badgeLabel}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">{description}</p>
          </div>
          <div className={`flex size-12 shrink-0 items-center justify-center rounded-2xl border ${colorClass}`}>
            {icon}
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

function TeamMemberHistoryPanel({
  classId,
  cohortId,
  className,
}: {
  classId: number;
  cohortId: number | null;
  className: string;
}) {
  const [scope, setScope] = useState<"class" | "cohort">("class");
  const [memberFilter, setMemberFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [page, setPage] = useState(0);
  const memberId = Number(memberFilter);
  const teamId = Number(teamFilter);
  const filters = {
    ...(scope === "cohort" && cohortId !== null
      ? { cohortId }
      : { classId }),
    ...(Number.isSafeInteger(memberId) && memberId > 0 ? { memberId } : {}),
    ...(Number.isSafeInteger(teamId) && teamId > 0 ? { teamId } : {}),
    page,
    size: 25,
  };
  const historyQuery = useQuery({
    queryKey: ["team-member-history", filters],
    queryFn: () => teamAllocationApi.getMemberHistory(filters),
    enabled: scope !== "cohort" || cohortId !== null,
    retry: false,
  });

  const clearFilters = () => {
    setMemberFilter("");
    setTeamFilter("");
    setPage(0);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lịch sử thành viên / Vai trò</CardTitle>
        <CardDescription>
          Nhật ký chỉ được thêm mới, sắp xếp từ mới nhất đến cũ nhất.
          Phạm vi hiện tại: {scope === "cohort" ? `Cohort #${cohortId}` : className}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm font-medium">
            Phạm vi
            <select
              className="block h-10 rounded-md border border-input bg-background px-3"
              value={scope}
              onChange={(event) => {
                setScope(event.target.value as "class" | "cohort");
                setPage(0);
              }}
              disabled={cohortId === null}
            >
              <option value="class">Lớp hiện tại</option>
              <option value="cohort">Toàn cohort</option>
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium">
            Lọc theo ID học viên
            <Input
              inputMode="numeric"
              value={memberFilter}
              onChange={(event) => {
                setMemberFilter(event.target.value);
                setPage(0);
              }}
              placeholder="ID học viên"
            />
          </label>
          <label className="space-y-1 text-sm font-medium">
            Lọc theo ID nhóm
            <Input
              inputMode="numeric"
              value={teamFilter}
              onChange={(event) => {
                setTeamFilter(event.target.value);
                setPage(0);
              }}
              placeholder="ID nhóm cũ/mới"
            />
          </label>
          <Button type="button" variant="outline" onClick={clearFilters}>
            Xóa bộ lọc
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void historyQuery.refetch()}
            disabled={historyQuery.isFetching}
          >
            {historyQuery.isFetching
              ? <LoaderCircle className="size-4 animate-spin" />
              : <Search className="size-4" />}
            Làm mới
          </Button>
        </div>

        {historyQuery.isLoading ? (
          <LoadingState label="Đang tải lịch sử biến động..." />
        ) : historyQuery.isError ? (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Không thể tải lịch sử. Kiểm tra quyền truy cập hoặc thử lại.
          </div>
        ) : historyQuery.data?.items.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Chưa có lịch sử biến động phù hợp bộ lọc.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3">Thời gian</th>
                    {scope === "cohort" && <th className="px-3 py-3">Lớp</th>}
                    <th className="px-3 py-3">Học viên</th>
                    <th className="px-3 py-3">Nhóm cũ → mới</th>
                    <th className="px-3 py-3">Role cũ → mới</th>
                    <th className="px-3 py-3">Biến động</th>
                    <th className="px-3 py-3">Lý do</th>
                    <th className="px-3 py-3">Người thực hiện</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {historyQuery.data?.items.map((item) => (
                    <tr key={item.id} className="align-top">
                      <td className="whitespace-nowrap px-3 py-3">
                        {new Date(item.occurredAt).toLocaleString()}
                      </td>
                      {scope === "cohort" && (
                        <td className="px-3 py-3">#{item.classId}</td>
                      )}
                      <td className="px-3 py-3">
                        <span className="font-medium">{item.memberName}</span>
                        <span className="block text-xs text-muted-foreground">
                          #{item.memberId}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {item.fromTeamName ?? "Chưa thuộc nhóm"}
                        <span className="mx-2 text-muted-foreground">→</span>
                        {item.toTeamName ?? "Không thuộc nhóm"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        {item.fromRole ?? "—"}
                        <span className="mx-2 text-muted-foreground">→</span>
                        {item.toRole ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        {historyActionLabel(item.action)}
                      </td>
                      <td className="max-w-64 px-3 py-3">{item.reason ?? "—"}</td>
                      <td className="px-3 py-3">
                        {item.actorName}
                        <span className="block text-xs text-muted-foreground">
                          #{item.actorId}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">
                {historyQuery.data?.totalElements ?? 0} biến động · Trang{" "}
                {(historyQuery.data?.page ?? 0) + 1} /{" "}
                {Math.max(historyQuery.data?.totalPages ?? 1, 1)}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 0 || historyQuery.isFetching}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Trước
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={
                    page + 1 >= (historyQuery.data?.totalPages ?? 0) ||
                    historyQuery.isFetching
                  }
                  onClick={() => setPage((current) => current + 1)}
                >
                  Sau
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function historyActionLabel(action: string) {
  switch (action) {
    case "ROLE_CHANGED":
      return "Đổi vai trò";
    case "MEMBER_TRANSFERRED":
      return "Chuyển nhóm";
    case "MEMBER_SWAPPED":
      return "Đổi vị trí";
    case "MEMBER_ADDED":
      return "Thêm thành viên";
    case "MEMBER_REMOVED":
      return "Gỡ thành viên";
    default:
      return action;
  }
}

function MemberOption({
  member,
  checked,
  duplicateDraft,
  highlighted,
  disabled = false,
  onCheckedChange,
}: {
  member: ClassMember;
  checked: boolean;
  duplicateDraft: boolean;
  highlighted: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
        highlighted
          ? "border-destructive bg-destructive/5"
          : checked
            ? "border-primary/40 bg-primary/5"
            : "bg-background hover:bg-muted/60"
      } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        aria-label={`Chọn ${member.fullName}`}
      />
      <span className="min-w-0 flex-1 truncate font-medium">
        {member.fullName}{member.userCode ? <span className="ml-2 text-xs font-normal text-muted-foreground">{member.userCode}</span> : null}
      </span>
      <span className="text-xs text-muted-foreground">#{member.memberId}</span>
      {duplicateDraft && (
        <span className="text-xs text-amber-700 dark:text-amber-300">Đã ở nhóm DRAFT khác</span>
      )}
    </label>
  );
}

function SavedTeamCard({
  classId,
  sessionId,
  team,
  openInitially,
  memberName,
  mentors,
  memberOptions,
  allTeams,
  maxMembers,
  canManageMembers,
  canManageMentor,
  canManageRoles,
  canTransfer,
  roleSaveError,
  rolesPending,
  transferPending,
  membershipPending,
  pending,
  savePending,
  onEdit,
  onSaveAll,
  onAddMember,
  onRemoveMember,
  onTransfer,
  onUpdateMentor,
  onUpdateRoles,
  onRoleChange,
  leaderPending,
  onAssignLeader,
  canAssignTemplate,
  assignTemplatePending,
  assignTemplateError,
  onAssignTemplate,
  onClearAssignTemplateError,
  canCreateNewSession,
  onCreateNewSession,
}: {
  classId: number;
  sessionId: number;
  team: AllocationTeam;
  openInitially: boolean;
  memberName: (memberId: number) => string;
  mentors: MentorOption[];
  memberOptions: ClassRosterMember[];
  allTeams: AllocationTeam[];
  maxMembers: number;
  canManageMembers: boolean;
  canManageMentor: boolean;
  canManageRoles: boolean;
  canTransfer: boolean;
  roleSaveError?: ApiFailure;
  rolesPending: boolean;
  transferPending: boolean;
  membershipPending: boolean;
  pending: boolean;
  savePending: boolean;
  onEdit: () => void;
  onSaveAll: (payload: SaveTeamDetailsPayload) => void;
  onAddMember: (memberId: number) => void;
  onRemoveMember: (memberId: number) => void;
  onTransfer: (memberId: number) => void;
  onUpdateMentor: (mentorId: number | null) => void;
  onUpdateRoles: (
    teamId: number,
    expectedVersion: number,
    members: Array<{ memberId: number; roles: TeamMemberRole[] }>,
  ) => void;
  onRoleChange: (teamId: number, memberId: number) => void;
  leaderPending: boolean;
  onAssignLeader: (memberId: number, memberName: string) => void;
  canAssignTemplate: boolean;
  assignTemplatePending: boolean;
  assignTemplateError?: TeamTemplateApiError;
  onAssignTemplate: (projectTemplateId: number, versionId?: number) => Promise<void>;
  onClearAssignTemplateError: () => void;
  canCreateNewSession: boolean;
  onCreateNewSession: () => void;
}) {
  const [selectedToAdd, setSelectedToAdd] = useState("");
  const [selectedMentor, setSelectedMentor] = useState(
    team.assignedMentorId === null ? "" : String(team.assignedMentorId),
  );
  const [selectedTemplate, setSelectedTemplate] = useState(
    team.projectTemplateId == null ? "" : String(team.projectTemplateId),
  );
  const [selectedCandidate, setSelectedCandidate] = useState<TemplateCandidate | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(openInitially);
  const [pickerOpen, setPickerOpen] = useState(false);
  const identity = usePermissions();
  const templatesQuery = useQuery({
    queryKey: ["template-candidates", "quick-options", identity.user.email,
      identity.activeRole, classId, sessionId, team.teamId],
    queryFn: ({ signal }) => teamTemplateApi.search(classId, sessionId,
      team.teamId, { q: "", level: "", category: "", page: 0, size: 50 }, signal),
    enabled: detailsOpen && team.status === "DRAFT" && canAssignTemplate,
    retry: false,
  });
  const templates = templatesQuery.data?.content ?? [];
  const templatesLoading = templatesQuery.isLoading;
  const templatesError = templatesQuery.isError ? "Không tải được danh sách đề bài." : null;
  const allowMultiRole = team.allowMultiRole ?? false;
  const roleQuotas = team.roleQuotas ?? [];
  const [memberRoles, setMemberRoles] = useState<Record<number, TeamMemberRole[]>>(
    () => Object.fromEntries(
      (team.members ?? []).map((member) => [
        member.memberId,
        memberRolesOf(member),
      ]),
    ),
  );
  const [localRoleErrors, setLocalRoleErrors] = useState<number[]>([]);
  const isDraft = team.status === "DRAFT";
  const isActive = team.status === "ACTIVE";
  const members = team.members?.length
    ? team.members.map((member) => ({
        ...member,
        roles: memberRolesOf(member),
      }))
    : team.memberIds.map((memberId) => {
        const member = memberOptions.find((option) => option.memberId === memberId);
        return {
          memberId,
          fullName: member?.fullName ?? memberName(memberId),
          userCode: member?.userCode ?? null,
          roles: memberRoles[memberId] ?? ([`DEV`] as TeamMemberRole[]),
        };
      });
  const currentQuotaGaps = roleQuotaGaps(team, memberRoles);
  const mentorValue = team.assignedMentorId === null
    ? ""
    : String(team.assignedMentorId);
  const templateValue = team.projectTemplateId == null
    ? ""
    : String(team.projectTemplateId);
  const mentorChanged = selectedMentor !== mentorValue;
  const templateChanged =
    selectedTemplate !== "" && selectedTemplate !== templateValue;
  const memberRolesChanged = members.some((member) => {
    const savedRoles = memberRolesOf(member);
    const nextRoles = memberRoles[member.memberId] ?? savedRoles;
    return nextRoles.length !== savedRoles.length ||
      nextRoles.some((role) => !savedRoles.includes(role));
  });
  const hasPendingChanges =
    mentorChanged || templateChanged || memberRolesChanged;
  const updateMemberRoles = (
    memberId: number,
    roles: TeamMemberRole[],
  ) => {
    setMemberRoles((current) => ({
      ...current,
      [memberId]: TEAM_ROLE_OPTIONS.filter((role) => roles.includes(role)),
    }));
    setLocalRoleErrors((current) => current.filter((id) => id !== memberId));
    onRoleChange(team.teamId, memberId);
  };
  const toggleMemberRole = (memberId: number, role: TeamMemberRole) => {
    const current = memberRoles[memberId] ?? [];
    if (!allowMultiRole) {
      updateMemberRoles(memberId, current[0] === role ? [] : [role]);
      return;
    }
    updateMemberRoles(
      memberId,
      current.includes(role)
        ? current.filter((value) => value !== role)
        : [...current, role],
    );
  };
  const transferTargets = allTeams.filter((candidate) =>
    candidate.teamId !== team.teamId &&
    candidate.status === "ACTIVE",
  );
  useEffect(() => {
    setSelectedMentor(
      team.assignedMentorId === null ? "" : String(team.assignedMentorId),
    );
  }, [team.assignedMentorId]);
  useEffect(() => {
    setSelectedTemplate(
      team.projectTemplateId == null ? "" : String(team.projectTemplateId),
    );
    setSelectedCandidate(null);
  }, [team.projectTemplateId]);
  useEffect(() => {
    setMemberRoles(Object.fromEntries(
      (team.members ?? []).map((member) => [
        member.memberId,
        memberRolesOf(member),
      ]),
    ));
    setLocalRoleErrors([]);
  }, [team.version, team.members]);
  const invalidRoleMemberIds = new Set([
    ...localRoleErrors,
    ...(roleSaveError?.invalidMemberIds ?? []),
    ...(roleSaveError?.multiRoleMemberIds ?? []),
  ]);
  const mentorName = team.assignedMentorName;
  const mentorInitials = mentorName
    ?.split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return (
    <>
      <div className={team.status === "DRAFT"
        ? "grid gap-3 rounded-xl border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.65fr)]"
        : ""}>
      <button
        type="button"
        className={`flex w-full items-center justify-between gap-3 text-left transition-colors hover:bg-muted/40 ${
          team.status === "DRAFT"
            ? "rounded-lg p-2"
            : "rounded-xl border p-4"
        }`}
        aria-label={`Xem chi tiết ${team.teamName}`}
        onClick={() => setDetailsOpen(true)}
      >
        <span className="min-w-0">
          <span className="block truncate font-semibold">{team.teamName}</span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {team.memberIds.length} thành viên
          </span>
          <span
            className={`mt-1 block truncate text-xs ${
              team.projectTemplateId ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {team.projectTemplateId
              ? `Đề bài: ${team.projectTemplateName ?? `#${team.projectTemplateId}`}`
              : team.status === "DRAFT"
                ? "Chưa gán đề bài · nhấn để gán"
                : "Chưa gán đề bài"}
          </span>
          <span className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
              {mentorInitials || "?"}
            </span>
            {mentorName ?? "Chưa gán Mentor"}
          </span>
        </span>
      </button>
      {team.status === "DRAFT" && (
        <div className="min-w-0 rounded-lg border bg-muted/20 px-3 py-2">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Thành viên ({team.memberIds.length})
          </p>
          {team.memberIds.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nhóm chưa có thành viên.</p>
          ) : (
            <ul className="max-h-28 divide-y overflow-y-auto pr-1">
              {team.memberIds.map((memberId) => (
                <li key={memberId} className="py-1 text-xs">
                  {memberName(memberId)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      </div>
      <Dialog open={detailsOpen} onOpenChange={(value) => {
        setDetailsOpen(value);
        if (!value) setPickerOpen(false);
      }}>
        <DialogContent className={pickerOpen
          ? "flex max-h-[min(90vh,850px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
          : "max-h-[85vh] w-[calc(100vw-2rem)] min-w-0 overflow-x-hidden overflow-y-auto sm:max-w-xl"}>
          <div className={pickerOpen ? "hidden" : "contents"}>
          <DialogHeader>
            <DialogTitle>{team.teamName}</DialogTitle>
            <DialogDescription>
              {team.memberIds.length} thành viên · Trạng thái {team.status}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border bg-background p-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {mentorInitials || "?"}
              </span>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Mentor phụ trách</p>
                <p className="truncate text-sm font-medium">
                  {mentorName ?? "Chưa gán Mentor"}
                </p>
              </div>
            </div>
            {isActive && canManageMentor && (
              <div className="flex flex-wrap gap-2">
                <select
                  aria-label={`Chọn Mentor cho ${team.teamName}`}
                  className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
                  value={selectedMentor}
                  onChange={(event) => setSelectedMentor(event.target.value)}
                >
                  <option value="">Chọn Mentor...</option>
                  {mentors.map((mentor) => (
                    <option key={mentor.mentorId} value={mentor.mentorId}>
                      {mentor.fullName}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={
                    !selectedMentor ||
                    selectedMentor === mentorValue
                  }
                  onClick={() => onUpdateMentor(
                    selectedMentor ? Number(selectedMentor) : null,
                  )}
                >
                  Cập nhật Mentor
                </Button>
              </div>
            )}
            <div className="space-y-2 rounded-lg border bg-background p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">Đề bài dự án</p>
                <Badge variant={team.projectTemplateId ? "default" : "secondary"}>
                  {team.projectTemplateId ? "Đã gán" : "Chưa gán"}
                </Badge>
              </div>
              <p className="text-sm font-medium">
                {team.projectTemplateName ?? "Chưa gán đề bài"}
              </p>
              <p className="text-xs text-muted-foreground">
                Sĩ số hiện tại: {team.memberCount ?? team.memberIds.length} thành viên
                {team.minMembers != null && team.maxMembers != null
                  ? ` · Đề bài yêu cầu ${team.minMembers}–${team.maxMembers} thành viên`
                  : ""}
              </p>
              {assignTemplateError && (
                <div
                  role="alert"
                  className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                >
                  <p className="font-medium">
                    {assignTemplateError.errorCode === "ERR_TEAM_NOT_DRAFT"
                      ? "Nhóm không còn ở trạng thái DRAFT"
                      : assignTemplateError.reason === "MIN_MEMBERS_NOT_MET"
                        ? "Nhóm chưa đủ sĩ số tối thiểu"
                        : "Sĩ số nhóm vượt quá sức chứa của đề bài"}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {assignTemplateError.message}
                  </p>
                  {assignTemplateError.minMembers != null &&
                    assignTemplateError.maxMembers != null && (
                    <p className="mt-1 text-muted-foreground">
                      Yêu cầu {assignTemplateError.minMembers}–
                      {assignTemplateError.maxMembers} thành viên · hiện có{" "}
                      {assignTemplateError.memberCount ?? 0}.
                    </p>
                  )}
                </div>
              )}
              {isDraft && (
                <div className="flex flex-wrap gap-2">
                  <select
                    aria-label={`Chọn đề bài cho ${team.teamName}`}
                    className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
                    value={selectedTemplate}
                    disabled={!canAssignTemplate || assignTemplatePending || templatesLoading}
                    onChange={(event) => {
                      setSelectedTemplate(event.target.value);
                      setSelectedCandidate(null);
                      onClearAssignTemplateError();
                    }}
                  >
                    <option value="">
                      {templatesLoading ? "Đang tải đề bài..." : "Chọn đề bài"}
                    </option>
                    {team.projectTemplateId != null && !templates.some((option) => option.templateId === team.projectTemplateId) && (
                      <option value={team.projectTemplateId}>
                        {team.projectTemplateName ?? `#${team.projectTemplateId}`}
                      </option>
                    )}
                    {templates.map((option) => (
                      <option key={option.templateId} value={option.templateId}>
                        {option.name} ({option.minMembers}–{option.maxMembers} thành viên)
                      </option>
                    ))}
                    {selectedCandidate && !templates.some((option) => option.templateId === selectedCandidate.templateId) && (
                      <option value={selectedCandidate.templateId}>
                        {selectedCandidate.name} ({selectedCandidate.minMembers}–{selectedCandidate.maxMembers} thành viên)
                      </option>
                    )}
                  </select>
                  <Button type="button" size="sm" variant="outline"
                    disabled={!canAssignTemplate || assignTemplatePending}
                    onClick={() => setPickerOpen(true)}>
                    <Search className="size-4" /> Tìm đề bài
                  </Button>
                  <Button
                    size="sm"
                    disabled={
                      !canAssignTemplate ||
                      assignTemplatePending ||
                      !selectedTemplate ||
                      selectedTemplate ===
                        (team.projectTemplateId == null
                          ? ""
                          : String(team.projectTemplateId))
                    }
                    onClick={() => {
                      const candidate: TemplateCandidate | undefined = selectedCandidate ?? templates.find(
                        (option) => option.templateId === Number(selectedTemplate));
                      void onAssignTemplate(Number(selectedTemplate), candidate?.versionId).catch(() => {});
                    }}
                  >
                    {assignTemplatePending
                      ? <LoaderCircle className="size-4 animate-spin" />
                      : <Save className="size-4" />}
                    Gán đề bài
                  </Button>
                </div>
              )}
              {isDraft && selectedCandidate && templateChanged && (
                <p role="status" className="rounded-md bg-primary/5 px-3 py-2 text-xs text-primary">
                  Đang chọn “{selectedCandidate.name}” ({selectedCandidate.version}). Bấm Gán đề bài hoặc Lưu để xác nhận.
                </p>
              )}
              {templatesError && (
                <p className="text-xs text-destructive">{templatesError}</p>
              )}
              {!isDraft && (
                <div className="space-y-1.5 rounded-lg bg-muted/50 p-2.5">
                  <p className="text-xs text-muted-foreground">
                    Nhóm đang ở trạng thái <strong>{team.status}</strong> nên không thể đổi
                    đề bài. Đề bài chỉ được gán khi nhóm còn ở trạng thái DRAFT (trước khi
                    publish phiên).
                  </p>
                  {canCreateNewSession ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setDetailsOpen(false);
                        onCreateNewSession();
                      }}
                    >
                      <Plus className="size-4" />
                      Tạo phiên phân nhóm mới để gán đề bài
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Liên hệ Mentor/Program Manager để tạo phiên phân nhóm mới.
                    </p>
                  )}
                </div>
              )}
              {!canAssignTemplate && isDraft && (
                <p className="text-xs text-muted-foreground">
                  Bạn không có quyền gán đề bài cho nhóm này.
                </p>
              )}
            </div>
            <section className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">Danh sách thành viên ({members.length})</p>
                <span className="text-xs text-muted-foreground">Rê chuột hoặc focus để xem nhanh</span>
              </div>
              {members.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nhóm chưa có thành viên.</p>
              ) : (
                <ul className="space-y-2">
                  {members.map((member) => {
                    const leader = team.leaderMemberId === member.memberId;
                    const canAssign = isDraft && (canManageMembers || canManageRoles) && !leader;
                    return <li key={member.memberId}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div tabIndex={0} role="group" aria-label={`Học viên ${member.fullName}`}
                            className="flex min-w-0 flex-wrap items-center gap-3 rounded-lg border px-3 py-3 transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                              {member.fullName.trim().charAt(0).toUpperCase()}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium" title={member.fullName}>{member.fullName}</p>
                              <p className="truncate text-xs text-muted-foreground">{member.userCode ?? `#${member.memberId}`}</p>
                            </div>
                            {leader && <Badge className="shrink-0">Leader</Badge>}
                            {isActive && (canManageMembers || canTransfer) && <div className="flex shrink-0 gap-1">
                              {canTransfer && <Button type="button" size="icon" variant="ghost"
                                aria-label={`Chuyển ${member.fullName} sang nhóm khác`}
                                disabled={leader || transferPending || transferTargets.length === 0}
                                onClick={() => onTransfer(member.memberId)}><ArrowRightLeft className="size-4" /></Button>}
                              {canManageMembers && <Button type="button" size="icon" variant="ghost"
                                aria-label={`Gỡ ${member.fullName} khỏi nhóm`}
                                disabled={leader || membershipPending}
                                onClick={() => onRemoveMember(member.memberId)}><Trash2 className="size-4" /></Button>}
                            </div>}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" sideOffset={10}
                          className="w-72 max-w-[calc(100vw-3rem)] rounded-xl border border-border bg-popover p-4 text-left text-popover-foreground shadow-xl">
                          <div className="space-y-3">
                            <div>
                              <p className="break-words font-semibold leading-snug">{member.fullName}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {member.userCode ?? `Học viên #${member.memberId}`}
                              </p>
                            </div>
                            <p className="text-xs text-muted-foreground">{team.teamName} · Thành viên trong nhóm</p>
                            {leader ? <Badge>Leader/PM hiện tại</Badge> : canAssign ? (
                              <Button type="button" size="sm" className="w-full" disabled={leaderPending}
                                onClick={() => onAssignLeader(member.memberId, member.fullName)}>
                                <ShieldCheck className="size-4" /> Chỉ định làm Leader
                              </Button>
                            ) : null}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </li>;
                  })}
                </ul>
              )}
            </section>
            {canManageRoles && (isDraft || isActive) && (
              <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">Vai trò thành viên</p>
                  <Badge variant={allowMultiRole ? "secondary" : "outline"}>
                    {allowMultiRole ? "Cho phép kiêm nhiệm" : "Không kiêm nhiệm"}
                  </Badge>
                </div>
                {roleQuotas.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5">
                    {roleQuotas.map((quota) => (
                      <li key={quota.role}>
                        <Badge variant="outline" className="font-normal">
                          {quota.role}: {quotaWindow(quota)}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
                {roleSaveError && (
                  <p role="alert" className="text-xs text-destructive">
                    {roleSaveError.status === 409
                      ? "Dữ liệu nhóm đã thay đổi, vui lòng tải lại trang."
                      : roleSaveError.message}
                  </p>
                )}
                {currentQuotaGaps.length > 0 && (
                  <ul className="text-xs text-amber-700 dark:text-amber-300">
                    {currentQuotaGaps.map((gap) => (
                      <li key={`${gap.role}-${gap.reason}`}>
                        {gap.role}: {gap.reason === "MISSING_REQUIRED_ROLE"
                          ? `cần tối thiểu ${gap.required}, hiện có ${gap.actual}`
                          : `tối đa ${gap.required}, hiện có ${gap.actual}`}
                      </li>
                    ))}
                  </ul>
                )}
                {localRoleErrors.length > 0 && (
                  <p className="text-xs text-destructive">
                    Mỗi thành viên cần ít nhất một vai trò.
                  </p>
                )}
                <ul className="space-y-1.5">
                  {members.map((member) => {
                    const selected = memberRoles[member.memberId] ?? member.roles;
                    const invalid = invalidRoleMemberIds.has(member.memberId);
                    return (
                      <li
                        key={member.memberId}
                        className={`flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-2.5 py-2 text-sm ${
                          invalid ? "border-destructive" : ""
                        }`}
                      >
                        <span className="min-w-0 truncate">
                          {member.fullName}
                          {member.userCode ? ` · ${member.userCode}` : ""}
                        </span>
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
                                } ${rolesPending ? "cursor-not-allowed opacity-60" : ""}`}
                              >
                                <Checkbox
                                  checked={selected.includes(role)}
                                  disabled={rolesPending}
                                  onCheckedChange={() =>
                                    toggleMemberRole(member.memberId, role)}
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
                            disabled={rolesPending}
                            onChange={(event) => updateMemberRoles(
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
                {isActive && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={rolesPending || !memberRolesChanged}
                    onClick={() => {
                      const rolesPayload = members.map((member) => ({
                        memberId: member.memberId,
                        roles: memberRoles[member.memberId]
                          ?? memberRolesOf(member),
                      }));
                      const missingRoleMemberIds = rolesPayload
                        .filter((member) => member.roles.length === 0)
                        .map((member) => member.memberId);
                      const multiRoleMemberIds = allowMultiRole
                        ? []
                        : rolesPayload
                          .filter((member) => member.roles.length > 1)
                          .map((member) => member.memberId);
                      if (missingRoleMemberIds.length || multiRoleMemberIds.length) {
                        setLocalRoleErrors([
                          ...missingRoleMemberIds,
                          ...multiRoleMemberIds,
                        ]);
                        toast.error(
                          missingRoleMemberIds.length
                            ? "Mỗi thành viên cần ít nhất một vai trò."
                            : "Đề bài không cho phép kiêm nhiệm vai trò.",
                        );
                        return;
                      }
                      onUpdateRoles(team.teamId, team.version, rolesPayload);
                    }}
                  >
                    {rolesPending
                      ? <LoaderCircle className="size-4 animate-spin" />
                      : <Save className="size-4" />}
                    Lưu vai trò
                  </Button>
                )}
              </div>
            )}
            {isActive && canManageMembers && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Để thay thành viên, hãy gỡ thành viên hiện tại rồi thêm học viên khác vào nhóm.
                </p>
                <div className="flex flex-wrap gap-2">
                  <select
                    aria-label={`Chọn học viên thêm vào ${team.teamName}`}
                    className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
                    value={selectedToAdd}
                    disabled={membershipPending || team.memberIds.length >= maxMembers}
                    onChange={(event) => setSelectedToAdd(event.target.value)}
                  >
                    <option value="">Thêm học viên chưa vào nhóm ACTIVE...</option>
                    {memberOptions
                      .filter((option) => !option.assignedToActiveTeam)
                      .map((option) => (
                        <option key={option.memberId} value={option.memberId}>
                          {option.fullName}{option.userCode ? ` · ${option.userCode}` : ""}
                        </option>
                      ))}
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      membershipPending ||
                      team.memberIds.length >= maxMembers ||
                      !selectedToAdd
                    }
                    onClick={() => {
                      onAddMember(Number(selectedToAdd));
                      setSelectedToAdd("");
                    }}
                  >
                    {membershipPending
                      ? <LoaderCircle className="size-4 animate-spin" />
                      : <Plus className="size-4" />}
                    Thêm
                  </Button>
                </div>
                {team.memberIds.length >= maxMembers && (
                  <p className="text-xs text-muted-foreground">
                    Nhóm đã đạt sức chứa tối đa ({maxMembers}).
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            {isDraft && (
              <>
                <Button
                  variant="outline"
                  disabled={pending || savePending}
                  onClick={() => {
                    setDetailsOpen(false);
                    onEdit();
                  }}
                >
                  Chỉnh sửa DRAFT
                </Button>
                <Button
                  disabled={
                    pending ||
                    savePending ||
                    !hasPendingChanges
                  }
                  onClick={() => {
                    const rolesPayload = members.map((member) => ({
                      memberId: member.memberId,
                      roles: memberRoles[member.memberId]
                        ?? memberRolesOf(member),
                    }));
                    if (memberRolesChanged) {
                      const missingRoleMemberIds = rolesPayload
                        .filter((member) => member.roles.length === 0)
                        .map((member) => member.memberId);
                      const multiRoleMemberIds = allowMultiRole
                        ? []
                        : rolesPayload
                          .filter((member) => member.roles.length > 1)
                          .map((member) => member.memberId);
                      if (missingRoleMemberIds.length || multiRoleMemberIds.length) {
                        setLocalRoleErrors([
                          ...missingRoleMemberIds,
                          ...multiRoleMemberIds,
                        ]);
                        toast.error(
                          missingRoleMemberIds.length
                            ? "Mỗi thành viên cần ít nhất một vai trò."
                            : "Đề bài không cho phép kiêm nhiệm vai trò.",
                        );
                        return;
                      }
                    }
                    onSaveAll({
                      teamId: team.teamId,
                      teamVersion: team.version,
                      mentorId: selectedMentor ? Number(selectedMentor) : null,
                      mentorChanged,
                      projectTemplateId: selectedTemplate
                        ? Number(selectedTemplate)
                        : null,
                      projectTemplateVersionId: selectedCandidate?.versionId,
                      templateChanged,
                      rolesChanged: memberRolesChanged,
                      roles: rolesPayload,
                    });
                  }}
                >
                  {savePending
                    ? <LoaderCircle className="size-4 animate-spin" />
                    : <Save className="size-4" />}
                  Lưu
                </Button>
              </>
            )}
          </DialogFooter>
          </div>
          <TemplatePickerPanel classId={classId} sessionId={sessionId}
            teamId={team.teamId} teamName={team.teamName}
            memberCount={team.memberIds.length} active={pickerOpen}
            selectedTemplateId={selectedTemplate ? Number(selectedTemplate) : null}
            onBack={() => setPickerOpen(false)}
            onSelect={(candidate) => {
              setSelectedTemplate(String(candidate.templateId));
              setSelectedCandidate(candidate);
              onClearAssignTemplateError();
              setPickerOpen(false);
            }} />
        </DialogContent>
      </Dialog>
    </>
  );
}

/** US-12: renders the strict-mode readiness report returned by the backend. */
function ReadinessReport({ report }: { report: AllocationReadiness }) {
  if (report.readyToPublish) {
    return (
      <div
        role="status"
        className="space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4"
      >
        <p className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-300">
          <ShieldCheck className="size-5" />
          Đủ điều kiện công bố (Ready to Publish)
        </p>
        <p className="text-sm text-muted-foreground">
          {report.assignedStudents}/{report.totalStudents} học viên đã có nhóm ·{" "}
          {report.totalTeams} nhóm · {report.teamsWithTemplate}/{report.totalTeams} nhóm
          có đề bài hợp lệ · không còn học viên tự do.
        </p>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="space-y-3 rounded-xl border-2 border-destructive bg-destructive/5 p-4"
    >
      <p className="flex items-center gap-2 font-semibold text-destructive">
        <CircleAlert className="size-5" />
        Chưa đủ điều kiện công bố
      </p>
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="outline" className="border-destructive text-destructive">
          {report.unassignedStudentCount} học viên tự do
        </Badge>
        <Badge variant="outline" className="border-destructive text-destructive">
          {report.teamIssues.length} lỗi nhóm
        </Badge>
        <Badge variant="outline" className="border-destructive text-destructive">
          {report.teamsWithTemplate}/{report.totalTeams} nhóm có đề bài
        </Badge>
      </div>
      {report.unassignedStudents.length > 0 && (
        <div className="rounded-lg border-2 border-destructive bg-background p-3">
          <p className="text-sm font-semibold text-destructive">
            Danh sách học viên chưa có nhóm ({report.unassignedStudentCount})
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {report.unassignedStudents.map((student) => (
              <Badge
                key={student.memberId}
                variant="outline"
                className="border-destructive bg-destructive/10 text-destructive"
              >
                {student.fullName}{student.userCode ? ` · ${student.userCode}` : ` (#${student.memberId})`}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {report.teamIssues.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-background p-3">
          <p className="text-sm font-semibold text-destructive">Lỗi theo nhóm</p>
          <ul className="mt-2 space-y-2 text-xs">
            {report.teamIssues.map((issue, index) => (
              <li key={`${issue.teamId}-${issue.code}-${index}`}>
                <span className="font-medium">
                  {issue.teamName} (#{issue.teamId})
                </span>{" "}
                — {issue.message}
                {issue.violations?.length ? (
                  <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                    {issue.violations.map((violation) => (
                      <li key={`${violation.role}-${violation.reason}`}>
                        {violation.role}:{" "}
                        {violation.reason === "MISSING_REQUIRED_ROLE"
                          ? `cần tối thiểu ${violation.required}, hiện có ${violation.actual}`
                          : `tối đa ${violation.required}, hiện có ${violation.actual}`}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {issue.memberIds?.length ? (
                  <span className="text-muted-foreground">
                    {" "}· Thành viên: {issue.memberIds.map((id) => `#${id}`).join(", ")}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function WarningList({ warnings }: { warnings: DraftWarning[] }) {
  return (
    <div role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
        <AlertCircle className="size-4" />
        Cảnh báo học viên trùng trong các nhóm DRAFT
      </p>
      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
        {warnings.map((warning, index) => (
          <li key={`${warning.memberId}-${index}`}>{warning.message}</li>
        ))}
      </ul>
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
      <LoaderCircle className="size-4 animate-spin" />
      {label}
    </div>
  );
}
