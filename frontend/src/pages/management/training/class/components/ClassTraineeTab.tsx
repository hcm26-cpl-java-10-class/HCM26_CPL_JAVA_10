import {
    AlertTriangle,
    CheckCircle2,
    Download,
    GraduationCap,
    Mail,
    Phone,
    Plus,
    Search,
    Trash2,
    TrendingDown,
    TrendingUp,
    UserMinus,
    XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
    useAddTrainee,
    useAllTrainees,
    useClassTrainees,
    useRemoveTrainee,
} from "@/hooks/useExternalLookups";
import type { ExternalClass, Trainee } from "@/types";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const ATTENDANCE_THRESHOLD = 80;

function AttendanceBadge({ pct }: { pct: number | null | undefined }) {
    if (pct == null) return <span className="text-muted-foreground text-xs">—</span>;
    const ok = pct >= ATTENDANCE_THRESHOLD;
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 text-xs font-semibold",
                ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            )}
        >
            {ok ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {pct}%
        </span>
    );
}

function TraineeStatusBadge({ status }: { status?: string }) {
    const map: Record<string, { label: string; cls: string }> = {
        studying: { label: "Đang học", cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
        dropped: { label: "Đã rút", cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
        graduated: { label: "Tốt nghiệp", cls: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
    };
    const meta = map[status ?? ""] ?? { label: status ?? "—", cls: "bg-muted text-muted-foreground" };
    return (
        <Badge variant="outline" className={cn("text-xs font-medium", meta.cls)}>
            {meta.label}
        </Badge>
    );
}

// ---- Add Trainee Dialog ----
function AddTraineeDialog({
    open,
    onClose,
    classItem,
}: {
    open: boolean;
    onClose: () => void;
    classItem: ExternalClass;
}) {
    const [search, setSearch] = useState("");
    const { data: allTrainees = [], isLoading } = useAllTrainees(open);
    const { data: classTrainees = [] } = useClassTrainees(String(classItem.id));
    const addMutation = useAddTrainee(String(classItem.id));

    const enrolledIds = new Set(classTrainees.map((t) => t.id));
    const filtered = allTrainees.filter(
        (t) =>
            !enrolledIds.has(t.id) &&
            (!search ||
                (t.fullName ?? "").toLowerCase().includes(search.toLowerCase()) ||
                (t.code ?? "").toLowerCase().includes(search.toLowerCase()) ||
                (t.email ?? "").toLowerCase().includes(search.toLowerCase()))
    );

    const handleAdd = (t: Trainee) => {
        addMutation.mutate(t.id, {
            onSuccess: () => {
                setSearch("");
            },
        });
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Plus className="size-4" /> Thêm học viên vào {classItem.code}
                    </DialogTitle>
                    <DialogDescription>
                        Lớp đã có {classItem.enrolledTrainees ?? 0}/{classItem.plannedSize} học viên.
                    </DialogDescription>
                </DialogHeader>
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <Input
                        className="pl-9"
                        placeholder="Tìm theo tên, mã HV, email..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="max-h-72 overflow-y-auto rounded border">
                    {isLoading ? (
                        <div className="p-4 space-y-2">
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} className="h-10 w-full" />
                            ))}
                        </div>
                    ) : filtered.length === 0 ? (
                        <p className="p-6 text-center text-sm text-muted-foreground">
                            {search ? "Không tìm thấy học viên phù hợp" : "Không còn học viên nào để thêm"}
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Mã HV</TableHead>
                                    <TableHead>Họ tên</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Trường</TableHead>
                                    <TableHead>GPA</TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map((t) => (
                                    <TableRow key={t.id}>
                                        <TableCell className="font-mono text-xs">{t.code}</TableCell>
                                        <TableCell className="font-medium">{t.fullName}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{t.email}</TableCell>
                                        <TableCell className="text-xs">{t.university}</TableCell>
                                        <TableCell className="text-xs">{t.gpa}</TableCell>
                                        <TableCell>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleAdd(t)}
                                                disabled={addMutation.isPending}
                                            >
                                                <Plus className="size-3 mr-1" /> Thêm
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </div>
                {addMutation.isError && (
                    <p className="text-sm text-destructive">
                        {(addMutation.error as Error).message}
                    </p>
                )}
                {addMutation.isSuccess && (
                    <p className="text-sm text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="size-4" /> Đã thêm học viên thành công!
                    </p>
                )}
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Đóng
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ---- Remove Trainee Dialog ----
function RemoveTraineeDialog({
    trainee,
    classId,
    onClose,
}: {
    trainee: Trainee | null;
    classId: string;
    onClose: () => void;
}) {
    const [reason, setReason] = useState("");
    const removeMutation = useRemoveTrainee(classId);

    const handleRemove = () => {
        if (!trainee || !reason.trim()) return;
        removeMutation.mutate(
            { traineeId: trainee.id, reason },
            {
                onSuccess: () => {
                    setReason("");
                    onClose();
                },
            }
        );
    };

    return (
        <Dialog open={!!trainee} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-destructive">
                        <UserMinus className="size-4" /> Rút học viên khỏi lớp
                    </DialogTitle>
                    <DialogDescription>
                        Học viên: <strong>{trainee?.fullName}</strong> ({trainee?.code})
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                    <Label htmlFor="reason">
                        Lý do rút <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                        id="reason"
                        placeholder="VD: Bảo lưu do sức khỏe / Chuyển lớp / Drop out..."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                    />
                </div>
                {removeMutation.isError && (
                    <p className="text-sm text-destructive">{(removeMutation.error as Error).message}</p>
                )}
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Hủy
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleRemove}
                        disabled={!reason.trim() || removeMutation.isPending}
                    >
                        <Trash2 className="size-4 mr-1" /> Xác nhận rút
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ---- Main Component ----
export function ClassTraineeTab({ classItem }: { classItem: ExternalClass }) {
    const classId = String(classItem.id);
    const { data: trainees = [], isLoading, isError, refetch } = useClassTrainees(classId);
    const [search, setSearch] = useState("");
    const [showAdd, setShowAdd] = useState(false);
    const [removeTarget, setRemoveTarget] = useState<Trainee | null>(null);

    const isEditable =
        classItem.status !== "completed" &&
        classItem.status !== "closed" &&
        classItem.status !== "cancelled";

    const filtered = useMemo(
        () =>
            trainees.filter(
                (t) =>
                    !search ||
                    (t.fullName ?? "").toLowerCase().includes(search.toLowerCase()) ||
                    (t.code ?? "").toLowerCase().includes(search.toLowerCase()) ||
                    (t.email ?? "").toLowerCase().includes(search.toLowerCase())
            ),
        [trainees, search]
    );

    const atRisk = trainees.filter((t) => t.attendance != null && t.attendance < ATTENDANCE_THRESHOLD).length;

    const handleExport = () => {
        const rows = trainees.map((t, i) => ({
            STT: i + 1,
            "Mã HV": t.code,
            "Họ tên": t.fullName,
            Email: t.email,
            "Điện thoại": t.phone,
            Trường: t.university,
            GPA: t.gpa,
            "Trạng thái": t.status,
            "Chuyên cần (%)": t.attendance != null ? `${t.attendance}%` : "—",
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Trainee List");
        XLSX.writeFile(wb, `trainee-list-${classItem.code ?? classId}.xlsx`);
    };

    return (
        <div className="space-y-4">
            {/* Summary bar */}
            <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-4 py-2.5 text-sm">
                <span className="flex items-center gap-1.5">
                    <GraduationCap className="size-4 text-blue-600" />
                    <strong>{trainees.length}</strong> học viên
                </span>
                {atRisk > 0 && (
                    <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                        <AlertTriangle className="size-4" />
                        <strong>{atRisk}</strong> nguy cơ cấm thi (&lt;{ATTENDANCE_THRESHOLD}%)
                    </span>
                )}
                <div className="ml-auto flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={handleExport} disabled={trainees.length === 0}>
                        <Download className="size-4 mr-1" /> Export Excel
                    </Button>
                    {isEditable && (
                        <Button size="sm" onClick={() => setShowAdd(true)}>
                            <Plus className="size-4 mr-1" /> Thêm học viên
                        </Button>
                    )}
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                    className="pl-9"
                    placeholder="Tìm học viên theo tên, mã HV, email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {/* Table */}
            <div className="rounded-lg border overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-10">#</TableHead>
                            <TableHead>Mã HV</TableHead>
                            <TableHead>Họ tên</TableHead>
                            <TableHead>Liên hệ</TableHead>
                            <TableHead>Trường</TableHead>
                            <TableHead>GPA</TableHead>
                            <TableHead>Chuyên cần</TableHead>
                            <TableHead>Trạng thái</TableHead>
                            {isEditable && <TableHead></TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            Array.from({ length: 5 }, (_, i) => (
                                <TableRow key={i}>
                                    {Array.from({ length: isEditable ? 9 : 8 }, (_, j) => (
                                        <TableCell key={j}>
                                            <Skeleton className="h-4 w-full" />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : isError ? (
                            <TableRow>
                                <TableCell
                                    colSpan={isEditable ? 9 : 8}
                                    className="text-center py-8 text-destructive"
                                >
                                    <XCircle className="size-5 mx-auto mb-1" />
                                    Không thể tải danh sách học viên.{" "}
                                    <button
                                        onClick={() => void refetch()}
                                        className="underline hover:no-underline"
                                    >
                                        Thử lại
                                    </button>
                                </TableCell>
                            </TableRow>
                        ) : filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={isEditable ? 9 : 8} className="text-center py-10 text-muted-foreground">
                                    {search ? "Không tìm thấy học viên phù hợp." : "Lớp chưa có học viên nào."}
                                </TableCell>
                            </TableRow>
                        ) : (
                            filtered.map((t, i) => (
                                <TableRow
                                    key={t.id}
                                    className={
                                        t.attendance != null && t.attendance < ATTENDANCE_THRESHOLD
                                            ? "bg-orange-50 dark:bg-orange-950/20"
                                            : undefined
                                    }
                                >
                                    <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                                    <TableCell className="font-mono text-xs font-medium">{t.code}</TableCell>
                                    <TableCell className="font-semibold">{t.fullName}</TableCell>
                                    <TableCell>
                                        <div className="text-xs space-y-0.5">
                                            <div className="flex items-center gap-1 text-muted-foreground">
                                                <Mail className="size-3" /> {t.email}
                                            </div>
                                            <div className="flex items-center gap-1 text-muted-foreground">
                                                <Phone className="size-3" /> {t.phone}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm">{t.university}</TableCell>
                                    <TableCell className="text-sm font-medium">{t.gpa?.toFixed(1)}</TableCell>
                                    <TableCell>
                                        <AttendanceBadge pct={t.attendance} />
                                    </TableCell>
                                    <TableCell>
                                        <TraineeStatusBadge status={t.status} />
                                    </TableCell>
                                    {isEditable && (
                                        <TableCell>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => setRemoveTarget(t)}
                                            >
                                                <UserMinus className="size-4" />
                                            </Button>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <p className="text-xs text-muted-foreground">
                Học viên có chuyên cần dưới {ATTENDANCE_THRESHOLD}% được đánh dấu cảnh báo nguy cơ cấm thi.
            </p>

            <AddTraineeDialog open={showAdd} onClose={() => setShowAdd(false)} classItem={classItem} />
            <RemoveTraineeDialog
                trainee={removeTarget}
                classId={classId}
                onClose={() => setRemoveTarget(null)}
            />
        </div>
    );
}
