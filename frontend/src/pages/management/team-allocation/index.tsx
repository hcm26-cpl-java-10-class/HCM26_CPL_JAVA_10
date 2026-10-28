import { projectTemplateApi, teamAllocationApi } from "@/api";
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
import { usePermissions } from "@/hooks/usePermissions";
import type { TrainingClassDTO } from "@/types/features/training-class";
import type {
  AllocationApiError,
  AllocationReadiness,
  AllocationSession,
  AllocationTeam,
  ClassMember,
  ClassRosterMember,
  DraftWarning,
  MentorOption,
  ProjectTemplateOption,
  PublishTeamsResponse,
  SaveDraftRequest,
  TeamMemberRole,
  TeamReadinessIssue,
  TeamRoleQuota,
  TeamRoleQuotaViolation,
  TeamTemplateApiError,
  TransferTeamMemberRequest,
} from "@/types/features/team-allocation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  AlertCircle,
  CircleAlert,
  ClipboardList,
  ArrowRightLeft,
  ListChecks,
  LoaderCircle,
  Plus,
  Ban,
  Save,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject, ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

interface LocalDraftTeam {
  localId: string;
  savedTeamId?: number;
  teamName: string;
  assignedMentorId: number | null;
  memberIds: number[];
  memberRoles: Record<number, string | null>;
}

/** Everything the saved-team dialog can change in one save (no publish). */
interface SaveTeamDetailsPayload {
  teamId: number;
  teamVersion: number;
  mentorId: number | null;
  mentorChanged: boolean;
  projectTemplateId: number | null;
  templateChanged: boolean;
  rolesChanged: boolean;
  roles: Array<{ memberId: number; roles: TeamMemberRole[] }>;
}

interface ApiFailure {
  status: number;
  code: string;
  message: string;
  memberId: number | null;
  unassignedCount?: number;
  unassignedMemberIds?: number[];
  /** US-12: free students with names for the red highlight banner. */
  unassignedMembers?: AllocationReadiness["unassignedStudents"];
  /** US-12: team-level publish blockers. */
  teamIssues?: TeamReadinessIssue[];
  blockers?: string[];
  invalidMemberIds?: number[];
  violations?: TeamRoleQuotaViolation[];
  multiRoleMemberIds?: number[];
}

const SESSION_STORAGE_KEY = "team-allocation-session";

function getSavedSession(): AllocationSession | null {
  try {
    const serialized = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!serialized) return null;

    const parsed: unknown = JSON.parse(serialized);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "id" in parsed &&
      "classId" in parsed &&
      "maxMembers" in parsed &&
      typeof parsed.id === "number" &&
      typeof parsed.classId === "number" &&
      typeof parsed.maxMembers === "number"
    ) {
      return parsed as AllocationSession;
    }
  } catch {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }
  return null;
}

function getApiFailure(error: unknown): ApiFailure {
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
    code: "ERR_REQUEST_FAILED",
    message: error instanceof Error
      ? error.message
      : "Không thể hoàn tất yêu cầu. Vui lòng thử lại.",
    memberId: null,
    invalidMemberIds: undefined,
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
  const selectedClass = (location.state as { trainingClass?: TrainingClassDTO } | null)
    ?.trainingClass;
  const queryClient = useQueryClient();
  const initialSession = useMemo(() => {
    const saved = getSavedSession();
    return saved?.classId === classId ? saved : null;
  }, [classId]);
  const [capacityInput, setCapacityInput] = useState(initialSession?.maxMembers.toString() ?? "");
  const [session, setSession] = useState<AllocationSession | null>(initialSession);
  const [createAnotherSession, setCreateAnotherSession] = useState(false);
  const [newSessionCapacity, setNewSessionCapacity] = useState("");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
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

  const sessionId = session?.id ?? null;
  const sessionsQuery = useQuery({
    queryKey: ["team-allocation", "sessions", classId],
    queryFn: () => teamAllocationApi.getSessions(classId),
    enabled: Number.isSafeInteger(classId) && classId > 0,
  });
  const membersQuery = useQuery({
    queryKey: ["team-allocation", "unassigned-members", classId, sessionId],
    queryFn: () => teamAllocationApi.getUnassignedMembers(classId, sessionId!),
    enabled:
      Number.isSafeInteger(classId) &&
      classId > 0 &&
      sessionId !== null &&
      hasPermission("PEO_TEAM_ALLOCATE"),
  });
  const rosterQuery = useQuery({
    queryKey: ["team-allocation", "class-roster", classId, sessionId],
    queryFn: () => teamAllocationApi.getClassRoster(classId, sessionId),
    enabled: Number.isSafeInteger(classId) && classId > 0,
  });

  const teamsQuery = useQuery({
    queryKey: ["team-allocation", "teams", classId, sessionId],
    queryFn: () => teamAllocationApi.getTeams(classId!, sessionId!),
    enabled: classId !== null && sessionId !== null,
    retry: false,
  });
  const mentorsQuery = useQuery({
    queryKey: ["team-allocation", "mentors", classId],
    queryFn: () => teamAllocationApi.getClassMentors(classId),
    enabled: Number.isSafeInteger(classId) && classId > 0,
  });
  // US-10: assignable project templates (min/max capacity window).
  const templatesQuery = useQuery({
    queryKey: ["project-templates", "options"],
    queryFn: () => projectTemplateApi.getAssignableOptions(),
  });

  useEffect(() => {
    if (!sessionsQuery.data) return;
    const matchingSession = (session
      ? sessionsQuery.data.find((item) => item.id === session.id)
      : undefined) ?? sessionsQuery.data[0];
    if (!matchingSession) {
      if (session) {
        setSession(null);
        setCapacityInput("");
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
      return;
    }
    if (
      session?.status === matchingSession.status &&
      session.maxMembers === matchingSession.maxMembers &&
      session.version === matchingSession.version
    ) {
      return;
    }
    setSession(matchingSession);
    setCapacityInput(String(matchingSession.maxMembers));
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(matchingSession));
  }, [sessionsQuery.data, session]);

  const openSessionMutation = useMutation({
    mutationFn: () => {
      const maxMembers = Number(session ? newSessionCapacity : capacityInput);
      if (!Number.isSafeInteger(maxMembers) || maxMembers <= 0) {
        throw new Error("Sức chứa phải là số nguyên dương.");
      }
      return teamAllocationApi.openSession(classId, { maxMembers });
    },
    onSuccess: (openedSession) => {
      // Put the new session at the top of the cached list before it is
      // re-fetched: the session-sync effect below falls back to
      // `sessions[0]` when the selected id is not in the list yet, which used
      // to bounce the page back to a previous (e.g. PUBLISHED) session.
      queryClient.setQueryData<AllocationSession[]>(
        ["team-allocation", "sessions", classId],
        (current) => current
          ? [openedSession, ...current.filter((item) => item.id !== openedSession.id)]
          : [openedSession],
      );
      setSession(openedSession);
      setCapacityInput(String(openedSession.maxMembers));
      setDraftTeams([]);
      setEditingSavedTeamId(null);
      setCreateAnotherSession(false);
      setSaveFailure(null);
      setPublishFailure(null);
      setPublishItemFailures([]);
      setLastWarnings([]);
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(openedSession));
      void queryClient.invalidateQueries({
        queryKey: ["team-allocation", "sessions", classId],
      });
      toast.success(`Đã mở phiên phân nhóm #${openedSession.id}.`);
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
    mutationFn: () => {
      if (classId === null || sessionId === null) {
        throw new Error("Không có phiên phân nhóm đang mở.");
      }
      return teamAllocationApi.cancelSession(classId, sessionId);
    },
    onSuccess: async (cancelledSession) => {
      setSession(cancelledSession);
      setCapacityInput(String(cancelledSession.maxMembers));
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(cancelledSession));
      setDraftTeams([]);
      setMemberPickerTeamId(null);
      setCancelDialogOpen(false);
      setSaveFailure(null);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["team-allocation", "sessions", classId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["team-allocation", "teams", classId, sessionId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["team-allocation", "unassigned-members", classId, sessionId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["team-allocation", "class-roster", classId, sessionId],
        }),
      ]);
      toast.success("Đã hủy phiên. Các nhóm DRAFT đã được lưu trữ.");
    },
    onError: (error) => toast.error(getApiFailure(error).message),
  });

  // US-12: strict-mode pre-check (read-only, returns free students + team issues).
  const readinessMutation = useMutation({
    mutationFn: () => {
      if (sessionId === null) {
        throw new Error("Không có phiên phân nhóm đang mở.");
      }
      return teamAllocationApi.getReadiness(classId, sessionId);
    },
    onSuccess: (report) => {
      setReadiness(report);
      setReadinessError(null);
      setPublishFailure(null);
      if (report.readyToPublish) {
        toast.success("Lớp đủ điều kiện công bố (Ready to Publish).");
      } else {
        toast.warning(
          `Lớp chưa đủ điều kiện công bố: ${report.unassignedStudentCount} học viên tự do, `
            + `${report.teamIssues.length} lỗi nhóm.`,
        );
      }
    },
    onError: (error) => {
      const failure = getApiFailure(error);
      setReadiness(null);
      setReadinessError(failure);
      toast.error(failure.message);
    },
  });

  // US-12: authoritative strict publish of the whole session. The backend
  // returns 422 ERR_UNASSIGNED_MEMBERS / ERR_TEAMS_NOT_READY with the offending
  // students and teams.
  const publishSessionMutation = useMutation({
    mutationFn: () => {
      if (sessionId === null) {
        throw new Error("Không có phiên phân nhóm đang mở.");
      }
      return teamAllocationApi.publishSession(
        classId,
        sessionId,
        makeIdempotencyKey(),
      );
    },
    onSuccess: async (response) => {
      const succeededItems = response?.succeededItems ?? [];
      const failedItems = response?.failedItems ?? [];
      setPublishItemFailures(failedItems);
      setPublishFailure(null);
      setReadinessError(null);
      if (succeededItems.length > 0) {
        const successMessage = `Đã công bố chính thức ${succeededItems.length} nhóm.`;
        setPublishSuccess(successMessage);
        toast.success(successMessage);
      } else {
        setPublishSuccess(null);
      }
      if (failedItems.length > 0) {
        setPublishSuccess(null);
        toast.warning(
          `${failedItems.length} nhóm chưa thể công bố. Xem toàn bộ lý do bên dưới.`,
        );
      }
      if (failedItems.length === 0 && succeededItems.length > 0) {
        setReadiness(null);
        setSession((current) => {
          if (!current) return current;
          const publishedSession = { ...current, status: "PUBLISHED" as const };
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(publishedSession));
          return publishedSession;
        });
      } else {
        // Re-run the strict check so the banner reflects the current state.
        readinessMutation.mutate();
      }
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["team-allocation", "teams", classId, sessionId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["team-allocation", "sessions", classId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["team-allocation", "unassigned-members", classId, sessionId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["team-allocation", "class-roster", classId, sessionId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["workspace-candidates"],
        }),
      ]);
    },
    onError: (error) => {
      const failure = getApiFailure(error);
      setPublishSuccess(null);
      setPublishFailure(failure);
      toast.error(failure.message);
      if (failure.status === 422) {
        readinessMutation.mutate();
      }
    },
  });

  const invalidateMembershipQueries = async () => {
    setReadiness(null);
    setReadinessError(null);
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["team-allocation", "teams", classId, sessionId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["team-allocation", "unassigned-members", classId, sessionId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["team-allocation", "class-roster", classId, sessionId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["team-member-history"],
      }),
    ]);
  };

  const addActiveMemberMutation = useMutation({
    mutationFn: ({ teamId, memberId }: { teamId: number; memberId: number }) => {
      if (sessionId === null) throw new Error("Không có phiên phân nhóm.");
      return teamAllocationApi.addActiveTeamMember(
        classId, sessionId, teamId, memberId,
      );
    },
    onSuccess: async () => {
      await invalidateMembershipQueries();
      toast.success("Đã thêm học viên vào nhóm ACTIVE.");
    },
    onError: (error) => toast.error(getApiFailure(error).message),
  });

  const removeActiveMemberMutation = useMutation({
    mutationFn: ({
      teamId,
      memberId,
      reason,
    }: { teamId: number; memberId: number; reason: string }) => {
      if (sessionId === null) throw new Error("Không có phiên phân nhóm.");
      return teamAllocationApi.removeActiveTeamMember(
        classId, sessionId, teamId, memberId, reason,
      );
    },
    onSuccess: async () => {
      await invalidateMembershipQueries();
      toast.success("Đã gỡ học viên khỏi nhóm ACTIVE.");
    },
    onError: (error) => toast.error(getApiFailure(error).message),
  });

  const updateActiveMentorMutation = useMutation({
    mutationFn: ({
      teamId,
      mentorId,
      reason,
    }: { teamId: number; mentorId: number | null; reason?: string }) => {
      if (sessionId === null) throw new Error("Không có phiên phân nhóm.");
      return teamAllocationApi.updateTeamMentor(
        classId, sessionId, teamId, mentorId, reason,
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["team-allocation", "teams", classId, sessionId],
      });
      setActiveMentorTarget(null);
      setActiveMentorReason("");
      toast.success("Đã cập nhật Mentor phụ trách nhóm.");
    },
    onError: (error) => toast.error(getApiFailure(error).message),
  });

  const updateTeamRolesMutation = useMutation({
    mutationFn: ({
      teamId,
      expectedVersion,
      members,
    }: {
      teamId: number;
      expectedVersion: number;
      members: Array<{ memberId: number; roles: TeamMemberRole[] }>;
    }) => {
      if (sessionId === null) throw new Error("Không có phiên phân nhóm.");
      return teamAllocationApi.updateTeamRoles(
        classId,
        sessionId,
        teamId,
        {
          expectedVersion,
          members: members.map((member) => ({
            memberId: member.memberId,
            roles: member.roles,
            role: member.roles[0] ?? null,
          })),
        },
      );
    },
    onSuccess: async (_, variables) => {
      setRoleAssignmentFailures((current) => {
        const next = { ...current };
        delete next[variables.teamId];
        return next;
      });
      setReadiness(null);
      setReadinessError(null);
      await queryClient.invalidateQueries({
        queryKey: ["team-allocation", "teams", classId, sessionId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["team-member-history"],
      });
      toast.success("Đã lưu vai trò thành viên trong nhóm.");
    },
    onError: (error, variables) => {
      const failure = getApiFailure(error);
      const invalidMemberIds = failure.status === 422
        ? failure.invalidMemberIds?.length
          ? failure.invalidMemberIds
          : failure.multiRoleMemberIds ?? []
        : [];
      setRoleAssignmentFailures((current) => ({
        ...current,
        [variables.teamId]: { ...failure, invalidMemberIds },
      }));
      toast.error(
        failure.status === 409
          ? "Dữ liệu/Version nhóm đã bị thay đổi, vui lòng tải lại trang"
          : failure.message,
      );
    },
  });

  // Save every editable field of one saved team (template, roles, mentor)
  // without publishing it. The template is assigned first so the returned
  // optimistic-lock version can be reused by the role update.
  const saveTeamDetailsMutation = useMutation({
    mutationFn: async (payload: SaveTeamDetailsPayload) => {
      if (classId === null || sessionId === null) {
        throw new Error("Không có phiên phân nhóm.");
      }
      let expectedVersion = payload.teamVersion;
      if (payload.templateChanged && payload.projectTemplateId !== null) {
        const assigned = await teamAllocationApi.assignProjectTemplate(
          classId,
          sessionId,
          payload.teamId,
          payload.projectTemplateId,
        );
        expectedVersion = assigned.version;
      }
      if (payload.rolesChanged) {
        await teamAllocationApi.updateTeamRoles(
          classId,
          sessionId,
          payload.teamId,
          {
            expectedVersion,
            members: payload.roles.map((member) => ({
              memberId: member.memberId,
              roles: member.roles,
              role: member.roles[0] ?? null,
            })),
          },
        );
      }
      if (payload.mentorChanged) {
        await teamAllocationApi.updateTeamMentor(
          classId,
          sessionId,
          payload.teamId,
          payload.mentorId,
        );
      }
    },
    onSuccess: async (_, payload) => {
      setRoleAssignmentFailures((current) => {
        const next = { ...current };
        delete next[payload.teamId];
        return next;
      });
      setTemplateAssignErrors((current) => {
        const next = { ...current };
        delete next[payload.teamId];
        return next;
      });
      setReadiness(null);
      setReadinessError(null);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["team-allocation", "teams", classId, sessionId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["team-member-history"],
        }),
      ]);
      toast.success("Đã lưu thông tin nhóm (chưa công bố).");
    },
    onError: (error, payload) => {
      const failure = getApiFailure(error);
      if (
        failure.code === "ERR_TEAM_CAPACITY_EXCEEDED" ||
        failure.code === "ERR_TEAM_NOT_DRAFT"
      ) {
        const templateFailure = getTemplateFailure(error);
        setTemplateAssignErrors((current) => ({
          ...current,
          [payload.teamId]: templateFailure,
        }));
        toast.error(templateFailure.message ?? "Không thể gán đề bài.");
        return;
      }
      const invalidMemberIds = failure.status === 422
        ? failure.invalidMemberIds?.length
          ? failure.invalidMemberIds
          : failure.multiRoleMemberIds ?? []
        : [];
      setRoleAssignmentFailures((current) => ({
        ...current,
        [payload.teamId]: { ...failure, invalidMemberIds },
      }));
      toast.error(
        failure.status === 409
          ? "Dữ liệu/Version nhóm đã bị thay đổi, vui lòng tải lại trang"
          : failure.message,
      );
    },
  });

  // US-10: assign the selected project template to a DRAFT team.
  const assignTemplateMutation = useMutation({
    mutationFn: ({
      teamId,
      projectTemplateId,
    }: {
      teamId: number;
      projectTemplateId: number;
    }) => {
      if (classId === null || sessionId === null) {
        throw new Error("Không có phiên phân nhóm.");
      }
      return teamAllocationApi.assignProjectTemplate(
        classId,
        sessionId,
        teamId,
        projectTemplateId,
      );
    },
    onSuccess: async (updated) => {
      setTemplateAssignErrors((current) => {
        const next = { ...current };
        delete next[updated.teamId];
        return next;
      });
      setReadiness(null);
      setReadinessError(null);
      await queryClient.invalidateQueries({
        queryKey: ["team-allocation", "teams", classId, sessionId],
      });
      toast.success(
        `Đã gán đề bài “${updated.projectTemplateName ?? "đề bài"}” cho nhóm ${updated.teamName}.`,
      );
    },
    onError: (error, variables) => {
      const failure = getTemplateFailure(error);
      setTemplateAssignErrors((current) => ({
        ...current,
        [variables.teamId]: failure,
      }));
      toast.error(failure.message ?? "Không thể gán đề bài.");
    },
  });

  const clearTemplateAssignError = (teamId: number) => {
    setTemplateAssignErrors((current) => {
      const next = { ...current };
      delete next[teamId];
      return next;
    });
  };

  const transferMemberMutation = useMutation({
    mutationFn: ({
      teamId,
      memberId,
      destinationTeamId,
      replacementMemberId,
      mode,
      payload,
    }: {
      teamId: number;
      memberId: number;
      destinationTeamId: number;
      replacementMemberId?: number;
      mode: "move" | "swap";
      payload: TransferTeamMemberRequest;
    }) => {
      if (sessionId === null) throw new Error("Không có phiên phân nhóm.");
      if (mode === "swap" && replacementMemberId !== undefined) {
        return teamAllocationApi.swapActiveTeamMember(
          classId,
          sessionId,
          teamId,
          memberId,
          {
            replacementMemberId,
            replacementTeamId: destinationTeamId,
            reason: payload.reason,
          },
        );
      }
      return teamAllocationApi.transferActiveTeamMember(
        classId, sessionId, teamId, memberId, payload,
      );
    },
    onSuccess: async () => {
      await invalidateMembershipQueries();
      setTransferTarget(null);
      setTransferDestinationId("");
      setTransferReplacementMemberId("");
      setTransferMode("move");
      setTransferReason("");
      toast.success("Đã chuyển học viên sang nhóm mới.");
    },
    onError: (error) => toast.error(getApiFailure(error).message),
  });

  const members = hasPermission("PEO_TEAM_ALLOCATE")
    ? membersQuery.data ?? []
    : [];
  const savedTeams = teamsQuery.data?.teams ?? [];
  const memberPickerTeam = draftTeams.find(
    (team) => team.localId === memberPickerTeamId,
  );
  const draftMemberIds = new Set(draftTeams.flatMap((team) => team.memberIds));
  const memberById = new Map(
    [...members, ...(rosterQuery.data ?? [])].map((member) => [member.memberId, member]),
  );
  const memberOptions: ClassMember[] = memberPickerTeam?.savedTeamId !== undefined
    ? (rosterQuery.data ?? [])
    : members;
  const filteredMembers = memberOptions.filter((member) =>
    member.fullName.toLowerCase().includes(memberSearch.trim().toLowerCase()) ||
    String(member.memberId).includes(memberSearch.trim()),
  );
  const publishableTeams = savedTeams.filter((team) => team.status === "DRAFT");
  const teamsMissingRoles = publishableTeams.filter(
    (team) => !hasCompleteTeamRoles(team),
  );
  const canCancelSession =
    session?.status === "OPEN" &&
    !teamsQuery.isLoading &&
    !teamsQuery.isError &&
    savedTeams.every((team) => team.status === "DRAFT");
  const addDraftTeam = () => {
    if (editingSavedTeamId !== null) {
      toast.error("Hãy lưu hoặc hủy chỉnh sửa nhóm trước khi thêm nhóm mới.");
      return;
    }
    const localId = crypto.randomUUID();
    setDraftTeams((current) => [
      ...current,
      {
        localId,
        teamName: `Nhóm ${current.length + 1}`,
        assignedMentorId: null,
        memberIds: [],
        memberRoles: {},
      },
    ]);
    setMemberPickerTeamId(localId);
    setMemberSearch("");
    setSaveFailure(null);
  };

  const toggleMember = (teamId: string, memberId: number, checked: boolean) => {
    setDraftTeams((current) => current.map((team) => {
      if (team.localId !== teamId) return team;
      return {
        ...team,
        memberIds: checked
          ? [...team.memberIds, memberId]
          : team.memberIds.filter((id) => id !== memberId),
        memberRoles: checked
          ? { ...team.memberRoles, [memberId]: "DEV" }
          : Object.fromEntries(
              Object.entries(team.memberRoles)
                .filter(([id]) => Number(id) !== memberId),
            ),
      };
    }));
    setSaveFailure(null);
  };

  const saveDraft = () => {
    const newTeams = draftTeams.filter((team) => team.savedTeamId === undefined);
    if (!draftTeams.length) {
      toast.error("Hãy thêm ít nhất một nhóm trước khi lưu.");
      return;
    }
    if (draftTeams.some((team) => !team.teamName.trim())) {
      toast.error("Tên nhóm không được để trống.");
      return;
    }
    if (newTeams.some((team) => team.memberIds.length === 0)) {
      toast.error("Mỗi nhóm mới cần có ít nhất một học viên.");
      return;
    }
    saveDraftMutation.mutate(draftTeams);
  };

  const editSavedTeam = (team: AllocationTeam) => {
    if (draftTeams.length > 0) {
      toast.error("Hãy lưu hoặc hủy thay đổi hiện tại trước khi chỉnh sửa nhóm đã lưu.");
      return;
    }
    const localId = `saved-${team.teamId}`;
    setDraftTeams([{
      localId,
      savedTeamId: team.teamId,
      teamName: team.teamName,
      assignedMentorId: team.assignedMentorId,
      memberIds: [...team.memberIds],
      memberRoles: Object.fromEntries(
        (team.members ?? []).map((member) => [member.memberId, member.role ?? "DEV"]),
      ),
    }]);
    setEditingSavedTeamId(team.teamId);
    setMemberPickerTeamId(localId);
    setMemberSearch("");
    setSaveFailure(null);
  };

  const cancelDraftEditing = () => {
    setDraftTeams([]);
    setEditingSavedTeamId(null);
    setMemberPickerTeamId(null);
    setSaveFailure(null);
  };

  const clearTeamRoleFailure = (teamId: number, memberId: number) => {
    setRoleAssignmentFailures((current) => {
      const next = { ...current };
      const failure = next[teamId];
      if (!failure || failure.status === 409) return current;
      const remaining = (failure.invalidMemberIds ?? [])
        .filter((id) => id !== memberId);
      if (remaining.length) {
        next[teamId] = { ...failure, invalidMemberIds: remaining };
      } else {
        delete next[teamId];
      }
      return next;
    });
  };

  const nameForMember = (memberId: number) =>
    memberById.get(memberId)?.fullName ?? `Học viên #${memberId}`;

  return (
    <MainLayout pathName={{ "team-allocation": "Phân nhóm dự án" }}>
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-900 px-6 py-8 text-white sm:px-9 sm:py-10">
          <div className="pointer-events-none absolute -right-12 -top-24 size-72 rounded-full bg-blue-400/20 blur-3xl" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <Badge className="mb-4 border border-white/20 bg-white/10 text-blue-100 hover:bg-white/10">
                ĐIỀU PHỐI LỚP HỌC
              </Badge>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Phân nhóm dự án thủ công
              </h1>
              <p className="mt-3 text-sm leading-6 text-blue-100/80 sm:text-base">
                Chọn học viên, lưu nhóm ở trạng thái nháp và publish khi đã sẵn sàng.
                Lựa chọn trên form được giữ lại nếu lưu gặp lỗi.
              </p>
            </div>
            <div className="hidden size-24 shrink-0 items-center justify-center rounded-3xl border border-white/15 bg-white/10 sm:flex">
              <UsersRound className="size-12 text-blue-100" />
            </div>
          </div>
        </section>

        <div role="tablist" aria-label="Quản lý nhóm" className="flex gap-2 border-b">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "teams"}
            className={`border-b-2 px-4 py-2 text-sm font-medium ${
              activeTab === "teams"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground"
            }`}
            onClick={() => setActiveTab("teams")}
          >
            Nhóm và thành viên
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "history"}
            className={`border-b-2 px-4 py-2 text-sm font-medium ${
              activeTab === "history"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground"
            }`}
            onClick={() => setActiveTab("history")}
          >
            Lịch sử thành viên / Vai trò
          </button>
        </div>

        {activeTab === "history" && (
          <TeamMemberHistoryPanel
            classId={classId}
            cohortId={selectedClass?.cohortId ?? null}
            className={selectedClass?.name ?? `Lớp #${classId}`}
          />
        )}
        <div className={activeTab === "teams" ? "contents" : "hidden"}>
        {!hasPermission("PEO_TEAM_ALLOCATE") &&
          !hasPermission("PRJ_WORKSPACE_MANAGE") && (
          <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Tài khoản hiện tại không có quyền phân nhóm dự án.
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <CardTitle>{selectedClass?.name ?? `Lớp #${classId}`}</CardTitle>
                <CardDescription>
                  {selectedClass
                    ? `${selectedClass.code} · ${selectedClass.memberCount} học viên`
                    : "Phiên phân nhóm và danh sách học viên của lớp đã chọn."}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                onClick={() => navigate("/team-allocation")}
              >
                Quay lại danh sách lớp
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {sessionsQuery.data && sessionsQuery.data.length > 0 && (
              <label className="block max-w-md space-y-2 text-sm font-medium">
                Phiên phân nhóm của lớp
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={session?.id ?? ""}
                  onChange={(event) => {
                    const selected = sessionsQuery.data?.find(
                      (item) => item.id === Number(event.target.value),
                    );
                    if (!selected) return;
                    if (
                      draftTeams.length > 0 &&
                      !window.confirm("Thay đổi chưa lưu sẽ bị bỏ. Bạn muốn chuyển phiên?")
                    ) {
                      return;
                    }
                    setSession(selected);
                    setCapacityInput(String(selected.maxMembers));
                    setDraftTeams([]);
                    setEditingSavedTeamId(null);
                    setMemberPickerTeamId(null);
                    setCreateAnotherSession(false);
                    setSaveFailure(null);
                    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(selected));
                  }}
                >
                  {sessionsQuery.data.map((item) => (
                    <option key={item.id} value={item.id}>
                      Phiên #{item.id} · {item.status} · tối đa {item.maxMembers}/nhóm
                    </option>
                  ))}
                  {!session && (
                    <option value="" disabled>
                      Chọn phiên phân nhóm
                    </option>
                  )}
                </select>
              </label>
            )}
            {session && !createAnotherSession && (
              <Button
                variant="outline"
                onClick={() => {
                  setNewSessionCapacity("");
                  setCreateAnotherSession(true);
                }}
                disabled={!hasPermission("PEO_TEAM_ALLOCATE")}
              >
                <Plus className="size-4" />
                Tạo phiên mới
              </Button>
            )}
            {(!session || createAnotherSession) && (
              <>
                <label className="block max-w-xs space-y-2 text-sm font-medium">
                  Sức chứa tối đa / nhóm {session ? "(phiên mới)" : ""}
                <Input
                  inputMode="numeric"
                  min={1}
                  type="number"
                  placeholder="Nhập số học viên tối đa"
                  value={session ? newSessionCapacity : capacityInput}
                  onChange={(event) => {
                    if (session) setNewSessionCapacity(event.target.value);
                    else setCapacityInput(event.target.value);
                  }}
                  disabled={!hasPermission("PEO_TEAM_ALLOCATE")}
                />
              </label>
                <p className="text-xs text-muted-foreground">
                  Lớp và project template được xác định tự động; mã phiên do hệ thống tạo.
                </p>
              </>
            )}
            {(!session || createAnotherSession) && (
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    if (
                      session &&
                      draftTeams.length > 0 &&
                      !window.confirm(
                        "Tạo phiên mới sẽ bỏ các thay đổi nhóm chưa lưu trong phiên hiện tại. Bạn có muốn tiếp tục?",
                      )
                    ) {
                      return;
                    }
                    openSessionMutation.mutate();
                  }}
                  disabled={
                    !hasPermission("PEO_TEAM_ALLOCATE") ||
                    openSessionMutation.isPending ||
                    !Number.isSafeInteger(Number(session ? newSessionCapacity : capacityInput)) ||
                    Number(session ? newSessionCapacity : capacityInput) <= 0
                  }
                >
                  {openSessionMutation.isPending
                    ? <LoaderCircle className="size-4 animate-spin" />
                    : <Plus className="size-4" />}
                  Tạo phiên phân nhóm
                </Button>
                {session && (
                  <Button
                    variant="outline"
                    onClick={() => setCreateAnotherSession(false)}
                    disabled={openSessionMutation.isPending}
                  >
                    Hủy
                  </Button>
                )}
              </div>
            )}
            {session && !createAnotherSession && (
              <div className="space-y-3 rounded-xl border bg-muted/40 p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant={session.status === "OPEN" ? "default" : "secondary"}>
                    {session.status}
                  </Badge>
                  <span className="font-medium">Phiên #{session.id}</span>
                  <span className="text-muted-foreground">Lớp #{session.classId}</span>
                  {teamsQuery.isLoading && <LoaderCircle className="size-4 animate-spin text-muted-foreground" />}
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="block w-full max-w-xs space-y-1.5 text-sm font-medium">
                    Sức chứa tối đa / nhóm
                    <Input
                      inputMode="numeric"
                      min={1}
                      type="number"
                      value={capacityInput}
                      onChange={(event) => setCapacityInput(event.target.value)}
                      disabled={session.status !== "OPEN" || !hasPermission("PEO_TEAM_ALLOCATE")}
                    />
                  </label>
                  <Button
                    variant="outline"
                    onClick={() => updateCapacityMutation.mutate()}
                    disabled={
                      session.status !== "OPEN" ||
                      !hasPermission("PEO_TEAM_ALLOCATE") ||
                      updateCapacityMutation.isPending ||
                      !Number.isSafeInteger(Number(capacityInput)) ||
                      Number(capacityInput) <= 0 ||
                      Number(capacityInput) === session.maxMembers
                    }
                  >
                    {updateCapacityMutation.isPending
                      ? <LoaderCircle className="size-4 animate-spin" />
                      : null}
                    Cập nhật sức chứa
                  </Button>
                  {session.status === "OPEN" && (
                    <Button
                      variant="destructive"
                      onClick={() => setCancelDialogOpen(true)}
                      disabled={
                        !hasPermission("PEO_TEAM_ALLOCATE") ||
                        !canCancelSession ||
                        cancelSessionMutation.isPending
                      }
                    >
                      {cancelSessionMutation.isPending
                        ? <LoaderCircle className="size-4 animate-spin" />
                        : <Ban className="size-4" />}
                      Hủy phiên
                    </Button>
                  )}
                  {session.status !== "OPEN" && (
                    <p className="w-full text-xs text-muted-foreground">
                      Phiên đã publish hoặc đóng nên không thể thay đổi sức chứa và
                      không thể gán đề bài cho các nhóm đã chuyển sang ACTIVE. Hãy tạo
                      phiên phân nhóm mới để gán đề bài cho nhóm DRAFT.
                    </p>
                  )}
                  {session.status === "OPEN" && !teamsQuery.isLoading && !teamsQuery.isError &&
                    !savedTeams.every((team) => team.status === "DRAFT") && (
                      <p className="w-full text-xs text-muted-foreground">
                        Chỉ có thể hủy khi tất cả nhóm trong phiên đều ở trạng thái DRAFT.
                      </p>
                    )}
                </div>
              </div>
            )}
            {teamsQuery.isError && session && (
              <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
                <span className="text-destructive">
                  Không tải được phiên #{session.id}. Kiểm tra class ID/session ID và quyền truy cập.
                </span>
                <Button variant="outline" size="sm" onClick={() => void teamsQuery.refetch()}>
                  Thử lại
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {session && (
          <>
            {/* US-12 — strict-mode class readiness before publishing the session. */}
            <Card
              className={
                readiness && !readiness.readyToPublish
                  ? "border-destructive/50"
                  : undefined
              }
            >
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <CardTitle className="flex items-center gap-2">
                      <ShieldCheck className="size-5 text-primary" />
                      Kiểm tra điều kiện công bố toàn lớp
                    </CardTitle>
                    <CardDescription>
                      BR-UNI-10 · Strict mode: 100% học viên phải đã có nhóm, mọi nhóm
                      phải được gán đề bài hợp lệ và đáp ứng đủ định suất vai trò trước
                      khi công bố phiên.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => readinessMutation.mutate()}
                      disabled={
                        readinessMutation.isPending ||
                        session.status !== "OPEN" ||
                        (!hasPermission("PEO_TEAM_ALLOCATE") &&
                          !hasPermission("PRJ_WORKSPACE_MANAGE"))
                      }
                    >
                      {readinessMutation.isPending
                        ? <LoaderCircle className="size-4 animate-spin" />
                        : <ListChecks className="size-4" />}
                      Kiểm tra điều kiện công bố
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {session.status !== "OPEN" && (
                  <p className="text-sm text-muted-foreground">
                    Phiên đang ở trạng thái {session.status}; chỉ phiên OPEN mới cần
                    kiểm tra điều kiện công bố.
                  </p>
                )}
                {session.status === "OPEN" && draftTeams.length > 0 && (
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Còn thay đổi nhóm chưa lưu. Hãy lưu nháp trước khi kiểm tra hoặc
                    công bố.
                  </p>
                )}
                {readinessError && (
                  <div
                    role="alert"
                    className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                  >
                    {readinessError.message}
                  </div>
                )}
                {!readiness && !readinessError && session.status === "OPEN" && (
                  <p className="text-sm text-muted-foreground">
                    Nhấn “Kiểm tra điều kiện công bố” để xác thực sĩ số toàn lớp, đề bài
                    và định suất vai trò của tất cả nhóm trước khi công bố chính thức.
                  </p>
                )}
                {readiness && <ReadinessReport report={readiness} />}
              </CardContent>
            </Card>

            <section className="grid gap-4 sm:grid-cols-3">
              <MetricCard
                icon={<Users className="size-5" />}
                label="Học viên chưa vào nhóm ACTIVE trong phiên"
                value={members.length}
                onClick={() => setSummaryDialog("unassigned")}
              />
              <MetricCard
                icon={<ClipboardList className="size-5" />}
                label="Nhóm đã lưu"
                value={savedTeams.length}
                onClick={() => setSummaryDialog("saved")}
              />
              <MetricCard
                icon={<CircleAlert className="size-5" />}
                label="Nhóm chờ publish"
                value={publishableTeams.length}
                onClick={() => setSummaryDialog("publishable")}
              />
            </section>

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(340px,0.7fr)]">
              <Card className={saveFailure?.status === 422 ? "border-destructive" : ""}>
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <CardTitle>Tạo nhóm nháp</CardTitle>
                    <CardDescription>
                      Mỗi nhóm cần ít nhất một học viên. Có thể lưu nhiều nhóm trong một lần.
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    onClick={addDraftTeam}
                        disabled={!hasPermission("PEO_TEAM_ALLOCATE") || session.status !== "OPEN"}
                  >
                    <Plus className="size-4" />
                    Thêm nhóm
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {saveFailure && (
                    <div role="alert" className="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
                      <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                      <div className="space-y-1">
                        <p className="font-medium text-destructive">
                          {saveFailure.status === 422
                            ? "Sức chứa nhóm không hợp lệ"
                            : saveFailure.status === 409
                              ? "Dữ liệu đã thay đổi"
                              : "Không thể lưu nhóm"}
                        </p>
                        <p className="text-muted-foreground">{saveFailure.message}</p>
                        {saveFailure.status === 409 && (
                          <p className="text-muted-foreground">
                            Bản nháp của bạn vẫn được giữ. Bỏ chọn học viên bị đánh dấu rồi lưu lại.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {membersQuery.isError ? (
                    <div role="alert" className="rounded-xl border border-destructive/30 p-5 text-sm">
                      <p className="text-destructive">Không tải được danh sách học viên.</p>
                      <Button className="mt-3" variant="outline" size="sm" onClick={() => void membersQuery.refetch()}>
                        Thử tải lại
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {draftTeams.length === 0 ? (
                        <div className="rounded-xl border border-dashed px-5 py-10 text-center">
                          <UsersRound className="mx-auto size-9 text-muted-foreground" />
                          <p className="mt-3 font-medium">Chưa có nhóm nháp</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Thêm nhóm để bắt đầu chọn học viên.
                          </p>
                        </div>
                      ) : draftTeams.map((team, teamIndex) => (
                        <article
                          key={team.localId}
                          className={`rounded-xl border p-4 ${
                            saveFailure?.memberId &&
                            team.memberIds.includes(saveFailure.memberId)
                              ? "border-destructive bg-destructive/5"
                              : ""
                          }`}
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <label className="min-w-0 flex-1 space-y-1.5 text-sm font-medium">
                              Tên nhóm
                              <Input
                                value={team.teamName}
                                maxLength={255}
                                onChange={(event) => {
                                  setDraftTeams((current) => current.map((item) =>
                                    item.localId === team.localId
                                      ? { ...item, teamName: event.target.value }
                                      : item,
                                  ));
                                  setSaveFailure(null);
                                }}
                              />
                            </label>
                            <div className={`flex items-center gap-2 text-sm ${
                              team.memberIds.length > session.maxMembers
                                ? "font-semibold text-destructive"
                                : "text-muted-foreground"
                            }`}>
                              <Users className="size-4" />
                              {team.memberIds.length}/{session.maxMembers}
                            </div>
                            <label className="mt-3 block max-w-md space-y-1.5 text-sm font-medium">
                              Mentor phụ trách
                              <select
                                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                value={team.assignedMentorId ?? ""}
                                disabled={mentorsQuery.isLoading}
                                onChange={(event) => setDraftTeams((current) =>
                                  current.map((item) => item.localId === team.localId
                                    ? {
                                        ...item,
                                        assignedMentorId: event.target.value
                                          ? Number(event.target.value)
                                          : null,
                                      }
                                    : item),
                                )}
                              >
                                <option value="">Chưa chọn Mentor</option>
                                {(mentorsQuery.data ?? []).map((mentor) => (
                                  <option key={mentor.mentorId} value={mentor.mentorId}>
                                    {mentor.fullName}
                                    {mentor.defaultMentor ? " · Mentor mặc định của lớp" : ""}
                                  </option>
                                ))}
                              </select>
                              {mentorsQuery.isError && (
                                <span className="block text-xs font-normal text-destructive">
                                  Không tải được danh sách Mentor của lớp.
                                </span>
                              )}
                            </label>
                          </div>
                          {team.savedTeamId === undefined && (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="mt-3"
                              aria-label={`Xóa nhóm nháp ${team.teamName || teamIndex + 1}`}
                              onClick={() => {
                                setDraftTeams((current) =>
                                  current.filter((item) => item.localId !== team.localId),
                                );
                                if (memberPickerTeamId === team.localId) {
                                  setMemberPickerTeamId(null);
                                }
                                setSaveFailure(null);
                              }}
                            >
                              <Trash2 className="size-4" />
                              Xóa nhóm nháp
                            </Button>
                          )}
                          <Button
                            className="mt-3"
                            size="sm"
                            variant={memberPickerTeamId === team.localId ? "default" : "outline"}
                            onClick={() => {
                              setMemberPickerTeamId((current) =>
                                current === team.localId ? null : team.localId,
                              );
                              setMemberSearch("");
                            }}
                            disabled={!hasPermission("PEO_TEAM_ALLOCATE") || session.status !== "OPEN"}
                          >
                            <Users className="size-4" />
                            {memberPickerTeamId === team.localId
                              ? "Đang chọn học viên cho nhóm này"
                              : "Chọn học viên cho nhóm này"}
                          </Button>
                          {team.memberIds.length > session.maxMembers && (
                            <p className="mt-2 text-xs text-destructive">
                              Vượt sức chứa tối đa {session.maxMembers}; danh sách chọn vẫn được giữ để bạn điều chỉnh.
                            </p>
                          )}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {team.memberIds.length === 0 ? (
                              <span className="text-xs text-muted-foreground">Chưa chọn học viên</span>
                            ) : team.memberIds.map((memberId) => (
                              <Badge
                                key={memberId}
                                variant="secondary"
                                className={saveFailure?.memberId === memberId
                                  ? "border-destructive text-destructive"
                                  : ""}
                              >
                                {nameForMember(memberId)}
                                <button
                                  type="button"
                                  aria-label={`Bỏ chọn ${nameForMember(memberId)}`}
                                  className="ml-1 rounded-full hover:text-destructive"
                                  onClick={() => toggleMember(team.localId, memberId, false)}
                                >
                                  <X className="size-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                          {team.savedTeamId !== undefined && (
                            <Button
                              className="mt-3"
                              size="sm"
                              variant="outline"
                              onClick={cancelDraftEditing}
                            >
                              Hủy chỉnh sửa
                            </Button>
                          )}
                        </article>
                      ))}

                      {memberPickerTeam && (
                        <div className="space-y-3 rounded-xl border border-primary/30 bg-muted/20 p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <h3 className="text-sm font-semibold">
                                Chọn học viên cho {memberPickerTeam.teamName || "nhóm chưa đặt tên"}
                              </h3>
                              <p className="text-xs text-muted-foreground">
                                Đã chọn {memberPickerTeam.memberIds.length}/{session.maxMembers} học viên.
                                Một học viên có thể ở nhiều nhóm DRAFT; hệ thống sẽ cảnh báo khi lưu.
                              </p>
                            </div>
                            <div className="relative w-full sm:max-w-xs">
                              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                className="pl-9"
                                placeholder="Tìm tên hoặc mã học viên"
                                aria-label={`Tìm học viên cho ${memberPickerTeam.teamName}`}
                                value={memberSearch}
                                onChange={(event) => setMemberSearch(event.target.value)}
                              />
                            </div>
                          </div>
                          {(memberPickerTeam.savedTeamId !== undefined
                            ? rosterQuery.isLoading
                            : membersQuery.isLoading) ? (
                            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                              <LoaderCircle className="size-4 animate-spin" />
                              Đang tải học viên...
                            </div>
                          ) : filteredMembers.length === 0 ? (
                            <p className="py-6 text-center text-sm text-muted-foreground">
                              {members.length === 0
                                ? "Không còn học viên ACTIVE chưa được xếp vào nhóm ACTIVE trong phiên này."
                                : "Không tìm thấy học viên phù hợp."}
                            </p>
                          ) : (
                            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                              {filteredMembers.map((member) => {
                                const selected = memberPickerTeam.memberIds.includes(member.memberId);
                                const assignedToAnotherDraft =
                                  !selected && draftMemberIds.has(member.memberId);
                                const assignedToActiveTeam =
                                  memberPickerTeam.savedTeamId !== undefined &&
                                  (rosterQuery.data ?? []).some(
                                    (rosterMember) =>
                                      rosterMember.memberId === member.memberId &&
                                      rosterMember.assignedToActiveTeam,
                                  );
                                return (
                                  <MemberOption
                                    key={`${memberPickerTeam.localId}-${member.memberId}`}
                                    member={member}
                                    checked={selected}
                                    duplicateDraft={assignedToAnotherDraft}
                                    highlighted={saveFailure?.memberId === member.memberId}
                                    disabled={assignedToActiveTeam && !selected}
                                    onCheckedChange={(checked) =>
                                      toggleMember(memberPickerTeam.localId, member.memberId, checked)
                                    }
                                  />
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                        <p className="text-xs text-muted-foreground">
                          Nhóm vượt giới hạn sẽ được backend kiểm tra; form không bị xóa nếu phát sinh lỗi.
                        </p>
                        <Button
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
                          {editingSavedTeamId !== null
                            ? "Lưu chỉnh sửa nhóm"
                            : "Lưu nhóm DRAFT"}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="size-5 text-primary" />
                    Nhóm đã lưu
                  </CardTitle>
                  <CardDescription>
                    Các nhóm DRAFT chưa giữ chỗ học viên. Công bố chính thức sẽ kiểm tra lại trạng thái thành viên.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {lastWarnings.length > 0 && (
                    <WarningList warnings={lastWarnings} />
                  )}
                  {publishFailure && (
                    <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                      {publishFailure.message}
                      {publishFailure.status === 422 &&
                        ((publishFailure.unassignedMembers?.length ?? 0) > 0 ||
                          (publishFailure.unassignedMemberIds?.length ?? 0) > 0) && (
                          <div className="mt-3 rounded-lg border-2 border-destructive bg-background p-3">
                            <p className="font-semibold">
                              Học viên tự do chưa được xếp nhóm (
                              {publishFailure.unassignedCount
                                ?? publishFailure.unassignedMembers?.length
                                ?? publishFailure.unassignedMemberIds?.length}
                              )
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {publishFailure.unassignedMembers?.length
                                ? publishFailure.unassignedMembers.map((member) => (
                                    <Badge
                                      key={member.memberId}
                                      variant="outline"
                                      className="border-destructive bg-destructive/10 text-destructive"
                                    >
                                      {member.fullName} (#{member.memberId})
                                    </Badge>
                                  ))
                                : publishFailure.unassignedMemberIds?.map((memberId) => (
                                    <Badge
                                      key={memberId}
                                      variant="outline"
                                      className="border-destructive bg-destructive/10 text-destructive"
                                    >
                                      {nameForMember(memberId)}
                                    </Badge>
                                  ))}
                            </div>
                          </div>
                        )}
                      {(publishFailure.teamIssues?.length ?? 0) > 0 && (
                        <div className="mt-3 rounded-lg border-2 border-destructive bg-background p-3">
                          <p className="font-semibold">
                            Nhóm chưa đáp ứng điều kiện công bố
                          </p>
                          <ul className="mt-2 space-y-1 text-xs">
                            {publishFailure.teamIssues?.map((issue, index) => (
                              <li key={`${issue.teamId}-${issue.code}-${index}`}>
                                <span className="font-medium">
                                  {issue.teamName} (#{issue.teamId}):
                                </span>{" "}
                                {issue.message}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  {publishSuccess && (
                    <div
                      role="status"
                      className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm font-medium text-emerald-700 dark:text-emerald-300"
                    >
                      {publishSuccess}
                    </div>
                  )}
                  {publishItemFailures.length > 0 && (
                    <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                      <p className="text-sm font-semibold text-destructive">
                        Một số nhóm chưa thể publish
                      </p>
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {publishItemFailures.map((failure) => (
                          <li key={failure.teamId}>
                            Nhóm #{failure.teamId}: {failure.message}
                            {failure.memberId
                              ? ` (${nameForMember(failure.memberId)})`
                              : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {teamsQuery.isLoading ? (
                    <LoadingState label="Đang tải nhóm..." />
                  ) : teamsQuery.isError ? (
                    <p className="text-sm text-muted-foreground">
                      Danh sách nhóm chưa tải được.
                    </p>
                  ) : savedTeams.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-6 text-center">
                      <ClipboardList className="mx-auto size-8 text-muted-foreground" />
                      <p className="mt-3 text-sm font-medium">Chưa có nhóm đã lưu</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Lưu nhóm nháp để chúng xuất hiện ở đây.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {savedTeams.map((team) => (
                        <SavedTeamCard
                          key={team.teamId}
                          team={team}
                          memberName={nameForMember}
                          mentors={mentorsQuery.data ?? []}
                          memberOptions={rosterQuery.data ?? []}
                          allTeams={savedTeams}
                          maxMembers={team.maxMembers ?? session.maxMembers}
                          canManageMembers={
                            hasPermission("PEO_TEAM_ALLOCATE") &&
                            (session.status === "OPEN" || session.status === "PUBLISHED")
                          }
                          canTransfer={
                            (hasPermission("PEO_TEAM_ALLOCATE") ||
                              hasPermission("PRJ_WORKSPACE_MANAGE")) &&
                            (session.status === "OPEN" || session.status === "PUBLISHED")
                          }
                          transferPending={transferMemberMutation.isPending}
                          canManageMentor={
                            (hasPermission("PEO_TEAM_ALLOCATE") ||
                              hasPermission("PRJ_WORKSPACE_MANAGE")) &&
                            (session.status === "OPEN" || session.status === "PUBLISHED")
                          }
                          canManageRoles={
                            (hasPermission("PEO_TEAM_ALLOCATE") ||
                              hasPermission("PRJ_WORKSPACE_MANAGE")) &&
                            (team.status === "DRAFT" || team.status === "ACTIVE") &&
                            (session.status === "OPEN" || session.status === "PUBLISHED")
                          }
                          roleSaveError={
                            roleAssignmentFailures[team.teamId]
                          }
                          rolesPending={
                            updateTeamRolesMutation.isPending
                          }
                          membershipPending={
                            addActiveMemberMutation.isPending ||
                            removeActiveMemberMutation.isPending
                          }
                          pending={
                            saveDraftMutation.isPending ||
                            draftTeams.length > 0 ||
                            session.status !== "OPEN"
                          }
                          savePending={saveTeamDetailsMutation.isPending}
                          onEdit={() => editSavedTeam(team)}
                          onSaveAll={(payload) =>
                            saveTeamDetailsMutation.mutate(payload)
                          }
                          onAddMember={(memberId) =>
                            addActiveMemberMutation.mutate({
                              teamId: team.teamId,
                              memberId,
                            })
                          }
                          onRemoveMember={(memberId) => {
                            setRemoveMemberTarget({
                              teamId: team.teamId,
                              memberId,
                              memberName: nameForMember(memberId),
                            });
                            setRemoveMemberReason("");
                          }}
                          onTransfer={(memberId) => {
                            setTransferTarget({
                              teamId: team.teamId,
                              memberId,
                              memberName: nameForMember(memberId),
                            });
                            setTransferDestinationId("");
                            setTransferReplacementMemberId("");
                            setTransferMode("move");
                            setTransferReason("");
                          }}
                          onUpdateMentor={(mentorId) => {
                            setActiveMentorTarget({
                              teamId: team.teamId,
                              teamName: team.teamName,
                              mentorId,
                              active: team.status === "ACTIVE",
                            });
                            setActiveMentorSelection(
                              mentorId === null ? "" : String(mentorId),
                            );
                            setActiveMentorReason("");
                          }}
                          onUpdateRoles={(teamId, expectedVersion, members) =>
                            updateTeamRolesMutation.mutate({
                              teamId,
                              expectedVersion,
                              members,
                            })
                          }
                          onRoleChange={clearTeamRoleFailure}
                          templates={templatesQuery.data ?? []}
                          templatesLoading={templatesQuery.isLoading}
                          templatesError={
                            templatesQuery.isError
                              ? "Không tải được danh sách đề bài."
                              : null
                          }
                          canAssignTemplate={
                            hasPermission("PEO_TEAM_ALLOCATE") ||
                            hasPermission("PRJ_WORKSPACE_MANAGE")
                          }
                          assignTemplatePending={assignTemplateMutation.isPending}
                          assignTemplateError={templateAssignErrors[team.teamId]}
                          onAssignTemplate={(projectTemplateId) =>
                            assignTemplateMutation.mutate({
                              teamId: team.teamId,
                              projectTemplateId,
                            })
                          }
                          onClearAssignTemplateError={() =>
                            clearTemplateAssignError(team.teamId)
                          }
                          canCreateNewSession={hasPermission("PEO_TEAM_ALLOCATE")}
                          onCreateNewSession={() => {
                            setNewSessionCapacity(String(session.maxMembers));
                            setCreateAnotherSession(true);
                          }}
                        />
                      ))}
                    </div>
                  )}
                  {savedTeams.length > 0 && (
                    <>
                      {teamsMissingRoles.length > 0 && (
                        <p className="text-sm text-muted-foreground">
                          Gán và lưu vai trò cho mọi thành viên trước khi công bố chính thức.
                        </p>
                      )}
                      <Button
                        className="w-full"
                        disabled={
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
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
        </div>
      </div>
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hủy phiên phân nhóm?</DialogTitle>
            <DialogDescription>
              Phiên sẽ chuyển sang CANCELLED và các nhóm DRAFT sẽ được lưu trữ (ARCHIVED).
              Hành động này không xóa lịch sử và không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
              disabled={cancelSessionMutation.isPending}
            >
              Quay lại
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelSessionMutation.mutate()}
              disabled={!canCancelSession || cancelSessionMutation.isPending}
            >
              {cancelSessionMutation.isPending
                ? <LoaderCircle className="size-4 animate-spin" />
                : <Ban className="size-4" />}
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
                ? `${members.length} học viên`
                : summaryDialog === "publishable"
                  ? `${publishableTeams.length} nhóm`
                  : `${savedTeams.length} nhóm`}
            </DialogDescription>
          </DialogHeader>
          {summaryDialog === "unassigned" ? (
            members.length === 0 ? (
              <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
                Không có học viên nào trong danh sách này.
              </p>
            ) : (
              <ul className="max-h-[55vh] divide-y overflow-y-auto rounded-lg border">
                {members.map((member) => (
                  <li
                    key={member.memberId}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                  >
                    <span className="min-w-0 truncate">{member.fullName}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      #{member.memberId}
                    </span>
                  </li>
                ))}
              </ul>
            )
          ) : (
            (() => {
              const displayedTeams = summaryDialog === "publishable"
                ? publishableTeams
                : savedTeams;
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
                      {member.fullName} · {member.role ?? "Chưa có role"}
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
    </MainLayout>
  );
}

function MetricCard({
  icon,
  label,
  value,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="rounded-xl text-left transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      onClick={onClick}
      aria-label={`${label}: ${value}. Nhấn để xem chi tiết.`}
    >
      <Card className="h-full gap-4 py-5 transition-colors hover:border-primary/40">
        <CardContent className="flex items-center gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
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
      <span className="min-w-0 flex-1 truncate font-medium">{member.fullName}</span>
      <span className="text-xs text-muted-foreground">#{member.memberId}</span>
      {duplicateDraft && (
        <span className="text-xs text-amber-700 dark:text-amber-300">Đã ở nhóm DRAFT khác</span>
      )}
    </label>
  );
}

function SavedTeamCard({
  team,
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
  templates,
  templatesLoading,
  templatesError,
  canAssignTemplate,
  assignTemplatePending,
  assignTemplateError,
  onAssignTemplate,
  onClearAssignTemplateError,
  canCreateNewSession,
  onCreateNewSession,
}: {
  team: AllocationTeam;
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
  templates: ProjectTemplateOption[];
  templatesLoading: boolean;
  templatesError: string | null;
  canAssignTemplate: boolean;
  assignTemplatePending: boolean;
  assignTemplateError?: TeamTemplateApiError;
  onAssignTemplate: (projectTemplateId: number) => void;
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
  const [detailsOpen, setDetailsOpen] = useState(false);
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
    : team.memberIds.map((memberId) => ({
        memberId,
        fullName: memberName(memberId),
        roles: memberRoles[memberId] ?? ([`DEV`] as TeamMemberRole[]),
      }));
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
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 rounded-xl border p-4 text-left transition-colors hover:bg-muted/40"
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
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
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
                      onClearAssignTemplateError();
                    }}
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
                    disabled={
                      !canAssignTemplate ||
                      assignTemplatePending ||
                      !selectedTemplate ||
                      selectedTemplate ===
                        (team.projectTemplateId == null
                          ? ""
                          : String(team.projectTemplateId))
                    }
                    onClick={() => onAssignTemplate(Number(selectedTemplate))}
                  >
                    {assignTemplatePending
                      ? <LoaderCircle className="size-4 animate-spin" />
                      : <Save className="size-4" />}
                    Gán đề bài
                  </Button>
                </div>
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
            {team.projectTemplateId == null ? (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Gán đề bài dự án để xem danh sách thành viên và cấu hình vai trò.
              </p>
            ) : (
              <>
            <div>
              <p className="mb-2 text-sm font-medium">Danh sách thành viên</p>
              {members.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Nhóm chưa có thành viên.
                </p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {members.map((member) => {
                    const selectedRoles = memberRoles[member.memberId]
                      ?? memberRolesOf(member);
                    return (
                    <li
                      key={member.memberId}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                    >
                      <span className="min-w-0 truncate">{member.fullName}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        {canManageRoles ? (
                          allowMultiRole ? (
                            <span
                              role="group"
                              aria-label={`Vai trò của ${member.fullName}`}
                              className={`flex flex-wrap gap-1 rounded-md ${
                                invalidRoleMemberIds.has(member.memberId)
                                  ? "ring-1 ring-destructive"
                                  : ""
                              }`}
                            >
                              {TEAM_ROLE_OPTIONS.map((role) => (
                                <label
                                  key={role}
                                  className={`flex cursor-pointer items-center gap-1 rounded-md border px-1.5 py-1 text-xs transition-colors ${
                                    selectedRoles.includes(role)
                                      ? "border-primary/50 bg-primary/10 font-medium text-primary"
                                      : "bg-background text-muted-foreground"
                                  } ${rolesPending ? "cursor-not-allowed opacity-60" : ""}`}
                                >
                                  <Checkbox
                                    checked={selectedRoles.includes(role)}
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
                              aria-invalid={invalidRoleMemberIds.has(member.memberId)}
                              className={`h-8 rounded-md border bg-background px-2 text-xs ${
                                invalidRoleMemberIds.has(member.memberId)
                                  ? "border-destructive"
                                  : ""
                              }`}
                              value={selectedRoles[0] ?? ""}
                              disabled={rolesPending}
                              onChange={(event) => {
                                const role = event.target.value;
                                updateMemberRoles(
                                  member.memberId,
                                  isTeamMemberRole(role) ? [role] : [],
                                );
                              }}
                            >
                              <option value="">Vui lòng chọn vai trò</option>
                              {TEAM_ROLE_OPTIONS.map((role) => (
                                <option key={role} value={role}>
                                  {TEAM_ROLE_LABEL[role]}
                                </option>
                              ))}
                            </select>
                          )
                        ) : (
                          <span className="flex flex-wrap gap-1">
                            {selectedRoles.length === 0 ? (
                              <Badge variant="outline">Chưa gán</Badge>
                            ) : selectedRoles.map((role) => (
                              <Badge key={role} variant="secondary">{role}</Badge>
                            ))}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          #{member.memberId}
                        </span>
                        {isActive && canManageMembers && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label={`Gỡ ${member.fullName} khỏi nhóm`}
                            title={`Gỡ ${member.fullName} khỏi nhóm`}
                            disabled={membershipPending}
                            onClick={() => onRemoveMember(member.memberId)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        )}
                        {isActive && canTransfer && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label={`Chuyển ${member.fullName} sang nhóm khác`}
                            title={`Chuyển ${member.fullName} sang nhóm khác`}
                            disabled={transferPending || transferTargets.length === 0}
                            onClick={() => onTransfer(member.memberId)}
                          >
                            {transferPending
                              ? <LoaderCircle className="size-4 animate-spin" />
                              : <ArrowRightLeft className="size-4" />}
                          </Button>
                        )}
                      </span>
                    </li>
                    );
                  })}
                </ul>
              )}
            </div>
            {canManageRoles && members.length > 0 && (
              <div className="space-y-2">
                {roleQuotas.length > 0 && (
                  <div className="rounded-lg border bg-muted/30 p-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-medium">
                        Định suất vai trò của đề bài
                      </p>
                      <Badge variant={allowMultiRole ? "secondary" : "outline"}>
                        {allowMultiRole ? "Cho phép kiêm nhiệm" : "Không kiêm nhiệm"}
                      </Badge>
                    </div>
                    <ul className="mt-1.5 flex flex-wrap gap-1.5">
                      {roleQuotas.map((quota) => {
                        const gap = currentQuotaGaps.find(
                          (violation) => violation.role === quota.role,
                        );
                        return (
                          <li key={quota.role}>
                            <Badge
                              variant={gap ? "destructive" : "outline"}
                              className="font-normal"
                            >
                              {quota.role}: {quotaWindow(quota)}
                              {gap ? ` · hiện có ${gap.actual}` : ""}
                            </Badge>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                {roleSaveError && (
                  <div
                    role="alert"
                    className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                  >
                    {roleSaveError.status === 409
                      ? "Dữ liệu/Version nhóm đã bị thay đổi, vui lòng tải lại trang"
                      : roleSaveError.message}
                    {roleSaveError.violations &&
                      roleSaveError.violations.length > 0 && (
                        <ul className="mt-2 space-y-0.5 text-xs">
                          {roleSaveError.violations.map((violation) => (
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
                {localRoleErrors.length > 0 && (
                  <div
                    role="alert"
                    className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                  >
                    Vui lòng chọn ít nhất một vai trò cho mỗi thành viên
                    {localRoleErrors.length > 0 ? ` (${localRoleErrors.length} thành viên)` : ""}.
                  </div>
                )}
                {isActive && (
                <Button
                  type="button"
                  size="sm"
                  disabled={rolesPending}
                  onClick={() => {
                    const missingRoleMemberIds = members
                      .filter((member) =>
                        (memberRoles[member.memberId]
                          ?? memberRolesOf(member)).length === 0)
                      .map((member) => member.memberId);
                    const multiRoleMemberIds = allowMultiRole
                      ? []
                      : members
                        .filter((member) =>
                          (memberRoles[member.memberId]
                            ?? memberRolesOf(member)).length > 1)
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
                    onUpdateRoles(
                      team.teamId,
                      team.version,
                      members.map((member) => ({
                        memberId: member.memberId,
                        roles: memberRoles[member.memberId]
                          ?? memberRolesOf(member),
                      })),
                    );
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
              </>
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
                          {option.fullName}
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
                {student.fullName} (#{student.memberId})
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
