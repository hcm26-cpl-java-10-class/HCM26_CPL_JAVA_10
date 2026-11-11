import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CopyPlus, Pencil, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { programApi, type TrainingProgramRequest, type TrainingProgramResponse } from "@/api/features/program.api";
import { subjectApi } from "@/api/features/subject.api";
import type { SubjectDTO } from "@/types";
import { usePermissions } from "@/hooks/usePermissions";
import { ProgramEditor } from "./ProgramEditor";
import { ProgramActionDialog, type ProgramAction } from "./ProgramDialogs";
import { ProgramStatusBadge, errorMessage, primaryButtonClass } from "./program-ui";

const chartColors = ["#2563eb", "#16a34a", "#d97706", "#9333ea", "#0891b2", "#e11d48", "#64748b", "#65a30d"];

export default function TrainingProgramDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canUpdate = hasPermission("PROGRAM_UPDATE");
  const canCreate = hasPermission("PROGRAM_CREATE");
  const [program, setProgram] = useState<TrainingProgramResponse | null>(null);
  const [subjects, setSubjects] = useState<SubjectDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [action, setAction] = useState<ProgramAction | null>(null);

  const load = useCallback(async () => {
    if (!id || !/^\d+$/.test(id)) { setError("ID chương trình không hợp lệ."); setLoading(false); return; }
    setLoading(true); setError("");
    try { setProgram(await programApi.getById(Number(id))); }
    catch (e) { setError(errorMessage(e, "Không tải được chương trình.")); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void load(); void subjectApi.getActiveSubjects().then(setSubjects).catch(() => setSubjects([])); }, [load]);

  const chart = useMemo(() => {
    const rows = program?.subjects ?? [];
    const total = rows.reduce((sum, row) => sum + Number(row.durationHours || 0), 0);
    let cursor = 0;
    const segments = rows.map((row, index) => {
      const start = total ? cursor / total * 100 : 0;
      cursor += Number(row.durationHours || 0);
      const end = total ? cursor / total * 100 : 0;
      return { ...row, color: chartColors[index % chartColors.length], start, end, percent: total ? Number(row.durationHours) / total * 100 : 0 };
    });
    return { total, segments, gradient: segments.length ? `conic-gradient(${segments.map(s => `${s.color} ${s.start}% ${s.end}%`).join(", ")})` : "conic-gradient(#e5e7eb 0% 100%)" };
  }, [program]);

  const save = async (request: TrainingProgramRequest) => {
    if (!program) return;
    const updated = await programApi.update(program.id, request);
    setProgram(updated); setEditorOpen(false); toast.success("Đã cập nhật chương trình.");
  };

  const confirmClone = async (version: string) => {
    if (!action || action.type !== "clone") return;
    const cloned = await programApi.cloneVersion(action.program.id, version);
    toast.success(`Đã tạo phiên bản ${cloned.version}.`);
    setAction(null); navigate(`/programs/${cloned.id}/detail`);
  };

  return <MainLayout pathName={{ programs: "Training Program", detail: "Training Program Detail" }} defaultSidebarHidden>
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><Button variant="ghost" size="icon" onClick={() => navigate("/programs")} aria-label="Quay lại danh sách"><ArrowLeft /></Button><div><h1 className="text-2xl font-semibold tracking-tight">Training Program Detail</h1><p className="text-sm text-muted-foreground">Thông tin chương trình và cấu trúc môn học.</p></div></div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""}/>Làm mới</Button>{canCreate && program && <Button variant="outline" onClick={() => setAction({ type: "clone", program })}><CopyPlus/>Clone</Button>}{canUpdate && program && <Button className={primaryButtonClass} onClick={() => setEditorOpen(true)}><Pencil/>Edit</Button>}</div>
      </div>
      {loading ? <div className="rounded-xl border p-10 text-center text-sm text-muted-foreground">Đang tải thông tin chương trình…</div> : error || !program ? <div role="alert" className="rounded-xl border border-destructive/40 p-6 text-sm text-destructive">{error || "Không tìm thấy chương trình."}<div className="mt-3"><Button variant="outline" onClick={() => void load()}>Thử lại</Button></div></div> : <>
        <section className="rounded-xl border bg-card p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">1. Training Program Info</h2><ProgramStatusBadge status={program.status}/></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[["Program Code",program.code],["Program Name",program.name],["Version",program.version],["Region",program.region || "—"]].map(([label,value]) => <div key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-medium">{value}</p></div>)}</div></section>
        <section className="rounded-xl border bg-card p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">2. Topic Info</h2><div className="text-sm text-muted-foreground">{program.subjects.length} môn · {chart.total} giờ</div></div><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>No.</TableHead><TableHead>Topic Code</TableHead><TableHead>Topic Name</TableHead><TableHead>Version</TableHead><TableHead className="text-right">Training Time</TableHead></TableRow></TableHeader><TableBody>{[...program.subjects].sort((a,b)=>a.orderIndex-b.orderIndex).map(s => <TableRow key={s.id}><TableCell>{s.orderIndex}</TableCell><TableCell className="font-medium">{s.code}</TableCell><TableCell>{s.name}</TableCell><TableCell>{s.version}</TableCell><TableCell className="text-right">{s.durationHours} giờ</TableCell></TableRow>)}</TableBody></Table>{!program.subjects.length && <p className="py-8 text-center text-sm text-muted-foreground">Chưa có môn học.</p>}</div></section>
        <section className="rounded-xl border bg-card p-5"><h2 className="mb-1 text-lg font-semibold">3. Topic Info Chart</h2><p className="mb-5 text-sm text-muted-foreground">Tỷ trọng thời lượng từng môn trong tổng thời lượng chương trình.</p><div className="grid items-center gap-6 md:grid-cols-[minmax(220px,320px)_1fr]"><div className="mx-auto flex size-64 items-center justify-center rounded-full" style={{background: chart.gradient}} role="img" aria-label="Biểu đồ tròn tỷ trọng thời lượng môn học"><div className="flex size-32 flex-col items-center justify-center rounded-full bg-card text-center shadow-inner"><span className="text-2xl font-semibold">{chart.total}</span><span className="text-xs text-muted-foreground">Tổng giờ</span></div></div><div className="space-y-3">{chart.segments.map(s => <div key={s.id} className="flex items-center gap-3 text-sm"><span className="size-3 shrink-0 rounded-sm" style={{backgroundColor:s.color}}/><span className="min-w-0 flex-1"><strong>{s.code}</strong> · {s.name}</span><span className="shrink-0 tabular-nums">{s.durationHours}h ({s.percent.toFixed(1)}%)</span></div>)}{!chart.segments.length && <p className="text-sm text-muted-foreground">Chưa có dữ liệu biểu đồ.</p>}</div></div></section>
      </>}
    </div>
    {editorOpen && program && <ProgramEditor program={program} subjects={subjects} loadingSubjects={false} subjectsError="" onRetrySubjects={() => void subjectApi.getActiveSubjects().then(setSubjects)} onClose={() => setEditorOpen(false)} onSave={save}/>}
    {action && <ProgramActionDialog action={action} programs={[action.program]} onClose={() => setAction(null)} onConfirm={confirmClone}/>}
  </MainLayout>;
}
