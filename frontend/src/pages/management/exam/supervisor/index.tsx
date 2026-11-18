import {
    useCallback,
    useMemo,
    useRef,
    useEffect,
    useState,
} from "react";
import { useQuery } from "@tanstack/react-query";

import {
    AlertTriangle,
    Camera,
    Clock3,
    Grid2X2,
    List,
    Monitor,
    MonitorOff,
    RefreshCw,
    Search,
    ShieldCheck,
    Users,
    VideoOff,
    X,
} from "lucide-react";

import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import {
    useExamSupervisorViewer,
    type ExamSupervisorMedia,
} from "@/hooks/useExamSupervisorViewer";

import {
    examSupervisorApi,
    type SupervisorAttemptDTO,
    type SupervisorViolationDTO,
} from "@/api/features/exam-supervisor.api";

type ViewMode = "grid" | "list";

/** Nguồn hình ảnh hiển thị trên mỗi ô: webcam hoặc màn hình thi. */
type StreamSource = "camera" | "screen";

interface AttemptMediaState {
    media: ExamSupervisorMedia;
    status: string;
}

/** Thí sinh vừa vi phạm trong khoảng thời gian này sẽ bị viền đỏ quanh camera. */
const VIOLATION_HIGHLIGHT_MS = 30_000;

interface AttemptViolationInfo {
    /** Tổng số vi phạm của lượt thi. */
    count: number;
    /** Vi phạm mới nhất. */
    latest: SupervisorViolationDTO;
    /** true nếu vi phạm mới nhất còn trong khoảng VIOLATION_HIGHLIGHT_MS. */
    recent: boolean;
}

function formatClock(value?: string | null) {
    if (!value) return "--:--";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? "--:--"
        : date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        });
}

function getRemainingTime(deadlineAt: string) {
    const remainingMs =
        new Date(deadlineAt).getTime() - Date.now();

    if (!Number.isFinite(remainingMs)) {
        return "Không xác định";
    }

    if (remainingMs <= 0) {
        return "Đã quá hạn";
    }

    const totalSeconds = Math.floor(remainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return hours > 0
        ? `${hours.toString().padStart(2, "0")}:${minutes
            .toString()
            .padStart(2, "0")}:${seconds
            .toString()
            .padStart(2, "0")}`
        : `${minutes.toString().padStart(2, "0")}:${seconds
            .toString()
            .padStart(2, "0")}`;
}

function getViolationLabel(type: string) {
    const labels: Record<string, string> = {
        TAB_HIDDEN: "Chuyển tab",
        WINDOW_BLUR: "Chuyển cửa sổ",
        FULLSCREEN_EXIT: "Thoát toàn màn hình",
        COPY: "Sao chép nội dung",
        CUT: "Cắt nội dung",
        PASTE: "Dán nội dung",
        CONTEXT_MENU: "Nhấn chuột phải",
        DEVTOOLS_KEY: "Phím tắt Developer Tools",
        PRINT_ATTEMPT: "Thử in hoặc chụp màn hình",
        CAMERA_OFF: "Tắt camera",
        CAMERA_COVERED: "Camera bị che",
        FACE_MISSING: "Không phát hiện khuôn mặt",
        MULTIPLE_FACES: "Phát hiện nhiều khuôn mặt",
        HEAD_TURNED: "Quay đầu khỏi màn hình",
        DIFFERENT_PERSON: "Phát hiện người khác",
        MULTI_SESSION: "Mở bài thi ở nơi khác",
    };

    return labels[type] ?? type;
}

/**
 * Gắn MediaStream vào video element.
 * Component này chỉ hiển thị stream, không tạo WebSocket mới.
 */
function StreamVideo({
                         stream,
                         className,
                     }: {
    stream: MediaStream | null;
    className?: string;
}) {
    const videoRef = useRef<HTMLVideoElement | null>(null);

    useEffect(() => {
        const video = videoRef.current;

        if (!video) return;

        video.srcObject = stream;

        if (stream) {
            void video.play().catch(() => undefined);
        }

        return () => {
            video.srcObject = null;
        };
    }, [stream]);

    return (
        <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={className}
        />
    );
}

/**
 * Mỗi attempt chỉ có một viewer connection.
 *
 * Component này quản lý WebSocket/WebRTC ở nền,
 * sau đó gửi hai MediaStream lên component cha.
 */
function AttemptMediaConnection({
                                    attemptId,
                                    onMedia,
                                }: {
    attemptId: number;
    onMedia: (
        attemptId: number,
        media: ExamSupervisorMedia | null,
        status: string,
    ) => void;
}) {
    const {
        cameraStream,
        screenStream,
        status,
    } = useExamSupervisorViewer(attemptId);

    const onMediaRef = useRef(onMedia);

    useEffect(() => {
        onMediaRef.current = onMedia;
    }, [onMedia]);

    useEffect(() => {
        onMediaRef.current(
            attemptId,
            {
                camera: cameraStream,
                screen: screenStream,
            },
            status,
        );
    }, [
        attemptId,
        cameraStream,
        screenStream,
        status,
    ]);

    useEffect(() => {
        return () => {
            onMediaRef.current(
                attemptId,
                null,
                "waiting",
            );
        };
    }, [attemptId]);

    return null;
}

/**
 * Thẻ camera trong chế độ Grid.
 * Không tạo viewer connection riêng.
 * Khi thí sinh vừa vi phạm (violation.recent) thẻ có viền đỏ xung quanh.
 */
function StudentCameraCard({
                               attempt,
                               onSelect,
                               mediaState,
                               violation,
                               source,
                           }: {
    attempt: SupervisorAttemptDTO;
    onSelect: (attempt: SupervisorAttemptDTO) => void;
    mediaState?: AttemptMediaState;
    violation?: AttemptViolationInfo;
    source: StreamSource;
}) {
    const streamStatus = mediaState?.status ?? "waiting";
    const cameraStream = mediaState?.media.camera ?? null;
    const screenStream = mediaState?.media.screen ?? null;
    const showScreen = source === "screen";
    const mainStream = showScreen ? screenStream : cameraStream;
    const isViolating = Boolean(violation?.recent);

    return (
        <button
            type="button"
            onClick={() => onSelect(attempt)}
            className={cn(
                "group relative overflow-hidden rounded-xl bg-slate-950 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isViolating
                    ? "ring-4 ring-red-500 shadow-lg shadow-red-500/40"
                    : "ring-1 ring-border hover:ring-2 hover:ring-primary/60",
            )}
        >
            <div className="relative flex aspect-video items-center justify-center text-slate-300">
                {mainStream ? (
                    <StreamVideo
                        stream={mainStream}
                        // Màn hình: giữ nguyên tỉ lệ để đọc được nội dung.
                        className={cn(
                            "h-full w-full",
                            showScreen ? "object-contain" : "object-cover",
                        )}
                    />
                ) : (
                    <div className="flex flex-col items-center gap-1.5 px-3 text-center">
                        <div className="rounded-full border border-white/15 bg-white/10 p-3">
                            {showScreen ? (
                                <MonitorOff className="h-5 w-5" />
                            ) : (
                                <VideoOff className="h-5 w-5" />
                            )}
                        </div>

                        <span className="text-xs font-medium">
                            {showScreen
                                ? "Thí sinh chưa chia sẻ màn hình"
                                : streamStatus === "error"
                                    ? "Không thể kết nối camera"
                                    : "Đang chờ luồng webcam"}
                        </span>
                    </div>
                )}

                {/* Trạng thái luồng (trên trái) */}
                <div className="absolute left-2 top-2 flex items-center gap-1.5">
                    <Badge className="border-0 bg-emerald-500 px-1.5 py-0 text-[10px] text-white hover:bg-emerald-500">
                        <span className="mr-1 h-1.5 w-1.5 rounded-full bg-white" />
                        {mainStream ? "LIVE" : "Đang thi"}
                    </Badge>

                    <span
                        title={
                            screenStream
                                ? "Đang chia sẻ màn hình"
                                : "Chưa chia sẻ màn hình"
                        }
                        className={cn(
                            "flex h-5 w-5 items-center justify-center rounded-full text-white",
                            screenStream ? "bg-emerald-600" : "bg-amber-500",
                        )}
                    >
                        {screenStream ? (
                            <Monitor className="h-3 w-3" />
                        ) : (
                            <MonitorOff className="h-3 w-3" />
                        )}
                    </span>
                </div>

                {/* Cảnh báo vi phạm (trên phải) */}
                {violation && (
                    <span
                        className={cn(
                            "absolute right-2 top-2 flex max-w-[60%] items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-white",
                            isViolating
                                ? "animate-pulse bg-red-600"
                                : "bg-amber-500",
                        )}
                    >
                        <AlertTriangle className="h-3 w-3 shrink-0" />

                        <span className="truncate">
                            {isViolating
                                ? getViolationLabel(violation.latest.type)
                                : `${violation.count} vi phạm`}
                        </span>
                    </span>
                )}

                {/* Tên thí sinh + thời gian còn lại (dưới) */}
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent px-2.5 pb-2 pt-6">
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                            {attempt.studentName ||
                                `Student #${attempt.studentId}`}
                        </p>

                        <p className="truncate text-[11px] text-white/70">
                            {attempt.examTitle ||
                                `Exam #${attempt.examId}`}
                        </p>
                    </div>

                    <span className="flex shrink-0 items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white">
                        <Clock3 className="h-3 w-3" />
                        {getRemainingTime(attempt.deadlineAt)}
                    </span>
                </div>
            </div>
        </button>
    );
}

function ViolationItem({
                           violation,
                           recent,
                           onSelect,
                       }: {
    violation: SupervisorViolationDTO;
    recent: boolean;
    onSelect?: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onSelect}
            className={cn(
                "flex w-full items-start gap-2.5 rounded-lg border p-2.5 text-left transition hover:bg-muted/50",
                recent && "border-red-500 bg-red-500/5",
            )}
        >
            <div className="mt-0.5 rounded-full bg-red-500/10 p-1.5 text-red-600">
                <AlertTriangle className="h-3.5 w-3.5" />
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">
                        {violation.studentName}
                    </p>

                    <span className="shrink-0 text-[11px] text-muted-foreground">
                        {formatClock(violation.occurredAt)}
                    </span>
                </div>

                <p className="text-sm font-medium text-red-600">
                    {getViolationLabel(violation.type)}
                    {violation.durationSeconds != null &&
                        ` · ${violation.durationSeconds}s`}
                </p>

                <p className="truncate text-[11px] text-muted-foreground">
                    {violation.examTitle} · Attempt #{violation.attemptId}
                </p>

                {violation.detail && (
                    <p className="truncate text-[11px] text-muted-foreground">
                        {violation.detail}
                    </p>
                )}
            </div>
        </button>
    );
}

export default function ExamSupervisorPage() {
    const [viewMode, setViewMode] = useState<ViewMode>("grid");
    const [source, setSource] = useState<StreamSource>("camera");
    const [searchText, setSearchText] = useState("");

    const [selectedAttempt, setSelectedAttempt] =
        useState<SupervisorAttemptDTO | null>(null);

    const [mediaByAttempt, setMediaByAttempt] =
        useState<Record<number, AttemptMediaState>>({});

    // Đồng hồ 1 giây: cập nhật thời gian còn lại và tự tắt viền đỏ khi hết hạn.
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const timer = window.setInterval(
            () => setNow(Date.now()),
            1_000,
        );

        return () => window.clearInterval(timer);
    }, []);

    const attemptsQuery = useQuery({
        queryKey: ["exam-supervisor", "active-attempts"],
        queryFn: examSupervisorApi.getActiveAttempts,
        refetchInterval: 10_000,
        refetchIntervalInBackground: true,
        retry: 1,
    });

    const violationsQuery = useQuery({
        queryKey: ["exam-supervisor", "active-violations"],
        queryFn: examSupervisorApi.getActiveViolations,
        refetchInterval: 3_000,
        refetchIntervalInBackground: true,
        retry: 1,
    });

    const attempts = useMemo(
        () => attemptsQuery.data ?? [],
        [attemptsQuery.data],
    );

    const violations = useMemo(
        () => violationsQuery.data ?? [],
        [violationsQuery.data],
    );

    /** Gom vi phạm theo attemptId: tổng số + vi phạm mới nhất. */
    const violationByAttempt = useMemo(() => {
        const map = new Map<number, AttemptViolationInfo>();

        for (const violation of violations) {
            const time = new Date(violation.occurredAt).getTime();
            const current = map.get(violation.attemptId);

            if (!current) {
                map.set(violation.attemptId, {
                    count: 1,
                    latest: violation,
                    recent: false,
                });

                continue;
            }

            current.count += 1;

            if (
                time >
                new Date(current.latest.occurredAt).getTime()
            ) {
                current.latest = violation;
            }
        }

        for (const info of map.values()) {
            const time = new Date(info.latest.occurredAt).getTime();

            info.recent =
                Number.isFinite(time) &&
                now - time <= VIOLATION_HIGHLIGHT_MS;
        }

        return map;
    }, [violations, now]);

    const violatingNowCount = useMemo(
        () =>
            Array.from(violationByAttempt.values()).filter(
                (info) => info.recent,
            ).length,
        [violationByAttempt],
    );

    const filteredAttempts = useMemo(() => {
        const keyword = searchText.trim().toLocaleLowerCase();

        if (!keyword) return attempts;

        return attempts.filter((attempt) =>
            [
                attempt.studentName,
                attempt.studentEmail,
                attempt.examTitle,
            ]
                .filter(
                    (value): value is string => Boolean(value),
                )
                .some((value) =>
                    value.toLocaleLowerCase().includes(keyword),
                ),
        );
    }, [attempts, searchText]);

    /**
     * Cập nhật stream của từng attempt.
     * Dùng useCallback để không làm các connection manager nhận callback mới liên tục.
     */
    const handleAttemptMedia = useCallback(
        (
            attemptId: number,
            media: ExamSupervisorMedia | null,
            status: string,
        ) => {
            setMediaByAttempt((current) => {
                if (media === null) {
                    if (!current[attemptId]) return current;

                    const next = { ...current };
                    delete next[attemptId];

                    return next;
                }

                return {
                    ...current,
                    [attemptId]: {
                        media,
                        status,
                    },
                };
            });
        },
        [],
    );

    const openAttemptById = useCallback(
        (attemptId: number) => {
            const attempt = attempts.find(
                (item) => item.attemptId === attemptId,
            );

            if (attempt) setSelectedAttempt(attempt);
        },
        [attempts],
    );

    const isRefreshing =
        attemptsQuery.isFetching || violationsQuery.isFetching;

    return (
        <MainLayout
            dense
            mainClassName="lg:overflow-hidden"
            pathName={{
                exams: "Quản lý bài thi",
                supervisor: "Exam Supervisor",
            }}
        >
            <div className="flex flex-col gap-3 bg-muted/20 lg:min-h-0 lg:flex-1">
                {/* Thanh tiêu đề gọn: tiêu đề + thống kê + công cụ */}
                <header className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <div className="flex items-center gap-2">
                            <div className="rounded-lg bg-primary/10 p-2 text-primary">
                                <ShieldCheck className="h-5 w-5" />
                            </div>

                            <h1 className="text-xl font-bold tracking-tight">
                                Exam Supervisor
                            </h1>

                            <Badge
                                variant="outline"
                                className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
                            >
                                <span className="mr-1.5 h-2 w-2 rounded-full bg-emerald-500" />
                                Live
                            </Badge>
                        </div>

                        <Badge variant="outline" className="gap-1.5">
                            <Users className="h-3.5 w-3.5" />
                            {attempts.length} đang thi
                        </Badge>

                        <Badge
                            variant="outline"
                            className={cn(
                                "gap-1.5",
                                violatingNowCount > 0 &&
                                "border-red-500/50 bg-red-500/10 text-red-600",
                            )}
                        >
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {violatingNowCount} đang vi phạm
                        </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative w-56">
                            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                            <Input
                                value={searchText}
                                onChange={(event) =>
                                    setSearchText(event.target.value)
                                }
                                placeholder="Tìm thí sinh hoặc bài thi..."
                                className="h-9 pl-8 pr-8"
                            />

                            {searchText && (
                                <button
                                    type="button"
                                    onClick={() => setSearchText("")}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    aria-label="Xóa tìm kiếm"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        {/* Chuyển nguồn hiển thị: webcam <-> màn hình thi */}
                        <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-0.5">
                            <Button
                                size="sm"
                                className="h-8"
                                variant={
                                    source === "camera" ? "default" : "ghost"
                                }
                                onClick={() => setSource("camera")}
                            >
                                <Camera className="mr-1.5 h-4 w-4" />
                                Webcam
                            </Button>

                            <Button
                                size="sm"
                                className="h-8"
                                variant={
                                    source === "screen" ? "default" : "ghost"
                                }
                                onClick={() => setSource("screen")}
                            >
                                <Monitor className="mr-1.5 h-4 w-4" />
                                Màn hình thi
                            </Button>
                        </div>

                        <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-0.5">
                            <Button
                                size="sm"
                                className="h-8"
                                variant={
                                    viewMode === "grid"
                                        ? "default"
                                        : "ghost"
                                }
                                onClick={() => setViewMode("grid")}
                            >
                                <Grid2X2 className="mr-1.5 h-4 w-4" />
                                Lưới
                            </Button>

                            <Button
                                size="sm"
                                className="h-8"
                                variant={
                                    viewMode === "list"
                                        ? "default"
                                        : "ghost"
                                }
                                onClick={() => setViewMode("list")}
                            >
                                <List className="mr-1.5 h-4 w-4" />
                                Danh sách
                            </Button>
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            className="h-9"
                            onClick={() => {
                                void attemptsQuery.refetch();
                                void violationsQuery.refetch();
                            }}
                            disabled={isRefreshing}
                        >
                            <RefreshCw
                                className={cn(
                                    "mr-1.5 h-4 w-4",
                                    isRefreshing && "animate-spin",
                                )}
                            />
                            Làm mới
                        </Button>
                    </div>
                </header>

                {/*
                  Mỗi attempt có một viewer connection duy nhất.
                  Dùng attempts thay vì filteredAttempts để kết nối
                  vẫn hoạt động khi Teacher/Admin đang lọc danh sách.
                */}
                <div className="hidden" aria-hidden="true">
                    {attempts.map((attempt) => (
                        <AttemptMediaConnection
                            key={attempt.attemptId}
                            attemptId={attempt.attemptId}
                            onMedia={handleAttemptMedia}
                        />
                    ))}
                </div>

                <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1 lg:flex-row">
                    {/* ===== Lưới camera: chiếm gần hết màn hình ===== */}
                    <section className="min-w-0 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                        {/* p-1: chừa chỗ cho viền đỏ không bị cắt */}
                        <div className="p-1">
                            {attemptsQuery.isLoading && (
                                <p className="py-12 text-center text-sm text-muted-foreground">
                                    Đang tải danh sách lượt thi...
                                </p>
                            )}

                            {attemptsQuery.isError && (
                                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5 text-center">
                                    <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-destructive" />

                                    <p className="font-medium">
                                        Không thể tải danh sách giám sát
                                    </p>

                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Kiểm tra backend và quyền truy cập API
                                        /exam-supervisor/attempts.
                                    </p>

                                    <Button
                                        className="mt-3"
                                        variant="outline"
                                        onClick={() =>
                                            void attemptsQuery.refetch()
                                        }
                                    >
                                        Thử lại
                                    </Button>
                                </div>
                            )}

                            {!attemptsQuery.isLoading &&
                                !attemptsQuery.isError &&
                                filteredAttempts.length === 0 && (
                                    <div className="rounded-xl border border-dashed bg-card py-14 text-center">
                                        <Users className="mx-auto mb-3 h-9 w-9 text-muted-foreground/50" />

                                        <p className="font-medium">
                                            {attempts.length === 0
                                                ? "Hiện không có học sinh nào đang thi"
                                                : "Không tìm thấy học sinh phù hợp"}
                                        </p>

                                        <p className="mt-1 text-sm text-muted-foreground">
                                            Danh sách tự động cập nhật mỗi 10
                                            giây.
                                        </p>
                                    </div>
                                )}

                            {filteredAttempts.length > 0 && (
                                <div
                                    className={
                                        viewMode === "grid"
                                            ? cn(
                                                "grid gap-3",
                                                source === "screen"
                                                    ? "grid-cols-[repeat(auto-fill,minmax(340px,1fr))]"
                                                    : "grid-cols-[repeat(auto-fill,minmax(260px,1fr))]",
                                            )
                                            : "space-y-3"
                                    }
                                >
                                    {filteredAttempts.map((attempt) => {
                                        const violation =
                                            violationByAttempt.get(
                                                attempt.attemptId,
                                            );

                                        if (viewMode === "grid") {
                                            return (
                                                <StudentCameraCard
                                                    key={attempt.attemptId}
                                                    attempt={attempt}
                                                    onSelect={
                                                        setSelectedAttempt
                                                    }
                                                    mediaState={
                                                        mediaByAttempt[
                                                            attempt.attemptId
                                                            ]
                                                    }
                                                    violation={violation}
                                                    source={source}
                                                />
                                            );
                                        }

                                        const camera =
                                            mediaByAttempt[attempt.attemptId]
                                                ?.media[source] ?? null;

                                        return (
                                            <button
                                                key={attempt.attemptId}
                                                type="button"
                                                onClick={() =>
                                                    setSelectedAttempt(attempt)
                                                }
                                                className={cn(
                                                    "flex w-full items-center gap-4 rounded-lg bg-card p-3 text-left",
                                                    violation?.recent
                                                        ? "ring-4 ring-red-500"
                                                        : "ring-1 ring-border hover:ring-primary/50",
                                                )}
                                            >
                                                <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-950">
                                                    {camera ? (
                                                        <StreamVideo
                                                            stream={camera}
                                                            className={cn(
                                                                "h-full w-full",
                                                                source === "screen"
                                                                    ? "object-contain"
                                                                    : "object-cover",
                                                            )}
                                                        />
                                                    ) : (
                                                        <div className="flex h-full items-center justify-center text-slate-400">
                                                            {source === "screen" ? (
                                                                <MonitorOff className="h-5 w-5" />
                                                            ) : (
                                                                <VideoOff className="h-5 w-5" />
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate font-medium">
                                                        {attempt.studentName}
                                                    </p>

                                                    <p className="truncate text-sm text-muted-foreground">
                                                        {attempt.examTitle}
                                                    </p>
                                                </div>

                                                {violation && (
                                                    <Badge
                                                        className={cn(
                                                            "text-white",
                                                            violation.recent
                                                                ? "animate-pulse bg-red-600 hover:bg-red-600"
                                                                : "bg-amber-500 hover:bg-amber-500",
                                                        )}
                                                    >
                                                        {violation.recent
                                                            ? getViolationLabel(
                                                                violation.latest
                                                                    .type,
                                                            )
                                                            : `${violation.count} vi phạm`}
                                                    </Badge>
                                                )}

                                                <Badge className="bg-emerald-600">
                                                    Đang thi
                                                </Badge>

                                                <span className="hidden text-sm text-muted-foreground md:block">
                                                    Còn{" "}
                                                    {getRemainingTime(
                                                        attempt.deadlineAt,
                                                    )}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </section>

                    {/* ===== Báo vi phạm: 1 cột bên phải ===== */}
                    <aside className="flex max-h-[28rem] w-full shrink-0 flex-col overflow-hidden rounded-xl border bg-card lg:max-h-none lg:min-h-0 lg:w-[340px]">
                        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
                            <h2 className="flex items-center gap-2 font-semibold">
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                                Báo vi phạm
                            </h2>

                            <Badge variant="outline">
                                {violations.length}
                            </Badge>
                        </div>

                        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                            {violationsQuery.isLoading && (
                                <p className="py-6 text-center text-sm text-muted-foreground">
                                    Đang tải dữ liệu vi phạm...
                                </p>
                            )}

                            {violationsQuery.isError && (
                                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                                    Không thể tải dữ liệu vi phạm. Hãy kiểm tra
                                    API /exam-supervisor/violations và quyền
                                    truy cập.
                                </div>
                            )}

                            {!violationsQuery.isLoading &&
                                !violationsQuery.isError &&
                                violations.length === 0 && (
                                    <div className="rounded-lg border border-dashed py-8 text-center">
                                        <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-emerald-500" />

                                        <p className="font-medium">
                                            Chưa có vi phạm nào
                                        </p>

                                        <p className="mt-1 text-xs text-muted-foreground">
                                            Tự động cập nhật mỗi 3 giây.
                                        </p>
                                    </div>
                                )}

                            {violations.slice(0, 100).map((violation) => {
                                const time = new Date(
                                    violation.occurredAt,
                                ).getTime();

                                return (
                                    <ViolationItem
                                        key={violation.id}
                                        violation={violation}
                                        recent={
                                            Number.isFinite(time) &&
                                            now - time <=
                                            VIOLATION_HIGHLIGHT_MS
                                        }
                                        onSelect={() =>
                                            openAttemptById(
                                                violation.attemptId,
                                            )
                                        }
                                    />
                                );
                            })}
                        </div>
                    </aside>
                </div>

                {/* Attempt detail dialog */}
                {selectedAttempt && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                        role="presentation"
                        onMouseDown={(event) => {
                            if (event.target === event.currentTarget) {
                                setSelectedAttempt(null);
                            }
                        }}
                    >
                        <section
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="supervisor-detail-title"
                            className="w-full max-w-2xl rounded-xl bg-background p-5 shadow-xl"
                        >
                            <div className="mb-4 flex items-start justify-between gap-3">
                                <div>
                                    <h2
                                        id="supervisor-detail-title"
                                        className="text-lg font-semibold"
                                    >
                                        Thông tin lượt thi
                                    </h2>

                                    <p className="text-sm text-muted-foreground">
                                        {selectedAttempt.studentName}
                                    </p>
                                </div>

                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() =>
                                        setSelectedAttempt(null)
                                    }
                                    aria-label="Đóng"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-lg bg-muted/50 p-3">
                                    <p className="text-xs text-muted-foreground">
                                        Bài thi
                                    </p>

                                    <p className="mt-1 font-medium">
                                        {selectedAttempt.examTitle}
                                    </p>
                                </div>

                                <div className="rounded-lg bg-muted/50 p-3">
                                    <p className="text-xs text-muted-foreground">
                                        Trạng thái
                                    </p>

                                    <p className="mt-1 font-medium text-emerald-600">
                                        Đang thi
                                    </p>
                                </div>

                                <div className="rounded-lg bg-muted/50 p-3">
                                    <p className="text-xs text-muted-foreground">
                                        Email
                                    </p>

                                    <p className="mt-1 break-all font-medium">
                                        {selectedAttempt.studentEmail}
                                    </p>
                                </div>

                                <div className="rounded-lg bg-muted/50 p-3">
                                    <p className="text-xs text-muted-foreground">
                                        Bắt đầu lúc
                                    </p>

                                    <p className="mt-1 font-medium">
                                        {formatClock(
                                            selectedAttempt.startedAt,
                                        )}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                {/* Webcam */}
                                <div className="rounded-lg border p-4">
                                    <div className="mb-2 flex items-center gap-2 font-medium">
                                        <Camera className="h-4 w-4" />
                                        Webcam
                                    </div>

                                    <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-md bg-slate-950 text-slate-300">
                                        {mediaByAttempt[
                                            selectedAttempt.attemptId
                                            ]?.media.camera ? (
                                            <StreamVideo
                                                stream={
                                                    mediaByAttempt[
                                                        selectedAttempt.attemptId
                                                        ].media.camera
                                                }
                                                className="h-full w-full object-contain"
                                            />
                                        ) : (
                                            <div className="flex flex-col items-center gap-2">
                                                <VideoOff className="h-7 w-7" />

                                                <span className="text-sm">
                                                    Chưa có luồng webcam
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Screen sharing */}
                                <div className="rounded-lg border p-4">
                                    <div className="mb-2 flex items-center gap-2 font-medium">
                                        <Monitor className="h-4 w-4" />
                                        Màn hình chia sẻ
                                    </div>

                                    <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-md bg-slate-950 text-slate-300">
                                        {mediaByAttempt[
                                            selectedAttempt.attemptId
                                            ]?.media.screen ? (
                                            <StreamVideo
                                                stream={
                                                    mediaByAttempt[
                                                        selectedAttempt.attemptId
                                                        ].media.screen
                                                }
                                                className="h-full w-full object-contain"
                                            />
                                        ) : (
                                            <div className="flex flex-col items-center gap-2">
                                                <Monitor className="h-7 w-7" />

                                                <span className="text-sm">
                                                    Học sinh chưa chia sẻ màn hình
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <p className="mt-4 text-xs text-muted-foreground">
                                Thông tin lượt thi lấy từ API hiện tại.
                                Luồng webcam và màn hình được nhận qua
                                kết nối WebRTC của lượt thi.
                            </p>
                        </section>
                    </div>
                )}
            </div>
        </MainLayout>
    );
}