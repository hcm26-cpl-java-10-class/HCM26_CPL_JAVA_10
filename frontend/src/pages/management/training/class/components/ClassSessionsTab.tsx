import {
    AlertTriangle,
    BookOpen,
    CalendarPlus,
    CheckCircle2,
    ChevronDown,
    ClipboardCheck,
    FlaskConical,
    GraduationCap,
    MapPin,
    Pencil,
    Plus,
    Trash2,
    User,
    XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
    useClassSessions,
    useClassTrainees,
    useCreateSession,
    useDeleteSession,
    useSaveAttendance,
    useSessionAttendance,
} from "@/hooks/useExternalLookups";
import type { AttendanceRecord, ClassSession, ExternalClass } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/common/NativeSelect";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

// ---- Helpers ----

const SESSION_TYPES = [
    { value: "lecture", label: "Lý thuyết (Lecture)" },
    { value: "lab", label: "Thực hành (Lab)" },
    { value: "exam", label: "Kiểm tra (Exam)" },
    { value: "orientation", label: "Định hướng (Orientation)" },
];

const SLOTS = [
    { value: "Morning (08:30-12:00)", label: "Sáng (08:30 - 12:00)" },
    { value: "Afternoon (13:30-17:30)", label: "Chiều (13:30 - 17:30)" },
    { value: "Evening (18:00-21:00)", label: "Tối (18:00 - 21:00)" },
];

const ATTENDANCE_OPTIONS = [
    { value: "present", label: "✅ Có mặt" },
    { value: "late", label: "⏰ Đi muộn" },
    { value: "absent_permitted", label: "📝 Vắng có phép" },
    { value: "absent", label: "❌ Vắng không phép" },
];

function SessionTypeBadge({ type }: { type?: string }) {
    const map: Record<string, { icon: typeof BookOpen; cls: string }> = {
        lecture: { icon: BookOpen, cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
        lab: { icon: FlaskConical, cls: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
        exam: { icon: ClipboardCheck, cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
        orientation: { icon: GraduationCap, cls: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
    };
    const meta = map[type ?? ""] ?? { icon: BookOpen, cls: "bg-muted text-muted-foreground" };
    const Icon = meta.icon;
    return (
        <Badge variant="outline" className={cn("text-xs gap-1", meta.cls)}>
            <Icon className="size-3" />
            {SESSION_TYPES.find((t) => t.value === type)?.label.split(" ")[0] ?? type}
        </Badge>
    );
}

function SessionStatusBadge({ status }: { status?: string }) {
    if (status === "completed")
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 text-xs border-green-300">Đã xong</Badge>;
    if (status === "cancelled")
        return <Badge variant="destructive" className="text-xs">Đã hủy</Badge>;
    return <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">Sắp diễn ra</Badge>;
}

// ---- Add Session Dialog ----
function AddSessionDialog({
    open,
    onClose,
    classItem,
}: {
    open: boolean;
    onClose: () => void;
    classItem: ExternalClass;
}) {
    const [form, setForm] = useState({
        date: "",
        slot: "Morning (08:30-12:00)",
        topic: "",
        trainer: classItem.masterTrainer ?? "",
        room: "Center Building Room 101",
        type: "lecture",
    });
    const createMutation = useCreateSession(String(classItem.id));

    const handleSubmit = () => {
        createMutation.mutate(form, {
            onSuccess: () => {
                setForm({ date: "", slot: "Morning (08:30-12:00)", topic: "", trainer: classItem.masterTrainer ?? "", room: "Center Building Room 101", type: "lecture" });
                onClose();
            },
        });
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CalendarPlus className="size-4" /> Tạo buổi học mới
                    </DialogTitle>
                    <DialogDescription>Lớp {classItem.code}</DialogDescription>
                </DialogHeader>
                <div className="grid gap-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label>Ngày <span className="text-destructive">*</span></Label>
                            <Input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                            <Label>Ca học</Label>
                            <NativeSelect value={form.slot} onChange={(e) => setForm((p) => ({ ...p, slot: e.target.value }))}>
                                {SLOTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </NativeSelect>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <Label>Chủ đề / Môn học <span className="text-destructive">*</span></Label>
                        <Input
                            placeholder="VD: Spring Boot Introduction"
                            value={form.topic}
                            onChange={(e) => setForm((p) => ({ ...p, topic: e.target.value }))}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label>Loại buổi học</Label>
                            <NativeSelect value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>
                                {SESSION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </NativeSelect>
                        </div>
                        <div className="space-y-1">
                            <Label>Giảng viên</Label>
                            <Input value={form.trainer} onChange={(e) => setForm((p) => ({ ...p, trainer: e.target.value }))} />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <Label>Phòng học</Label>
                        <Input value={form.room} onChange={(e) => setForm((p) => ({ ...p, room: e.target.value }))} />
                    </div>
                </div>
                {createMutation.isError && (
                    <p className="text-sm text-destructive">{(createMutation.error as Error).message}</p>
                )}
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Hủy</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!form.date || !form.topic || createMutation.isPending}
                    >
                        <Plus className="size-4 mr-1" /> Tạo buổi học
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ---- Attendance Dialog ----
function AttendanceDialog({
    session,
    classId,
    onClose,
}: {
    session: ClassSession | null;
    classId: string;
    onClose: () => void;
}) {
    const { data: records = [], isLoading } = useSessionAttendance(
        session ? classId : undefined,
        session?.id
    );
    const saveMutation = useSaveAttendance(classId, session?.id);
    const [localRecords, setLocalRecords] = useState<AttendanceRecord[]>([]);

    // Sync when records loaded
    const displayRecords = localRecords.length > 0 ? localRecords : records;

    const setStatus = (traineeId: number, status: string) => {
        const base = displayRecords.length > 0 ? displayRecords : records;
        const updated = base.map((r) =>
            r.traineeId === traineeId ? { ...r, status } : r
        );
        setLocalRecords(updated);
    };

    const markAll = (status: string) => {
        const base = displayRecords.length > 0 ? displayRecords : records;
        setLocalRecords(base.map((r) => ({ ...r, status })));
    };

    const handleSave = () => {
        const toSave = displayRecords.map(({ traineeId, status }) => ({ traineeId, status }));
        saveMutation.mutate(toSave as AttendanceRecord[], {
            onSuccess: () => {
                setLocalRecords([]);
                onClose();
            },
        });
    };

    return (
        <Dialog open={!!session} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ClipboardCheck className="size-4" /> Điểm danh — {session?.topic}
                    </DialogTitle>
                    <DialogDescription>
                        {session?.date} · {session?.slot}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground self-center">Đánh dấu tất cả:</span>
                    {ATTENDANCE_OPTIONS.map((o) => (
                        <Button key={o.value} size="sm" variant="outline" onClick={() => markAll(o.value)}>
                            {o.label}
                        </Button>
                    ))}
                </div>
                <div className="max-h-72 overflow-y-auto rounded border">
                    {isLoading ? (
                        <div className="p-4 space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
                    ) : displayRecords.length === 0 ? (
                        <p className="p-6 text-center text-sm text-muted-foreground">Không có học viên</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Mã HV</TableHead>
                                    <TableHead>Họ tên</TableHead>
                                    <TableHead>Tình trạng</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {displayRecords.map((r) => (
                                    <TableRow key={r.traineeId}>
                                        <TableCell className="font-mono text-xs">{r.traineeCode}</TableCell>
                                        <TableCell className="font-medium text-sm">{r.traineeName}</TableCell>
                                        <TableCell>
                                            <NativeSelect
                                                value={r.status}
                                                onChange={(e) => setStatus(r.traineeId, e.target.value)}
                                                className="w-44"
                                            >
                                                {ATTENDANCE_OPTIONS.map((o) => (
                                                    <option key={o.value} value={o.value}>{o.label}</option>
                                                ))}
                                                <option value="not_marked">— Chưa đánh dấu</option>
                                            </NativeSelect>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </div>
                {saveMutation.isError && (
                    <p className="text-sm text-destructive">{(saveMutation.error as Error).message}</p>
                )}
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Hủy</Button>
                    <Button onClick={handleSave} disabled={saveMutation.isPending || displayRecords.length === 0}>
                        <CheckCircle2 className="size-4 mr-1" />
                        {saveMutation.isPending ? "Đang lưu..." : "Lưu điểm danh"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ---- Main Component ----
export function ClassSessionsTab({ classItem }: { classItem: ExternalClass }) {
    const classId = String(classItem.id);
    const { data: sessions = [], isLoading, isError, refetch } = useClassSessions(classId);
    const deleteMutation = useDeleteSession(classId);
    const [showAdd, setShowAdd] = useState(false);
    const [attendanceSession, setAttendanceSession] = useState<ClassSession | null>(null);

    const isEditable =
        classItem.status !== "completed" &&
        classItem.status !== "closed" &&
        classItem.status !== "cancelled";

    const upcoming = sessions.filter((s) => s.status === "upcoming").length;
    const completed = sessions.filter((s) => s.status === "completed").length;

    const sortedSessions = useMemo(
        () => [...sessions].sort((a, b) => a.date.localeCompare(b.date)),
        [sessions]
    );

    return (
        <div className="space-y-4">
            {/* Summary */}
            <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-4 py-2.5 text-sm">
                <span><strong>{sessions.length}</strong> buổi học</span>
                <span className="text-green-600"><strong>{completed}</strong> đã hoàn thành</span>
                <span className="text-blue-600"><strong>{upcoming}</strong> sắp diễn ra</span>
                {isEditable && (
                    <div className="ml-auto">
                        <Button size="sm" onClick={() => setShowAdd(true)}>
                            <Plus className="size-4 mr-1" /> Thêm buổi học
                        </Button>
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="rounded-lg border overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>Ngày</TableHead>
                            <TableHead>Ca</TableHead>
                            <TableHead>Chủ đề</TableHead>
                            <TableHead>Loại</TableHead>
                            <TableHead>Giảng viên</TableHead>
                            <TableHead>Phòng</TableHead>
                            <TableHead>Trạng thái</TableHead>
                            <TableHead></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            Array.from({ length: 4 }, (_, i) => (
                                <TableRow key={i}>
                                    {Array.from({ length: 9 }, (_, j) => (
                                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : isError ? (
                            <TableRow>
                                <TableCell colSpan={9} className="text-center py-8 text-destructive">
                                    <XCircle className="size-5 mx-auto mb-1" />
                                    Không thể tải lịch học.{" "}
                                    <button onClick={() => void refetch()} className="underline">Thử lại</button>
                                </TableCell>
                            </TableRow>
                        ) : sortedSessions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                                    Lớp chưa có buổi học nào được lập lịch.
                                </TableCell>
                            </TableRow>
                        ) : (
                            sortedSessions.map((s, i) => (
                                <TableRow key={s.id}>
                                    <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                                    <TableCell className="font-medium text-sm whitespace-nowrap">{s.date}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{s.slot}</TableCell>
                                    <TableCell className="font-medium text-sm max-w-[200px] truncate">{s.topic}</TableCell>
                                    <TableCell><SessionTypeBadge type={s.type} /></TableCell>
                                    <TableCell>
                                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <User className="size-3" />{s.trainer}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <MapPin className="size-3" />{s.room}
                                        </span>
                                    </TableCell>
                                    <TableCell><SessionStatusBadge status={s.status} /></TableCell>
                                    <TableCell>
                                        <div className="flex gap-1">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="text-xs h-7"
                                                onClick={() => setAttendanceSession(s)}
                                            >
                                                <ClipboardCheck className="size-3 mr-1" /> Điểm danh
                                            </Button>
                                            {isEditable && s.status !== "completed" && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-7 text-destructive hover:text-destructive"
                                                    onClick={() => {
                                                        if (confirm(`Xóa buổi học "${s.topic}"?`)) {
                                                            deleteMutation.mutate(s.id);
                                                        }
                                                    }}
                                                >
                                                    <Trash2 className="size-3" />
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <AddSessionDialog open={showAdd} onClose={() => setShowAdd(false)} classItem={classItem} />
            <AttendanceDialog
                session={attendanceSession}
                classId={classId}
                onClose={() => setAttendanceSession(null)}
            />
        </div>
    );
}
