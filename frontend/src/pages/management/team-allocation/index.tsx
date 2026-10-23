import { teamAllocationApi } from "@/api";
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
  AllocationSession,
  AllocationTeam,
  ClassMember,
  ClassRosterMember,
  DraftWarning,
  PublishTeamsResponse,
  SaveDraftRequest,
  TeamListResponse,
} from "@/types/features/team-allocation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  AlertCircle,
  CircleAlert,
  ClipboardList,
  LoaderCircle,
  Plus,
  Ban,
  Save,
  Search,
  Send,
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
  memberIds: number[];
}

interface ApiFailure {
  status: number;
  code: string;
  message: string;
  memberId: number | null;
  unassignedCount?: number;
  unassignedMemberIds?: number[];
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
    };
  }

  return {
    status: 0,
    code: "ERR_REQUEST_FAILED",
    message: error instanceof Error
      ? error.message
      : "Không thể hoàn tất yêu cầu. Vui lòng thử lại.",
    memberId: null,
  };
}

function makeIdempotencyKey() {
  return crypto.randomUUID();
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
  const [draftTeams, setDraftTeams] = useState<LocalDraftTeam[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberPickerTeamId, setMemberPickerTeamId] = useState<string | null>(null);
  const [editingSavedTeamId, setEditingSavedTeamId] = useState<number | null>(null);
  const [rosterSearch, setRosterSearch] = useState("");
  const [saveFailure, setSaveFailure] = useState<ApiFailure | null>(null);
  const [publishFailure, setPublishFailure] = useState<ApiFailure | null>(null);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);
  const [publishItemFailures, setPublishItemFailures] = useState<
    PublishTeamsResponse["failedItems"]
  >([]);
  const [lastWarnings, setLastWarnings] = useState<DraftWarning[]>([]);
  const saveKeyRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const publishKeyRef = useRef<{ fingerprint: string; key: string } | null>(null);

  const sessionId = session?.id ?? null;
  const sessionsQuery = useQuery({
    queryKey: ["team-allocation", "sessions", classId],
    queryFn: () => teamAllocationApi.getSessions(classId),
    enabled: Number.isSafeInteger(classId) && classId > 0,
  });
  const membersQuery = useQuery({
    queryKey: ["team-allocation", "unassigned-members", classId, sessionId],
    queryFn: () => teamAllocationApi.getUnassignedMembers(classId, sessionId!),
    enabled: Number.isSafeInteger(classId) && classId > 0 && sessionId !== null,
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
            members: team.memberIds.map((memberId) => ({ memberId, role: null })),
          },
        );
      }
      if (newDrafts.length === 0) return [];

      const payload: SaveDraftRequest = {
        teams: newDrafts.map((team) => ({
          teamName: team.teamName.trim(),
          members: team.memberIds.map((memberId) => ({ memberId, role: null })),
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

  const publishMutation = useMutation({
    mutationFn: (teamIds: number[]) => {
      if (classId === null || sessionId === null) {
        throw new Error("Không có phiên phân nhóm đang mở.");
      }
      const fingerprint = JSON.stringify({ classId, sessionId, teamIds });
      const key = getStoredKey(publishKeyRef, fingerprint);
      return teamAllocationApi.publishTeams(classId, sessionId, teamIds, key);
    },
    onSuccess: async (response) => {
      publishKeyRef.current = null;
      setPublishFailure(null);
      const succeededItems = response?.succeededItems ?? [];
      const failedItems = response?.failedItems ?? [];
      setPublishItemFailures(failedItems);
      if (classId !== null && sessionId !== null && succeededItems.length > 0) {
        queryClient.setQueryData<TeamListResponse>(
          ["team-allocation", "teams", classId, sessionId],
          (current) => current
            ? {
                ...current,
                teams: current.teams.map((team) =>
                  succeededItems.includes(team.teamId)
                    ? { ...team, status: "ACTIVE" }
                    : team,
                ),
              }
            : current,
        );
      }
      if (succeededItems.length > 0) {
        const successMessage = `Đã publish thành công ${succeededItems.length} nhóm.`;
        setPublishSuccess(successMessage);
        toast.success(successMessage);
      } else {
        setPublishSuccess(null);
      }
      void queryClient.invalidateQueries({
        queryKey: ["team-allocation", "teams", classId, sessionId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["team-allocation", "sessions", classId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["team-allocation", "unassigned-members", classId, sessionId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["team-allocation", "class-roster", classId, sessionId],
      });
      if (failedItems.length) {
        setPublishSuccess(null);
        toast.warning(
          `Đã publish ${succeededItems.length} nhóm; ${failedItems.length} nhóm cần xử lý.`,
        );
      }
      if (
        failedItems.length === 0 &&
        succeededItems.length > 0 &&
        succeededItems.length >= publishableTeams.length
      ) {
        setSession((current) => {
          if (!current) return current;
          const publishedSession = { ...current, status: "PUBLISHED" as const };
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(publishedSession));
          return publishedSession;
        });
      }
    },
    onError: (error) => {
      const failure = getApiFailure(error);
      setPublishSuccess(null);
      setPublishFailure(failure);
      toast.error(failure.message);
    },
  });

  const invalidateMembershipQueries = async () => {
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

  const members = membersQuery.data ?? [];
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
  const filteredRoster = (rosterQuery.data ?? []).filter((member) =>
    member.fullName.toLowerCase().includes(rosterSearch.trim().toLowerCase()) ||
    String(member.memberId).includes(rosterSearch.trim()),
  );
  const publishableTeams = savedTeams.filter((team) => team.status === "DRAFT");
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
        memberIds: [],
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
      memberIds: [...team.memberIds],
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

  const togglePublishTeam = (team: AllocationTeam) => {
    if (publishMutation.isPending) return;
    setPublishItemFailures([]);
    setPublishFailure(null);
    setPublishSuccess(null);
    publishMutation.mutate([team.teamId]);
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

        {!hasPermission("PEO_TEAM_ALLOCATE") && (
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
                      Phiên đã publish hoặc đóng nên không thể thay đổi sức chứa.
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

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Danh sách học viên trong lớp</CardTitle>
                <CardDescription>
                  {rosterQuery.data
                    ? `${rosterQuery.data.length} học viên ACTIVE · trạng thái phân nhóm trong phiên đang chọn`
                    : "Danh sách học viên ACTIVE của lớp và trạng thái nhóm trong phiên đang chọn."}
                </CardDescription>
              </div>
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Tìm theo tên hoặc mã học viên"
                  aria-label="Tìm trong danh sách học viên"
                  value={rosterSearch}
                  onChange={(event) => setRosterSearch(event.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {rosterQuery.isError ? (
              <div role="alert" className="rounded-xl border border-destructive/30 p-5 text-sm">
                <p className="text-destructive">Không tải được danh sách học viên.</p>
                <Button
                  className="mt-3"
                  variant="outline"
                  size="sm"
                  onClick={() => void rosterQuery.refetch()}
                >
                  Thử tải lại
                </Button>
              </div>
            ) : rosterQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />
                Đang tải danh sách học viên...
              </div>
            ) : filteredRoster.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {(rosterQuery.data ?? []).length === 0
                  ? "Lớp chưa có học viên ACTIVE."
                  : "Không tìm thấy học viên phù hợp."}
              </p>
            ) : (
              <div className="max-h-96 divide-y overflow-y-auto rounded-lg border">
                {filteredRoster.map((member: ClassRosterMember) => (
                  <div
                    key={member.memberId}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                  >
                    <span className="font-medium">{member.fullName}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">#{member.memberId}</span>
                      <Badge variant={member.assignedToActiveTeam ? "secondary" : "outline"}>
                        {member.assignedToActiveTeam
                          ? "Đã vào nhóm ACTIVE trong phiên"
                          : "Chưa vào nhóm ACTIVE trong phiên"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {session && (
          <>
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
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Xóa Nhóm ${teamIndex + 1}`}
                              onClick={() => {
                                if (team.savedTeamId !== undefined) {
                                  cancelDraftEditing();
                                  return;
                                }
                                setDraftTeams((current) =>
                                  current.filter((item) => item.localId !== team.localId),
                                );
                                if (memberPickerTeamId === team.localId) {
                                  setMemberPickerTeamId(null);
                                }
                                setSaveFailure(null);
                              }}
                            >
                              <Trash2 className="size-4 text-muted-foreground" />
                            </Button>
                          </div>
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
                    Các nhóm DRAFT chưa giữ chỗ học viên. Publish sẽ kiểm tra lại trạng thái thành viên.
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
                        publishFailure.unassignedMemberIds &&
                        publishFailure.unassignedMemberIds.length > 0 && (
                          <div className="mt-3 rounded-lg border-2 border-destructive bg-background p-3">
                            <p className="font-semibold">
                              Học viên chưa được xếp nhóm ({publishFailure.unassignedCount})
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {publishFailure.unassignedMemberIds.map((memberId) => (
                                <Badge
                                  key={memberId}
                                  variant="outline"
                                  className="border-destructive text-destructive"
                                >
                                  {nameForMember(memberId)}
                                </Badge>
                              ))}
                            </div>
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
                          memberOptions={rosterQuery.data ?? []}
                          maxMembers={session.maxMembers}
                          canManageMembers={
                            hasPermission("PEO_TEAM_ALLOCATE") &&
                            (session.status === "OPEN" || session.status === "PUBLISHED")
                          }
                          membershipPending={
                            addActiveMemberMutation.isPending ||
                            removeActiveMemberMutation.isPending
                          }
                          pending={
                            publishMutation.isPending ||
                            saveDraftMutation.isPending ||
                            draftTeams.length > 0 ||
                            session.status !== "OPEN"
                          }
                          onEdit={() => editSavedTeam(team)}
                          onPublish={() => togglePublishTeam(team)}
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
                        />
                      ))}
                    </div>
                  )}
                  {publishableTeams.length > 1 && (
                    <Button
                      className="w-full"
                      variant="outline"
                      disabled={publishMutation.isPending || !hasPermission("PEO_TEAM_ALLOCATE")}
                      onClick={() => {
                        setPublishItemFailures([]);
                        setPublishFailure(null);
                        setPublishSuccess(null);
                        publishMutation.mutate(
                          publishableTeams.map((team) => team.teamId),
                        );
                      }}
                    >
                      {publishMutation.isPending
                        ? <LoaderCircle className="size-4 animate-spin" />
                        : <Send className="size-4" />}
                      Publish tất cả nhóm DRAFT
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
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
  memberOptions,
  maxMembers,
  canManageMembers,
  membershipPending,
  pending,
  onEdit,
  onPublish,
  onAddMember,
  onRemoveMember,
}: {
  team: AllocationTeam;
  memberName: (memberId: number) => string;
  memberOptions: ClassRosterMember[];
  maxMembers: number;
  canManageMembers: boolean;
  membershipPending: boolean;
  pending: boolean;
  onEdit: () => void;
  onPublish: () => void;
  onAddMember: (memberId: number) => void;
  onRemoveMember: (memberId: number) => void;
}) {
  const [selectedToAdd, setSelectedToAdd] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const isDraft = team.status === "DRAFT";
  const isActive = team.status === "ACTIVE";
  const members = team.members?.length
    ? team.members
    : team.memberIds.map((memberId) => ({
        memberId,
        fullName: memberName(memberId),
      }));
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
            <div>
              <p className="mb-2 text-sm font-medium">Danh sách thành viên</p>
              {members.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Nhóm chưa có thành viên.
                </p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {members.map((member) => (
                    <li
                      key={member.memberId}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                    >
                      <span className="min-w-0 truncate">{member.fullName}</span>
                      <span className="flex shrink-0 items-center gap-2">
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
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
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
                  disabled={pending}
                  onClick={() => {
                    setDetailsOpen(false);
                    onEdit();
                  }}
                >
                  Chỉnh sửa DRAFT
                </Button>
                <Button
                  disabled={pending || members.length === 0}
                  onClick={() => {
                    setDetailsOpen(false);
                    onPublish();
                  }}
                >
                  {pending
                    ? <LoaderCircle className="size-4 animate-spin" />
                    : <Send className="size-4" />}
                  Publish
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
