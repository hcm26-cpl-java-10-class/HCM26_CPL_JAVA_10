import {
    AlertTriangle,
    CheckCircle2,
    ClipboardCheck,
    Download,
    FilePlus,
    Search,
    Star,
    XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { useAllAudits, useCreateAudit, useExternalClasses } from "@/hooks/useExternalLookups";
import type { AuditRecord } from "@/types";
import { MainLayout } from "@/components/layout/MainLayout";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function AuditResultBadge({ result }: { result?: string }) {
    const map: Record<string, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
        pass: { label: "Đạt", cls: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300", icon: CheckCircle2 },
        warning: { label: "Cảnh báo", cls: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300", icon: AlertTriangle },
        fail: { label: "Không đạt", cls: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300", icon: XCircle },
    };
    const meta = map[result ?? ""] ?? { label: result ?? "—", cls: "bg-muted text-muted-foreground", icon: ClipboardCheck };
    const Icon = meta.icon;
    return (
        <Badge variant="outline" className={cn("text-xs gap-1 font-medium", meta.cls)}>
            <Icon className="size-3" /> {meta.label}
        </Badge>
    );
}

function StarRating({ value, max = 5 }: { value?: number; max?: number }) {
    if (value == null) return <span className="text-muted-foreground text-xs">—</span>;
    return (
        <span className="inline-flex items-center gap-0.5 text-xs text-yellow-500">
            {Array.from({ length: max }, (_, i) => (
                <Star key={i} className={cn("size-3", i < Math.round(value) ? "fill-yellow-500" : "fill-muted stroke-muted-foreground")} />
            ))}
            <span className="ml-1 text-muted-foreground font-medium">{value.toFixed(1)}</span>
        </span>
    );
}

// ---- Create Audit Dialog ----
function CreateAuditDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { data: classes = [] } = useExternalClasses(open);
    const createMutation = useCreateAudit();
    const [form, setForm] = useState({
        classId: "",
        auditDate: new Date().toISOString().split("T")[0],
        auditor: "QATeamLead",
        trainerProfessionalism: 4,
        materialQuality: 4,
        studentsEngagement: 4,
        syllabusCompliance: 4,
        notes: "",
    });

    const set = (key: string, val: string | number) => setForm((p) => ({ ...p, [key]: val }));

    const handleSubmit = () => {
        if (!form.classId || !form.auditDate) return;
        createMutation.mutate(
            { ...form, classId: parseInt(form.classId, 10) },
            { onSuccess: () => { setForm({ ...form, classId: "", notes: "" }); onClose(); } }
        );
    };

    const SCORE_OPTIONS = [1, 2, 3, 4, 5];
    const CRITERIA = [
        { key: "trainerProfessionalism", label: "Tác phong giảng viên" },
        { key: "materialQuality", label: "Chất lượng tài liệu" },
        { key: "studentsEngagement", label: "Mức độ tham gia học viên" },
        { key: "syllabusCompliance", label: "Tuân thủ Syllabus" },
    ] as const;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FilePlus className="size-4" /> Tạo phiếu kiểm tra chất lượng
                    </DialogTitle>
                    <DialogDescription>Audit lớp học theo tiêu chí chất lượng đào tạo</DialogDescription>
                </DialogHeader>
                <div className="grid gap-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label>Lớp học <span className="text-destructive">*</span></Label>
                            <NativeSelect value={form.classId} onChange={(e) => set("classId", e.target.value)}>
                                <option value="">— Chọn lớp —</option>
                                {classes.map((c) => (
                                    <option key={c.id} value={c.id}>{c.code}</option>
                                ))}
                            </NativeSelect>
                        </div>
                        <div className="space-y-1">
                            <Label>Ngày kiểm tra <span className="text-destructive">*</span></Label>
                            <Input type="date" value={form.auditDate} onChange={(e) => set("auditDate", e.target.value)} />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <Label>Cán bộ kiểm tra</Label>
                        <Input value={form.auditor} onChange={(e) => set("auditor", e.target.value)} />
                    </div>
                    {/* Score criteria */}
                    <div className="rounded-lg border p-3 space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground">TIÊU CHÍ CHẤM ĐIỂM (1-5 ⭐)</p>
                        {CRITERIA.map(({ key, label }) => (
                            <div key={key} className="flex items-center justify-between">
                                <Label className="text-sm">{label}</Label>
                                <div className="flex gap-1">
                                    {SCORE_OPTIONS.map((score) => (
                                        <button
                                            key={score}
                                            type="button"
                                            onClick={() => set(key, score)}
                                            className={cn(
                                                "size-7 rounded text-xs font-bold border transition-colors",
                                                form[key] >= score
                                                    ? "bg-yellow-400 border-yellow-500 text-yellow-900"
                                                    : "bg-muted border-muted-foreground/20 text-muted-foreground"
                                            )}
                                        >
                                            {score}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                        <p className="text-xs text-muted-foreground">
                            Điểm trung bình: <strong>
                                {((form.trainerProfessionalism + form.materialQuality + form.studentsEngagement + form.syllabusCompliance) / 4).toFixed(2)}
                            </strong> → {((form.trainerProfessionalism + form.materialQuality + form.studentsEngagement + form.syllabusCompliance) / 4) >= 4 ? "✅ Đạt" : ((form.trainerProfessionalism + form.materialQuality + form.studentsEngagement + form.syllabusCompliance) / 4) >= 3 ? "⚠ Cảnh báo" : "❌ Không đạt"}
                        </p>
                    </div>
                    <div className="space-y-1">
                        <Label>Nhận xét / Ghi chú</Label>
                        <Textarea
                            placeholder="Nhận xét chung về buổi kiểm tra..."
                            value={form.notes}
                            onChange={(e) => set("notes", e.target.value)}
                            rows={3}
                        />
                    </div>
                </div>
                {createMutation.isError && (
                    <p className="text-sm text-destructive">{(createMutation.error as Error).message}</p>
                )}
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Hủy</Button>
                    <Button onClick={handleSubmit} disabled={!form.classId || !form.auditDate || createMutation.isPending}>
                        <ClipboardCheck className="size-4 mr-1" />
                        {createMutation.isPending ? "Đang lưu..." : "Tạo phiếu kiểm tra"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ---- Detail Dialog ----
function AuditDetailDialog({ audit, onClose }: { audit: AuditRecord | null; onClose: () => void }) {
    if (!audit) return null;
    return (
        <Dialog open={!!audit} onOpenChange={onClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Chi tiết kiểm tra — {audit.classCode}</DialogTitle>
                    <DialogDescription>{audit.auditDate} · {audit.auditor}</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">Kết quả tổng thể</span>
                        <AuditResultBadge result={audit.result} />
                    </div>
                    {[
                        { label: "Tác phong giảng viên", value: audit.trainerProfessionalism },
                        { label: "Chất lượng tài liệu", value: audit.materialQuality },
                        { label: "Mức độ tham gia học viên", value: audit.studentsEngagement },
                        { label: "Tuân thủ Syllabus", value: audit.syllabusCompliance },
                    ].map((c) => (
                        <div key={c.label} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{c.label}</span>
                            <StarRating value={c.value} />
                        </div>
                    ))}
                    <div className="rounded border p-2.5 text-sm bg-muted/30">
                        <p className="font-semibold mb-1">Điểm trung bình: <StarRating value={audit.overallScore} /></p>
                        {audit.notes && <p className="text-muted-foreground">{audit.notes}</p>}
                    </div>
                    {(audit.actionItems ?? []).length > 0 && (
                        <div className="space-y-1">
                            <p className="text-sm font-semibold">Action Items</p>
                            {(audit.actionItems ?? []).map((item) => (
                                <div key={item.id} className="flex items-start gap-2 text-sm border rounded p-2">
                                    {item.status === "done" ? (
                                        <CheckCircle2 className="size-4 text-green-600 mt-0.5 flex-shrink-0" />
                                    ) : (
                                        <AlertTriangle className="size-4 text-orange-500 mt-0.5 flex-shrink-0" />
                                    )}
                                    <div>
                                        <p>{item.description}</p>
                                        <p className="text-xs text-muted-foreground">Hạn: {item.dueDate} · {item.status === "done" ? "Đã xử lý" : "Chưa xử lý"}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Đóng</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ---- Main Page ----
export default function AuditPage() {
    const { data: audits = [], isLoading, isError, refetch } = useAllAudits();
    const [search, setSearch] = useState("");
    const [filterResult, setFilterResult] = useState("all");
    const [showCreate, setShowCreate] = useState(false);
    const [detailAudit, setDetailAudit] = useState<AuditRecord | null>(null);

    const filtered = useMemo(
        () =>
            audits.filter((a) => {
                const matchSearch =
                    !search ||
                    (a.classCode ?? "").toLowerCase().includes(search.toLowerCase()) ||
                    (a.auditor ?? "").toLowerCase().includes(search.toLowerCase());
                const matchResult = filterResult === "all" || a.result === filterResult;
                return matchSearch && matchResult;
            }),
        [audits, search, filterResult]
    );

    const stats = {
        total: audits.length,
        pass: audits.filter((a) => a.result === "pass").length,
        warning: audits.filter((a) => a.result === "warning").length,
        fail: audits.filter((a) => a.result === "fail").length,
    };

    const handleExport = () => {
        const rows = filtered.map((a, i) => ({
            STT: i + 1,
            "Lớp học": a.classCode,
            "Ngày kiểm tra": a.auditDate,
            "Cán bộ KT": a.auditor,
            "Tác phong GV": a.trainerProfessionalism,
            "Tài liệu": a.materialQuality,
            "Tham gia HV": a.studentsEngagement,
            "Tuân thủ Syllabus": a.syllabusCompliance,
            "Điểm TB": a.overallScore,
            "Kết quả": a.result === "pass" ? "Đạt" : a.result === "warning" ? "Cảnh báo" : "Không đạt",
            "Nhận xét": a.notes,
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Audit Records");
        XLSX.writeFile(wb, "audit-records.xlsx");
    };

    return (
        <MainLayout pathName={{ training: "Training Operations", audit: "Audit" }}>
            <div className="space-y-5">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <ClipboardCheck className="size-5 text-blue-600" /> Kiểm tra chất lượng đào tạo
                        </h1>
                        <p className="text-sm text-muted-foreground mt-0.5">Phiếu audit lớp học theo tiêu chí chất lượng FAMS</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleExport} disabled={filtered.length === 0}>
                            <Download className="size-4 mr-1" /> Export Excel
                        </Button>
                        <Button size="sm" onClick={() => setShowCreate(true)}>
                            <FilePlus className="size-4 mr-1" /> Tạo phiếu kiểm tra
                        </Button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { label: "Tổng phiếu KT", value: stats.total, cls: "text-foreground" },
                        { label: "✅ Đạt", value: stats.pass, cls: "text-green-600" },
                        { label: "⚠ Cảnh báo", value: stats.warning, cls: "text-yellow-600" },
                        { label: "❌ Không đạt", value: stats.fail, cls: "text-red-600" },
                    ].map((s, i) => (
                        <div key={i} className="rounded-lg border bg-card p-4 text-center">
                            <p className={cn("text-2xl font-bold", s.cls)}>{s.value}</p>
                            <p className="text-xs text-muted-foreground">{s.label}</p>
                        </div>
                    ))}
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-2">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                        <Input
                            className="pl-9"
                            placeholder="Tìm theo lớp, cán bộ kiểm tra..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <NativeSelect value={filterResult} onChange={(e) => setFilterResult(e.target.value)} className="w-40">
                        <option value="all">Tất cả kết quả</option>
                        <option value="pass">✅ Đạt</option>
                        <option value="warning">⚠ Cảnh báo</option>
                        <option value="fail">❌ Không đạt</option>
                    </NativeSelect>
                </div>

                {/* Table */}
                <div className="rounded-lg border overflow-x-auto bg-card">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>#</TableHead>
                                <TableHead>Lớp học</TableHead>
                                <TableHead>Ngày KT</TableHead>
                                <TableHead>Cán bộ KT</TableHead>
                                <TableHead>Tác phong GV</TableHead>
                                <TableHead>Tài liệu</TableHead>
                                <TableHead>HV tham gia</TableHead>
                                <TableHead>Syllabus</TableHead>
                                <TableHead>Điểm TB</TableHead>
                                <TableHead>Kết quả</TableHead>
                                <TableHead></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 3 }, (_, i) => (
                                    <TableRow key={i}>
                                        {Array.from({ length: 11 }, (_, j) => (
                                            <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : isError ? (
                                <TableRow>
                                    <TableCell colSpan={11} className="text-center py-8 text-destructive">
                                        Không thể tải dữ liệu.{" "}
                                        <button onClick={() => void refetch()} className="underline">Thử lại</button>
                                    </TableCell>
                                </TableRow>
                            ) : filtered.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={11} className="text-center py-10 text-muted-foreground">
                                        {search || filterResult !== "all" ? "Không tìm thấy phiếu kiểm tra phù hợp." : "Chưa có phiếu kiểm tra nào."}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filtered.map((a, i) => (
                                    <TableRow key={a.id}>
                                        <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                                        <TableCell className="font-semibold text-sm">{a.classCode}</TableCell>
                                        <TableCell className="text-sm">{a.auditDate}</TableCell>
                                        <TableCell className="text-sm">{a.auditor}</TableCell>
                                        <TableCell><StarRating value={a.trainerProfessionalism} /></TableCell>
                                        <TableCell><StarRating value={a.materialQuality} /></TableCell>
                                        <TableCell><StarRating value={a.studentsEngagement} /></TableCell>
                                        <TableCell><StarRating value={a.syllabusCompliance} /></TableCell>
                                        <TableCell>
                                            <span className="font-bold text-sm">{a.overallScore?.toFixed(2)}</span>
                                        </TableCell>
                                        <TableCell><AuditResultBadge result={a.result} /></TableCell>
                                        <TableCell>
                                            <Button size="sm" variant="ghost" onClick={() => setDetailAudit(a)}>
                                                Chi tiết
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <CreateAuditDialog open={showCreate} onClose={() => setShowCreate(false)} />
            <AuditDetailDialog audit={detailAudit} onClose={() => setDetailAudit(null)} />
        </MainLayout>
    );
}
