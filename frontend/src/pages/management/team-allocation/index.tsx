import { teamAllocationApi, trainingClassApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { usePermissions } from "@/hooks/usePermissions";
import { MetricCard } from "./MetricCard";
import type {
  AllocationApiError,
  AllocationSession,
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
  Users,
  UsersRound,
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
      message:
        data?.message ??
        data?.error ??
        error.message ??
        "Không thể hoàn tất yêu cầu. Vui lòng thử lại.",
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

/**
 * Class session page: the entry point of the team-allocation flow.
 * The mentor creates/reopens an allocation session here, then moves to
 * `/team-allocation/classes/:classId/setup` to allocate and set up teams.
 */
export default function TeamAllocationSessionPage() {
  const { hasPermission } = usePermissions();
  const { classId: classIdParam } = useParams<{ classId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const classId = Number(classIdParam);
  const canAllocate = hasPermission("PEO_TEAM_ALLOCATE");
  const [capacityInput, setCapacityInput] = useState("");
  const [cancelTarget, setCancelTarget] = useState<AllocationSession | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [summaryDialog, setSummaryDialog] = useState<
    "unassigned" | "saved" | "publishable" | null
  >(null);

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
    </MainLayout>
  );
}
