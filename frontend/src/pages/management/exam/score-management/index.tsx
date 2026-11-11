import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Plus, Save, ScanSearch, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  scoreManagementApi,
  SM_COLUMN_TYPES,
  type SmColumn,
  type SmColumnType,
  type SmGradebook,
  type SmImportReport,
  type SmPerson,
} from "@/api/features/score-management.api";
import { getErrorMessage } from "../examConfig";

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

function PeopleTable({ title, description, rows, showScore }: { title: string; description: string; rows: SmPerson[]; showScore?: boolean }) {
  const [open, setOpen] = useState(false);
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
          {open ? "Show less" : "Show more"}
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

function ColumnHeader({ col, onEdit }: { col: SmColumn; onEdit: () => void }) {
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
  const queryClient = useQueryClient();
  const key = ["sm-gradebook", courseId];
  const { data, isLoading, isError } = useQuery({ queryKey: key, queryFn: () => scoreManagementApi.gradebook(courseId) });
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SmColumn | null>(null);
  const [reports, setReports] = useState<SmImportReport[]>([]);

  const [confirmWarnings, setConfirmWarnings] = useState<string[] | null>(null);
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
      setConfirmWarnings(null);
      toast.success("Scores saved");
    },
    onError: fail,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading score table...</p>;
  if (isError || !data) return <p className="text-sm text-destructive">Failed to load the score table.</p>;

  const weightOk = Math.abs(data.totalWeight - 100) < 0.005;
  const requestSave = () => {
    const warnings: string[] = [];
    if (!weightOk) warnings.push(`The weights add up to ${fmt(data.totalWeight)}%, not 100%.`);
    const missing = SM_COLUMN_TYPES.filter((t) => !data.columns.some((c) => c.type === t.value)).map((t) => t.label);
    if (missing.length > 0) warnings.push(`Missing score column(s): ${missing.join(", ")}. A full score table has Assignment, Quiz, Midterm and Final.`);
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
          <Button size="sm" variant="outline" onClick={requestSave} disabled={saveMutation.isPending}>
            <Save className="size-4" /> Save scores
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
        <p className="text-xs text-destructive">The weights should add up to 100% for the final score to be meaningful.</p>
      )}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-40 px-2">Student</TableHead>
              {data.columns.map((c) => (
                <TableHead key={c.id} className="px-2 align-top">
                  <ColumnHeader col={c} onEdit={() => setEditId(c.id)} />
                </TableHead>
              ))}
              <TableHead className="w-16 px-2 text-right">Final</TableHead>
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
              data.students.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="px-2 py-1">
                    <div className="font-medium leading-tight">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.email}</div>
                  </TableCell>
                  {data.columns.map((c) => (
                    <TableCell key={c.id} className="px-2 py-1">
                      <div className="flex h-8 w-16 items-center justify-center rounded-md border bg-muted/30 text-sm tabular-nums">{fmt(s.scores[String(c.id)])}</div>
                    </TableCell>
                  ))}
                  <TableCell className="px-2 py-1 text-right font-semibold">{fmt(s.finalScore)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {reports.map((report) => (
        <div key={report.columnId} className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">
              Import result: {report.columnName} ← <span className="text-destructive">{report.examTitle}</span>
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setReports((rs) => rs.filter((r) => r.columnId !== report.columnId))}>Hide</Button>
          </div>
          <p className="text-sm text-muted-foreground">{report.imported} student(s) matched by ID and received a score.</p>
          <PeopleTable
            title="Extra students"
            description="Took the assessment but are not in this course's student list. Their scores were skipped."
            rows={report.extra}
            showScore
          />
          <PeopleTable
            title="Missing students"
            description="Enrolled in this course but have no score in the assessment."
            rows={report.missing}
          />
        </div>
      ))}

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

/* ------------------------------------------------------------------ page */

export default function ScoreManagementPage() {
  const [courseId, setCourseId] = useState<number | null>(null);
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
          <TabsContent value="class" className="pt-4" />
          <TabsContent value="course" className="pt-4">
            {courseId == null ? <CourseList onOpen={setCourseId} /> : <Gradebook courseId={courseId} onBack={() => setCourseId(null)} />}
          </TabsContent>
          <TabsContent value="department" className="pt-4" />
        </Tabs>
      </div>
    </MainLayout>
  );
}
