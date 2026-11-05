import { teamAllocationApi } from "@/api";
import { teamTemplateApi } from "@/api/features/team-template.api";
import { TemplatePickerPanel } from "./TemplatePickerPanel";
import type { TemplateCandidate } from "@/types/features/template-candidate";
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
  ChevronDown,
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
  projectTemplateVersionId?: number;
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
        "Kh├┤ng thß╗â ho├án tß║Ñt y├¬u cß║ºu. Vui l├▓ng thß╗¡ lß║íi.",
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
      : "Kh├┤ng thß╗â ho├án tß║Ñt y├¬u cß║ºu. Vui l├▓ng thß╗¡ lß║íi.",
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
        "Kh├┤ng thß╗â g├ín ─æß╗ü b├ái. Vui l├▓ng thß╗¡ lß║íi.",
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
      : "Kh├┤ng thß╗â g├ín ─æß╗ü b├ái. Vui l├▓ng thß╗¡ lß║íi.",
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
  const initialSession = useMemo(() => {
    const saved = getSavedSession();
    return saved?.classId === classId &&
      (allocationLink.sessionId === null || saved.id === allocationLink.sessionId) ? saved : null;
  }, [classId, allocationLink.sessionId]);
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
        throw new Error("Sß╗⌐c chß╗⌐a phß║úi l├á sß╗æ nguy├¬n d╞░╞íng.");
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
      toast.success(`─É├ú mß╗ƒ phi├¬n ph├ón nh├│m #${openedSession.id}.`);
    },
    onError: (error) => toast.error(getApiFailure(error).message),
  });

  const updateCapacityMutation = useMutation({
    mutationFn: () => {
      const maxMembers = Number(capacityInput);
      if (classId === null || sessionId === null) {
        throw new Error("Kh├┤ng c├│ phi├¬n ph├ón nh├│m ─æang mß╗ƒ.");
      }
      if (!Number.isSafeInteger(maxMembers) || maxMembers <= 0) {
        throw new Error("Sß╗⌐c chß╗⌐a phß║úi l├á sß╗æ nguy├¬n d╞░╞íng.");
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
      toast.success(`─É├ú cß║¡p nhß║¡t sß╗⌐c chß╗⌐a tß╗æi ─æa th├ánh ${updatedSession.maxMembers} hß╗ìc vi├¬n/nh├│m.`);
    },
    onError: (error) => toast.error(getApiFailure(error).message),
  });

  const saveDraftMutation = useMutation({
    mutationFn: async (teams: LocalDraftTeam[]): Promise<DraftWarning[]> => {
      if (classId === null || sessionId === null) {
        throw new Error("H├úy mß╗ƒ phi├¬n ph├ón nh├│m tr╞░ß╗¢c khi l╞░u.");
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
      toast.success("─É├ú l╞░u thay ─æß╗òi nh├│m DRAFT.");
      if (response.length) {
        toast.warning(`─É├ú l╞░u k├¿m ${response.length} cß║únh b├ío hß╗ìc vi├¬n tr├╣ng DRAFT.`);
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
        throw new Error("Kh├┤ng c├│ phi├¬n ph├ón nh├│m ─æang mß╗ƒ.");
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
      toast.success("─É├ú hß╗ºy phi├¬n. C├íc nh├│m DRAFT ─æ├ú ─æ╞░ß╗úc l╞░u trß╗».");
    },
    onError: (error) => toast.error(getApiFailure(error).message),
  });

  // US-12: strict-mode pre-check (read-only, returns free students + team issues).
  const readinessMutation = useMutation({
    mutationFn: () => {
      if (sessionId === null) {
        throw new Error("Kh├┤ng c├│ phi├¬n ph├ón nh├│m ─æang mß╗ƒ.");
      }
      return teamAllocationApi.getReadiness(classId, sessionId);
    },
    onSuccess: (report) => {
      setReadiness(report);
      setReadinessError(null);
      setPublishFailure(null);
      if (report.readyToPublish) {
        toast.success("Lß╗¢p ─æß╗º ─æiß╗üu kiß╗çn c├┤ng bß╗æ (Ready to Publish).");
      } else {
        toast.warning(
          `Lß╗¢p ch╞░a ─æß╗º ─æiß╗üu kiß╗çn c├┤ng bß╗æ: ${report.unassignedStudentCount} hß╗ìc vi├¬n tß╗▒ do, `
            + `${report.teamIssues.length} lß╗ùi nh├│m.`,
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
        throw new Error("Kh├┤ng c├│ phi├¬n ph├ón nh├│m ─æang mß╗ƒ.");
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
        const successMessage = `─É├ú c├┤ng bß╗æ ch├¡nh thß╗⌐c ${succeededItems.length} nh├│m.`;
        setPublishSuccess(successMessage);
        toast.success(successMessage);
      } else {
        setPublishSuccess(null);
      }
      if (failedItems.length > 0) {
        setPublishSuccess(null);
        toast.warning(
          `${failedItems.length} nh├│m ch╞░a thß╗â c├┤ng bß╗æ. Xem to├án bß╗Ö l├╜ do b├¬n d╞░ß╗¢i.`,
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
      if (sessionId === null) throw new Error("Kh├┤ng c├│ phi├¬n ph├ón nh├│m.");
      return teamAllocationApi.addActiveTeamMember(
        classId, sessionId, teamId, memberId,
      );
    },
    onSuccess: async () => {
      await invalidateMembershipQueries();
      toast.success("─É├ú th├¬m hß╗ìc vi├¬n v├áo nh├│m ACTIVE.");
    },
    onError: (error) => toast.error(getApiFailure(error).message),
  });

  const removeActiveMemberMutation = useMutation({
    mutationFn: ({
      teamId,
      memberId,
      reason,
    }: { teamId: number; memberId: number; reason: string }) => {
      if (sessionId === null) throw new Error("Kh├┤ng c├│ phi├¬n ph├ón nh├│m.");
      return teamAllocationApi.removeActiveTeamMember(
        classId, sessionId, teamId, memberId, reason,
      );
    },
    onSuccess: async () => {
      await invalidateMembershipQueries();
      toast.success("─É├ú gß╗í hß╗ìc vi├¬n khß╗Åi nh├│m ACTIVE.");
    },
    onError: (error) => toast.error(getApiFailure(error).message),
  });

  const updateActiveMentorMutation = useMutation({
    mutationFn: ({
      teamId,
      mentorId,
      reason,
    }: { teamId: number; mentorId: number | null; reason?: string }) => {
      if (sessionId === null) throw new Error("Kh├┤ng c├│ phi├¬n ph├ón nh├│m.");
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
      toast.success("─É├ú cß║¡p nhß║¡t Mentor phß╗Ñ tr├ích nh├│m.");
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
      if (sessionId === null) throw new Error("Kh├┤ng c├│ phi├¬n ph├ón nh├│m.");
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
      toast.success("─É├ú l╞░u vai tr├▓ th├ánh vi├¬n trong nh├│m.");
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
          ? "Dß╗» liß╗çu/Version nh├│m ─æ├ú bß╗ï thay ─æß╗òi, vui l├▓ng tß║úi lß║íi trang"
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
        throw new Error("Kh├┤ng c├│ phi├¬n ph├ón nh├│m.");
      }
      let expectedVersion = payload.teamVersion;
      if (payload.templateChanged && payload.projectTemplateId !== null) {
        const assigned = await teamAllocationApi.assignProjectTemplate(
          classId,
          sessionId,
          payload.teamId,
          payload.projectTemplateId,
          payload.projectTemplateVersionId,
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
      toast.success("─É├ú l╞░u th├┤ng tin nh├│m (ch╞░a c├┤ng bß╗æ).");
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
        toast.error(templateFailure.message ?? "Kh├┤ng thß╗â g├ín ─æß╗ü b├ái.");
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
          ? "Dß╗» liß╗çu/Version nh├│m ─æ├ú bß╗ï thay ─æß╗òi, vui l├▓ng tß║úi lß║íi trang"
          : failure.message,
      );
    },
  });

  // US-10: assign the selected project template to a DRAFT team.
  const assignTemplateMutation = useMutation({
    mutationFn: ({
      teamId,
      projectTemplateId,
      versionId,
    }: {
      teamId: number;
      projectTemplateId: number;
      versionId?: number;
    }) => {
      if (classId === null || sessionId === null) {
        throw new Error("Kh├┤ng c├│ phi├¬n ph├ón nh├│m.");
      }
      return teamAllocationApi.assignProjectTemplate(
        classId,
        sessionId,
        teamId,
        projectTemplateId,
        versionId,
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
        `─É├ú g├ín ─æß╗ü b├ái ΓÇ£${updated.projectTemplateName ?? "─æß╗ü b├ái"}ΓÇ¥ cho nh├│m ${updated.teamName}.`,
      );
    },
    onError: (error, variables) => {
      const failure = getTemplateFailure(error);
      setTemplateAssignErrors((current) => ({
        ...current,
        [variables.teamId]: failure,
      }));
      toast.error(failure.message ?? "Kh├┤ng thß╗â g├ín ─æß╗ü b├ái.");
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
      if (sessionId === null) throw new Error("Kh├┤ng c├│ phi├¬n ph├ón nh├│m.");
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
      toast.success("─É├ú chuyß╗ân hß╗ìc vi├¬n sang nh├│m mß╗¢i.");
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
    member.userCode?.toLowerCase().includes(memberSearch.trim().toLowerCase()) ||
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
      toast.error("H├úy l╞░u hoß║╖c hß╗ºy chß╗ënh sß╗¡a nh├│m tr╞░ß╗¢c khi th├¬m nh├│m mß╗¢i.");
      return;
    }
    const localId = crypto.randomUUID();
    setCollapsedDraftTeamIds(new Set(draftTeams.map((team) => team.localId)));
    setDraftTeams((current) => [
      ...current,
      {
        localId,
        teamName: `Nh├│m ${current.length + 1}`,
        assignedMentorId: null,
        memberIds: [],
        memberRoles: {},
      },
    ]);
    setMemberPickerTeamId(localId);
    setMemberSearch("");
    setSaveFailure(null);
  };

  const addDraftTeamWithCapacity = async () => {
    if (!session) return;
    if (editingSavedTeamId !== null) {
      toast.error("H├úy l╞░u hoß║╖c hß╗ºy chß╗ënh sß╗¡a nh├│m tr╞░ß╗¢c khi th├¬m nh├│m mß╗¢i.");
      return;
    }
    const maxMembers = Number(capacityInput);
    if (!Number.isSafeInteger(maxMembers) || maxMembers <= 0) {
      toast.error("Sß╗⌐c chß╗⌐a phß║úi l├á sß╗æ nguy├¬n d╞░╞íng.");
      return;
    }
    if (maxMembers !== session.maxMembers) {
      try {
        await updateCapacityMutation.mutateAsync();
      } catch {
        return;
      }
    }
    addDraftTeam();
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
      toast.error("H├úy th├¬m ├¡t nhß║Ñt mß╗Öt nh├│m tr╞░ß╗¢c khi l╞░u.");
      return;
    }
    if (draftTeams.some((team) => !team.teamName.trim())) {
      toast.error("T├¬n nh├│m kh├┤ng ─æ╞░ß╗úc ─æß╗â trß╗æng.");
      return;
    }
    if (newTeams.some((team) => team.memberIds.length === 0)) {
      toast.error("Mß╗ùi nh├│m mß╗¢i cß║ºn c├│ ├¡t nhß║Ñt mß╗Öt hß╗ìc vi├¬n.");
      return;
    }
    saveDraftMutation.mutate(draftTeams);
  };

  const editSavedTeam = (team: AllocationTeam) => {
    if (draftTeams.length > 0) {
      toast.error("H├úy l╞░u hoß║╖c hß╗ºy thay ─æß╗òi hiß╗çn tß║íi tr╞░ß╗¢c khi chß╗ënh sß╗¡a nh├│m ─æ├ú l╞░u.");
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

  const nameForMember = (memberId: number) => {
    const member = memberById.get(memberId);
    if (!member) return `Hß╗ìc vi├¬n #${memberId}`;
    return member.userCode ? `${member.fullName} (${member.userCode})` : member.fullName;
  };

  return (
    <MainLayout pathName={{ "team-allocation": "Project Team Allocation" }}>
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div role="tablist" aria-label="Quß║ún l├╜ nh├│m" className="flex gap-2 border-b">
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
            Nh├│m v├á th├ánh vi├¬n
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
            Lß╗ïch sß╗¡ th├ánh vi├¬n / Vai tr├▓
          </button>
        </div>

        {activeTab === "history" && (
          <TeamMemberHistoryPanel
            classId={classId}
            cohortId={selectedClass?.cohortId ?? null}
            className={selectedClass?.name ?? `Lß╗¢p #${classId}`}
          />
        )}
        <div className={activeTab === "teams" ? "contents" : "hidden"}>
        {!hasPermission("PEO_TEAM_ALLOCATE") &&
          !hasPermission("PRJ_WORKSPACE_MANAGE") && (
          <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            T├ái khoß║ún hiß╗çn tß║íi kh├┤ng c├│ quyß╗ün ph├ón nh├│m dß╗▒ ├ín.
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <CardTitle>{selectedClass?.name ?? `Lß╗¢p #${classId}`}</CardTitle>
                <CardDescription>
                  {selectedClass
                    ? `${selectedClass.code} ┬╖ ${selectedClass.memberCount} hß╗ìc vi├¬n`
                    : "Phi├¬n ph├ón nh├│m v├á danh s├ích hß╗ìc vi├¬n cß╗ºa lß╗¢p ─æ├ú chß╗ìn."}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                onClick={() => navigate("/team-allocation")}
              >
                Quay lß║íi danh s├ích lß╗¢p
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {sessionsQuery.data && sessionsQuery.data.length > 0 && (
              <label className="block max-w-md space-y-2 text-sm font-medium">
                Phi├¬n ph├ón nh├│m cß╗ºa lß╗¢p
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
                      !window.confirm("Thay ─æß╗òi ch╞░a l╞░u sß║╜ bß╗ï bß╗Å. Bß║ín muß╗æn chuyß╗ân phi├¬n?")
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
                      Phi├¬n #{item.sessionNumber} ┬╖ {item.status} ┬╖ tß╗æi ─æa {item.maxMembers}/nh├│m
                    </option>
                  ))}
                  {!session && (
                    <option value="" disabled>
                      Chß╗ìn phi├¬n ph├ón nh├│m
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
                Tß║ío phi├¬n mß╗¢i
              </Button>
            )}
            {(!session || createAnotherSession) && (
              <>
                <label className="block max-w-xs space-y-2 text-sm font-medium">
                  Sß╗⌐c chß╗⌐a tß╗æi ─æa / nh├│m {session ? "(phi├¬n mß╗¢i)" : ""}
                <Input
                  inputMode="numeric"
                  min={1}
                  type="number"
                  placeholder="Nhß║¡p sß╗æ hß╗ìc vi├¬n tß╗æi ─æa"
                  value={session ? newSessionCapacity : capacityInput}
                  onChange={(event) => {
                    if (session) setNewSessionCapacity(event.target.value);
                    else setCapacityInput(event.target.value);
                  }}
                  disabled={!hasPermission("PEO_TEAM_ALLOCATE")}
                />
              </label>
                <p className="text-xs text-muted-foreground">
                  Lß╗¢p v├á project template ─æ╞░ß╗úc x├íc ─æß╗ïnh tß╗▒ ─æß╗Öng; m├ú phi├¬n do hß╗ç thß╗æng tß║ío.
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
                        "Tß║ío phi├¬n mß╗¢i sß║╜ bß╗Å c├íc thay ─æß╗òi nh├│m ch╞░a l╞░u trong phi├¬n hiß╗çn tß║íi. Bß║ín c├│ muß╗æn tiß║┐p tß╗Ñc?",
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
                  Tß║ío phi├¬n ph├ón nh├│m
                </Button>
                {session && (
                  <Button
                    variant="outline"
                    onClick={() => setCreateAnotherSession(false)}
                    disabled={openSessionMutation.isPending}
                  >
                    Hß╗ºy
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
                  <span className="font-medium">Phi├¬n #{session.sessionNumber}</span>
                  <span className="text-muted-foreground">Lß╗¢p #{session.classId}</span>
                  {teamsQuery.isLoading && <LoaderCircle className="size-4 animate-spin text-muted-foreground" />}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-muted-foreground">
                    Sß╗⌐c chß╗⌐a hiß╗çn tß║íi: <strong className="text-foreground">{session.maxMembers}</strong> hß╗ìc vi├¬n/nh├│m
                  </span>
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
                      Hß╗ºy phi├¬n
                    </Button>
                  )}
                  {session.status !== "OPEN" && (
                    <p className="w-full text-xs text-muted-foreground">
                      Phi├¬n ─æ├ú publish hoß║╖c ─æ├│ng n├¬n kh├┤ng thß╗â thay ─æß╗òi sß╗⌐c chß╗⌐a v├á
                      kh├┤ng thß╗â g├ín ─æß╗ü b├ái cho c├íc nh├│m ─æ├ú chuyß╗ân sang ACTIVE. H├úy tß║ío
                      phi├¬n ph├ón nh├│m mß╗¢i ─æß╗â g├ín ─æß╗ü b├ái cho nh├│m DRAFT.
                    </p>
                  )}
                  {session.status === "OPEN" && !teamsQuery.isLoading && !teamsQuery.isError &&
                    !savedTeams.every((team) => team.status === "DRAFT") && (
                      <p className="w-full text-xs text-muted-foreground">
                        Chß╗ë c├│ thß╗â hß╗ºy khi tß║Ñt cß║ú nh├│m trong phi├¬n ─æß╗üu ß╗ƒ trß║íng th├íi DRAFT.
                      </p>
                    )}
                </div>
              </div>
            )}
            {teamsQuery.isError && session && (
              <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
                <span className="text-destructive">
                  Kh├┤ng tß║úi ─æ╞░ß╗úc phi├¬n #{session.id}. Kiß╗âm tra class ID/session ID v├á quyß╗ün truy cß║¡p.
                </span>
                <Button variant="outline" size="sm" onClick={() => void teamsQuery.refetch()}>
                  Thß╗¡ lß║íi
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {session && (
          <>
            {/* US-12 ΓÇö strict-mode class readiness before publishing the session. */}
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
                      Kiß╗âm tra ─æiß╗üu kiß╗çn c├┤ng bß╗æ to├án lß╗¢p
                    </CardTitle>
                    <CardDescription>
                      BR-UNI-10 ┬╖ Strict mode: 100% hß╗ìc vi├¬n phß║úi ─æ├ú c├│ nh├│m, mß╗ìi nh├│m
                      phß║úi ─æ╞░ß╗úc g├ín ─æß╗ü b├ái hß╗úp lß╗ç v├á ─æ├íp ß╗⌐ng ─æß╗º ─æß╗ïnh suß║Ñt vai tr├▓ tr╞░ß╗¢c
                      khi c├┤ng bß╗æ phi├¬n.
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
                      Kiß╗âm tra ─æiß╗üu kiß╗çn c├┤ng bß╗æ
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {session.status !== "OPEN" && (
                  <p className="text-sm text-muted-foreground">
                    Phi├¬n ─æang ß╗ƒ trß║íng th├íi {session.status}; chß╗ë phi├¬n OPEN mß╗¢i cß║ºn
                    kiß╗âm tra ─æiß╗üu kiß╗çn c├┤ng bß╗æ.
                  </p>
                )}
                {session.status === "OPEN" && draftTeams.length > 0 && (
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    C├▓n thay ─æß╗òi nh├│m ch╞░a l╞░u. H├úy l╞░u nh├íp tr╞░ß╗¢c khi kiß╗âm tra hoß║╖c
                    c├┤ng bß╗æ.
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
                    Nhß║Ñn ΓÇ£Kiß╗âm tra ─æiß╗üu kiß╗çn c├┤ng bß╗æΓÇ¥ ─æß╗â x├íc thß╗▒c s─⌐ sß╗æ to├án lß╗¢p, ─æß╗ü b├ái
                    v├á ─æß╗ïnh suß║Ñt vai tr├▓ cß╗ºa tß║Ñt cß║ú nh├│m tr╞░ß╗¢c khi c├┤ng bß╗æ ch├¡nh thß╗⌐c.
                  </p>
                )}
                {readiness && <ReadinessReport report={readiness} />}
              </CardContent>
            </Card>

            <section className="grid gap-4 sm:grid-cols-3">
              <MetricCard
                icon={<Users className="size-5" />}
                label="Hß╗ìc vi├¬n ch╞░a v├áo nh├│m ACTIVE trong phi├¬n"
                value={members.length}
                onClick={() => setSummaryDialog("unassigned")}
              />
              <MetricCard
                icon={<ClipboardList className="size-5" />}
                label="Nh├│m ─æ├ú l╞░u"
                value={savedTeams.length}
                onClick={() => setSummaryDialog("saved")}
              />
              <MetricCard
                icon={<CircleAlert className="size-5" />}
                label="Nh├│m chß╗¥ publish"
                value={publishableTeams.length}
                onClick={() => setSummaryDialog("publishable")}
              />
            </section>

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(340px,0.7fr)]">
              <Card className={saveFailure?.status === 422 ? "border-destructive" : ""}>
                <CardHeader className="flex flex-col gap-4">
                  <div className="space-y-1.5">
                    <CardTitle>Tß║ío nh├│m nh├íp</CardTitle>
                    <CardDescription>
                      Cß║Ñu h├¼nh sß╗⌐c chß╗⌐a v├á th├¬m nh├│m tß║íi ─æ├óy. Nh├│m ─æ├ú nhß║¡p sß║╜ tß╗▒ thu gß╗ìn ─æß╗â dß╗à quß║ún l├╜.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-3">
                    <label className="block w-full max-w-xs space-y-1.5 text-sm font-medium">
                      Sß╗⌐c chß╗⌐a tß╗æi ─æa / nh├│m
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
                      onClick={() => void addDraftTeamWithCapacity()}
                      disabled={
                        !hasPermission("PEO_TEAM_ALLOCATE") ||
                        session.status !== "OPEN" ||
                        updateCapacityMutation.isPending ||
                        saveDraftMutation.isPending ||
                        !Number.isSafeInteger(Number(capacityInput)) ||
                        Number(capacityInput) <= 0
                      }
                    >
                      {updateCapacityMutation.isPending
                        ? <LoaderCircle className="size-4 animate-spin" />
                        : <Plus className="size-4" />}
                      {Number(capacityInput) !== session.maxMembers
                        ? "Cß║¡p nhß║¡t & th├¬m nh├│m"
                        : "Th├¬m nh├│m"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {saveFailure && (
                    <div role="alert" className="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
                      <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                      <div className="space-y-1">
                        <p className="font-medium text-destructive">
                          {saveFailure.status === 422
                            ? "Sß╗⌐c chß╗⌐a nh├│m kh├┤ng hß╗úp lß╗ç"
                            : saveFailure.status === 409
                              ? "Dß╗» liß╗çu ─æ├ú thay ─æß╗òi"
                              : "Kh├┤ng thß╗â l╞░u nh├│m"}
                        </p>
                        <p className="text-muted-foreground">{saveFailure.message}</p>
                        {saveFailure.status === 409 && (
                          <p className="text-muted-foreground">
                            Bß║ún nh├íp cß╗ºa bß║ín vß║½n ─æ╞░ß╗úc giß╗». Bß╗Å chß╗ìn hß╗ìc vi├¬n bß╗ï ─æ├ính dß║Ñu rß╗ôi l╞░u lß║íi.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {membersQuery.isError ? (
                    <div role="alert" className="rounded-xl border border-destructive/30 p-5 text-sm">
                      <p className="text-destructive">Kh├┤ng tß║úi ─æ╞░ß╗úc danh s├ích hß╗ìc vi├¬n.</p>
                      <Button className="mt-3" variant="outline" size="sm" onClick={() => void membersQuery.refetch()}>
                        Thß╗¡ tß║úi lß║íi
                      </Button>
                    </div>
                  ) : (
                    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(320px,1.1fr)]">
                      <div className="space-y-3">
                        {draftTeams.length === 0 ? (
                          <div className="rounded-xl border border-dashed px-5 py-10 text-center">
                            <UsersRound className="mx-auto size-9 text-muted-foreground" />
                            <p className="mt-3 font-medium">Ch╞░a c├│ nh├│m nh├íp</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Th├¬m nh├│m ─æß╗â bß║»t ─æß║ºu chß╗ìn hß╗ìc vi├¬n.
                            </p>
                          </div>
                        ) : draftTeams.map((team, teamIndex) => {
                          const collapsed = collapsedDraftTeamIds.has(team.localId);
                          const mentorName = mentorsQuery.data?.find(
                            (mentor) => mentor.mentorId === team.assignedMentorId,
                          )?.fullName;
                          return (
                            <article
                              key={team.localId}
                              className={`rounded-xl border p-3 ${
                                saveFailure?.memberId &&
                                team.memberIds.includes(saveFailure.memberId)
                                  ? "border-destructive bg-destructive/5"
                                  : ""
                              }`}
                            >
                              <button
                                type="button"
                                className="flex w-full items-center justify-between gap-3 text-left"
                                aria-expanded={!collapsed}
                                onClick={() => setCollapsedDraftTeamIds((current) => {
                                  const next = new Set(current);
                                  if (next.has(team.localId)) next.delete(team.localId);
                                  else next.add(team.localId);
                                  return next;
                                })}
                              >
                                <span className="flex min-w-0 items-center gap-2">
                                  <ChevronDown className={`size-4 shrink-0 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
                                  <span className="min-w-0">
                                    <span className="block truncate text-sm font-semibold">
                                      {team.teamName || `Nh├│m ${teamIndex + 1}`}
                                    </span>
                                    <span className="block truncate text-xs text-muted-foreground">
                                      {team.memberIds.length}/{session.maxMembers} th├ánh vi├¬n
                                      {mentorName ? ` ┬╖ ${mentorName}` : ""}
                                    </span>
                                  </span>
                                </span>
                                <span className="shrink-0 text-xs text-muted-foreground">
                                  {collapsed ? "Mß╗ƒ" : "Thu gß╗ìn"}
                                </span>
                              </button>
                              {!collapsed && (
                                <div className="mt-3 space-y-3 border-t pt-3">
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                                    <label className="min-w-0 flex-1 space-y-1.5 text-sm font-medium">
                                      T├¬n nh├│m
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
                                    <span className={`flex items-center gap-2 pb-2 text-sm ${
                                      team.memberIds.length > session.maxMembers
                                        ? "font-semibold text-destructive"
                                        : "text-muted-foreground"
                                    }`}>
                                      <Users className="size-4" />
                                      {team.memberIds.length}/{session.maxMembers}
                                    </span>
                                  </div>
                                  <label className="block space-y-1.5 text-sm font-medium">
                                    Mentor phß╗Ñ tr├ích
                                    <select
                                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                      value={team.assignedMentorId ?? ""}
                                      disabled={mentorsQuery.isLoading}
                                      onChange={(event) => {
                                        const mentorId = event.target.value
                                          ? Number(event.target.value)
                                          : null;
                                        setDraftTeams((current) => current.map((item, index) =>
                                          item.localId === team.localId
                                            ? { ...item, assignedMentorId: mentorId }
                                            : index > teamIndex &&
                                                mentorId !== null &&
                                                item.assignedMentorId === null
                                              ? { ...item, assignedMentorId: mentorId }
                                              : item,
                                        ));
                                      }}
                                    >
                                      <option value="">Ch╞░a chß╗ìn Mentor</option>
                                      {(mentorsQuery.data ?? []).map((mentor) => (
                                        <option key={mentor.mentorId} value={mentor.mentorId}>
                                          {mentor.fullName}
                                          {mentor.defaultMentor ? " ┬╖ Mentor mß║╖c ─æß╗ïnh cß╗ºa lß╗¢p" : ""}
                                        </option>
                                      ))}
                                    </select>
                                    {mentorsQuery.isError && (
                                      <span className="block text-xs font-normal text-destructive">
                                        Kh├┤ng tß║úi ─æ╞░ß╗úc danh s├ích Mentor cß╗ºa lß╗¢p.
                                      </span>
                                    )}
                                  </label>
                                  <div className="flex flex-wrap gap-2">
                                    {team.savedTeamId === undefined && (
                                      <Button
                                        type="button"
                                        variant="destructive"
                                        size="sm"
                                        aria-label={`X├│a nh├│m nh├íp ${team.teamName || teamIndex + 1}`}
                                        onClick={() => {
                                          setDraftTeams((current) =>
                                            current.filter((item) => item.localId !== team.localId),
                                          );
                                          setCollapsedDraftTeamIds((current) => {
                                            const next = new Set(current);
                                            next.delete(team.localId);
                                            return next;
                                          });
                                          if (memberPickerTeamId === team.localId) {
                                            setMemberPickerTeamId(null);
                                          }
                                          setSaveFailure(null);
                                        }}
                                      >
                                        <Trash2 className="size-4" />
                                        X├│a nh├│m
                                      </Button>
                                    )}
                                    <Button
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
                                        ? "─Éang chß╗ìn hß╗ìc vi├¬n"
                                        : "Chß╗ìn hß╗ìc vi├¬n"}
                                    </Button>
                                    {team.savedTeamId !== undefined && (
                                      <Button size="sm" variant="outline" onClick={cancelDraftEditing}>
                                        Hß╗ºy chß╗ënh sß╗¡a
                                      </Button>
                                    )}
                                  </div>
                                  {team.memberIds.length > session.maxMembers && (
                                    <p className="text-xs text-destructive">
                                      V╞░ß╗út sß╗⌐c chß╗⌐a tß╗æi ─æa {session.maxMembers}; danh s├ích chß╗ìn vß║½n ─æ╞░ß╗úc giß╗» ─æß╗â bß║ín ─æiß╗üu chß╗ënh.
                                    </p>
                                  )}
                                  <div className="max-h-24 overflow-y-auto rounded-md border p-2">
                                    <div className="flex flex-wrap gap-2">
                                      {team.memberIds.length === 0 ? (
                                        <span className="text-xs text-muted-foreground">Ch╞░a chß╗ìn hß╗ìc vi├¬n</span>
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
                                            aria-label={`Bß╗Å chß╗ìn ${nameForMember(memberId)}`}
                                            className="ml-1 rounded-full hover:text-destructive"
                                            onClick={() => toggleMember(team.localId, memberId, false)}
                                          >
                                            <X className="size-3" />
                                          </button>
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </article>
                          );
                        })}
                      </div>

                      {memberPickerTeam ? (
                        <div className="min-w-0 space-y-3 rounded-xl border border-primary/30 bg-muted/20 p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <h3 className="text-sm font-semibold">
                                Chß╗ìn hß╗ìc vi├¬n cho {memberPickerTeam.teamName || "nh├│m ch╞░a ─æß║╖t t├¬n"}
                              </h3>
                              <p className="text-xs text-muted-foreground">
                                ─É├ú chß╗ìn {memberPickerTeam.memberIds.length}/{session.maxMembers} hß╗ìc vi├¬n.
                                Mß╗Öt hß╗ìc vi├¬n c├│ thß╗â ß╗ƒ nhiß╗üu nh├│m DRAFT; hß╗ç thß╗æng sß║╜ cß║únh b├ío khi l╞░u.
                              </p>
                            </div>
                            <div className="relative w-full sm:max-w-xs">
                              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                className="pl-9"
                                placeholder="T├¼m t├¬n hoß║╖c m├ú hß╗ìc vi├¬n"
                                aria-label={`T├¼m hß╗ìc vi├¬n cho ${memberPickerTeam.teamName}`}
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
                              ─Éang tß║úi hß╗ìc vi├¬n...
                            </div>
                          ) : filteredMembers.length === 0 ? (
                            <p className="py-6 text-center text-sm text-muted-foreground">
                              {members.length === 0
                                ? "Kh├┤ng c├▓n hß╗ìc vi├¬n ACTIVE ch╞░a ─æ╞░ß╗úc xß║┐p v├áo nh├│m ACTIVE trong phi├¬n n├áy."
                                : "Kh├┤ng t├¼m thß║Ñy hß╗ìc vi├¬n ph├╣ hß╗úp."}
                            </p>
                          ) : (
                            <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
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
                      ) : (
                        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                          Th├¬m nh├│m hoß║╖c chß╗ìn ΓÇ£Chß╗ìn hß╗ìc vi├¬nΓÇ¥ ß╗ƒ mß╗Öt nh├│m ─æß╗â mß╗ƒ danh s├ích sinh vi├¬n tß║íi ─æ├óy.
                        </div>
                      )}

                      <div className="col-span-full flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                        <p className="text-xs text-muted-foreground">
                          Nh├│m v╞░ß╗út giß╗¢i hß║ín sß║╜ ─æ╞░ß╗úc backend kiß╗âm tra; form kh├┤ng bß╗ï x├│a nß║┐u ph├ít sinh lß╗ùi.
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
                            ? "L╞░u chß╗ënh sß╗¡a nh├│m"
                            : "L╞░u nh├│m DRAFT"}
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
                    Nh├│m ─æ├ú l╞░u
                  </CardTitle>
                  <CardDescription>
                    C├íc nh├│m DRAFT ch╞░a giß╗» chß╗ù hß╗ìc vi├¬n. C├┤ng bß╗æ ch├¡nh thß╗⌐c sß║╜ kiß╗âm tra lß║íi trß║íng th├íi th├ánh vi├¬n.
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
                              Hß╗ìc vi├¬n tß╗▒ do ch╞░a ─æ╞░ß╗úc xß║┐p nh├│m (
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
                                      {member.fullName}{member.userCode ? ` ┬╖ ${member.userCode}` : ` (#${member.memberId})`}
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
                            Nh├│m ch╞░a ─æ├íp ß╗⌐ng ─æiß╗üu kiß╗çn c├┤ng bß╗æ
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
                        Mß╗Öt sß╗æ nh├│m ch╞░a thß╗â publish
                      </p>
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {publishItemFailures.map((failure) => (
                          <li key={failure.teamId}>
                            Nh├│m #{failure.teamId}: {failure.message}
                            {failure.memberId
                              ? ` (${nameForMember(failure.memberId)})`
                              : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {teamsQuery.isLoading ? (
                    <LoadingState label="─Éang tß║úi nh├│m..." />
                  ) : teamsQuery.isError ? (
                    <p className="text-sm text-muted-foreground">
                      Danh s├ích nh├│m ch╞░a tß║úi ─æ╞░ß╗úc.
                    </p>
                  ) : savedTeams.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-6 text-center">
                      <ClipboardList className="mx-auto size-8 text-muted-foreground" />
                      <p className="mt-3 text-sm font-medium">Ch╞░a c├│ nh├│m ─æ├ú l╞░u</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        L╞░u nh├│m nh├íp ─æß╗â ch├║ng xuß║Ñt hiß╗çn ß╗ƒ ─æ├óy.
                      </p>
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
                          canAssignTemplate={
                            hasPermission("PEO_TEAM_ALLOCATE") ||
                            hasPermission("PRJ_WORKSPACE_MANAGE")
                          }
                          assignTemplatePending={assignTemplateMutation.isPending}
                          assignTemplateError={templateAssignErrors[team.teamId]}
                          onAssignTemplate={async (projectTemplateId, versionId) => {
                            await assignTemplateMutation.mutateAsync({
                              teamId: team.teamId,
                              projectTemplateId,
                              versionId,
                            });
                          }}
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
                          G├ín v├á l╞░u vai tr├▓ cho mß╗ìi th├ánh vi├¬n tr╞░ß╗¢c khi c├┤ng bß╗æ ch├¡nh thß╗⌐c.
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
                        C├┤ng bß╗æ ch├¡nh thß╗⌐c
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
            <DialogTitle>Hß╗ºy phi├¬n ph├ón nh├│m?</DialogTitle>
            <DialogDescription>
              Phi├¬n sß║╜ chuyß╗ân sang CANCELLED v├á c├íc nh├│m DRAFT sß║╜ ─æ╞░ß╗úc l╞░u trß╗» (ARCHIVED).
              H├ánh ─æß╗Öng n├áy kh├┤ng x├│a lß╗ïch sß╗¡ v├á kh├┤ng thß╗â ho├án t├íc.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
              disabled={cancelSessionMutation.isPending}
            >
              Quay lß║íi
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelSessionMutation.mutate()}
              disabled={!canCancelSession || cancelSessionMutation.isPending}
            >
              {cancelSessionMutation.isPending
                ? <LoaderCircle className="size-4 animate-spin" />
                : <Ban className="size-4" />}
              X├íc nhß║¡n hß╗ºy phi├¬n
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
                ? "Hß╗ìc vi├¬n ch╞░a v├áo nh├│m ACTIVE trong phi├¬n"
                : summaryDialog === "publishable"
                  ? "Nh├│m chß╗¥ publish"
                  : "Nh├│m ─æ├ú l╞░u"}
            </DialogTitle>
            <DialogDescription>
              {summaryDialog === "unassigned"
                ? `${members.length} hß╗ìc vi├¬n`
                : summaryDialog === "publishable"
                  ? `${publishableTeams.length} nh├│m`
                  : `${savedTeams.length} nh├│m`}
            </DialogDescription>
          </DialogHeader>
          {summaryDialog === "unassigned" ? (
            members.length === 0 ? (
              <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
                Kh├┤ng c├│ hß╗ìc vi├¬n n├áo trong danh s├ích n├áy.
              </p>
            ) : (
              <ul className="max-h-[55vh] divide-y overflow-y-auto rounded-lg border">
                {members.map((member) => (
                  <li
                    key={member.memberId}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                  >
                    <span className="min-w-0 truncate">{member.fullName}{member.userCode ? ` ┬╖ ${member.userCode}` : ""}</span>
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
                  Kh├┤ng c├│ nh├│m n├áo trong danh s├ích n├áy.
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
                        {team.memberIds.length} th├ánh vi├¬n
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
            <DialogTitle>Chuyß╗ân hß╗ìc vi├¬n giß╗»a c├íc nh├│m</DialogTitle>
            <DialogDescription>
              Chß╗ìn chuyß╗ân trß╗▒c tiß║┐p nß║┐u nh├│m nhß║¡n c├▓n chß╗ù, hoß║╖c ─æß╗òi vß╗ï tr├¡ vß╗¢i mß╗Öt th├ánh vi├¬n cß╗ºa nh├│m nhß║¡n.
              L├╜ do sß║╜ ─æ╞░ß╗úc ghi v├áo lß╗ïch sß╗¡.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm font-medium">
            Hß╗ìc vi├¬n: {transferTarget?.memberName}
          </p>
          <label className="space-y-2 text-sm font-medium">
            H├¼nh thß╗⌐c
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
              <option value="move">Chuyß╗ân trß╗▒c tiß║┐p</option>
              <option value="swap">─Éß╗òi vß╗ï tr├¡ hai hß╗ìc vi├¬n</option>
            </select>
          </label>
          <label className="space-y-2 text-sm font-medium">
            Nh├│m nhß║¡n
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={transferDestinationId}
              onChange={(event) => {
                setTransferDestinationId(event.target.value);
                setTransferReplacementMemberId("");
              }}
              disabled={transferMemberMutation.isPending}
            >
              <option value="">Chß╗ìn nh├│m</option>
              {savedTeams
                .filter((candidate) =>
                  candidate.teamId !== transferTarget?.teamId &&
                  candidate.status === "ACTIVE" &&
                  (transferMode === "swap" ||
                    candidate.memberIds.length < (session?.maxMembers ?? 0)),
                )
                .map((candidate) => (
                  <option key={candidate.teamId} value={candidate.teamId}>
                    {candidate.teamName} ({candidate.memberIds.length} th├ánh vi├¬n)
                  </option>
                ))}
            </select>
          </label>
          {transferMode === "swap" && transferDestinationId && (
            <label className="space-y-2 text-sm font-medium">
              Hß╗ìc vi├¬n ─æß╗òi vß╗ï tr├¡
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={transferReplacementMemberId}
                onChange={(event) =>
                  setTransferReplacementMemberId(event.target.value)
                }
                disabled={transferMemberMutation.isPending}
              >
                <option value="">Chß╗ìn th├ánh vi├¬n nh├│m nhß║¡n</option>
                {savedTeams
                  .find((candidate) =>
                    candidate.teamId === Number(transferDestinationId),
                  )
                  ?.members?.map((member) => (
                    <option key={member.memberId} value={member.memberId}>
                      {member.fullName}{member.userCode ? ` ┬╖ ${member.userCode}` : ""} ┬╖ {member.role ?? "Ch╞░a c├│ role"}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <label className="space-y-2 text-sm font-medium">
            L├╜ do chuyß╗ân nh├│m (bß║»t buß╗Öc)
            <Textarea
              maxLength={500}
              placeholder="Nhß║¡p l├╜ do ─æiß╗üu chuyß╗ân"
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
              Hß╗ºy
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
              X├íc nhß║¡n chuyß╗ân nh├│m
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
            <DialogTitle>Gß╗í hß╗ìc vi├¬n khß╗Åi nh├│m?</DialogTitle>
            <DialogDescription>
              Nhß║¡p l├╜ do gß╗í {removeMemberTarget?.memberName ?? "hß╗ìc vi├¬n"}.
              Hß╗ìc vi├¬n sß║╜ trß╗ƒ vß╗ü danh s├ích ch╞░a ─æ╞░ß╗úc xß║┐p nh├│m trong phi├¬n n├áy.
            </DialogDescription>
          </DialogHeader>
          <label className="space-y-2 text-sm font-medium">
            L├╜ do gß╗í
            <Textarea
              autoFocus
              maxLength={500}
              placeholder="Nhß║¡p l├╜ do (bß║»t buß╗Öc)"
              value={removeMemberReason}
              onChange={(event) => setRemoveMemberReason(event.target.value)}
              disabled={removeActiveMemberMutation.isPending}
            />
            <span className="block text-xs font-normal text-muted-foreground">
              {removeMemberReason.length}/500 k├╜ tß╗▒
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
              Hß╗ºy
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
              X├íc nhß║¡n gß╗í
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
            <DialogTitle>Thay ─æß╗òi Mentor phß╗Ñ tr├ích</DialogTitle>
            <DialogDescription>
              Cß║¡p nhß║¡t Mentor cho nh├│m {activeMentorTarget?.teamName}.
              {activeMentorTarget?.active
                ? " L├╜ do thay ─æß╗òi l├á bß║»t buß╗Öc v├á ─æ╞░ß╗úc l╞░u v├áo lß╗ïch sß╗¡ audit."
                : " L├╜ do thay ─æß╗òi c├│ thß╗â ─æ╞░ß╗úc ghi lß║íi trong lß╗ïch sß╗¡ audit."}
            </DialogDescription>
          </DialogHeader>
          <label className="space-y-2 text-sm font-medium">
            Mentor phß╗Ñ tr├ích
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={activeMentorSelection}
              onChange={(event) => setActiveMentorSelection(event.target.value)}
              disabled={updateActiveMentorMutation.isPending}
            >
              <option value="">Ch╞░a g├ín Mentor</option>
              {(mentorsQuery.data ?? []).map((mentor) => (
                <option key={mentor.mentorId} value={mentor.mentorId}>
                  {mentor.fullName}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm font-medium">
            L├╜ do thay ─æß╗òi{activeMentorTarget?.active ? " (bß║»t buß╗Öc)" : " (kh├┤ng bß║»t buß╗Öc)"}
            <Textarea
              maxLength={500}
              placeholder={
                activeMentorTarget?.active
                  ? "Nhß║¡p l├╜ do thay ─æß╗òi (bß║»t buß╗Öc)"
                  : "Nhß║¡p l├╜ do thay ─æß╗òi (kh├┤ng bß║»t buß╗Öc)"
              }
              value={activeMentorReason}
              onChange={(event) => setActiveMentorReason(event.target.value)}
              disabled={updateActiveMentorMutation.isPending}
            />
            <span className="block text-xs font-normal text-muted-foreground">
              {activeMentorReason.length}/500 k├╜ tß╗▒
            </span>
          </label>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setActiveMentorTarget(null)}
              disabled={updateActiveMentorMutation.isPending}
            >
              Hß╗ºy
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
              L╞░u Mentor
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
      aria-label={`${label}: ${value}. Nhß║Ñn ─æß╗â xem chi tiß║┐t.`}
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
        <CardTitle>Lß╗ïch sß╗¡ th├ánh vi├¬n / Vai tr├▓</CardTitle>
        <CardDescription>
          Nhß║¡t k├╜ chß╗ë ─æ╞░ß╗úc th├¬m mß╗¢i, sß║»p xß║┐p tß╗½ mß╗¢i nhß║Ñt ─æß║┐n c┼⌐ nhß║Ñt.
          Phß║ím vi hiß╗çn tß║íi: {scope === "cohort" ? `Cohort #${cohortId}` : className}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm font-medium">
            Phß║ím vi
            <select
              className="block h-10 rounded-md border border-input bg-background px-3"
              value={scope}
              onChange={(event) => {
                setScope(event.target.value as "class" | "cohort");
                setPage(0);
              }}
              disabled={cohortId === null}
            >
              <option value="class">Lß╗¢p hiß╗çn tß║íi</option>
              <option value="cohort">To├án cohort</option>
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium">
            Lß╗ìc theo ID hß╗ìc vi├¬n
            <Input
              inputMode="numeric"
              value={memberFilter}
              onChange={(event) => {
                setMemberFilter(event.target.value);
                setPage(0);
              }}
              placeholder="ID hß╗ìc vi├¬n"
            />
          </label>
          <label className="space-y-1 text-sm font-medium">
            Lß╗ìc theo ID nh├│m
            <Input
              inputMode="numeric"
              value={teamFilter}
              onChange={(event) => {
                setTeamFilter(event.target.value);
                setPage(0);
              }}
              placeholder="ID nh├│m c┼⌐/mß╗¢i"
            />
          </label>
          <Button type="button" variant="outline" onClick={clearFilters}>
            X├│a bß╗Ö lß╗ìc
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
            L├ám mß╗¢i
          </Button>
        </div>

        {historyQuery.isLoading ? (
          <LoadingState label="─Éang tß║úi lß╗ïch sß╗¡ biß║┐n ─æß╗Öng..." />
        ) : historyQuery.isError ? (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Kh├┤ng thß╗â tß║úi lß╗ïch sß╗¡. Kiß╗âm tra quyß╗ün truy cß║¡p hoß║╖c thß╗¡ lß║íi.
          </div>
        ) : historyQuery.data?.items.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Ch╞░a c├│ lß╗ïch sß╗¡ biß║┐n ─æß╗Öng ph├╣ hß╗úp bß╗Ö lß╗ìc.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3">Thß╗¥i gian</th>
                    {scope === "cohort" && <th className="px-3 py-3">Lß╗¢p</th>}
                    <th className="px-3 py-3">Hß╗ìc vi├¬n</th>
                    <th className="px-3 py-3">Nh├│m c┼⌐ ΓåÆ mß╗¢i</th>
                    <th className="px-3 py-3">Role c┼⌐ ΓåÆ mß╗¢i</th>
                    <th className="px-3 py-3">Biß║┐n ─æß╗Öng</th>
                    <th className="px-3 py-3">L├╜ do</th>
                    <th className="px-3 py-3">Ng╞░ß╗¥i thß╗▒c hiß╗çn</th>
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
                        {item.fromTeamName ?? "Ch╞░a thuß╗Öc nh├│m"}
                        <span className="mx-2 text-muted-foreground">ΓåÆ</span>
                        {item.toTeamName ?? "Kh├┤ng thuß╗Öc nh├│m"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        {item.fromRole ?? "ΓÇö"}
                        <span className="mx-2 text-muted-foreground">ΓåÆ</span>
                        {item.toRole ?? "ΓÇö"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        {historyActionLabel(item.action)}
                      </td>
                      <td className="max-w-64 px-3 py-3">{item.reason ?? "ΓÇö"}</td>
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
                {historyQuery.data?.totalElements ?? 0} biß║┐n ─æß╗Öng ┬╖ Trang{" "}
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
                  Tr╞░ß╗¢c
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
      return "─Éß╗òi vai tr├▓";
    case "MEMBER_TRANSFERRED":
      return "Chuyß╗ân nh├│m";
    case "MEMBER_SWAPPED":
      return "─Éß╗òi vß╗ï tr├¡";
    case "MEMBER_ADDED":
      return "Th├¬m th├ánh vi├¬n";
    case "MEMBER_REMOVED":
      return "Gß╗í th├ánh vi├¬n";
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
        aria-label={`Chß╗ìn ${member.fullName}`}
      />
      <span className="min-w-0 flex-1 truncate font-medium">
        {member.fullName}{member.userCode ? <span className="ml-2 text-xs font-normal text-muted-foreground">{member.userCode}</span> : null}
      </span>
      <span className="text-xs text-muted-foreground">#{member.memberId}</span>
      {duplicateDraft && (
        <span className="text-xs text-amber-700 dark:text-amber-300">─É├ú ß╗ƒ nh├│m DRAFT kh├íc</span>
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
  const templatesError = templatesQuery.isError ? "Kh├┤ng tß║úi ─æ╞░ß╗úc danh s├ích ─æß╗ü b├ái." : null;
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
        aria-label={`Xem chi tiß║┐t ${team.teamName}`}
        onClick={() => setDetailsOpen(true)}
      >
        <span className="min-w-0">
          <span className="block truncate font-semibold">{team.teamName}</span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {team.memberIds.length} th├ánh vi├¬n
          </span>
          <span
            className={`mt-1 block truncate text-xs ${
              team.projectTemplateId ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {team.projectTemplateId
              ? `─Éß╗ü b├ái: ${team.projectTemplateName ?? `#${team.projectTemplateId}`}`
              : team.status === "DRAFT"
                ? "Ch╞░a g├ín ─æß╗ü b├ái ┬╖ nhß║Ñn ─æß╗â g├ín"
                : "Ch╞░a g├ín ─æß╗ü b├ái"}
          </span>
          <span className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
              {mentorInitials || "?"}
            </span>
            {mentorName ?? "Ch╞░a g├ín Mentor"}
          </span>
        </span>
      </button>
      {team.status === "DRAFT" && (
        <div className="min-w-0 rounded-lg border bg-muted/20 px-3 py-2">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Th├ánh vi├¬n ({team.memberIds.length})
          </p>
          {team.memberIds.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nh├│m ch╞░a c├│ th├ánh vi├¬n.</p>
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
          : "max-h-[85vh] overflow-y-auto sm:max-w-xl"}>
          <div className={pickerOpen ? "hidden" : "contents"}>
          <DialogHeader>
            <DialogTitle>{team.teamName}</DialogTitle>
            <DialogDescription>
              {team.memberIds.length} th├ánh vi├¬n ┬╖ Trß║íng th├íi {team.status}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border bg-background p-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {mentorInitials || "?"}
              </span>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Mentor phß╗Ñ tr├ích</p>
                <p className="truncate text-sm font-medium">
                  {mentorName ?? "Ch╞░a g├ín Mentor"}
                </p>
              </div>
            </div>
            {isActive && canManageMentor && (
              <div className="flex flex-wrap gap-2">
                <select
                  aria-label={`Chß╗ìn Mentor cho ${team.teamName}`}
                  className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
                  value={selectedMentor}
                  onChange={(event) => setSelectedMentor(event.target.value)}
                >
                  <option value="">Chß╗ìn Mentor...</option>
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
                  Cß║¡p nhß║¡t Mentor
                </Button>
              </div>
            )}
            <div className="space-y-2 rounded-lg border bg-background p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">─Éß╗ü b├ái dß╗▒ ├ín</p>
                <Badge variant={team.projectTemplateId ? "default" : "secondary"}>
                  {team.projectTemplateId ? "─É├ú g├ín" : "Ch╞░a g├ín"}
                </Badge>
              </div>
              <p className="text-sm font-medium">
                {team.projectTemplateName ?? "Ch╞░a g├ín ─æß╗ü b├ái"}
              </p>
              <p className="text-xs text-muted-foreground">
                S─⌐ sß╗æ hiß╗çn tß║íi: {team.memberCount ?? team.memberIds.length} th├ánh vi├¬n
                {team.minMembers != null && team.maxMembers != null
                  ? ` ┬╖ ─Éß╗ü b├ái y├¬u cß║ºu ${team.minMembers}ΓÇô${team.maxMembers} th├ánh vi├¬n`
                  : ""}
              </p>
              {assignTemplateError && (
                <div
                  role="alert"
                  className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                >
                  <p className="font-medium">
                    {assignTemplateError.errorCode === "ERR_TEAM_NOT_DRAFT"
                      ? "Nh├│m kh├┤ng c├▓n ß╗ƒ trß║íng th├íi DRAFT"
                      : assignTemplateError.reason === "MIN_MEMBERS_NOT_MET"
                        ? "Nh├│m ch╞░a ─æß╗º s─⌐ sß╗æ tß╗æi thiß╗âu"
                        : "S─⌐ sß╗æ nh├│m v╞░ß╗út qu├í sß╗⌐c chß╗⌐a cß╗ºa ─æß╗ü b├ái"}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {assignTemplateError.message}
                  </p>
                  {assignTemplateError.minMembers != null &&
                    assignTemplateError.maxMembers != null && (
                    <p className="mt-1 text-muted-foreground">
                      Y├¬u cß║ºu {assignTemplateError.minMembers}ΓÇô
                      {assignTemplateError.maxMembers} th├ánh vi├¬n ┬╖ hiß╗çn c├│{" "}
                      {assignTemplateError.memberCount ?? 0}.
                    </p>
                  )}
                </div>
              )}
              {isDraft && (
                <div className="flex flex-wrap gap-2">
                  <select
                    aria-label={`Chß╗ìn ─æß╗ü b├ái cho ${team.teamName}`}
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
                      {templatesLoading ? "─Éang tß║úi ─æß╗ü b├ái..." : "Chß╗ìn ─æß╗ü b├ái"}
                    </option>
                    {team.projectTemplateId != null && !templates.some((option) => option.templateId === team.projectTemplateId) && (
                      <option value={team.projectTemplateId}>
                        {team.projectTemplateName ?? `#${team.projectTemplateId}`}
                      </option>
                    )}
                    {templates.map((option) => (
                      <option key={option.templateId} value={option.templateId}>
                        {option.name} ({option.minMembers}ΓÇô{option.maxMembers} th├ánh vi├¬n)
                      </option>
                    ))}
                    {selectedCandidate && !templates.some((option) => option.templateId === selectedCandidate.templateId) && (
                      <option value={selectedCandidate.templateId}>
                        {selectedCandidate.name} ({selectedCandidate.minMembers}ΓÇô{selectedCandidate.maxMembers} th├ánh vi├¬n)
                      </option>
                    )}
                  </select>
                  <Button type="button" size="sm" variant="outline"
                    disabled={!canAssignTemplate || assignTemplatePending}
                    onClick={() => setPickerOpen(true)}>
                    <Search className="size-4" /> T├¼m ─æß╗ü b├ái
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
                    G├ín ─æß╗ü b├ái
                  </Button>
                </div>
              )}
              {isDraft && selectedCandidate && templateChanged && (
                <p role="status" className="rounded-md bg-primary/5 px-3 py-2 text-xs text-primary">
                  ─Éang chß╗ìn ΓÇ£{selectedCandidate.name}ΓÇ¥ ({selectedCandidate.version}). Bß║Ñm G├ín ─æß╗ü b├ái hoß║╖c L╞░u ─æß╗â x├íc nhß║¡n.
                </p>
              )}
              {templatesError && (
                <p className="text-xs text-destructive">{templatesError}</p>
              )}
              {!isDraft && (
                <div className="space-y-1.5 rounded-lg bg-muted/50 p-2.5">
                  <p className="text-xs text-muted-foreground">
                    Nh├│m ─æang ß╗ƒ trß║íng th├íi <strong>{team.status}</strong> n├¬n kh├┤ng thß╗â ─æß╗òi
                    ─æß╗ü b├ái. ─Éß╗ü b├ái chß╗ë ─æ╞░ß╗úc g├ín khi nh├│m c├▓n ß╗ƒ trß║íng th├íi DRAFT (tr╞░ß╗¢c khi
                    publish phi├¬n).
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
                      Tß║ío phi├¬n ph├ón nh├│m mß╗¢i ─æß╗â g├ín ─æß╗ü b├ái
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Li├¬n hß╗ç Mentor/Program Manager ─æß╗â tß║ío phi├¬n ph├ón nh├│m mß╗¢i.
                    </p>
                  )}
                </div>
              )}
              {!canAssignTemplate && isDraft && (
                <p className="text-xs text-muted-foreground">
                  Bß║ín kh├┤ng c├│ quyß╗ün g├ín ─æß╗ü b├ái cho nh├│m n├áy.
                </p>
              )}
            </div>
            {team.projectTemplateId == null ? (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                G├ín ─æß╗ü b├ái dß╗▒ ├ín ─æß╗â xem danh s├ích th├ánh vi├¬n v├á cß║Ñu h├¼nh vai tr├▓.
              </p>
            ) : (
              <>
            <div>
              <p className="mb-2 text-sm font-medium">Danh s├ích th├ánh vi├¬n</p>
              {members.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Nh├│m ch╞░a c├│ th├ánh vi├¬n.
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
                      <span className="min-w-0 truncate">{member.fullName}{member.userCode ? ` ┬╖ ${member.userCode}` : ""}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        {canManageRoles ? (
                          allowMultiRole ? (
                            <span
                              role="group"
                              aria-label={`Vai tr├▓ cß╗ºa ${member.fullName}`}
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
                                    aria-label={`${TEAM_ROLE_LABEL[role]} cß╗ºa ${member.fullName}`}
                                  />
                                  {TEAM_ROLE_LABEL[role]}
                                </label>
                              ))}
                            </span>
                          ) : (
                            <select
                              aria-label={`Vai tr├▓ cß╗ºa ${member.fullName}`}
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
                              <option value="">Vui l├▓ng chß╗ìn vai tr├▓</option>
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
                              <Badge variant="outline">Ch╞░a g├ín</Badge>
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
                            aria-label={`Gß╗í ${member.fullName} khß╗Åi nh├│m`}
                            title={`Gß╗í ${member.fullName} khß╗Åi nh├│m`}
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
                            aria-label={`Chuyß╗ân ${member.fullName} sang nh├│m kh├íc`}
                            title={`Chuyß╗ân ${member.fullName} sang nh├│m kh├íc`}
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
                {!team.projectTemplateId && (
                  <p className="text-xs text-muted-foreground">
                    Nh├│m ch╞░a g├ín ─æß╗ü b├ái: mß║╖c ─æß╗ïnh mß╗ùi th├ánh vi├¬n chß╗ë chß╗ìn 1 vai tr├▓.
                    G├ín ─æß╗ü b├ái ─æß╗â ├íp dß╗Ñng ─æß╗ïnh suß║Ñt v├á quy tß║»c ki├¬m nhiß╗çm cß╗ºa ─æß╗ü b├ái.
                  </p>
                )}
                {roleQuotas.length > 0 && (
                  <div className="rounded-lg border bg-muted/30 p-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-medium">
                        ─Éß╗ïnh suß║Ñt vai tr├▓ cß╗ºa ─æß╗ü b├ái
                      </p>
                      <Badge variant={allowMultiRole ? "secondary" : "outline"}>
                        {allowMultiRole ? "Cho ph├⌐p ki├¬m nhiß╗çm" : "Kh├┤ng ki├¬m nhiß╗çm"}
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
                              {gap ? ` ┬╖ hiß╗çn c├│ ${gap.actual}` : ""}
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
                      ? "Dß╗» liß╗çu/Version nh├│m ─æ├ú bß╗ï thay ─æß╗òi, vui l├▓ng tß║úi lß║íi trang"
                      : roleSaveError.message}
                    {roleSaveError.violations &&
                      roleSaveError.violations.length > 0 && (
                        <ul className="mt-2 space-y-0.5 text-xs">
                          {roleSaveError.violations.map((violation) => (
                            <li key={`${violation.role}-${violation.reason}`}>
                              {violation.role}:{" "}
                              {violation.reason === "MISSING_REQUIRED_ROLE"
                                ? `cß║ºn tß╗æi thiß╗âu ${violation.required}, hiß╗çn c├│ ${violation.actual}`
                                : `tß╗æi ─æa ${violation.required}, hiß╗çn c├│ ${violation.actual}`}
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
                    Vui l├▓ng chß╗ìn ├¡t nhß║Ñt mß╗Öt vai tr├▓ cho mß╗ùi th├ánh vi├¬n
                    {localRoleErrors.length > 0 ? ` (${localRoleErrors.length} th├ánh vi├¬n)` : ""}.
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
                          ? "Mß╗ùi th├ánh vi├¬n cß║ºn ├¡t nhß║Ñt mß╗Öt vai tr├▓."
                          : "─Éß╗ü b├ái kh├┤ng cho ph├⌐p ki├¬m nhiß╗çm vai tr├▓.",
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
                  L╞░u vai tr├▓
                </Button>
                )}
              </div>
            )}
              </>
            )}
            {isActive && canManageMembers && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  ─Éß╗â thay th├ánh vi├¬n, h├úy gß╗í th├ánh vi├¬n hiß╗çn tß║íi rß╗ôi th├¬m hß╗ìc vi├¬n kh├íc v├áo nh├│m.
                </p>
                <div className="flex flex-wrap gap-2">
                  <select
                    aria-label={`Chß╗ìn hß╗ìc vi├¬n th├¬m v├áo ${team.teamName}`}
                    className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
                    value={selectedToAdd}
                    disabled={membershipPending || team.memberIds.length >= maxMembers}
                    onChange={(event) => setSelectedToAdd(event.target.value)}
                  >
                    <option value="">Th├¬m hß╗ìc vi├¬n ch╞░a v├áo nh├│m ACTIVE...</option>
                    {memberOptions
                      .filter((option) => !option.assignedToActiveTeam)
                      .map((option) => (
                        <option key={option.memberId} value={option.memberId}>
                          {option.fullName}{option.userCode ? ` ┬╖ ${option.userCode}` : ""}
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
                    Th├¬m
                  </Button>
                </div>
                {team.memberIds.length >= maxMembers && (
                  <p className="text-xs text-muted-foreground">
                    Nh├│m ─æ├ú ─æß║ít sß╗⌐c chß╗⌐a tß╗æi ─æa ({maxMembers}).
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
                  Chß╗ënh sß╗¡a DRAFT
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
                            ? "Mß╗ùi th├ánh vi├¬n cß║ºn ├¡t nhß║Ñt mß╗Öt vai tr├▓."
                            : "─Éß╗ü b├ái kh├┤ng cho ph├⌐p ki├¬m nhiß╗çm vai tr├▓.",
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
                  L╞░u
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
          ─Éß╗º ─æiß╗üu kiß╗çn c├┤ng bß╗æ (Ready to Publish)
        </p>
        <p className="text-sm text-muted-foreground">
          {report.assignedStudents}/{report.totalStudents} hß╗ìc vi├¬n ─æ├ú c├│ nh├│m ┬╖{" "}
          {report.totalTeams} nh├│m ┬╖ {report.teamsWithTemplate}/{report.totalTeams} nh├│m
          c├│ ─æß╗ü b├ái hß╗úp lß╗ç ┬╖ kh├┤ng c├▓n hß╗ìc vi├¬n tß╗▒ do.
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
        Ch╞░a ─æß╗º ─æiß╗üu kiß╗çn c├┤ng bß╗æ
      </p>
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="outline" className="border-destructive text-destructive">
          {report.unassignedStudentCount} hß╗ìc vi├¬n tß╗▒ do
        </Badge>
        <Badge variant="outline" className="border-destructive text-destructive">
          {report.teamIssues.length} lß╗ùi nh├│m
        </Badge>
        <Badge variant="outline" className="border-destructive text-destructive">
          {report.teamsWithTemplate}/{report.totalTeams} nh├│m c├│ ─æß╗ü b├ái
        </Badge>
      </div>
      {report.unassignedStudents.length > 0 && (
        <div className="rounded-lg border-2 border-destructive bg-background p-3">
          <p className="text-sm font-semibold text-destructive">
            Danh s├ích hß╗ìc vi├¬n ch╞░a c├│ nh├│m ({report.unassignedStudentCount})
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {report.unassignedStudents.map((student) => (
              <Badge
                key={student.memberId}
                variant="outline"
                className="border-destructive bg-destructive/10 text-destructive"
              >
                {student.fullName}{student.userCode ? ` ┬╖ ${student.userCode}` : ` (#${student.memberId})`}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {report.teamIssues.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-background p-3">
          <p className="text-sm font-semibold text-destructive">Lß╗ùi theo nh├│m</p>
          <ul className="mt-2 space-y-2 text-xs">
            {report.teamIssues.map((issue, index) => (
              <li key={`${issue.teamId}-${issue.code}-${index}`}>
                <span className="font-medium">
                  {issue.teamName} (#{issue.teamId})
                </span>{" "}
                ΓÇö {issue.message}
                {issue.violations?.length ? (
                  <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                    {issue.violations.map((violation) => (
                      <li key={`${violation.role}-${violation.reason}`}>
                        {violation.role}:{" "}
                        {violation.reason === "MISSING_REQUIRED_ROLE"
                          ? `cß║ºn tß╗æi thiß╗âu ${violation.required}, hiß╗çn c├│ ${violation.actual}`
                          : `tß╗æi ─æa ${violation.required}, hiß╗çn c├│ ${violation.actual}`}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {issue.memberIds?.length ? (
                  <span className="text-muted-foreground">
                    {" "}┬╖ Th├ánh vi├¬n: {issue.memberIds.map((id) => `#${id}`).join(", ")}
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
        Cß║únh b├ío hß╗ìc vi├¬n tr├╣ng trong c├íc nh├│m DRAFT
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
