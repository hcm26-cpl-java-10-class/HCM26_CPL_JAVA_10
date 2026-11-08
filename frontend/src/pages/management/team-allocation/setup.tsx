import { teamAllocationApi, trainingClassApi } from "@/api";
import { ProjectAssignmentPanel } from "./ProjectAssignmentPanel";
import { TeamMemberRoleInput } from "./AssignmentTeamRoles";
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
import type { TrainingClassDTO } from "@/types/features/training-class";
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
  TeamRoleQuotaViolation,
  TransferTeamMemberRequest,
} from "@/types/features/team-allocation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CircleAlert,
  ClipboardList,
  ArrowRightLeft,
  ChevronDown,
  ChevronRight,
  History,
  Info,
  ListChecks,
  LoaderCircle,
  LockKeyhole,
  Monitor,
  Plus,
  RefreshCw,
  Save,
  Search,
  Shuffle,
  Send,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject, ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

interface LocalDraftTeam {
  localId: string;
  savedTeamId?: number;
  teamName: string;
  assignedMentorId: number | null;
  memberIds: number[];
  memberRoles: Record<number, string | null>;
  leaderMemberId: number | null;
  effectiveMaxMembers?: number;
}

/** Everything the saved-team dialog can change in one save (no publish). */
interface SaveTeamDetailsPayload {
  teamId: number;
  teamVersion: number;
  mentorId: number | null;
  mentorChanged: boolean;
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

/** Unsaved draft teams are kept per class + session so a refresh doesn't lose them. */
const DRAFT_STORAGE_PREFIX = "team-allocation-drafts";

interface StoredDraftState {
  classId: number;
  sessionId: number;
  teams: LocalDraftTeam[];
  editingSavedTeamId: number | null;
  memberPickerTeamId: string | null;
  rememberedMentorId: number | null;
}

function draftStorageKeyFor(classId: number, sessionId: number) {
  return `${DRAFT_STORAGE_PREFIX}:${classId}:${sessionId}`;
}

function isRestorableDraftTeam(value: unknown): value is LocalDraftTeam {
  if (typeof value !== "object" || value === null) return false;
  const team = value as Record<string, unknown>;
  return (
    typeof team.localId === "string" &&
    typeof team.teamName === "string" &&
    Array.isArray(team.memberIds) &&
    team.memberIds.every((id) => typeof id === "number") &&
    typeof team.memberRoles === "object" &&
    team.memberRoles !== null
  );
}

function readStoredDrafts(key: string): StoredDraftState | null {
  try {
    const serialized = localStorage.getItem(key);
    if (!serialized) return null;
    const parsed: unknown = JSON.parse(serialized);
    if (typeof parsed !== "object" || parsed === null) return null;
    const state = parsed as Partial<StoredDraftState>;
    if (!Array.isArray(state.teams)) return null;
    const teams = state.teams.filter(isRestorableDraftTeam);
    if (teams.length === 0) return null;
    return {
      classId: typeof state.classId === "number" ? state.classId : 0,
      sessionId: typeof state.sessionId === "number" ? state.sessionId : 0,
      teams,
      editingSavedTeamId:
        typeof state.editingSavedTeamId === "number" ? state.editingSavedTeamId : null,
      memberPickerTeamId:
        typeof state.memberPickerTeamId === "string" ? state.memberPickerTeamId : null,
      rememberedMentorId:
        typeof state.rememberedMentorId === "number" ? state.rememberedMentorId : null,
    };
  } catch {
    localStorage.removeItem(key);
    return null;
  }
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

function isTeamMemberRole(role: string | null | undefined): role is TeamMemberRole {
  return role === "PM" || role === "BA" || role === "DEV" || role === "QA";
}

/** Backend uses Integer.MAX_VALUE for an unbounded max quota. */
const UNBOUNDED_ROLE_QUOTA = 2_147_483_647;

/** US-11: member roles from the new `roles` array, falling back to `role`. */
function memberRolesOf(member: {
  role?: string | null;
  roles?: TeamMemberRole[];
}): TeamMemberRole[] {
  if (member.roles?.length) return member.roles;
  return (member.role ?? "").split(",").map((role) => role.trim()).filter(isTeamMemberRole);
}

function hasCompleteTeamRoles(team: AllocationTeam) {
  const rolesComplete = team.members?.length === team.memberIds.length &&
    team.members.every((member) => memberRolesOf(member).length > 0);
  return team.leaderMemberId != null && rolesComplete && roleQuotaGaps(team).length === 0;
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

function getStoredKey(
  ref: MutableRefObject<{ fingerprint: string; key: string } | null>,
  fingerprint: string,
) {
  if (ref.current?.fingerprint !== fingerprint) {
    ref.current = { fingerprint, key: makeIdempotencyKey() };
  }
  return ref.current.key;
}

function describeAutoTeamSizes(preview: AutoAllocationPreview): string {
  const counts = new Map<number, number>();
  for (const team of preview.teams) {
    counts.set(team.members.length, (counts.get(team.members.length) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => b - a)
    .map(([size, teams]) => `${teams} nhóm ${size} người`)
    .join(", ");
}

/**
 * Next free "Nhóm N" name, counting saved teams as well as unsaved drafts so a
 * new team never reuses a name that already exists in the session (for example
 * right after "Lưu nhóm DRAFT").
 */
function nextDraftTeamName(usedNames: Iterable<string>): string {
  const usedNumbers = new Set<number>();
  for (const name of usedNames) {
    const match = /^nhóm\s*(\d+)$/i.exec(name.trim());
    if (match) usedNumbers.add(Number(match[1]));
  }
  let index = 1;
  while (usedNumbers.has(index)) index += 1;
  return `Nhóm ${index}`;
}

export default function TeamAllocationSetupPage() {
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
      review: params.get("tab") === "review",
    };
  }, [location.search]);
  const requestedSessionRef = useRef(allocationLink.sessionId);
  const classQuery = useQuery({
    queryKey: ["training-class", "detail", classId],
    queryFn: () => trainingClassApi.getById(String(classId)),
    enabled: Number.isSafeInteger(classId) && classId > 0,
    retry: false,
  });
  const selectedClass = (location.state as { trainingClass?: TrainingClassDTO } | null)
    ?.trainingClass ?? classQuery.data;
  const queryClient = useQueryClient();
  const initialSession = useMemo(() => {
    const saved = getSavedSession();
    return saved?.classId === classId &&
      (allocationLink.sessionId === null || saved.id === allocationLink.sessionId) ? saved : null;
  }, [classId, allocationLink.sessionId]);
  const [session, setSession] = useState<AllocationSession | null>(initialSession);
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
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState<"build" | "review">(
    allocationLink.review || allocationLink.teamId !== null ? "review" : "build",
  );
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
  const [memberSearch, setMemberSearch] = useState("");
  const [memberPickerTeamId, setMemberPickerTeamId] = useState<string | null>(null);
  const [mentorForAllDialogOpen, setMentorForAllDialogOpen] = useState(false);
  const [mentorForAllSelection, setMentorForAllSelection] = useState("");
  /** Mentor đã chọn gần nhất — tự gán cho nhóm nháp tạo mới. */
  const [rememberedMentorId, setRememberedMentorId] = useState<number | null>(null);
  const [editingSavedTeamId, setEditingSavedTeamId] = useState<number | null>(null);
  const [saveFailure, setSaveFailure] = useState<ApiFailure | null>(null);
  const [publishFailure, setPublishFailure] = useState<ApiFailure | null>(null);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);
  /** US-12: latest strict-mode readiness report (null until checked). */
  const [readiness, setReadiness] = useState<AllocationReadiness | null>(null);
  const [readinessError, setReadinessError] = useState<ApiFailure | null>(null);
  const [readinessDialogOpen, setReadinessDialogOpen] = useState(false);
  const [publishItemFailures, setPublishItemFailures] = useState<
    PublishTeamsResponse["failedItems"]
  >([]);
  const [lastWarnings, setLastWarnings] = useState<DraftWarning[]>([]);
  const saveKeyRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const restoredDraftKeyRef = useRef<string | null>(null);

  const sessionId = session?.id ?? null;
  const draftStorageKey = classId > 0 && sessionId !== null
    ? draftStorageKeyFor(classId, sessionId)
    : null;
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

  useEffect(() => {
    if (!sessionsQuery.data) return;
    const requestedSession = requestedSessionRef.current;
    requestedSessionRef.current = null;
    const matchingSession = (requestedSession === null ? undefined
      : sessionsQuery.data.find((item) => item.id === requestedSession)) ?? (session
      ? sessionsQuery.data.find((item) => item.id === session.id)
      : undefined) ?? sessionsQuery.data[0];
    if (!matchingSession) {
      if (session) {
        setSession(null);
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
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(matchingSession));
  }, [sessionsQuery.data, session]);

  // Restore unsaved draft teams for this class + session (survives a refresh).
  useEffect(() => {
    if (!draftStorageKey) return;
    if (restoredDraftKeyRef.current === draftStorageKey) return;
    restoredDraftKeyRef.current = draftStorageKey;
    const stored = readStoredDrafts(draftStorageKey);
    if (!stored) {
      setDraftTeams([]);
      setEditingSavedTeamId(null);
      setMemberPickerTeamId(null);
      return;
    }
    setDraftTeams(stored.teams);
    setEditingSavedTeamId(stored.editingSavedTeamId);
    setMemberPickerTeamId(
      stored.memberPickerTeamId &&
        stored.teams.some((team) => team.localId === stored.memberPickerTeamId)
        ? stored.memberPickerTeamId
        : stored.teams[0]?.localId ?? null,
    );
    if (stored.rememberedMentorId !== null) {
      setRememberedMentorId(stored.rememberedMentorId);
    }
    setSaveFailure(null);
  }, [draftStorageKey]);

  // Keep the saved snapshot in sync while the drafts are being edited.
  useEffect(() => {
    if (!draftStorageKey) return;
    if (restoredDraftKeyRef.current !== draftStorageKey) return;
    if (draftTeams.length === 0) {
      localStorage.removeItem(draftStorageKey);
      return;
    }
    try {
      const snapshot: StoredDraftState = {
        classId,
        sessionId: sessionId!,
        teams: draftTeams,
        editingSavedTeamId,
        memberPickerTeamId,
        rememberedMentorId,
      };
      localStorage.setItem(draftStorageKey, JSON.stringify(snapshot));
    } catch {
      // Persistence is best effort — never block the editor.
    }
  }, [
    draftStorageKey,
    draftTeams,
    editingSavedTeamId,
    memberPickerTeamId,
    rememberedMentorId,
    classId,
    sessionId,
  ]);

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
          leaderMemberId: team.leaderMemberId,
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
        setReadinessDialogOpen(false);
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

  const checkPublishReadiness = () => {
    setReadinessDialogOpen(true);
    setReadiness(null);
    setReadinessError(null);
    readinessMutation.mutate();
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

  const assignLeaderMutation = useMutation({
    mutationFn: ({ team, memberId, confirmReplacement }: {
      team: AllocationTeam; memberId: number; confirmReplacement: boolean;
    }) => {
      if (sessionId === null) throw new Error("Không có phiên phân nhóm.");
      return teamAllocationApi.assignLeader(classId, sessionId, team.teamId,
        memberId, team.version, confirmReplacement);
    },
    onSuccess: async () => {
      setLeaderReplacement(null);
      setReadiness(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["team-allocation", "teams", classId, sessionId] }),
        queryClient.invalidateQueries({ queryKey: ["team-member-history"] }),
      ]);
      toast.success("Đã cập nhật Leader của nhóm.");
    },
    onError: async (error) => {
      if (getApiFailure(error).status === 409) {
        await queryClient.invalidateQueries({ queryKey: ["team-allocation", "teams", classId, sessionId] });
      }
      toast.error(getApiFailure(error).message);
    },
  });

  // Save the mentor and member roles without publishing the team.
  const saveTeamDetailsMutation = useMutation({
    mutationFn: async (payload: SaveTeamDetailsPayload) => {
      if (classId === null || sessionId === null) {
        throw new Error("Không có phiên phân nhóm.");
      }
      if (payload.rolesChanged) {
        await teamAllocationApi.updateTeamRoles(
          classId,
          sessionId,
          payload.teamId,
          {
            expectedVersion: payload.teamVersion,
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
  const assignedInCurrentSession = new Set(
    savedTeams
      .filter((team) => team.status === "DRAFT" || team.status === "ACTIVE")
      .flatMap((team) => team.memberIds),
  );
  const autoAvailableCount = rosterQuery.data && teamsQuery.data
    ? rosterQuery.data.filter((member) => !assignedInCurrentSession.has(member.memberId)).length
    : null;
  const memberPickerTeam = draftTeams.find(
    (team) => team.localId === memberPickerTeamId,
  );
  const memberPickerMaxMembers = memberPickerTeam
    ? memberPickerTeam.effectiveMaxMembers ?? session?.maxMembers ?? 0
    : 0;
  const memberPickerIsFull = Boolean(memberPickerTeam) &&
    memberPickerMaxMembers > 0 &&
    (memberPickerTeam?.memberIds.length ?? 0) >= memberPickerMaxMembers;
  const draftMemberIds = new Set(draftTeams.flatMap((team) => team.memberIds));
  /** Học viên đã thuộc một nhóm khác trong phiên (DRAFT/ACTIVE) thì không được chọn nữa. */
  const otherSavedTeamMemberIds = new Set(
    savedTeams
      .filter((team) => team.teamId !== memberPickerTeam?.savedTeamId)
      .filter((team) => team.status === "DRAFT" || team.status === "ACTIVE")
      .flatMap((team) => team.memberIds),
  );
  /**
   * Học viên đã được xếp vào một nhóm DRAFT/ACTIVE đã lưu hoặc một nhóm nháp khác.
   * Dùng chung cho cả việc disable checkbox lẫn kiểm tra khi toggle.
   */
  const blockedMemberIds = new Set([
    ...otherSavedTeamMemberIds,
    ...draftTeams
      .filter((team) => team.localId !== memberPickerTeam?.localId)
      .flatMap((team) => team.memberIds),
  ]);
  const memberById = new Map(
    [...members, ...(rosterQuery.data ?? [])].map((member) => [member.memberId, member]),
  );
  const memberOptions: ClassMember[] = memberPickerTeam?.savedTeamId !== undefined
    ? (rosterQuery.data ?? [])
    : members;
  const filteredMembers = memberOptions.filter((member) =>
    member.fullName.toLowerCase().includes(memberSearch.trim().toLowerCase()) ||
    member.userCode?.toLowerCase().includes(memberSearch.trim().toLowerCase()) ||
    String(member.memberId).includes(memberSearch.trim()),
  );
  const publishableTeams = savedTeams.filter((team) => team.status === "DRAFT");
  const teamsMissingRoles = publishableTeams.filter(
    (team) => !hasCompleteTeamRoles(team),
  );
  const teamsMissingTemplate = savedTeams.filter((team) => !team.projectTemplateId);
  const missingSetupNote = [
    teamsMissingTemplate.length > 0
      ? `${teamsMissingTemplate.length} nhóm còn thiếu thông tin đề bài`
      : null,
    teamsMissingRoles.length > 0
      ? `${teamsMissingRoles.length} nhóm còn thiếu vai trò thành viên`
      : null,
  ].filter(Boolean).join(" · ");
  const addDraftTeam = () => {
    if (editingSavedTeamId !== null) {
      toast.error("Hãy lưu hoặc hủy chỉnh sửa nhóm trước khi thêm nhóm mới.");
      return;
    }
    const localId = crypto.randomUUID();
    setAutoPreview(null);
    setAutoConfirmKey(null);
    setDraftTeams((current) => [
      ...current,
      {
        localId,
        teamName: nextDraftTeamName([
          ...savedTeams.map((team) => team.teamName),
          ...current.map((team) => team.teamName),
        ]),
        assignedMentorId: rememberedMentorId,
        memberIds: [],
        memberRoles: {},
        leaderMemberId: null,
      },
    ]);
    setMemberPickerTeamId(localId);
    setMemberSearch("");
    setSaveFailure(null);
  };

  const addDraftTeamWithCapacity = () => {
    if (!session) return;
    addDraftTeam();
  };

  /** Selecting a draft team in the right column opens its student picker on the left. */
  const selectDraftTeamForMembers = (team: LocalDraftTeam) => {
    setMemberPickerTeamId(team.localId);
  };

  const applyMentorToAllDraftTeams = (mentorId: number | null) => {
    setDraftTeams((current) => current.map((team) => ({ ...team, assignedMentorId: mentorId })));
    setRememberedMentorId(mentorId);
    setSaveFailure(null);
    setMentorForAllDialogOpen(false);
    setMentorForAllSelection("");
    toast.success(
      mentorId === null
        ? "Đã bỏ Mentor phụ trách của tất cả nhóm nháp."
        : "Đã gán Mentor cho tất cả nhóm nháp.",
    );
  };

  const toggleMember = (teamId: string, memberId: number, checked: boolean) => {
    const targetTeam = draftTeams.find((item) => item.localId === teamId);
    if (!targetTeam) return;
    if (checked && !targetTeam.memberIds.includes(memberId)) {
      // Chặn cả khi checkbox bị bỏ qua: học viên đã thuộc nhóm khác trong phiên.
      if (blockedMemberIds.has(memberId)) {
        toast.warning(
          "Học viên đã thuộc một nhóm khác trong phiên phân nhóm này.",
          { duration: 2500 },
        );
        return;
      }
      const maxMembers = targetTeam.effectiveMaxMembers ?? session?.maxMembers ?? 0;
      if (maxMembers > 0 && targetTeam.memberIds.length >= maxMembers) {
        toast.warning(
          `Nhóm "${targetTeam.teamName || "chưa đặt tên"}" đã đủ ${maxMembers} thành viên. Bỏ chọn một học viên trước khi thêm người khác.`,
          { duration: 2500 },
        );
        return;
      }
    }
    setDraftTeams((current) => current.map((team) => {
      if (team.localId !== teamId) return team;
      return {
        ...team,
        memberIds: checked
          ? [...team.memberIds, memberId]
          : team.memberIds.filter((id) => id !== memberId),
        leaderMemberId: !checked && team.leaderMemberId === memberId ? null : team.leaderMemberId,
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
      leaderMemberId: team.leaderMemberId ?? null,
      memberRoles: Object.fromEntries(
        (team.members ?? []).map((member) => [member.memberId, member.role ?? "DEV"]),
      ),
      effectiveMaxMembers: team.maxMembers ?? session?.maxMembers,
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

  const nameForMember = (memberId: number) => {
    const member = memberById.get(memberId);
    if (!member) return `Học viên #${memberId}`;
    return member.userCode ? `${member.fullName} (${member.userCode})` : member.fullName;
  };

  const hasUnsavedDrafts = draftTeams.length > 0;

  return (
    <MainLayout pathName={{ "team-allocation": "Project Team Allocation" }}>
      <div className="mx-auto flex min-h-full w-full max-w-7xl flex-1 flex-col gap-2 pb-1">
        {!hasPermission("PEO_TEAM_ALLOCATE") &&
          !hasPermission("PRJ_WORKSPACE_MANAGE") && (
          <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Tài khoản hiện tại không có quyền phân nhóm dự án.
          </div>
        )}

        {teamsQuery.isError && session && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm">
            <span className="text-destructive">
              Không tải được phiên #{session.id}. Kiểm tra class ID/session ID và quyền truy cập.
            </span>
            <Button variant="outline" size="sm" onClick={() => void teamsQuery.refetch()}>
              <RefreshCw className="size-3.5" />
              Thử lại
            </Button>
          </div>
        )}

        {session && session.status !== "OPEN" && (
          <p className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <span>
              Phiên đã {session.status === "PUBLISHED" ? "công bố" : "đóng"} nên không thể thay đổi sức chứa.
              Dùng <strong className="font-medium text-foreground">Master project assignment</strong> để phân
              công dự án cho nhóm đủ điều kiện; nhóm phải hoàn tất hoặc hủy dự án cũ trước khi nhận dự án mới.
            </span>
          </p>
        )}

        {!session && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-muted">
                <CalendarDays className="size-6 text-muted-foreground" />
              </span>
              <div className="space-y-1">
                <p className="font-medium">Chưa chọn phiên phân nhóm</p>
                <p className="mx-auto max-w-md text-sm text-muted-foreground">
                  Hãy tạo hoặc chọn một phiên phân nhóm ở trang lớp học, sau đó bấm
                  “Allocate Teams” để bắt đầu.
                </p>
              </div>
              <Button
                onClick={() => navigate(`/team-allocation/classes/${classId}`)}
                className="gap-2"
              >
                <ArrowLeft className="size-4" />
                Quay lại phiên phân nhóm
              </Button>
            </CardContent>
          </Card>
        )}

        {session && (
          <>
            <div className="sticky bottom-0 z-30 order-last mt-auto">
            <div className="flex items-center justify-between gap-2 rounded-xl border bg-background/95 p-1.5 shadow-lg backdrop-blur">
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/team-allocation/classes/${classId}`)}
                  className="gap-2 bg-background transition-colors hover:border-primary/40"
                >
                  <ArrowLeft className="size-4" />
                  Quay lại phiên phân nhóm
                </Button>
              <div className="flex gap-1" role="tablist" aria-label="Quy trình phân nhóm">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeWorkspace === "build"}
                  onClick={() => setActiveWorkspace("build")}
                  className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    activeWorkspace === "build"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
                  }`}
                >
                  <span className={`flex size-5 items-center justify-center rounded-full text-[11px] font-bold ${
                    activeWorkspace === "build" ? "bg-primary text-primary-foreground" : "bg-muted-foreground/15"
                  }`}>
                    1
                  </span>
                  <UsersRound className="size-4" />
                  Allocate Teams
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                    {draftTeams.length}
                  </span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeWorkspace === "review"}
                  onClick={() => setActiveWorkspace("review")}
                  className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    activeWorkspace === "review"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
                  }`}
                >
                  <span className={`flex size-5 items-center justify-center rounded-full text-[11px] font-bold ${
                    activeWorkspace === "review" ? "bg-primary text-primary-foreground" : "bg-muted-foreground/15"
                  }`}>
                    2
                  </span>
                  <ClipboardList className="size-4" />
                  Set up Teams
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                    {savedTeams.length}
                  </span>
                  {publishableTeams.length > 0 && (
                    <span
                      className="size-1.5 animate-pulse rounded-full bg-emerald-500"
                      aria-label="Có nhóm chờ publish"
                    />
                  )}
                </button>
              </div>
              </div>
              <div className="flex min-w-0 flex-1 items-center justify-end gap-2 px-1">
                <p aria-live="polite" className="hidden min-w-0 flex-1 truncate text-right text-xs text-muted-foreground xl:block">
                  {activeWorkspace === "build"
                    ? "Tạo nhóm và phân bổ học viên vào từng nhóm."
                    : "Gán đề bài dự án, vai trò thành viên và kiểm tra điều kiện công bố."}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setHistoryDialogOpen(true)}
                  className="shrink-0 gap-2 bg-background transition-colors hover:border-primary/40"
                >
                  <History className="size-4" />
                  Lịch sử thành viên / Vai trò
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Button>
                {activeWorkspace === "build" && (
                  <WithHint
                    hint={
                      !hasPermission("PEO_TEAM_ALLOCATE")
                        ? "Bạn không có quyền tạo nhóm cho lớp này."
                        : session.status !== "OPEN"
                          ? "Phiên không ở trạng thái mở nên không thể lưu nhóm."
                          : draftTeams.length === 0
                            ? "Chưa có nhóm nháp nào để lưu."
                            : null
                    }
                  >
                    <Button
                      onClick={saveDraft}
                      className="shrink-0 gap-1.5 shadow-lg shadow-primary/20 transition-transform active:scale-[0.99]"
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
                  </WithHint>
                )}
              </div>
            </div>
            </div>

            <div className={activeWorkspace === "review" ? "flex min-h-0 flex-1 flex-col" : "grid items-start gap-6"}>
              <div className={activeWorkspace === "build" ? "block" : "hidden"}>
              <Card className={`gap-3 py-4 ${saveFailure?.status === 422 ? "border-destructive" : ""}`}>
                <CardHeader className="flex flex-col gap-2 px-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <UsersRound className="size-4 text-primary" />
                        Tạo nhóm & phân bổ học viên
                      </CardTitle>
                      {hasUnsavedDrafts ? (
                        <>
                          <Badge
                            variant="outline"
                            className="border-amber-500/40 bg-amber-500/10 text-[11px] text-amber-700 dark:text-amber-300"
                          >
                            Chưa lưu
                          </Badge>
                          <span className="text-[11px] font-normal text-muted-foreground">
                            {draftTeams.length} nhóm · {draftMemberIds.size} học viên đang chờ lưu.
                            Nhóm vượt giới hạn sẽ được backend kiểm tra.
                          </span>
                        </>
                      ) : (
                        <span className="flex items-center gap-1.5 text-[11px] font-normal text-muted-foreground">
                          <Info className="size-3.5 shrink-0" />
                          Nhóm vượt giới hạn sẽ được backend kiểm tra; form không bị xóa nếu phát sinh lỗi.
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-2">
                    <Button
                      size="sm"
                      onClick={() => void addDraftTeamWithCapacity()}
                      disabled={
                        !hasPermission("PEO_TEAM_ALLOCATE") ||
                        session.status !== "OPEN" ||
                        saveDraftMutation.isPending
                      }
                    >
                      <Plus className="size-4" />
                      Thêm nhóm
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => autoPreviewMutation.mutate()}
                      disabled={
                        !hasPermission("PEO_TEAM_ALLOCATE") || session.status !== "OPEN" ||
                        draftTeams.length > 0 ||
                        autoAvailableCount === 0 ||
                        autoPreviewMutation.isPending || autoConfirmMutation.isPending
                      }
                    >
                      {autoPreviewMutation.isPending
                        ? <LoaderCircle className="size-4 animate-spin" />
                        : <Shuffle className="size-4" />}
                      Xem trước chia tự động
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setMentorForAllSelection(
                          rememberedMentorId === null ? "" : String(rememberedMentorId),
                        );
                        setMentorForAllDialogOpen(true);
                      }}
                      disabled={
                        !hasPermission("PEO_TEAM_ALLOCATE") ||
                        session.status !== "OPEN" ||
                        draftTeams.length === 0 ||
                        mentorsQuery.isLoading ||
                        saveDraftMutation.isPending
                      }
                    >
                      <Users className="size-4" />
                      Chọn Mentor cho tất cả nhóm
                    </Button>
                    {session.status === "OPEN" && (
                      <p className="w-full text-[11px] text-muted-foreground" aria-live="polite">
                        {autoAvailableCount === null
                          ? "Đang tính số học viên có thể chia trong phiên này…"
                          : `Còn ${autoAvailableCount} học viên hợp lệ chưa có nhóm Draft/Active trong phiên này.`}
                      </p>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 px-4 pb-4">
                  {autoPreviewError && (
                    <div role="alert" className="rounded-lg border border-destructive/30 p-2.5 text-xs text-destructive">
                      {autoPreviewError}
                    </div>
                  )}
                  {autoPreview && (
                    <section className="space-y-2 rounded-xl border bg-muted/20 p-3" aria-label="Bản xem trước chia nhóm tự động">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-semibold">Xem trước chia tự động</h3>
                          <p className="text-xs text-muted-foreground">
                            {autoPreview.eligibleCount} học viên · {autoPreview.teams.length} nhóm ·
                            sĩ số mỗi nhóm {autoPreview.minMembers}–{autoPreview.standardMax} ·
                            {describeAutoTeamSizes(autoPreview)}.
                            Các nhóm Draft đã lưu được giữ nguyên.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" variant="outline"
                            disabled={autoPreviewMutation.isPending || autoConfirmMutation.isPending}
                            onClick={() => autoPreviewMutation.mutate()}>
                            <Shuffle className="size-4" /> Xáo trộn lại
                          </Button>
                          <Button type="button" size="sm" variant="outline"
                            disabled={autoConfirmMutation.isPending}
                            onClick={() => { setAutoPreview(null); setAutoPreviewError(""); setAutoConfirmKey(null); }}>
                            Hủy xem trước
                          </Button>
                          <Button type="button" size="sm"
                            disabled={!autoConfirmKey || autoConfirmMutation.isPending || autoPreviewMutation.isPending ||
                              draftTeams.length > 0}
                            onClick={() => autoConfirmMutation.mutate()}>
                            {autoConfirmMutation.isPending && <LoaderCircle className="size-4 animate-spin" />}
                            Xác nhận tạo nhóm Draft
                          </Button>
                        </div>
                      </div>
                      <div className="grid items-start gap-2 sm:grid-cols-2">
                        {autoPreview.teams.map((team, index) => {
                          const expanded = expandedPreviewTeams.has(index);
                          const panelId = `auto-preview-team-${sessionId}-${index}`;
                          return (
                            <article key={`${index}-${team.teamName}`}
                              className="min-w-0 self-start overflow-hidden rounded-lg border bg-background">
                              <button type="button" aria-expanded={expanded} aria-controls={panelId}
                                className="flex w-full min-w-0 items-center gap-2 px-2.5 py-2 text-left text-xs font-medium hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                                onClick={() => setExpandedPreviewTeams((current) => {
                                  const next = new Set(current);
                                  if (next.has(index)) next.delete(index);
                                  else next.add(index);
                                  return next;
                                })}>
                                <ChevronDown className={`size-4 shrink-0 transition-transform ${expanded ? "" : "-rotate-90"}`} />
                                <span className="min-w-0 flex-1 truncate">{team.teamName} · {team.members.length} học viên</span>
                                {index === autoPreview.teams.length - 1 &&
                                  team.members.length < autoPreview.standardMax && (
                                  <Badge variant="secondary" className="shrink-0">Nhóm phần dư</Badge>
                                )}
                              </button>
                              {expanded && (
                                <ul id={panelId} className="space-y-1 border-t px-3 py-2 text-xs text-muted-foreground">
                                  {team.members.map((member) => (
                                    <li key={member.memberId} className="break-words">
                                      • {member.fullName}{member.userCode ? ` (${member.userCode})` : ""}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  )}
                  {saveFailure && (
                    <div role="alert" className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs">
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
                    <div role="alert" className="rounded-xl border border-destructive/30 p-3 text-xs">
                      <p className="text-destructive">Không tải được danh sách học viên.</p>
                      <Button className="mt-2" variant="outline" size="sm" onClick={() => void membersQuery.refetch()}>
                        Thử tải lại
                      </Button>
                    </div>
                  ) : (
                    <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(260px,1fr)]">
                      <div className="order-2 flex min-w-0 flex-col gap-3 lg:col-start-2 lg:row-start-1">
                      {memberPickerTeam ? (
                        <section
                          className="space-y-2 rounded-xl border border-primary/30 bg-background p-3 shadow-sm"
                          aria-label="Chỉnh sửa nhóm đang chọn"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <h3 className="text-xs font-semibold">Chỉnh sửa nhóm đang chọn</h3>
                            </div>
                            <span className={`flex items-center gap-1.5 text-xs ${
                              memberPickerTeam.memberIds.length >
                              (memberPickerTeam.effectiveMaxMembers ?? session.maxMembers)
                                ? "font-semibold text-destructive"
                                : "text-muted-foreground"
                            }`}>
                              <Users className="size-4" />
                              {memberPickerTeam.memberIds.length}/
                              {memberPickerTeam.effectiveMaxMembers ?? session.maxMembers} thành viên
                            </span>
                          </div>
                          <div className="grid gap-2">
                            <label className="block space-y-1 text-xs font-medium">
                              Tên nhóm
                              <Input
                                value={memberPickerTeam.teamName}
                                maxLength={255}
                                onChange={(event) => {
                                  const localId = memberPickerTeam.localId;
                                  setDraftTeams((current) => current.map((item) =>
                                    item.localId === localId
                                      ? { ...item, teamName: event.target.value }
                                      : item,
                                  ));
                                  setSaveFailure(null);
                                }}
                              />
                            </label>
                            <label className="block space-y-1 text-xs font-medium">
                              Mentor phụ trách
                              <select
                                className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                                value={memberPickerTeam.assignedMentorId ?? ""}
                                disabled={mentorsQuery.isLoading}
                                onChange={(event) => {
                                  const mentorId = event.target.value
                                    ? Number(event.target.value)
                                    : null;
                                  if (mentorId !== null) setRememberedMentorId(mentorId);
                                  const currentIndex = draftTeams.findIndex(
                                    (item) => item.localId === memberPickerTeam.localId,
                                  );
                                  setDraftTeams((current) => current.map((item, index) =>
                                    item.localId === memberPickerTeam.localId
                                      ? { ...item, assignedMentorId: mentorId }
                                      : index > currentIndex &&
                                          mentorId !== null &&
                                          item.assignedMentorId === null
                                        ? { ...item, assignedMentorId: mentorId }
                                        : item,
                                  ));
                                }}
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
                            {memberPickerTeam.savedTeamId === undefined && (
                              <label className="block space-y-1 text-xs font-medium">
                                Leader
                                <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                                  value={memberPickerTeam.leaderMemberId ?? ""}
                                  disabled={memberPickerTeam.memberIds.length === 0 || saveDraftMutation.isPending}
                                  onChange={(event) => {
                                    const leaderMemberId = event.target.value ? Number(event.target.value) : null;
                                    setDraftTeams((current) => current.map((team) =>
                                      team.localId === memberPickerTeam.localId ? { ...team, leaderMemberId } : team,
                                    ));
                                  }}>
                                  <option value="">Chọn Leader khi phân vai</option>
                                  {memberPickerTeam.memberIds.map((memberId) => (
                                    <option key={memberId} value={memberId}>{nameForMember(memberId)}</option>
                                  ))}
                                </select>
                              </label>
                            )}
                          </div>
                          {memberPickerTeam.memberIds.length >
                            (memberPickerTeam.effectiveMaxMembers ?? session.maxMembers) && (
                            <p className="text-xs text-destructive">
                              Vượt sức chứa tối đa {memberPickerTeam.effectiveMaxMembers ?? session.maxMembers}; danh sách chọn vẫn được giữ để bạn điều chỉnh.
                            </p>
                          )}
                          <div className="flex flex-wrap gap-2">
                            {memberPickerTeam.savedTeamId === undefined ? (
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                aria-label={`Xóa nhóm nháp ${memberPickerTeam.teamName || ""}`}
                                onClick={() => {
                                  const removedId = memberPickerTeam.localId;
                                  const remaining = draftTeams.filter(
                                    (item) => item.localId !== removedId,
                                  );
                                  setDraftTeams(remaining);
                                  setMemberPickerTeamId(remaining[0]?.localId ?? null);
                                  setSaveFailure(null);
                                }}
                              >
                                <Trash2 className="size-4" />
                                Xóa nhóm
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" onClick={cancelDraftEditing}>
                                Hủy chỉnh sửa
                              </Button>
                            )}
                          </div>
                        </section>
                      ) : (
                        <div className="rounded-xl border border-dashed px-3 py-2 text-[11px] text-muted-foreground">
                          Chọn một nhóm nháp ở khung bên phải để chỉnh sửa tên nhóm, Mentor phụ trách và học viên.
                        </div>
                      )}

                      <div className="min-w-0 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold">Nhóm nháp</h3>
                          <Badge variant="secondary" className="tabular-nums">{draftTeams.length}</Badge>
                        </div>
                        {draftTeams.length === 0 ? (
                          <div className="space-y-2 rounded-lg border border-dashed px-2.5 py-4 text-center">
                            <p className="text-xs text-muted-foreground">Chưa có nhóm nháp.</p>
                            <Button
                              type="button"
                              size="sm"
                              className="w-full gap-1.5"
                              onClick={() => void addDraftTeamWithCapacity()}
                              disabled={
                                !hasPermission("PEO_TEAM_ALLOCATE") ||
                                session.status !== "OPEN"
                              }
                            >
                              <Plus className="size-4" />
                              Thêm nhóm
                            </Button>
                          </div>
                        ) : (
                          <ul
                            className="space-y-2 overflow-y-auto pr-1"
                            style={{ maxHeight: "min(16rem, calc(100vh - 38rem))" }}
                          >
                            {draftTeams.map((team, teamIndex) => {
                              const isSelected = memberPickerTeamId === team.localId;
                              return (
                                <li key={team.localId}>
                                  <button
                                    type="button"
                                    aria-pressed={isSelected}
                                    aria-controls="draft-member-picker"
                                    onClick={() => selectDraftTeamForMembers(team)}
                                    title={team.teamName || `Nhóm ${teamIndex + 1}`}
                                    className={`w-full truncate rounded-lg border px-2.5 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                      isSelected
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "bg-background hover:border-primary/40"
                                    }`}
                                  >
                                    {team.teamName || `Nhóm ${teamIndex + 1}`}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                      </div>

                      {memberPickerTeam ? (
                        <div className="order-1 min-w-0 space-y-3 rounded-xl border border-primary/30 bg-muted/20 p-3 lg:col-start-1 lg:row-start-1" id="draft-member-picker">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <h3 className="text-sm font-semibold">
                                Chọn học viên cho {memberPickerTeam.teamName || "nhóm chưa đặt tên"}
                              </h3>
                              <p className="text-xs text-muted-foreground">
                                Đã chọn {memberPickerTeam.memberIds.length}/{memberPickerMaxMembers} học viên.
                                Học viên đã thuộc nhóm khác trong phiên sẽ không chọn được.
                              </p>
                              {memberPickerIsFull && (
                                <p
                                  className="mt-1 flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300"
                                  role="status"
                                  aria-live="polite"
                                >
                                  <CircleAlert className="size-3.5 shrink-0" />
                                  Nhóm đã đủ {memberPickerMaxMembers} thành viên. Bỏ chọn một học viên để thêm người khác.
                                </p>
                              )}
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
                            <div className="space-y-2" aria-busy="true" aria-label="Đang tải học viên">
                              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                                <LoaderCircle className="size-3.5 animate-spin" />
                                Đang tải học viên...
                              </span>
                              {[0, 1, 2, 3].map((row) => (
                                <div
                                  key={row}
                                  className="h-11 animate-pulse rounded-lg border bg-muted/40"
                                  style={{ animationDelay: `${row * 80}ms` }}
                                />
                              ))}
                            </div>
                          ) : filteredMembers.length === 0 ? (
                            <div className="py-8 text-center">
                              <Users className="mx-auto size-7 text-muted-foreground/70" />
                              <p className="mt-2 text-sm text-muted-foreground">
                                {members.length === 0
                                  ? "Không còn học viên ACTIVE chưa được xếp vào nhóm ACTIVE trong phiên này."
                                  : "Không tìm thấy học viên phù hợp."}
                              </p>
                              {members.length > 0 && memberSearch.trim() && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="mt-2"
                                  onClick={() => setMemberSearch("")}
                                >
                                  <X className="size-3.5" />
                                  Xóa từ khóa tìm kiếm
                                </Button>
                              )}
                            </div>
                          ) : (
                            <div
                              className="space-y-2 overflow-y-auto pr-1"
                              style={{ maxHeight: "min(21rem, calc(100vh - 32rem))" }}
                            >
                              {filteredMembers.map((member) => {
                                const selected = memberPickerTeam.memberIds.includes(member.memberId);
                                const assignedToOtherTeam = !selected &&
                                  (blockedMemberIds.has(member.memberId) ||
                                    (memberPickerTeam.savedTeamId !== undefined &&
                                      (rosterQuery.data ?? []).some(
                                        (rosterMember) =>
                                          rosterMember.memberId === member.memberId &&
                                          rosterMember.assignedToActiveTeam,
                                      )));
                                return (
                                  <MemberOption
                                    key={`${memberPickerTeam.localId}-${member.memberId}`}
                                    member={member}
                                    checked={selected}
                                    duplicateDraft={assignedToOtherTeam}
                                    highlighted={saveFailure?.memberId === member.memberId}
                                    disabled={assignedToOtherTeam}
                                    onCheckedChange={(checked) =>
                                      toggleMember(memberPickerTeam.localId, member.memberId, checked)
                                    }
                                  />
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="order-1 h-full rounded-xl border border-dashed px-6 py-10 text-center lg:col-start-1 lg:row-start-1">
                          <Search className="mx-auto size-7 text-muted-foreground/70" />
                          <p className="mt-2 text-sm font-medium">Chưa chọn nhóm</p>
                          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
                            Bấm vào một nhóm ở khung bên phải để mở danh sách học viên tại đây.
                          </p>
                        </div>
                      )}

                    </div>
                  )}
                </CardContent>
              </Card>
              </div>

              <div className={activeWorkspace === "review" ? "flex min-h-0 flex-1 flex-col gap-4" : "hidden"}>
              {sessionId !== null &&
                (hasPermission("PEO_TEAM_ALLOCATE") || hasPermission("PRJ_WORKSPACE_MANAGE")) && (
                <div className="shrink-0">
                  <ProjectAssignmentPanel key={sessionId} classId={classId} sessionId={sessionId} />
                </div>
              )}
              <Card className="flex min-h-0 flex-1 flex-col">
                <CardHeader className="shrink-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1.5">
                      <CardTitle className="flex items-center gap-2">
                        <LockKeyhole className="size-5 text-primary" />
                        Nhóm đã lưu
                        <Badge variant="secondary" className="tabular-nums">{savedTeams.length}</Badge>
                      </CardTitle>
                      <CardDescription>
                        Các nhóm DRAFT chưa giữ chỗ học viên. Mở một nhóm để gán đề bài dự án,
                        vai trò thành viên và Mentor; công bố chính thức sẽ kiểm tra lại trạng thái thành viên.
                      </CardDescription>
                    </div>
                    {publishableTeams.length > 0 && (
                      <Badge
                        variant="outline"
                        className="gap-1.5 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      >
                        <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                        {publishableTeams.length} nhóm chờ publish
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto">
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
                                      {member.fullName}{member.userCode ? ` · ${member.userCode}` : ` (#${member.memberId})`}
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
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3 gap-1.5"
                        onClick={() => setActiveWorkspace("build")}
                      >
                        <ArrowLeft className="size-3.5" />
                        Sang bước tạo nhóm
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {savedTeams.map((team) => (
                        <SavedTeamCard
                          classId={classId!}
                          sessionId={sessionId!}
                          key={team.teamId}
                          team={team}
                          openInitially={allocationLink.teamId === team.teamId}
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
                          leaderPending={assignLeaderMutation.isPending}
                          onAssignLeader={(memberId, memberName) => {
                            if (team.leaderMemberId && team.leaderMemberId !== memberId) {
                              setLeaderReplacement({ team, memberId, memberName,
                                oldName: nameForMember(team.leaderMemberId) });
                            } else {
                              assignLeaderMutation.mutate({ team, memberId, confirmReplacement: false });
                            }
                          }}
                          canAssignTemplate={
                            hasPermission("PEO_TEAM_ALLOCATE") ||
                            hasPermission("PRJ_WORKSPACE_MANAGE")
                          }
                        />
                      ))}
                    </div>
                  )}
                  {savedTeams.length > 0 && (
                    <WithHint
                      className="flex w-full cursor-not-allowed"
                      hint={
                        !hasPermission("PEO_TEAM_ALLOCATE")
                          ? "Bạn không có quyền kiểm tra điều kiện công bố."
                          : session.status !== "OPEN"
                            ? "Phiên không ở trạng thái mở."
                            : draftTeams.length > 0
                              ? "Hãy lưu hoặc hủy nhóm nháp trước khi kiểm tra."
                              : null
                      }
                    >
                      <button
                        type="button"
                        className="flex w-full flex-col items-center justify-center gap-0.5 rounded-xl border bg-muted/20 px-4 py-3 text-sm font-medium transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={
                          readinessMutation.isPending ||
                          !hasPermission("PEO_TEAM_ALLOCATE") ||
                          session.status !== "OPEN" ||
                          draftTeams.length > 0
                        }
                        onClick={checkPublishReadiness}
                      >
                        <span className="flex items-center gap-2">
                          {readinessMutation.isPending
                            ? <LoaderCircle className="size-4 animate-spin" />
                            : <ListChecks className="size-4" />}
                          Kiểm tra điều kiện công bố
                        </span>
                        {missingSetupNote && (
                          <span className="text-[11px] font-normal text-muted-foreground">
                            ({missingSetupNote})
                          </span>
                        )}
                      </button>
                    </WithHint>
                  )}
                </CardContent>
              </Card>
              </div>
            </div>
          </>
        )}
      </div>
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="size-5 text-primary" />
              Lịch sử thành viên / Vai trò
            </DialogTitle>
            <DialogDescription>
              Nhật ký chỉ được thêm mới, sắp xếp từ mới nhất đến cũ nhất.
            </DialogDescription>
          </DialogHeader>
          <TeamMemberHistoryPanel
            classId={classId}
            cohortId={selectedClass?.cohortId ?? null}
            className={selectedClass?.name ?? `Lớp #${classId}`}
            embedded
          />
        </DialogContent>
      </Dialog>
      <Dialog open={mentorForAllDialogOpen} onOpenChange={setMentorForAllDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chọn Mentor cho tất cả nhóm</DialogTitle>
            <DialogDescription>
              Mentor được chọn sẽ áp dụng cho toàn bộ {draftTeams.length} nhóm nháp hiện tại.
            </DialogDescription>
          </DialogHeader>
          <label className="block space-y-1.5 text-sm font-medium">
            Mentor phụ trách
            <select
              aria-label="Mentor cho tất cả nhóm nháp"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={mentorForAllSelection}
              onChange={(event) => setMentorForAllSelection(event.target.value)}
            >
              <option value="">Bỏ chọn Mentor</option>
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
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMentorForAllDialogOpen(false)}
            >
              Hủy
            </Button>
            <Button
              onClick={() => applyMentorToAllDraftTeams(
                mentorForAllSelection ? Number(mentorForAllSelection) : null,
              )}
              disabled={draftTeams.length === 0}
            >
              <Users className="size-4" />
              Áp dụng cho tất cả nhóm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={leaderReplacement !== null} onOpenChange={(open) => {
        if (!open && !assignLeaderMutation.isPending) setLeaderReplacement(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đổi Leader của nhóm?</DialogTitle>
            <DialogDescription>
              Nhóm đã có Leader ({leaderReplacement?.oldName}). Bạn có muốn đổi sang {leaderReplacement?.memberName} không?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={assignLeaderMutation.isPending}
              onClick={() => setLeaderReplacement(null)}>Hủy</Button>
            <Button disabled={assignLeaderMutation.isPending} onClick={() => {
              if (leaderReplacement) assignLeaderMutation.mutate({
                team: leaderReplacement.team, memberId: leaderReplacement.memberId,
                confirmReplacement: true,
              });
            }}>Xác nhận đổi Leader</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={readinessDialogOpen}
        onOpenChange={setReadinessDialogOpen}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Kiểm tra điều kiện công bố</DialogTitle>
            <DialogDescription>
              Kết quả kiểm tra toàn bộ học viên, nhóm, đề bài và định suất vai trò.
            </DialogDescription>
          </DialogHeader>
          {readinessMutation.isPending ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Đang kiểm tra điều kiện công bố...
            </div>
          ) : readinessError ? (
            <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {readinessError.message}
            </div>
          ) : readiness ? (
            <>
              <ReadinessReport report={readiness} />
              {readiness.readyToPublish && (
                <DialogFooter>
                  <Button
                    disabled={
                      publishSessionMutation.isPending ||
                      !hasPermission("PEO_TEAM_ALLOCATE") ||
                      session?.status !== "OPEN" ||
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
                </DialogFooter>
              )}
            </>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Chưa có kết quả kiểm tra.
            </p>
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
    </MainLayout>
  );
}

/** Wraps a disabled control so its blocking reason stays discoverable. */
function WithHint({
  hint,
  className = "inline-flex cursor-not-allowed",
  children,
}: {
  hint?: string | null;
  className?: string;
  children: ReactNode;
}) {
  if (!hint) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className={className}>
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  );
}

function TeamMemberHistoryPanel({
  classId,
  cohortId,
  className,
  embedded = false,
}: {
  classId: number;
  cohortId: number | null;
  className: string;
  embedded?: boolean;
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
    <Card className={embedded ? "border-0 shadow-none" : undefined}>
      {!embedded && (
        <CardHeader>
          <CardTitle>Lịch sử thành viên / Vai trò</CardTitle>
          <CardDescription>
            Nhật ký chỉ được thêm mới, sắp xếp từ mới nhất đến cũ nhất.
            Phạm vi hiện tại: {scope === "cohort" ? `Cohort #${cohortId}` : className}.
          </CardDescription>
        </CardHeader>
      )}
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
        <span className="text-xs text-amber-700 dark:text-amber-300">Đã ở nhóm khác</span>
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
}) {
  const [selectedToAdd, setSelectedToAdd] = useState("");
  const [selectedMentor, setSelectedMentor] = useState(
    team.assignedMentorId === null ? "" : String(team.assignedMentorId),
  );
  const [detailsOpen, setDetailsOpen] = useState(openInitially);
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
  const isDraft = team.status === "DRAFT";
  const isActive = team.status === "ACTIVE";
  const canChooseLeader = canManageRoles && (isDraft || (isActive && team.leaderMemberId == null));
  const memberEditPending = leaderPending || rolesPending || savePending || membershipPending || (isDraft && pending);
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
  const roleCounts = new Map<TeamMemberRole, number>();
  Object.values(memberRoles).forEach((roles) => {
    roles.forEach((role) => {
      roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1);
    });
  });
  const mentorValue = team.assignedMentorId === null
    ? ""
    : String(team.assignedMentorId);
  const mentorChanged = selectedMentor !== mentorValue;
  const memberRolesChanged = members.some((member) => {
    const savedRoles = memberRolesOf(member);
    const nextRoles = memberRoles[member.memberId] ?? savedRoles;
    return nextRoles.length !== savedRoles.length ||
      nextRoles.some((role) => !savedRoles.includes(role));
  });
  const rolesPayload = members.map((member) => ({
    memberId: member.memberId,
    roles: memberRoles[member.memberId] ?? member.roles,
  }));
  const validRoles = rolesPayload.every(({ roles }) => team.allowMultiRole ? roles.length > 0 : roles.length === 1);
  const hasPendingChanges = mentorChanged || memberRolesChanged;
  const updateMemberRoles = (
    memberId: number,
    roles: TeamMemberRole[],
  ) => {
    setMemberRoles((current) => ({
      ...current,
      [memberId]: roles,
    }));
    onRoleChange(team.teamId, memberId);
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
    setMemberRoles(Object.fromEntries(
      (team.members ?? []).map((member) => [
        member.memberId,
        memberRolesOf(member),
      ]),
    ));
  }, [team.members]);
  const invalidRoleMemberIds = new Set([
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
  const initialsOf = (fullName: string) => {
    const parts = fullName.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "";
    if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "";
    return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
  };
  return (
    <>
      <article className="rounded-xl border bg-background p-4">
        <div className="grid items-stretch gap-4 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.3fr)]">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Badge
                  variant="outline"
                  className="shrink-0 border-muted-foreground/20 bg-muted/60 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {team.status}
                </Badge>
                <h3 className="truncate text-base font-semibold">{team.teamName}</h3>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {team.memberIds.length} thành viên
              </span>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Đề bài dự án:</p>
              {team.projectTemplateId ? (
                <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <Monitor className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">
                    {team.projectTemplateName ?? `#${team.projectTemplateId}`}
                  </span>
                </p>
              ) : team.status === "DRAFT" ? (
                <Link
                  to={"/team-allocation/classes/" + classId + "/assign?sessionId=" + sessionId
                    + "&teamId=" + team.teamId}
                  className="flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-500/20 dark:text-amber-300"
                >
                  <TriangleAlert className="size-3.5 shrink-0" />
                  <span className="min-w-0 truncate">Chưa gán đề bài · Nhấn để gán ngay</span>
                </Link>
              ) : (
                <p className="text-sm text-muted-foreground">Chưa gán đề bài</p>
              )}
            </div>

            <div className="mt-auto space-y-1.5">
              <p className="text-xs text-muted-foreground">Mentor phụ trách</p>
              {mentorName ? (
                <div className="flex min-w-0 items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                    {mentorInitials || "?"}
                  </span>
                  <span className="min-w-0 truncate text-sm font-medium">{mentorName}</span>
                  <span className="ml-auto shrink-0 rounded-full border bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
                    Giảng viên
                  </span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Chưa gán Mentor</p>
              )}
            </div>
          </div>

          <div className="min-w-0 border-t pt-3 md:border-l md:border-t-0 md:pl-4 md:pt-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Danh sách thành viên ({members.length})
              </p>
              <button
                type="button"
                aria-label={`Chỉnh sửa ${team.teamName}`}
                onClick={() => setDetailsOpen(true)}
                className="inline-flex shrink-0 items-center gap-0.5 rounded-sm text-xs font-medium text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Chỉnh sửa
                <ChevronRight className="size-3.5" />
              </button>
            </div>
            {members.length === 0 ? (
              <p className="mt-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Nhóm chưa có thành viên.
              </p>
            ) : (
              <ul className="mt-2 divide-y">
                {members.map((member) => {
                  const leader = team.leaderMemberId === member.memberId;
                  return (
                    <li
                      key={member.memberId}
                      className="flex min-w-0 items-center justify-between gap-3 py-2 text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold uppercase text-muted-foreground">
                          {initialsOf(member.fullName)}
                        </span>
                        <span className="min-w-0 truncate">
                          <span className="font-medium">{member.fullName}</span>
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({member.userCode ?? `#${member.memberId}`})
                          </span>
                        </span>
                      </span>
                      {leader ? (
                        <Badge
                          variant="outline"
                          className="shrink-0 border-amber-500/40 bg-amber-500/10 text-[10px] font-medium text-amber-700 dark:text-amber-300"
                        >
                          Trưởng nhóm
                        </Badge>
                      ) : (
                        <span className="shrink-0 text-xs text-muted-foreground">Thành viên</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </article>
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-h-[85vh] w-[calc(100vw-2rem)] min-w-0 overflow-x-hidden overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <DialogTitle className="text-2xl font-bold">{team.teamName}</DialogTitle>
              <DialogDescription className="text-sm">
                {team.memberIds.length} thành viên
              </DialogDescription>
              <Badge
                variant={team.status === "DRAFT" ? "secondary" : "default"}
                className="font-semibold"
              >
                {team.status}
              </Badge>
            </div>
          </DialogHeader>
          <div className="space-y-3 pb-4">
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
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="text-sm font-semibold">Đề bài dự án</p>
                  <p className="text-xs text-muted-foreground">
                    Sĩ số hiện tại: {team.memberCount ?? team.memberIds.length} thành viên
                    {team.minMembers != null && team.maxMembers != null
                      ? ` · Đề bài yêu cầu ${team.minMembers}–${team.maxMembers} thành viên`
                      : ""}
                  </p>
                </div>
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
              {canAssignTemplate && (isDraft || isActive) && <Button size="sm" variant="outline" asChild>
                <Link to={"/team-allocation/classes/" + classId + "/assign?sessionId=" + sessionId
                  + "&teamId=" + team.teamId}>
                  Gán Master Project
                </Link>
              </Button>}
            </div>
            {team.projectTemplateId == null && (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Gán đề bài dự án để áp dụng định suất và quy tắc kiêm nhiệm vai trò.
              </p>
            )}
            {team.projectTemplateId != null && (
            <section className="min-w-0 space-y-2">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">Danh sách thành viên ({members.length})</p>
                {canManageRoles && roleQuotas.length > 0 && (
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      Định suất vai trò của đề bài
                    </span>
                    <Badge variant={allowMultiRole ? "secondary" : "outline"}>
                      {allowMultiRole ? "Cho phép kiêm nhiệm" : "Không kiêm nhiệm"}
                    </Badge>
                    {roleQuotas.map((quota) => {
                      const actual = roleCounts.get(quota.role) ?? 0;
                      const maximum = quota.max >= UNBOUNDED_ROLE_QUOTA
                        ? quota.min
                        : quota.max;
                      const met = actual >= quota.min &&
                        (quota.max >= UNBOUNDED_ROLE_QUOTA || actual <= quota.max);
                      return (
                        <Badge
                          key={quota.role}
                          variant="outline"
                          className={met
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "border-destructive bg-destructive/10 text-destructive"}
                        >
                          {quota.role} {actual}/{maximum}
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>
              {members.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nhóm chưa có thành viên.</p>
              ) : (
                <ul className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto rounded-lg border p-2">
                  {members.map((member) => {
                    const selectedRoles = memberRoles[member.memberId]
                      ?? memberRolesOf(member);
                    const leader = team.leaderMemberId === member.memberId;
                    return (
                    <li key={member.memberId}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            tabIndex={0}
                            role="group"
                            aria-label={`Thành viên ${member.fullName}`}
                            className="flex min-w-0 items-center justify-between gap-3 rounded-md border bg-background px-3 py-2.5 text-sm transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="min-w-0 truncate font-medium">{member.fullName}{member.userCode ? ` · ${member.userCode}` : ""}</span>
                        {leader && <Badge className="shrink-0">Leader</Badge>}
                      </span>
                      <span className="flex flex-wrap items-center gap-2">
                        {canChooseLeader && !leader && (
                          <Button type="button" size="sm" variant="outline" disabled={memberEditPending}
                            onClick={() => onAssignLeader(member.memberId, member.fullName)}>
                            <ShieldCheck className="size-4" /> Chỉ định Leader
                          </Button>
                        )}
                        {canManageRoles ? (
                          <span className={invalidRoleMemberIds.has(member.memberId) ? "rounded-md ring-1 ring-destructive" : undefined}>
                            <TeamMemberRoleInput label={`Vai trò của ${member.fullName}`} selected={selectedRoles}
                              multiple={allowMultiRole} disabled={memberEditPending} placeholder="Chọn vai trò"
                              onChange={(roles) => updateMemberRoles(member.memberId, roles)} />
                          </span>
                        ) : (
                          <span className="flex flex-wrap gap-1">
                            {selectedRoles.length === 0 ? <Badge variant="outline">Chưa gán</Badge>
                              : selectedRoles.map((role) => <Badge key={role} variant="secondary">{role}</Badge>)}
                          </span>
                        )}
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
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </li>
                    );
                  })}
                </ul>
              )}
            </section>
            )}
            {canManageRoles && members.length > 0 && team.projectTemplateId != null && (
              <div className="space-y-2">
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
                {memberRolesChanged && !validRoles && (
                  <p className="text-xs text-destructive">{allowMultiRole
                    ? "Mỗi thành viên cần ít nhất một vai trò."
                    : "Mỗi thành viên cần đúng một vai trò."}</p>
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
          <DialogFooter className="-mx-6 -mb-6 shrink-0 border-t bg-muted/40 px-6 py-4">
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
                    memberEditPending ||
                    (memberRolesChanged && !validRoles) ||
                    !hasPendingChanges
                  }
                  onClick={() => {
                    onSaveAll({
                      teamId: team.teamId,
                      teamVersion: team.version,
                      mentorId: selectedMentor ? Number(selectedMentor) : null,
                      mentorChanged,
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
            {isActive && canManageRoles && (
              <Button disabled={memberEditPending || !memberRolesChanged || !validRoles}
                onClick={() => onUpdateRoles(team.teamId, team.version, rolesPayload)}>
                {rolesPending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                Lưu vai trò
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** US-12: renders the strict-mode readiness report returned by the backend. */
function ReadinessReport({ report }: { report: AllocationReadiness }) {
  const ready = report.readyToPublish;
  const statistics = [
    {
      label: "Học viên đã vào nhóm",
      value: `${report.assignedStudents}/${report.totalStudents}`,
      icon: <Users className="size-4" />,
    },
    {
      label: "Tổng số nhóm",
      value: report.totalTeams,
      icon: <ClipboardList className="size-4" />,
    },
    {
      label: "Nhóm có đề bài hợp lệ",
      value: `${report.teamsWithTemplate}/${report.totalTeams}`,
      icon: <ListChecks className="size-4" />,
    },
    {
      label: ready ? "Học viên tự do" : "Lỗi điều kiện nhóm",
      value: ready ? report.unassignedStudentCount : report.teamIssues.length,
      icon: <CircleAlert className="size-4" />,
    },
  ];

  return (
    <div
      role={ready ? "status" : "alert"}
      className={`space-y-4 rounded-xl border p-4 ${
        ready
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-destructive/50 bg-destructive/5"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className={`flex items-center gap-2 font-semibold ${
          ready
            ? "text-emerald-700 dark:text-emerald-300"
            : "text-destructive"
        }`}>
          {ready ? <ShieldCheck className="size-5" /> : <CircleAlert className="size-5" />}
          {ready ? "Đủ điều kiện công bố" : "Chưa đủ điều kiện công bố"}
        </p>
        <Badge
          variant="outline"
          className={ready
            ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
            : "border-destructive text-destructive"}
        >
          {ready ? "READY" : "BLOCKED"}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statistics.map((statistic) => (
          <div
            key={statistic.label}
            className="min-w-0 rounded-lg border bg-background/80 p-3"
          >
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {statistic.icon}
              <span className="truncate">{statistic.label}</span>
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {statistic.value}
            </p>
          </div>
        ))}
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
      {!ready && report.teamIssues.length > 0 && (
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
