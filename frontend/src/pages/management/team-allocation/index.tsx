import { teamAllocationApi, trainingClassApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";
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
  Check,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  GraduationCap,
  Hash,
  Info,
  Layers,
  ListChecks,
  LoaderCircle,
  Minus,
  Plus,
  RefreshCw,
  ShieldAlert,
  Users,
  UsersRound,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
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
  PUBLISHED: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  CLOSED: "border-muted-foreground/30 bg-muted text-muted-foreground",
  CANCELLED: "border-destructive/40 bg-destructive/10 text-destructive",
};

const CLASS_STATUS_LABEL: Record<TrainingClassDTO["status"], string> = {
  PLANNING: "Đang lên kế hoạch",
  ONGOING: "Đang diễn ra",
  COMPLETED: "Đã hoàn thành",
  CANCELLED: "Đã hủy",
};

const CLASS_STATUS_CLASS: Record<TrainingClassDTO["status"], string> = {
  PLANNING: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  ONGOING: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  COMPLETED: "border-primary/40 bg-primary/10 text-primary",
  CANCELLED: "border-destructive/40 bg-destructive/10 text-destructive",
};

/**
 * Per-status feedback accents for the session list rows: only a slim status
 * bar and the row icon carry colour, the row itself stays neutral.
 */
const SESSION_ROW_TONE: Record<AllocationSessionStatus, { bar: string; tile: string }> = {
  OPEN: {
    bar: "bg-emerald-500",
    tile: "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  PUBLISHED: {
    bar: "bg-sky-500",
    tile: "border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  CLOSED: {
    bar: "bg-muted-foreground/40",
    tile: "border-border bg-muted text-muted-foreground",
  },
  CANCELLED: {
    bar: "bg-destructive",
    tile: "border-destructive/25 bg-destructive/10 text-destructive",
  },
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
  const capacityInputRef = useRef<HTMLInputElement>(null);

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
      setSelectedSessionId(openedSession.id);
      setCapacityInput("");
      void queryClient.invalidateQueries({
        queryKey: ["team-allocation", "sessions", classId],
      });
      toast.success(
        `Đã tạo phiên phân nhóm #${openedSession.sessionNumber}. Bấm “Allocate Team” để bắt đầu.`,
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
  const capacityState = capacityInput.trim() === "" ? "empty" : capacityValid ? "valid" : "invalid";
  const isRefreshing = sessionsQuery.isFetching || classQuery.isFetching;

  const handleCreateSession = () => {
    if (!capacityValid) {
      toast.error("Sức chứa phải là số nguyên dương.");
      capacityInputRef.current?.focus();
      return;
    }
    openSessionMutation.mutate(maxMembers);
  };

  const stepCapacity = (delta: number) => {
    const current = Number(capacityInput);
    const base = Number.isSafeInteger(current) && current > 0 ? current : 1;
    setCapacityInput(String(Math.max(1, Math.min(999, base + delta))));
  };

  const refreshPage = () => {
    void classQuery.refetch();
    void sessionsQuery.refetch();
    if (selectedSession) {
      void sessionTeamsQuery.refetch();
      if (canAllocate) void unassignedQuery.refetch();
    }
  };

  const openSetup = (session: AllocationSession) => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    navigate(`/team-allocation/classes/${classId}/setup?sessionId=${session.id}`);
  };

  const metaChip =
    "inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground";

  return (
    <MainLayout
      pathName={{ "team-allocation": "Project Team Allocation" }}
      // `classes` has no route of its own; send the crumb to the class list.
      pathLinks={{ classes: "/team-allocation" }}
    >
      <div className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col gap-5">
        <section className="shrink-0 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <UsersRound className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Team allocation
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2.5">
                  <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
                    {trainingClass?.name ?? `Lớp #${classId}`}
                  </h1>
                  {trainingClass && (
                    <Badge
                      variant="outline"
                      className={cn("shrink-0", CLASS_STATUS_CLASS[trainingClass.status])}
                    >
                      {CLASS_STATUS_LABEL[trainingClass.status]}
                    </Badge>
                  )}
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  {trainingClass ? (
                    <>
                      <span className={metaChip}>
                        <Hash className="size-3.5" />
                        {trainingClass.code}
                      </span>
                      <span className={metaChip}>
                        <Users className="size-3.5" />
                        {trainingClass.memberCount} học viên
                      </span>
                      {trainingClass.programName && (
                        <span className={metaChip}>
                          <GraduationCap className="size-3.5" />
                          {trainingClass.programName}
                        </span>
                      )}
                      {trainingClass.cohortName && (
                        <span className={metaChip}>
                          <Layers className="size-3.5" />
                          {trainingClass.cohortName}
                        </span>
                      )}
                    </>
                  ) : classQuery.isLoading ? (
                    <span className={metaChip}>
                      <LoaderCircle className="size-3.5 animate-spin" />
                      Đang tải thông tin lớp…
                    </span>
                  ) : (
                    <span className={metaChip}>
                      <Info className="size-3.5" />
                      Chưa tải được thông tin lớp
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row lg:shrink-0">
              <Button variant="outline" onClick={refreshPage} disabled={isRefreshing} className="gap-2">
                {isRefreshing ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                {isRefreshing ? "Đang làm mới…" : "Làm mới"}
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/team-allocation")}
                className="gap-2"
              >
                <ArrowLeft className="size-4" />
                Quay lại danh sách lớp
              </Button>
            </div>
          </div>
        </section>

        {!canAllocate && !hasPermission("PRJ_WORKSPACE_MANAGE") && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
          >
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <span>Tài khoản hiện tại không có quyền phân nhóm dự án.</span>
          </div>
        )}

        {selectedSession && (
          <section className="shrink-0 space-y-2.5" aria-label="Tổng quan phiên phân nhóm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="size-1.5 rounded-full bg-muted-foreground/50" />
              <p className="text-sm font-medium">
                Tổng quan phiên #{selectedSession.sessionNumber}
              </p>
              <Badge
                variant="outline"
                className={SESSION_STATUS_CLASS[selectedSession.status]}
              >
                {SESSION_STATUS_LABEL[selectedSession.status]}
              </Badge>
              {sessionTeamsQuery.isFetching && (
                <span
                  role="status"
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <LoaderCircle className="size-3.5 animate-spin" />
                  Đang đồng bộ…
                </span>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
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
                tone={publishableTeams.length > 0 ? "warning" : "success"}
                onClick={() => setSummaryDialog("publishable")}
              />
            </div>
          </section>
        )}

        <div className="grid gap-5 xl:min-h-0 xl:flex-1 xl:grid-cols-2 xl:grid-rows-1">
          <Card className="relative flex min-h-0 flex-col gap-0 overflow-hidden py-0 shadow-sm">
            <CardHeader className="grid shrink-0 grid-rows-1 gap-0 border-b px-5 py-3.5 [.border-b]:pb-3.5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarDays className="size-4 text-muted-foreground" />
                  Phiên phân nhóm
                  <Badge variant="secondary" className="tabular-nums">
                    {sessions.length}
                  </Badge>
                </CardTitle>
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
            <CardContent className="space-y-5 px-5 pb-5 pt-4 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  handleCreateSession();
                }}
                className="rounded-xl border bg-muted/30 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="w-full space-y-1.5 sm:max-w-xs">
                    <label
                      htmlFor="capacity-input"
                      className="text-sm font-medium"
                    >
                      Sức chứa tối đa / nhóm
                    </label>
                    <div className="flex items-stretch">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Giảm sức chứa"
                        disabled={!canAllocate || openSessionMutation.isPending}
                        onClick={() => stepCapacity(-1)}
                        className="rounded-r-none border-r-0"
                      >
                        <Minus />
                      </Button>
                      <Input
                        ref={capacityInputRef}
                        id="capacity-input"
                        inputMode="numeric"
                        min={1}
                        max={999}
                        type="number"
                        placeholder="VD: 5"
                        value={capacityInput}
                        aria-label="Sức chứa tối đa mỗi nhóm"
                        aria-invalid={capacityState === "invalid"}
                        aria-describedby="capacity-help"
                        disabled={!canAllocate || openSessionMutation.isPending}
                        onChange={(event) => setCapacityInput(event.target.value)}
                        className="h-9 rounded-none border-x-0 text-center text-base font-semibold tabular-nums [appearance:textfield] focus-visible:relative focus-visible:z-10 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Tăng sức chứa"
                        disabled={!canAllocate || openSessionMutation.isPending}
                        onClick={() => stepCapacity(1)}
                        className="rounded-l-none border-l-0"
                      >
                        <Plus />
                      </Button>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={!canAllocate || openSessionMutation.isPending || !capacityValid}
                    className="h-9 w-full gap-2 sm:w-auto"
                  >
                    {openSessionMutation.isPending ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <Plus className="size-4" />
                    )}
                    {openSessionMutation.isPending
                      ? "Đang tạo phiên…"
                      : "Tạo phiên phân nhóm"}
                  </Button>
                </div>
                {capacityState !== "empty" && (
                  <p
                    id="capacity-help"
                    aria-live="polite"
                    className={cn(
                      "mt-2 flex items-center gap-1.5 text-xs font-medium",
                      capacityState === "invalid"
                        ? "text-destructive"
                        : "text-emerald-600 dark:text-emerald-400",
                    )}
                  >
                    {capacityState === "invalid" ? (
                      <CircleAlert className="size-3.5 shrink-0" />
                    ) : (
                      <CheckCircle2 className="size-3.5 shrink-0" />
                    )}
                    {capacityState === "invalid"
                      ? "Sức chứa phải là số nguyên lớn hơn 0."
                      : `Mỗi nhóm sẽ có tối đa ${maxMembers} học viên.`}
                  </p>
                )}
              </form>

            </CardContent>
          </Card>

          <Card className="relative flex min-h-0 flex-col gap-0 overflow-hidden py-0 shadow-sm">
            <CardHeader className="grid shrink-0 grid-rows-1 gap-0 border-b px-5 py-3.5 [.border-b]:pb-3.5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ListChecks className="size-4 text-muted-foreground" />
                  Các phiên đã tạo
                  <Badge variant="secondary" className="tabular-nums">
                    {sessions.length}
                  </Badge>
                </CardTitle>
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
            <CardContent className="space-y-3 px-5 pb-5 pt-4 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                {sessionsQuery.isError ? (
                  <div
                    role="alert"
                    className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                        <CircleAlert className="size-4" />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-destructive">
                          Không tải được danh sách phiên.
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void sessionsQuery.refetch()}
                      disabled={sessionsQuery.isFetching}
                      className="gap-2"
                    >
                      {sessionsQuery.isFetching ? (
                        <LoaderCircle className="size-4 animate-spin" />
                      ) : (
                        <RefreshCw className="size-4" />
                      )}
                      {sessionsQuery.isFetching ? "Đang thử lại…" : "Thử lại"}
                    </Button>
                  </div>
                ) : sessionsQuery.isLoading ? (
                  <div className="space-y-2.5" aria-busy="true">
                    {[0, 1, 2].map((row) => (
                      <div
                        key={row}
                        className="flex items-center gap-3 rounded-xl border p-3.5"
                      >
                        <div className="size-9 shrink-0 animate-pulse rounded-lg bg-muted" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 w-32 animate-pulse rounded bg-muted" />
                          <div className="h-2.5 w-48 animate-pulse rounded bg-muted/70" />
                        </div>
                        <div className="h-8 w-24 animate-pulse rounded-lg bg-muted" />
                      </div>
                    ))}
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="rounded-xl border border-dashed bg-muted/30 px-5 py-10 text-center">
                    <span className="mx-auto flex size-11 items-center justify-center rounded-full border bg-background text-muted-foreground">
                      <CalendarDays className="size-5" />
                    </span>
                    <p className="mt-3 font-medium">Chưa có phiên phân nhóm</p>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!canAllocate || openSessionMutation.isPending}
                      onClick={() => {
                        if (capacityValid) handleCreateSession();
                        else capacityInputRef.current?.focus();
                      }}
                      className="mt-4 gap-2"
                    >
                      <Plus className="size-4" />
                      Tạo phiên đầu tiên
                    </Button>
                  </div>
                ) : (
                  <ul className="space-y-2.5">
                    {sessions.map((item) => {
                      const isSelected = selectedSession?.id === item.id;
                      const tone = SESSION_ROW_TONE[item.status];
                      return (
                        <li
                          key={item.id}
                          className={cn(
                            "group relative overflow-hidden rounded-xl border transition-colors duration-200",
                            isSelected
                              ? "border-primary/40 bg-muted/50"
                              : "bg-card hover:bg-muted/30",
                          )}
                        >
                          <span
                            aria-hidden
                            className={cn(
                              "absolute inset-y-0 left-0 w-1",
                              tone.bar,
                              isSelected ? "opacity-100" : "opacity-60",
                            )}
                          />
                          <div className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                            <button
                              type="button"
                              onClick={() => setSelectedSessionId(item.id)}
                              aria-pressed={isSelected}
                              className="flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            >
                              <span
                                className={cn(
                                  "flex size-9 shrink-0 items-center justify-center rounded-lg border",
                                  tone.tile,
                                )}
                              >
                                {isSelected ? (
                                  <Check className="size-4" />
                                ) : (
                                  <CalendarDays className="size-4" />
                                )}
                              </span>
                              <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-semibold">
                                    Phiên #{item.sessionNumber}
                                  </p>
                                  <Badge
                                    variant="outline"
                                    className={SESSION_STATUS_CLASS[item.status]}
                                  >
                                    {SESSION_STATUS_LABEL[item.status]}
                                  </Badge>
                                  {isSelected && (
                                    <span className="rounded-md border bg-background px-1.5 py-0.5 text-[11px] font-medium text-foreground">
                                      Đang xem
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Sức chứa {item.maxMembers}/nhóm · Phiên bản{" "}
                                  {item.version}
                                </p>
                              </div>
                            </button>
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
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={cancelTarget !== null}
        onOpenChange={(open) => {
          if (!open && !cancelSessionMutation.isPending) setCancelTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <span className="mb-1 flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <Ban className="size-5" />
            </span>
            <DialogTitle>Hủy phiên phân nhóm?</DialogTitle>
            <DialogDescription>
              Phiên #{cancelTarget?.sessionNumber} sẽ chuyển sang CANCELLED và
              các nhóm DRAFT sẽ được lưu trữ (ARCHIVED). Hành động này không thể
              hoàn tác.
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
            <span
              className={cn(
                "mb-1 flex size-10 items-center justify-center rounded-xl border",
                summaryDialog === "unassigned" || summaryDialog === "publishable"
                  ? "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "border-border bg-muted text-muted-foreground",
              )}
            >
              {summaryDialog === "unassigned" ? (
                <Users className="size-5" />
              ) : summaryDialog === "publishable" ? (
                <CircleAlert className="size-5" />
              ) : (
                <ClipboardList className="size-5" />
              )}
            </span>
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
                    className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-muted/40"
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
                      className="flex items-center justify-between gap-3 px-3 py-3 text-sm transition-colors hover:bg-muted/40"
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
