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
  PUBLISHED: "border-primary/40 bg-primary/10 text-primary",
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

/** Per-status colour accents for the session list rows. */
const SESSION_ROW_TONE: Record<
  AllocationSessionStatus,
  { bar: string; tile: string; selected: string; idle: string }
> = {
  OPEN: {
    bar: "bg-gradient-to-b from-emerald-400 via-emerald-500 to-teal-500",
    tile: "border-emerald-400/40 bg-gradient-to-br from-emerald-500/20 to-teal-500/15 text-emerald-600 dark:border-emerald-400/30 dark:text-emerald-300",
    selected:
      "border-emerald-500/50 bg-gradient-to-r from-emerald-500/[0.10] via-teal-500/[0.05] to-transparent shadow-sm",
    idle: "hover:border-emerald-400/60 hover:shadow-sm",
  },
  PUBLISHED: {
    bar: "bg-gradient-to-b from-indigo-500 via-violet-500 to-fuchsia-500",
    tile: "border-indigo-400/40 bg-gradient-to-br from-indigo-500/20 to-violet-500/15 text-indigo-600 dark:border-indigo-400/30 dark:text-indigo-300",
    selected:
      "border-indigo-500/50 bg-gradient-to-r from-indigo-500/[0.10] via-violet-500/[0.05] to-transparent shadow-sm",
    idle: "hover:border-indigo-400/60 hover:shadow-sm",
  },
  CLOSED: {
    bar: "bg-gradient-to-b from-slate-400 via-slate-500 to-slate-600",
    tile: "border-slate-400/40 bg-muted/60 text-muted-foreground",
    selected: "border-slate-400/60 bg-muted/40 shadow-sm",
    idle: "hover:border-slate-400/60 hover:shadow-sm",
  },
  CANCELLED: {
    bar: "bg-gradient-to-b from-rose-400 via-rose-500 to-red-500",
    tile: "border-rose-400/40 bg-gradient-to-br from-rose-500/15 to-red-500/10 text-rose-600 dark:border-rose-400/30 dark:text-rose-300",
    selected: "border-rose-400/60 bg-rose-500/[0.07] shadow-sm",
    idle: "hover:border-rose-400/60 hover:shadow-sm",
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
    "inline-flex items-center gap-1.5 rounded-full border border-indigo-200/70 bg-background/70 px-2.5 py-1 text-xs text-muted-foreground backdrop-blur dark:border-indigo-900/60";

  return (
    <MainLayout
      pathName={{ "team-allocation": "Project Team Allocation" }}
      // `classes` has no route of its own; send the crumb to the class list.
      pathLinks={{ classes: "/team-allocation" }}
    >
      <div className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col gap-5">
        <section className="relative shrink-0 overflow-hidden rounded-2xl border border-indigo-200/70 bg-card shadow-sm dark:border-indigo-900/60">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-sky-500/[0.12] via-indigo-500/[0.06] to-violet-500/[0.12]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-violet-400/25 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 left-1/3 size-56 rounded-full bg-sky-400/20 blur-3xl"
          />
          <div className="relative flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 via-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/25">
                <UsersRound className="size-6" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
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
                        <Hash className="size-3.5 text-sky-500" />
                        {trainingClass.code}
                      </span>
                      <span className={metaChip}>
                        <Users className="size-3.5 text-indigo-500" />
                        {trainingClass.memberCount} học viên
                      </span>
                      {trainingClass.programName && (
                        <span className={metaChip}>
                          <GraduationCap className="size-3.5 text-violet-500" />
                          {trainingClass.programName}
                        </span>
                      )}
                      {trainingClass.cohortName && (
                        <span className={metaChip}>
                          <Layers className="size-3.5 text-emerald-500" />
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
              <Button
                variant="outline"
                onClick={refreshPage}
                disabled={isRefreshing}
                className="gap-2 bg-background/70"
              >
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
                className="gap-2 bg-background/70 transition-colors hover:border-sky-400/60 hover:bg-sky-500/10 hover:text-sky-700 dark:hover:text-sky-300"
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="size-2 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 shadow-sm shadow-indigo-500/40" />
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
              <p className="text-xs text-muted-foreground">
                Nhấn vào thẻ để xem chi tiết
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard
                icon={<Users className="size-5" />}
                label="Học viên chưa vào nhóm ACTIVE"
                hint="Nhấn để xem ai chưa được xếp nhóm"
                value={unassignedMembers.length}
                tone={unassignedMembers.length > 0 ? "warning" : "success"}
                onClick={() => setSummaryDialog("unassigned")}
              />
              <MetricCard
                icon={<ClipboardList className="size-5" />}
                label="Nhóm đã lưu trong phiên"
                hint="Nhấn để xem toàn bộ nhóm trong phiên"
                value={sessionTeams.length}
                tone="primary"
                onClick={() => setSummaryDialog("saved")}
              />
              <MetricCard
                icon={<CircleAlert className="size-5" />}
                label="Nhóm chờ publish"
                hint="Nhấn để xem nhóm còn ở trạng thái DRAFT"
                value={publishableTeams.length}
                tone={publishableTeams.length > 0 ? "success" : "primary"}
                onClick={() => setSummaryDialog("publishable")}
              />
            </div>
          </section>
        )}

        <div className="grid gap-5 xl:min-h-0 xl:flex-1 xl:grid-cols-2 xl:grid-rows-1">
          <Card className="relative flex min-h-0 flex-col gap-0 overflow-hidden border-sky-200/80 py-0 shadow-sm dark:border-sky-900/60">
            <CardHeader className="shrink-0 border-b border-sky-200/70 bg-gradient-to-r from-sky-500/[0.12] via-indigo-500/[0.07] to-transparent px-5 py-4 dark:border-sky-900/50">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CalendarDays className="size-5 text-sky-600 dark:text-sky-400" />
                    Phiên phân nhóm
                    <Badge
                      variant="outline"
                      className="border-sky-500/30 bg-sky-500/10 tabular-nums text-sky-700 dark:text-sky-300"
                    >
                      {sessions.length}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Tạo phiên mới hoặc chọn một phiên ở cột bên phải, rồi bấm
                    “Allocate Team” để mở màn hình phân nhóm.
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
            <CardContent className="space-y-5 px-5 py-5 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  handleCreateSession();
                }}
                className="rounded-xl border border-indigo-200/70 bg-gradient-to-br from-indigo-500/[0.07] via-sky-500/[0.04] to-transparent p-4 dark:border-indigo-900/60"
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
                    className="h-9 w-full gap-2 bg-gradient-to-r from-sky-600 via-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-500/30 transition-shadow hover:shadow-md disabled:opacity-50 sm:w-auto"
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
                <p
                  id="capacity-help"
                  aria-live="polite"
                  className={cn(
                    "mt-2 flex items-center gap-1.5 text-xs",
                    capacityState === "invalid"
                      ? "font-medium text-destructive"
                      : capacityState === "valid"
                        ? "font-medium text-emerald-600 dark:text-emerald-400"
                        : "text-muted-foreground",
                  )}
                >
                  {capacityState === "invalid" ? (
                    <CircleAlert className="size-3.5 shrink-0" />
                  ) : capacityState === "valid" ? (
                    <CheckCircle2 className="size-3.5 shrink-0" />
                  ) : (
                    <Info className="size-3.5 shrink-0" />
                  )}
                  {capacityState === "invalid"
                    ? "Sức chứa phải là số nguyên lớn hơn 0."
                    : capacityState === "valid"
                      ? `Mỗi nhóm sẽ có tối đa ${maxMembers} học viên.`
                      : "Nhập số học viên tối đa cho mỗi nhóm."}
                </p>
                <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
                  Lớp và project template được xác định tự động; số phiên do hệ
                  thống tạo.
                </p>
              </form>

            </CardContent>
          </Card>

          <Card className="relative flex min-h-0 flex-col gap-0 overflow-hidden border-violet-200/80 py-0 shadow-sm dark:border-violet-900/60">
            <CardHeader className="shrink-0 border-b border-violet-200/70 bg-gradient-to-r from-violet-500/[0.12] via-fuchsia-500/[0.07] to-transparent px-5 py-4 dark:border-violet-900/50">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ListChecks className="size-5 text-violet-600 dark:text-violet-400" />
                    Các phiên đã tạo
                    <Badge
                      variant="outline"
                      className="border-violet-500/30 bg-violet-500/10 tabular-nums text-violet-700 dark:text-violet-300"
                    >
                      {sessions.length}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Chọn một phiên để xem tổng quan, hoặc mở “Allocate Team” để
                    phân nhóm học viên.
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
            <CardContent className="space-y-3 px-5 py-5 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
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
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Kiểm tra kết nối hoặc quyền truy cập lớp rồi thử lại.
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
                  <div className="rounded-xl border border-dashed border-violet-300/70 bg-gradient-to-br from-violet-500/[0.07] via-fuchsia-500/[0.04] to-transparent px-5 py-10 text-center dark:border-violet-800/60">
                    <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/25">
                      <CalendarDays className="size-6" />
                    </span>
                    <p className="mt-3 font-medium">Chưa có phiên phân nhóm</p>
                    <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                      Nhập sức chứa tối đa mỗi nhóm ở phía trên và tạo phiên đầu
                      tiên cho lớp này.
                    </p>
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
                      {capacityValid
                        ? "Tạo phiên đầu tiên"
                        : "Nhập sức chứa để bắt đầu"}
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
                            "group relative overflow-hidden rounded-xl border transition-all duration-200",
                            isSelected ? tone.selected : cn("bg-card", tone.idle),
                          )}
                        >
                          <span
                            aria-hidden
                            className={cn(
                              "absolute inset-y-0 left-0 w-1 transition-opacity",
                              tone.bar,
                              isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-60",
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
                                  "flex size-9 shrink-0 items-center justify-center rounded-lg border shadow-sm transition-transform duration-200 group-hover:scale-105",
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
                                    <span className="rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm shadow-indigo-500/30">
                                      Đang xem
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Sức chứa {item.maxMembers}/nhóm · Phiên bản{" "}
                                  {item.version}
                                </p>
                                <p
                                  className={cn(
                                    "text-[11px] transition-colors",
                                    isSelected
                                      ? "font-medium text-indigo-600 dark:text-indigo-300"
                                      : "text-muted-foreground",
                                  )}
                                >
                                  {isSelected
                                    ? "Đang hiển thị tổng quan của phiên này"
                                    : "Nhấn để xem tổng quan phiên"}
                                </p>
                              </div>
                            </button>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                size="sm"
                                onClick={() => openSetup(item)}
                                className="gap-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-500/30 transition-shadow hover:from-indigo-500 hover:to-violet-500 hover:shadow-md"
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
            <span className="mb-1 flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-sm shadow-rose-500/30">
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
                "mb-1 flex size-10 items-center justify-center rounded-xl text-white shadow-sm",
                summaryDialog === "unassigned"
                  ? "bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/30"
                  : summaryDialog === "publishable"
                    ? "bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-violet-500/30"
                    : "bg-gradient-to-br from-sky-500 to-indigo-600 shadow-sky-500/30",
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
