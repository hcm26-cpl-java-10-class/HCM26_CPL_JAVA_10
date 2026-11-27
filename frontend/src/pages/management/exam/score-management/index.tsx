import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronDown, ChevronRight, ChevronUp, CircleDashed, Download, Gift, History, Pencil, Plus, Save, ScanSearch, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  scoreManagementApi,
  SM_COLUMN_TYPES,
  type SmColumn,
  type SmColumnType,
  type SmGradebook,
  type SmStudentRow,
  type SmImportReport,
  type SmPerson,
  type SmSaveLog,
  type SmBonusLog,
} from "@/api/features/score-management.api";
import type { SmReleasePolicy } from "@/api/features/score-management.api";
import { getErrorMessage } from "../examConfig";

const csvCell = (v: string | number | null | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;

function exportCsv(g: SmGradebook) {
  const head = ["Student", "Email", ...g.columns.map((c) => `${c.name} (${fmt(c.weightPercent)}%)`), "Final"];
  const rows = g.students.map((s) => [
    s.name, s.email, ...g.columns.map((c) => s.scores[String(c.id)] ?? ""), s.finalScore ?? "",
  ]);
  const text = [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff" + text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${g.courseName.replace(/[^\w-]+/g, "_")}_scores.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const BONUS_CAP = 1;
const BONUS_REASONS = ["Participation", "Extra project", "Contest award", "Helped classmates", "Excellent work"];
let lastBonusReason = "";

type BonusPreset = { columnId: number; studentId: number } | null;

function BonusDialog({ data, open, preset, onClose, onChanged }: {
  data: SmGradebook;
  open: boolean;
  preset: BonusPreset;
  onClose: () => void;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const courseId = data.courseId;
  const { data: log = [] } = useQuery<SmBonusLog[]>({
    queryKey: ["sm-bonus", courseId],
    queryFn: () => scoreManagementApi.bonusLog(courseId),
    enabled: open,
  });
  const [columnId, setColumnId] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [points, setPoints] = useState("0.5");
  const [reason, setReason] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [logColumn, setLogColumn] = useState("");
  const [logStudent, setLogStudent] = useState("");
  const [logQ, setLogQ] = useState("");

  // Open pre-filled when launched from a score cell; otherwise start clean.
  useEffect(() => {
    if (!open) return;
    setColumnId(preset ? String(preset.columnId) : "");
    setSelected(preset ? [preset.studentId] : []);
    setReason(lastBonusReason);
    setQ("");
    setLogColumn("");
    setLogStudent("");
    setLogQ("");
  }, [open, preset?.columnId, preset?.studentId]);

  const pts = Number(points);
  const pointsOk = pts >= 0.05 && pts <= BONUS_CAP;
  // Bonus already granted to a student in this course (all columns): the cap is per student, not per column.
  const used = (s: SmStudentRow) => Object.values(s.bonuses ?? {}).reduce((a, b) => a + b, 0);
  const remaining = (s: SmStudentRow) => Math.max(0, +(BONUS_CAP - used(s)).toFixed(2));

  const needle = q.trim().toLowerCase();
  const rows = columnId
    ? data.students
        .filter((s) => s.scores[columnId] != null)
        .filter((s) => !needle || `${s.name} ${s.email}`.toLowerCase().includes(needle))
    : [];
  const canReceive = (s: SmStudentRow) => remaining(s) >= (pointsOk ? pts : 0.05);
  const eligible = rows.filter(canReceive);
  const chosen = data.students.filter((s) => selected.includes(s.id) && s.scores[columnId] != null && canReceive(s));
  const allEligibleSelected = eligible.length > 0 && eligible.every((s) => selected.includes(s.id));
  const toggle = (id: number) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const valid = columnId && chosen.length > 0 && pointsOk && reason.trim().length >= 5;

  const submit = async () => {
    setBusy(true);
    let ok = 0;
    const failed: string[] = [];
    let rowsLog: SmBonusLog[] | null = null;
    for (const s of chosen) {
      try {
        rowsLog = await scoreManagementApi.addBonus(courseId, { columnId: Number(columnId), studentId: s.id, points: pts, reason: reason.trim() });
        ok++;
      } catch (e) {
        failed.push(`${s.name}: ${getErrorMessage(e, "failed")}`);
      }
    }
    setBusy(false);
    if (rowsLog) queryClient.setQueryData(["sm-bonus", courseId], rowsLog);
    if (ok > 0) {
      lastBonusReason = reason.trim();
      onChanged();
      setSelected([]);
      toast.success(`Bonus +${fmt(pts)} added to ${ok} student(s)`);
    }
    if (failed.length > 0) toast.error(failed.slice(0, 3).join("\n"));
  };

  const revoke = useMutation({
    mutationFn: (id: number) => scoreManagementApi.revokeBonus(id),
    onSuccess: (rowsLog) => {
      queryClient.setQueryData(["sm-bonus", courseId], rowsLog);
      onChanged();
      toast.success("Bonus revoked");
    },
    onError: (e) => toast.error(getErrorMessage(e, "Unable to revoke bonus")),
  });
  const logNeedle = logQ.trim().toLowerCase();
  const logStudents = Array.from(new Map(log.map((b) => [b.studentId, b.studentName])).entries());
  const filteredLog = log.filter((b) =>
    (!logColumn || String(b.columnId) === logColumn) &&
    (!logStudent || String(b.studentId) === logStudent) &&
    (!logNeedle || `${b.studentName} ${b.reason}`.toLowerCase().includes(logNeedle)));
  const activeTotal = filteredLog.filter((b) => !b.revokedAt).reduce((sum, b) => sum + b.points, 0);
  const filtering = Boolean(logColumn || logStudent || logNeedle);
  const selectCls = "h-9 w-full rounded-md border bg-background px-2 text-sm";
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] w-[96vw] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Bonus points</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium">Column</label>
            <select className={selectCls} value={columnId} onChange={(e) => { setColumnId(e.target.value); setSelected([]); }}>
              <option value="">Select a column...</option>
              {data.columns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Points per student (0.05 - {BONUS_CAP})</label>
            <Input type="number" min={0.05} max={BONUS_CAP} step={0.05} value={points} onChange={(e) => setPoints(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-medium">Students ({chosen.length} selected)</label>
            <Input className="h-8 w-48" placeholder="Search name or email..." value={q} onChange={(e) => setQ(e.target.value)} disabled={!columnId} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-auto h-8"
              disabled={eligible.length === 0}
              onClick={() => setSelected(allEligibleSelected ? [] : eligible.map((s) => s.id))}
            >
              {allEligibleSelected ? "Clear selection" : `Select all with a score (${eligible.length})`}
            </Button>
          </div>
          <div className="max-h-[320px] overflow-auto rounded-md border">
            {!columnId ? (
              <p className="p-3 text-sm text-muted-foreground">Select a column to see the students who have a score in it.</p>
            ) : rows.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">No student has a score in this column.</p>
            ) : (
              <ul className="divide-y">
                {rows.map((s) => {
                  const rem = remaining(s);
                  const ok = canReceive(s);
                  return (
                    <li key={s.id}>
                      <label className={`flex items-center gap-3 px-3 py-2.5 text-sm ${ok ? "cursor-pointer hover:bg-muted/50" : "opacity-50"}`}>
                        <input type="checkbox" className="size-4" disabled={!ok} checked={selected.includes(s.id) && ok} onChange={() => toggle(s.id)} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium leading-tight">{s.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{s.email}</span>
                        </span>
                        <span className="text-right text-xs tabular-nums text-muted-foreground">
                          <span className="block">Score {fmt(s.scores[columnId])}</span>
                          <span className={ok ? "" : "font-medium text-destructive"}>
                            {ok ? `Bonus left +${fmt(rem)}` : rem <= 0 ? "Bonus limit reached" : `Only +${fmt(rem)} left`}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium">Reason (required)</label>
          <div className="flex flex-wrap gap-1.5">
            {BONUS_REASONS.map((r) => (
              <Button key={r} type="button" size="sm" variant={reason === r ? "default" : "outline"} className="h-7 px-2 text-xs" onClick={() => setReason(r)}>
                {r}
              </Button>
            ))}
          </div>
          <textarea className="min-h-20 w-full rounded-md border bg-background p-2 text-sm" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Pick a reason above or write your own (at least 5 characters)" />
        </div>
        <div className="flex items-center justify-end gap-3">
          {chosen.length > 0 && pointsOk && (
            <span className="text-xs text-muted-foreground">+{fmt(pts)} to {chosen.length} student(s) in this column</span>
          )}
          <Button size="sm" disabled={!valid || busy} onClick={() => void submit()}>
            {busy ? "Adding..." : `Add bonus${chosen.length > 1 ? ` (${chosen.length})` : ""}`}
          </Button>
        </div>
        </div>
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">
            Bonus history <Badge variant="outline">{filtering ? `${filteredLog.length} / ${log.length}` : log.length}</Badge>
          </h4>
          <div className="grid gap-2 sm:grid-cols-2">
            <select className={selectCls} value={logColumn} onChange={(e) => setLogColumn(e.target.value)}>
              <option value="">All columns</option>
              {data.columns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select className={selectCls} value={logStudent} onChange={(e) => setLogStudent(e.target.value)}>
              <option value="">All students</option>
              {logStudents.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Input className="h-8" placeholder="Search name or reason..." value={logQ} onChange={(e) => setLogQ(e.target.value)} />
            {filtering && (
              <Button variant="ghost" size="sm" className="h-8 shrink-0" onClick={() => { setLogColumn(""); setLogStudent(""); setLogQ(""); }}>
                Clear
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Total active bonus{filtering ? " (filtered)" : ""}: +{fmt(+activeTotal.toFixed(2))}</p>
        <div className="max-h-[560px] space-y-2 overflow-auto text-sm">
          {log.length === 0 ? <p className="text-muted-foreground">No bonus given yet.</p> : filteredLog.length === 0 ? <p className="text-muted-foreground">No bonus matches the filter.</p> : filteredLog.map((b) => (
            <div key={b.id} className={`flex items-start justify-between gap-2 rounded-md border p-2 ${b.revokedAt ? "opacity-60" : ""}`}>
              <div>
                <div className="font-medium">+{fmt(b.points)} · {b.studentName} · {b.columnName}{b.revokedAt ? " (revoked)" : ""}</div>
                <div className="text-xs text-muted-foreground">{b.reason}</div>
                <div className="text-xs text-muted-foreground">
                  {b.grantedByName ?? "—"} · {new Date(b.createdAt).toLocaleString()}
                  {b.revokedAt ? ` · revoked by ${b.revokedByName ?? "—"} ${new Date(b.revokedAt).toLocaleString()}` : ""}
                </div>
              </div>
              {!b.revokedAt && (
                <Button variant="ghost" size="sm" disabled={revoke.isPending} onClick={() => revoke.mutate(b.id)}>Revoke</Button>
              )}
            </div>
          ))}
        </div>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ courseId, open, onClose }: { courseId: number; open: boolean; onClose: () => void }) {
  const { data = [], isLoading } = useQuery<SmSaveLog[]>({
    queryKey: ["sm-history", courseId],
    queryFn: () => scoreManagementApi.history(courseId),
    enabled: open,
  });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save history</DialogTitle>
          <DialogDescription>Each time the score table was saved and published to students.</DialogDescription>
        </DialogHeader>
        <div className="max-h-80 space-y-2 overflow-auto text-sm">
          {isLoading ? <p className="text-muted-foreground">Loading...</p> : data.length === 0 ? <p className="text-muted-foreground">No saves yet.</p> : data.map((h) => (
            <div key={h.id} className="rounded-md border p-2">
              <div className="font-medium">{new Date(h.savedAt).toLocaleString()}{h.savedByName ? ` · ${h.savedByName}` : ""}</div>
              <div className="text-xs text-muted-foreground">{h.columnCount} column(s) · {h.studentCount} student(s) · total weight {fmt(h.totalWeight)}%</div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const fmt = (n: number | null | undefined) => (n == null ? "—" : Number.isInteger(n) ? String(n) : n.toFixed(2));

/* ------------------------------------------------------------------ course list */

function CourseList({ onOpen }: { onOpen: (id: number) => void }) {
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ["sm-courses"],
    queryFn: scoreManagementApi.courses,
  });
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading courses...</p>;
  if (isError) return <p className="text-sm text-destructive">Failed to load courses.</p>;
  if (data.length === 0) return <p className="text-sm text-muted-foreground">No courses found for your account.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((c) => (
        <Card key={c.id} className="cursor-pointer transition hover:border-primary" onClick={() => onOpen(c.id)}>
          <CardContent className="space-y-2 p-4">
            <p className="font-semibold">{c.name}</p>
            <p className="text-sm text-muted-foreground">
              {c.studentCount} student{c.studentCount === 1 ? "" : "s"} · {c.columnCount} score column{c.columnCount === 1 ? "" : "s"}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ people tables */

function PeopleTable({ title, description, rows, showScore, defaultOpen }: { title: string; description: string; rows: SmPerson[]; showScore?: boolean; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">
            {title} <Badge variant="outline">{rows.length}</Badge>
          </h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setOpen((o) => !o)} disabled={rows.length === 0}>
          {open ? "Less" : "More"}
        </Button>
      </div>
      {open && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                {showScore && <TableHead className="text-right">Score</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={showScore ? 4 : 3} className="text-center text-sm text-muted-foreground">None</TableCell>
                </TableRow>
              ) : (
                rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.code ?? p.id}</TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.email}</TableCell>
                    {showScore && <TableCell className="text-right">{fmt(p.score)}</TableCell>}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ gradebook */

function ScanRowDetail({ column, scored, onClose }: { column: SmColumn; scored: number; onClose: () => void }) {
  const { data: report, isLoading, isError } = useQuery<SmImportReport>({
    queryKey: ["sm-report", column.id, scored],
    queryFn: () => scoreManagementApi.report(column.id),
    staleTime: 0,
  });
  return (
    <div className="mt-3 space-y-4 border-t pt-3">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading students...</p>
      ) : isError || !report ? (
        <p className="text-sm text-destructive">Failed to load the student list for this assessment.</p>
      ) : !report.published ? (
        <p className="text-sm text-amber-700">
          Scores of this assessment are not published yet, so no student was imported. Publish the results, then scan again.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{report.imported} student(s) matched by ID and received a score.</p>
          <PeopleTable
            title="Missing students"
            description="Enrolled in this course but have no score in the assessment."
            rows={report.missing}
            defaultOpen
          />
          <PeopleTable
            title="Extra students"
            description="Took the assessment but are not in this course's student list. Their scores were skipped."
            rows={report.extra}
            showScore
            defaultOpen
          />
        </>
      )}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onClose}>
          <ChevronUp className="size-4" /> Less
        </Button>
      </div>
    </div>
  );
}

function ScanSummary({ data }: { data: SmGradebook }) {
  const [openIds, setOpenIds] = useState<number[]>([]);
  const linked = data.columns.filter((c) => c.examId != null);
  if (linked.length === 0) return null;
  const total = data.students.length;
  const rows = linked.map((c) => {
    const scored = data.students.filter((s) => s.scores[String(c.id)] != null).length;
    const status: "unpublished" | "full" | "partial" | "empty" =
      !c.published ? "unpublished" : scored === 0 ? "empty" : scored < total ? "partial" : "full";
    return { c, scored, status };
  });
  const count = (st: string) => rows.filter((r) => r.status === st).length;
  const unpublished = count("unpublished");
  const empty = count("empty");
  const toggle = (id: number) => setOpenIds((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  return (
    <div className="space-y-2 rounded-md border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-semibold">Scan summary</span>
        <span className="text-muted-foreground">
          {linked.length} assessment column(s) · {rows.filter((r) => r.scored > 0).length} with scores
        </span>
        {unpublished > 0 && <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-700">{unpublished} not published</Badge>}
        {empty > 0 && <Badge variant="outline" className="text-muted-foreground">{empty} no scores yet</Badge>}
      </div>
      <p className="text-xs text-muted-foreground">
        Click a row to see which students are missing a score and which students took the assessment but are not in this course.
      </p>
      <ul className="divide-y rounded-md border">
        {rows.map(({ c, scored, status }) => {
          const open = openIds.includes(c.id);
          return (
            <li key={c.id} className="px-3 py-2">
              <button type="button" className="flex w-full flex-wrap items-center gap-2 text-left" onClick={() => toggle(c.id)} aria-expanded={open}>
                {open ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
                {status === "unpublished" ? <AlertTriangle className="size-4 shrink-0 text-amber-600" />
                  : status === "empty" ? <CircleDashed className="size-4 shrink-0 text-muted-foreground" />
                  : <CheckCircle2 className={`size-4 shrink-0 ${status === "full" ? "text-emerald-600" : "text-sky-600"}`} />}
                <span className="font-medium">{c.name}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={c.examTitle ?? undefined}>← {c.examTitle}</span>
                <span className={`text-xs ${status === "unpublished" ? "font-medium text-amber-700" : "text-muted-foreground"}`}>
                  {status === "unpublished" ? "Not published - nothing imported"
                    : status === "empty" ? (c.gradingState === "PENDING_GRADING" ? "Pending grading - no scores yet" : c.gradingState === "NO_ATTEMPTS" ? "No attempts yet - no scores" : "No scores yet")
                    : `${scored}/${total} students have a score`}
                </span>
              </button>
              {open && <ScanRowDetail column={c} scored={scored} onClose={() => toggle(c.id)} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ColumnHeader({ col, onEdit, noScores }: { col: SmColumn; onEdit: () => void; noScores?: boolean }) {
  return (
    <div className="flex w-24 flex-col gap-0.5">
      <div className="flex items-center justify-between gap-1">
        <span className="truncate font-semibold" title={col.name}>{col.name}</span>
        <Button variant="ghost" size="icon-sm" className="size-6 shrink-0" title="Edit column" onClick={onEdit}>
          <Pencil className="size-3.5" />
        </Button>
      </div>
      <span className="text-xs font-normal text-muted-foreground">{fmt(col.weightPercent)}%</span>
      <span className="truncate text-xs font-normal text-muted-foreground" title={col.examTitle ?? undefined}>
        {col.examTitle ?? "No assessment"}
      </span>
      {col.examId != null && !col.published && (
        <Badge variant="outline" className="w-fit border-amber-400 bg-amber-50 px-1.5 py-0 text-[10px] font-medium text-amber-700">
          Not published
        </Badge>
      )}
      {col.examId != null && col.published && noScores && col.gradingState !== "GRADED" && (
        <Badge variant="outline" className="w-fit border-sky-300 bg-sky-50 px-1.5 py-0 text-[10px] font-medium text-sky-700">
          {col.gradingState === "PENDING_GRADING" ? "Pending grading" : col.gradingState === "NO_ATTEMPTS" ? "No attempts" : "No scores yet"}
        </Badge>
      )}
    </div>
  );
}

function ColumnEditDialog({ courseId, column, onClose, onSaveWeight, onDelete, onImported }: {
  courseId: number;
  column: SmColumn | null;
  onClose: () => void;
  onSaveWeight: (weight: number) => void;
  onDelete: () => void;
  onImported: (report: SmImportReport) => void;
}) {
  const [weight, setWeight] = useState("");
  useEffect(() => setWeight(column ? String(column.weightPercent) : ""), [column?.id, column?.weightPercent]);
  const saveWeight = () => {
    const w = Number(weight);
    if (weight.trim() === "" || Number.isNaN(w) || w < 0 || w > 100) {
      toast.error("Weight must be between 0 and 100");
      return;
    }
    onSaveWeight(w);
  };
  const { data = [], isLoading } = useQuery({
    queryKey: ["sm-available-exams", courseId, column?.type ?? null],
    queryFn: () => scoreManagementApi.availableExams(courseId, column?.type),
    enabled: column != null,
  });
  const [search, setSearch] = useState("");
  useEffect(() => setSearch(""), [column?.id]);
  const shown = data.filter((e) => e.title.toLowerCase().includes(search.trim().toLowerCase()));
  const importMutation = useMutation({
    mutationFn: (examId: number) => scoreManagementApi.importExam(column!.id, examId),
    onSuccess: (report) => {
      toast.success(`Imported ${report.imported} score(s) into "${report.columnName}"`);
      onImported(report);
    },
    onError: (e) => toast.error(getErrorMessage(e, "Failed to import scores")),
  });
  return (
    <Dialog open={column != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit "{column?.name}"</DialogTitle>
          <DialogDescription>
            {column?.type ? `Only ${SM_COLUMN_TYPES.find((x) => x.value === column.type)?.label} assessments are shown. ` : ""}Choose the assessment to take scores from. Students are matched by user ID; the highest attempt score (scaled to 10) is used.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-end gap-3 rounded-md border p-3">
          <label className="space-y-1 text-sm font-medium">
            Weight (%)
            <Input type="number" min={0} max={100} className="w-28" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </label>
          <Button size="sm" onClick={saveWeight}>Save weight</Button>
          <Button variant="outline" size="sm" className="ml-auto text-destructive" onClick={onDelete}>
            <Trash2 className="size-4" /> Delete column
          </Button>
        </div>
        <Input placeholder="Search assessments by name..." value={search} onChange={(e) => setSearch(e.target.value)} />
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading assessments...</p>
        ) : shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">{data.length === 0 ? "No assessments available." : "No assessments match your search."}</p>
        ) : (
          <div className="space-y-2">
            {shown.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{e.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.inCourse ? "In this course" : e.courseName ? `Course: ${e.courseName}` : "Not linked to a course"} · {e.attemptCount} attempt{e.attemptCount === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {e.inCourse && <Badge variant="secondary">In course</Badge>}
                  <Button size="sm" disabled={importMutation.isPending} onClick={() => importMutation.mutate(e.id)}>
                    Add
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Gradebook({ courseId, onBack }: { courseId: number; onBack: () => void }) {
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);

  const [releasePolicy, setReleasePolicy] =
      useState<SmReleasePolicy>("MY_SCORES_ONLY");
  const queryClient = useQueryClient();
  const key = ["sm-gradebook", courseId];
  const { data, isLoading, isError } = useQuery({ queryKey: key, queryFn: () => scoreManagementApi.gradebook(courseId) });
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SmColumn | null>(null);
  const [, setReports] = useState<SmImportReport[]>([]);

  const [confirmWarnings, setConfirmWarnings] = useState<string[] | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [bonusOpen, setBonusOpen] = useState(false);
  const [bonusPreset, setBonusPreset] = useState<BonusPreset>(null);
  const [search, setSearch] = useState("");
  const apply = (g: SmGradebook) => {
    queryClient.setQueryData(key, g);
    void queryClient.invalidateQueries({ queryKey: ["sm-courses"] });
  };
  const fail = (e: unknown) => toast.error(getErrorMessage(e, "Action failed"));

  const addColumn = useMutation({
    // the server names the column after its type (Quiz 1, Quiz 2... when there are several)
    mutationFn: (type: SmColumnType) => scoreManagementApi.addColumn(courseId, 0, type),
    onSuccess: apply,
    onError: fail,
  });
  const updateColumn = useMutation({
    mutationFn: (v: { id: number; weight: number; type?: SmColumnType }) =>
      scoreManagementApi.updateColumn(v.id, v.weight, v.type),
    onSuccess: apply,
    onError: fail,
  });
  const deleteColumn = useMutation({
    mutationFn: (id: number) => scoreManagementApi.deleteColumn(id),
    onSuccess: (g, id) => {
      apply(g);
      setReports((rs) => rs.filter((r) => r.columnId !== id));
    },
    onError: fail,
  });
  const scanMutation = useMutation({
    mutationFn: () => scoreManagementApi.autoScan(courseId),
    onSuccess: (res) => {
      apply(res.gradebook);
      setReports(res.reports);
      toast.success(
        res.created === 0 && res.refreshed === 0
          ? "No assessments are linked to this course yet."
          : `Created ${res.created} column(s) and refreshed ${res.refreshed} existing column(s).`
      );
    },
    onError: fail,
  });
  const saveMutation = useMutation({
    mutationFn: () => scoreManagementApi.save(courseId),
    onSuccess: (g) => {
      queryClient.setQueryData(key, g);
      void queryClient.invalidateQueries({ queryKey: ["sm-history", courseId] });
      setConfirmWarnings(null);
      toast.success("Scores saved");
    },
    onError: fail,
  });

  const publishCourseMutation = useMutation({
    mutationFn: async (policy: SmReleasePolicy) => {
      const exams = (
          await scoreManagementApi.availableExams(courseId)
      ).filter((exam) => exam.inCourse);

      if (exams.length === 0) {
        return {
          total: 0,
          published: 0,
          skipped: 0,
          failed: [] as { title: string; message: string }[],
        };
      }

      let published = 0;
      let skipped = 0;

      const failed: { title: string; message: string }[] = [];

      for (const exam of exams) {
        try {
          const status = await scoreManagementApi.publicationStatus(exam.id);

          if (status.published) {
            skipped++;
            continue;
          }

          await scoreManagementApi.publishExam(exam.id, policy);
          published++;
        } catch (error) {
          failed.push({
            title: exam.title,
            message: getErrorMessage(error, "Unable to publish this exam"),
          });
        }
      }

      return {
        total: exams.length,
        published,
        skipped,
        failed,
      };
    },

    onSuccess: (result) => {
      setPublishDialogOpen(false);

      if (result.total === 0) {
        toast.info("No exams are linked to this course.");
        return;
      }

      toast.success(
          `Published: ${result.published} · Already published: ${result.skipped} · Failed: ${result.failed.length}`
      );

      if (result.failed.length > 0) {
        console.error("Course publication errors:", result.failed);

        toast.error(
            `${result.failed.length} exam(s) could not be published. Check the console for details.`
        );
      }

      void queryClient.invalidateQueries({ queryKey: key });
    },

    onError: fail,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading score table...</p>;
  if (isError || !data) return <p className="text-sm text-destructive">Failed to load the score table.</p>;

  const weightOk = Math.abs(data.totalWeight - 100) < 0.005;
  const overWeight = data.totalWeight > 100.005;
  const q = search.trim().toLowerCase();
  const visibleStudents = q ? data.students.filter((s) => `${s.name} ${s.email}`.toLowerCase().includes(q)) : data.students;
  const requestSave = () => {
    if (overWeight) {
      toast.error(`Total weight is ${fmt(data.totalWeight)}%. Reduce it to 100% or less before saving.`);
      return;
    }
    const warnings: string[] = [];
    if (!weightOk) warnings.push(`The weights add up to ${fmt(data.totalWeight)}%, not 100%.`);
    const missing = SM_COLUMN_TYPES.filter((t) => !data.columns.some((c) => c.type === t.value)).map((t) => t.label);
    if (missing.length > 0) warnings.push(`Missing score column(s): ${missing.join(", ")}. A full score table has Assignment, Quiz, Midterm and Final.`);
    for (const c of data.columns) {
      if (c.weightPercent <= 0) continue;
      const without = data.students.filter((st) => st.scores[String(c.id)] == null).length;
      if (without > 0) {
        warnings.push(`${c.name}: ${without} of ${data.students.length} student(s) have no score yet. They will see an empty cell and no overall result.`);
      }
    }
    if (warnings.length > 0) setConfirmWarnings(warnings);
    else saveMutation.mutate();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="size-4" /> Courses
          </Button>
          <div>
            <h2 className="text-lg font-semibold">{data.courseName}</h2>
            <p className="text-xs text-muted-foreground">
              {data.students.length} student{data.students.length === 1 ? "" : "s"} · scores are on a 10-point scale and come from assessments
            </p>
            <p className={`text-xs ${data.unsaved ? "font-medium text-amber-600" : "text-muted-foreground"}`}>
              {data.unsaved ? "Unsaved changes" : data.savedAt ? `Saved ${new Date(data.savedAt).toLocaleString()}` : "Not saved yet"}
            </p>
          </div>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <Input className="h-8 w-48" placeholder="Search student..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button size="sm" variant="outline" onClick={() => exportCsv(data)} title="Download the score table as CSV">
            <Download className="size-4" /> Export CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setBonusPreset(null); setBonusOpen(true); }} disabled={data.columns.length === 0}>
            <Gift className="size-4" /> Bonus
          </Button>
          <Button size="sm" variant="outline" onClick={() => setHistoryOpen(true)}>
            <History className="size-4" /> History
          </Button>
          <Button size="sm" variant="outline" onClick={requestSave} disabled={saveMutation.isPending || overWeight}>
            <Save className="size-4" /> Save scores
          </Button>
          <Button
              size="sm"
              onClick={() => setPublishDialogOpen(true)}
              disabled={publishCourseMutation.isPending}
          >
            {publishCourseMutation.isPending
                ? "Publishing..."
                : "Publish Results"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending}
            title="Create score columns for every assessment in this course and add the existing scores"
          >
            <ScanSearch className="size-4" /> Scan assessments
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" disabled={addColumn.isPending}>
                <Plus className="size-4" /> Add column
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {SM_COLUMN_TYPES.map((tp) => (
                <DropdownMenuItem key={tp.value} onClick={() => addColumn.mutate(tp.value)}>
                  {tp.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {!weightOk && data.columns.length > 0 && (
        <p className="text-xs text-destructive">{overWeight ? `Total weight is ${fmt(data.totalWeight)}% - it cannot exceed 100% to save.` : "The weights should add up to 100% for the final score to be meaningful."}</p>
      )}

      <div className="max-h-[65vh] overflow-auto rounded-md border">
        <table className="w-full caption-bottom text-sm">
          <TableHeader className="sticky top-0 z-20 bg-background [&_th]:bg-background">
            <TableRow>
              <TableHead className="sticky left-0 z-30 min-w-40 bg-background px-2">Student</TableHead>
              {data.columns.map((c) => (
                <TableHead key={c.id} className="px-2 align-top">
                  <ColumnHeader col={c} onEdit={() => setEditId(c.id)} noScores={!data.students.some((st) => st.scores[String(c.id)] != null)} />
                </TableHead>
              ))}
              <TableHead className="sticky right-0 z-30 w-16 bg-background px-2 text-right">Final</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.students.length === 0 ? (
              <TableRow>
                <TableCell colSpan={data.columns.length + 2} className="text-center text-sm text-muted-foreground">
                  No students are enrolled in this course.
                </TableCell>
              </TableRow>
            ) : (
              visibleStudents.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="sticky left-0 z-10 bg-background px-2 py-1">
                    <div className="font-medium leading-tight">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.email}</div>
                  </TableCell>
                  {data.columns.map((c) => (
                    <TableCell key={c.id} className="px-2 py-1">
                      <div
                        className={`relative flex h-8 w-16 items-center justify-center rounded-md border bg-muted/30 text-sm tabular-nums ${s.scores[String(c.id)] != null ? "cursor-pointer hover:border-primary" : ""}`}
                        title={s.scores[String(c.id)] == null ? undefined
                          : s.bonuses?.[String(c.id)] ? `Includes +${fmt(s.bonuses[String(c.id)])} bonus. Click to give more bonus.` : "Click to give bonus points"}
                        onClick={s.scores[String(c.id)] != null ? () => { setBonusPreset({ columnId: c.id, studentId: s.id }); setBonusOpen(true); } : undefined}
                      >
                        {fmt(s.scores[String(c.id)])}
                        {s.bonuses?.[String(c.id)] ? (
                          <span className="absolute -right-1 -top-2 rounded bg-amber-500 px-1 text-[10px] font-medium leading-4 text-white">
                            +{fmt(s.bonuses[String(c.id)])}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                  ))}
                  <TableCell className="sticky right-0 z-10 bg-background px-2 py-1 text-right font-semibold">{fmt(s.finalScore)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </table>
      </div>

      <ScanSummary data={data} />

      <Dialog open={deleteTarget != null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete column?</DialogTitle>
            <DialogDescription>
              Delete column "{deleteTarget?.name}" and all its scores? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteColumn.isPending}
              onClick={() => {
                if (deleteTarget) deleteColumn.mutate(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmWarnings != null} onOpenChange={(o) => !o && setConfirmWarnings(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save an incomplete score table?</DialogTitle>
            <DialogDescription>Please review the following before saving.</DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {(confirmWarnings ?? []).map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmWarnings(null)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>Save anyway</Button>
          </div>
        </DialogContent>
      </Dialog>

      <HistoryDialog courseId={courseId} open={historyOpen} onClose={() => setHistoryOpen(false)} />
      <BonusDialog
        data={data}
        open={bonusOpen}
        preset={bonusPreset}
        onClose={() => setBonusOpen(false)}
        onChanged={() => void queryClient.invalidateQueries({ queryKey: key })}
      />
      <Dialog
          open={publishDialogOpen}
          onOpenChange={(open) => {
            if (!publishCourseMutation.isPending) {
              setPublishDialogOpen(open);
            }
          }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish Course Results</DialogTitle>
            <DialogDescription>
              Publish the results of all exams linked to this course.
              Exams that have already been published will be skipped.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label
                htmlFor="course-release-policy"
                className="text-sm font-medium"
            >
              Result visibility
            </label>

            <select
                id="course-release-policy"
                value={releasePolicy}
                onChange={(event) =>
                    setReleasePolicy(event.target.value as SmReleasePolicy)
                }
                disabled={publishCourseMutation.isPending}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="MY_SCORES_ONLY">
                Show scores
              </option>
              <option value="MY_SCORES_AND_EMAIL">
                Show scores and send email
              </option>
              <option value="HIDDEN">
                Hide scores
              </option>
            </select>
          </div>

          <DialogFooter>
            <Button
                type="button"
                variant="outline"
                onClick={() => setPublishDialogOpen(false)}
                disabled={publishCourseMutation.isPending}
            >
              Cancel
            </Button>

            <Button
                type="button"
                onClick={() => publishCourseMutation.mutate(releasePolicy)}
                disabled={publishCourseMutation.isPending}
            >
              {publishCourseMutation.isPending
                  ? "Publishing..."
                  : "Confirm Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ColumnEditDialog
        courseId={courseId}
        column={data.columns.find((c) => c.id === editId) ?? null}
        onClose={() => setEditId(null)}
        onSaveWeight={(weight) => editId != null && updateColumn.mutate({ id: editId, weight })}
        onDelete={() => {
          setDeleteTarget(data.columns.find((c) => c.id === editId) ?? null);
          setEditId(null);
        }}
        onImported={(r) => {
          setEditId(null);
          setReports([r]);
          void queryClient.invalidateQueries({ queryKey: key });
          void queryClient.invalidateQueries({ queryKey: ["sm-courses"] });
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ class tab */

function ClassList({ onOpen }: { onOpen: (id: number) => void }) {
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ["sm-classes"],
    queryFn: scoreManagementApi.classes,
  });
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading classes...</p>;
  if (isError) return <p className="text-sm text-destructive">Failed to load classes.</p>;
  if (data.length === 0) return <p className="text-sm text-muted-foreground">No classes found for your account.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((c) => (
        <Card key={c.id} className="cursor-pointer transition hover:border-primary" onClick={() => onOpen(c.id)}>
          <CardContent className="space-y-2 p-4">
            <p className="font-semibold">{c.name}</p>
            <p className="text-sm text-muted-foreground">
              {c.studentCount} student{c.studentCount === 1 ? "" : "s"} · {c.assessmentCount} assessment{c.assessmentCount === 1 ? "" : "s"}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ClassGradebook({ classId, onBack }: { classId: number; onBack: () => void }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["sm-class-gradebook", classId],
    queryFn: () => scoreManagementApi.classGradebook(classId),
  });
  const [search, setSearch] = useState("");
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading class scores...</p>;
  if (isError || !data) return <p className="text-sm text-destructive">Failed to load the class scores.</p>;

  const q = search.trim().toLowerCase();
  const students = data.students.filter(
    (s) => !q || s.name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q) || (s.code ?? "").toLowerCase().includes(q)
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="size-4" /> Classes
          </Button>
          <div>
            <h2 className="text-lg font-semibold">{data.className}</h2>
            <p className="text-xs text-muted-foreground">
              {data.students.length} student{data.students.length === 1 ? "" : "s"} · scores come from the assessments the students have taken (10-point scale)
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Class average</p>
            <p className="text-lg font-semibold tabular-nums">{fmt(data.classAverage)}</p>
          </div>
          <Input className="w-56" placeholder="Search student..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-40 px-2">Student</TableHead>
              {data.columns.map((c) => (
                <TableHead key={c.type} className="px-2 align-top">
                  <div className="flex w-24 flex-col gap-0.5" title={c.examTitles.join("\n")}>
                    <span className="truncate font-semibold">{c.label}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {c.examCount} assessment{c.examCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </TableHead>
              ))}
              <TableHead className="w-20 px-2 text-right">Average</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.length === 0 ? (
              <TableRow>
                <TableCell colSpan={data.columns.length + 2} className="text-center text-sm text-muted-foreground">
                  {data.students.length === 0 ? "No active students in this class." : "No students match your search."}
                </TableCell>
              </TableRow>
            ) : (
              students.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="px-2 py-1">
                    <div className="font-medium leading-tight">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.email}</div>
                  </TableCell>
                  {data.columns.map((c) => (
                    <TableCell key={c.type} className="px-2 py-1">
                      <div className="flex h-8 w-16 items-center justify-center rounded-md border bg-muted/30 text-sm tabular-nums">
                        {fmt(s.scores[c.type])}
                      </div>
                    </TableCell>
                  ))}
                  <TableCell className="px-2 py-1 text-right font-semibold tabular-nums">{fmt(s.averageScore)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {data.columns.length > 0 && data.students.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell className="px-2 py-2 font-medium">Class average</TableCell>
                {data.columns.map((c) => (
                  <TableCell key={c.type} className="px-2 py-2 font-medium tabular-nums">
                    {fmt(data.columnAverages[c.type])}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">({c.scoredCount}/{data.students.length})</span>
                  </TableCell>
                ))}
                <TableCell className="px-2 py-2 text-right font-semibold tabular-nums">{fmt(data.classAverage)}</TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        Each cell is the mean of the student's best score on every assessment of that type; Average is the mean of the types they have a score in. Hover a column header to see its assessments. Read-only: edit course scores in the Course tab.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ page */

export default function ScoreManagementPage() {
  const [courseId, setCourseId] = useState<number | null>(null);
  const [classId, setClassId] = useState<number | null>(null);
  return (
    <MainLayout pathName={{ exams: "Assessment Management", "score-management": "Score Management" }}>
      <div className="space-y-5 p-4">
        <header className="border-b pb-4">
          <h1 className="text-2xl font-semibold">Score Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">Build score tables, set weights and add scores from assessments.</p>
        </header>
        <Tabs defaultValue="course">
          <TabsList className="w-full">
            <TabsTrigger value="class" className="flex-1">Class</TabsTrigger>
            <TabsTrigger value="course" className="flex-1">Course</TabsTrigger>
            <TabsTrigger value="department" className="flex-1">Department</TabsTrigger>
          </TabsList>
          <TabsContent value="class" className="pt-4">
            {classId == null ? <ClassList onOpen={setClassId} /> : <ClassGradebook classId={classId} onBack={() => setClassId(null)} />}
          </TabsContent>
          <TabsContent value="course" className="pt-4">
            {courseId == null ? <CourseList onOpen={setCourseId} /> : <Gradebook courseId={courseId} onBack={() => setCourseId(null)} />}
          </TabsContent>
          <TabsContent value="department" className="pt-4" />
        </Tabs>
      </div>
    </MainLayout>
  );
}
