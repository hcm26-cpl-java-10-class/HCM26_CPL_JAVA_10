import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { AlertCircle, CalendarOff, ChevronLeft, ChevronRight, Eye, LoaderCircle, Pencil, Plus, RefreshCw, Search, Trash2, Users, X } from "lucide-react";
import { AssignmentLifecycleDialog, type LifecycleMode } from "./components/AssignmentLifecycleDialog";
import { EditAssignmentDialog } from "./components/EditAssignmentDialog";
import { CreateAssignmentDialog } from "./components/CreateAssignmentDialog";
import { AssignmentDetailDialog } from "./components/AssignmentDetailDialog";
import { AssignmentDataIO } from "./components/AssignmentDataIO";
import { classSetupApi, type AssignmentRole, type AssignmentSearchParams, type TeachingAssignment } from "@/api/features/class-setup.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppliedTextInput, AppliedNumberInput } from "./components/ReferenceInput";
import { roleOptions, trainerTextOptions, type TextOption } from "./assignment-text";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePermissions } from "@/hooks/usePermissions";

function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    if ([502, 503, 504].includes(error.response?.status ?? 0)) return "The shared data service is unavailable. Please try again.";
    if (error.response?.status === 403) return "You do not have permission to view this data.";
    if (!error.response) return "Unable to connect to the server. Please check your connection.";
    if (typeof error.response.data?.message === "string") return error.response.data.message;
  }
  return "Unable to load data. Please try again.";
}

function positiveId(value: string | null) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : undefined;
}

function displayDate(value: string) {
  return value.split("-").reverse().join("/");
}

function FilterInput({ id, label, value, onChange, options, disabled = false }: {
  id: string; label: string; value: string; onChange: (value: string) => void;
  options: TextOption[]; disabled?: boolean;
}) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>
    <AppliedTextInput id={id} value={value} options={options} onCommit={onChange} disabled={disabled} placeholder={`All ${label === "Class" ? "classes" : `${label.toLowerCase()}s`}`} />
  </div>;
}

const sortOptions: TextOption[] = [
  { value: "effectiveFrom,desc", label: "Start date: newest first", aliases: ["Newest", "Start descending"] },
  { value: "effectiveFrom,asc", label: "Start date: oldest first", aliases: ["Oldest", "Start ascending"] },
  { value: "effectiveTo,asc", label: "End date: ascending", aliases: ["End ascending"] },
  { value: "effectiveTo,desc", label: "End date: descending", aliases: ["End descending"] },
];

export default function TeachingAssignmentPage() {
  const { hasPermission } = usePermissions();
  const canRead = hasPermission("ASSIGNMENT_READ");
  const canCreate = hasPermission("ASSIGNMENT_CREATE");
  const canUpdate = hasPermission("ASSIGNMENT_UPDATE");
  const canDelete = hasPermission("ASSIGNMENT_DELETE");
  const [lifecycle, setLifecycle] = useState<{ mode: LifecycleMode; assignment: TeachingAssignment } | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [resetVersion, setResetVersion] = useState(0);
  const [url, setUrl] = useSearchParams();
  const detailId = positiveId(url.get("assignmentId"));
  const pageValue = Number(url.get("page") ?? 0);
  const page = Number.isInteger(pageValue) && pageValue >= 0 && pageValue <= 100000 ? pageValue : 0;
  const sizeValue = Number(url.get("size") ?? 20);
  const size = Number.isInteger(sizeValue) && sizeValue >= 1 && sizeValue <= 100 ? sizeValue : 20;
  const role = ["MAIN", "ASSISTANT"].includes(url.get("role") ?? "") ? url.get("role") as AssignmentRole : undefined;
  const sort = ["effectiveFrom,asc", "effectiveFrom,desc", "effectiveTo,asc", "effectiveTo,desc"].includes(url.get("sort") ?? "")
    ? url.get("sort")! : "effectiveFrom,desc";
  const date = url.get("effectiveOn") ?? "";
  const effectiveOn = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
  const search = (url.get("search") ?? "").trim().slice(0, 100);
  const params: AssignmentSearchParams = {
    classId: positiveId(url.get("classId")), subjectId: positiveId(url.get("subjectId")),
    trainerId: positiveId(url.get("trainerId")), role, effectiveOn, search: search || undefined, page, size, sort,
  };
  const options = useQuery({
    queryKey: ["teaching-assignment-options"],
    queryFn: ({ signal }) => classSetupApi.getAssignmentOptions(signal),
    enabled: canRead, staleTime: 60_000, retry: 1,
  });
  const assignments = useQuery({
    queryKey: ["teaching-assignments", params],
    queryFn: ({ signal }) => classSetupApi.searchAssignments(params, signal),
    enabled: canRead, retry: 1,
  });

  function change(key: string, value: string) {
    setUrl((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value); else next.delete(key);
      if (key !== "page") next.delete("page");
      return next;
    });
  }
  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    change("search", String(new FormData(event.currentTarget).get("search") ?? "").trim());
  }
  function showDetails(id?: number) {
    setUrl((current) => {
      const next = new URLSearchParams(current);
      if (id) next.set("assignmentId", String(id)); else next.delete("assignmentId");
      return next;
    });
  }
  const classOptions: TextOption[] = (options.data?.classes ?? []).map((item) => ({ value: String(item.id), label: `${item.code} - ${item.name}`, aliases: [item.code, item.name] }));
  const subjectOptions: TextOption[] = (options.data?.subjects ?? []).map((item) => ({ value: String(item.id), label: `${item.code} - ${item.name} - v${item.version}`, aliases: [item.code, item.name, `${item.code} v${item.version}`] }));
  const trainerOptions = trainerTextOptions(options.data?.trainers ?? []);
  for (const [value, choices, label] of [[params.classId, classOptions, "Class"], [params.subjectId, subjectOptions, "Subject"], [params.trainerId, trainerOptions, "Trainer"]] as const) {
    if (value && !choices.some((item) => item.value === String(value))) choices.push({ value: String(value), label: `${label} #${value}` });
  }

  const data = assignments.data;
  const total = data?.totalElements ?? 0;
  const pages = data?.totalPages ?? 0;
  const filtered = Boolean(search || params.classId || params.subjectId || params.trainerId || role || effectiveOn);

  return <MainLayout pathName={{ "teaching-assignments": "Teaching Assignments" }}>
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><Users className="size-6 text-primary" />Teaching Assignments</h1>
          <p className="mt-1 text-sm text-muted-foreground">Find teaching assignments by class, subject, trainer and effective date.</p></div>
        <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={assignments.isFetching || options.isFetching || !canRead} onClick={() => { void assignments.refetch(); void options.refetch(); }}>
          <RefreshCw className={assignments.isFetching || options.isFetching ? "size-4 animate-spin" : "size-4"} />Refresh
        </Button>
        {canRead && <AssignmentDataIO filters={params} canImport={canCreate} />}
        {canRead && canCreate && <Button onClick={() => setCreating(true)}><Plus className="size-4" />New assignment</Button>}
        </div>
      </div>
      {!canRead ? <Alert variant="destructive"><AlertCircle /><AlertTitle>Access denied</AlertTitle><AlertDescription>You need permission to view teaching assignments.</AlertDescription></Alert> : <>
        {options.data?.sampleData && <Alert><AlertCircle /><AlertTitle>Sample data</AlertTitle><AlertDescription>Local mode is enabled. Classes and trainers use sample data.</AlertDescription></Alert>}
        {options.isError && <Alert variant="destructive"><AlertCircle /><AlertTitle>Unable to load filter options</AlertTitle><AlertDescription>{errorMessage(options.error)} <Button size="sm" variant="outline" onClick={() => void options.refetch()}>Retry filters</Button></AlertDescription></Alert>}
        <Card><CardContent className="space-y-4 pt-6">
          <form onSubmit={submitSearch} className="flex flex-wrap items-end gap-2" role="search">
            <div className="min-w-48 flex-1 space-y-2"><Label htmlFor="assignment-search">Search</Label><Input key={search} id="assignment-search" name="search" defaultValue={search} maxLength={100} placeholder="Class or subject code/name, trainer name/email" /></div>
            <Button type="submit"><Search className="size-4" />Search</Button>
            <Button type="button" variant="outline" onClick={(event) => { event.currentTarget.form?.reset(); setUrl({}); setResetVersion((version) => version + 1); }}><X className="size-4" />Reset</Button>
          </form>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <FilterInput key={`${resetVersion}:class:${params.classId ?? ""}`} id="assignment-class" label="Class" value={String(params.classId ?? "")} onChange={(value) => change("classId", value)} options={classOptions} disabled={!options.data} />
            <FilterInput key={`${resetVersion}:subject:${params.subjectId ?? ""}`} id="assignment-subject" label="Subject" value={String(params.subjectId ?? "")} onChange={(value) => change("subjectId", value)} options={subjectOptions} disabled={!options.data} />
            <FilterInput key={`${resetVersion}:trainer:${params.trainerId ?? ""}`} id="assignment-trainer" label="Trainer" value={String(params.trainerId ?? "")} onChange={(value) => change("trainerId", value)} options={trainerOptions} disabled={!options.data} />
            <FilterInput key={`${resetVersion}:role:${role ?? ""}`} id="assignment-role" label="Role" value={role ?? ""} onChange={(value) => change("role", value)} options={roleOptions} />
            <div className="space-y-2"><Label htmlFor="assignment-date">Effective on</Label><Input id="assignment-date" type="date" value={effectiveOn ?? ""} onChange={(e) => change("effectiveOn", e.target.value)} /></div>
          </div>
          <p className="text-xs text-muted-foreground">Enter a code, name, email or ID. Press Enter or leave the field to apply; leave blank to show all.</p>
        </CardContent></Card>
        <Card><CardContent className="space-y-4 pt-6" aria-busy={assignments.isFetching}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Assignment list {data && !assignments.isError && <Badge variant="secondary">{total}</Badge>}</h2>
            <div className="w-52"><Label className="sr-only" htmlFor="assignment-sort">Sort order</Label><AppliedTextInput key={`${resetVersion}:sort:${sort}`} id="assignment-sort" value={sort} options={sortOptions} allowEmpty={false} onCommit={(value) => change("sort", value)} placeholder="Newest or Oldest" /></div>
          </div>
          {assignments.isPending ? <div role="status" className="flex items-center justify-center gap-2 py-16 text-muted-foreground"><LoaderCircle className="size-5 animate-spin" />Loading assignments...</div>
            : assignments.isError ? <Alert variant="destructive"><AlertCircle /><AlertTitle>Unable to load assignments</AlertTitle><AlertDescription>{errorMessage(assignments.error)} <Button size="sm" variant="outline" onClick={() => void assignments.refetch()}>Retry list</Button></AlertDescription></Alert>
            : !data?.content.length ? <div role="status" className="space-y-2 rounded-lg border border-dashed px-6 py-14 text-center">
              <p className="font-medium">{total > 0 ? "This page has no records" : filtered ? "No matching assignments" : "No teaching assignments yet"}</p>
              <p className="text-sm text-muted-foreground">{total > 0 ? "Return to the first page to view the current list." : "Try changing the filters or refreshing the list."}</p>
              {total > 0 && <Button variant="outline" onClick={() => change("page", "0")}>Go to first page</Button>}
            </div> : <Table><TableHeader><TableRow><TableHead>Class</TableHead><TableHead>Subject</TableHead><TableHead>Trainer</TableHead><TableHead>Role</TableHead><TableHead>Effective from</TableHead><TableHead>Effective to</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>{data.content.map((a) => <TableRow key={a.id}>
                <TableCell><div className="font-medium">{a.classCode || `Class #${a.classId}`}</div><div className="text-xs text-muted-foreground">{options.data?.classes.find((c) => c.id === a.classId)?.name}</div></TableCell>
                <TableCell><div className="font-medium">{a.subjectName}</div><div className="text-xs text-muted-foreground">{a.subjectCode}</div></TableCell>
                <TableCell>{a.trainerName || `Trainer #${a.trainerId}`}</TableCell>
                <TableCell><Badge variant={a.role === "MAIN" ? "default" : "outline"}>{a.role === "MAIN" ? "Main" : "Assistant"}</Badge></TableCell>
                <TableCell className="whitespace-nowrap">{displayDate(a.effectiveFrom)}</TableCell><TableCell className="whitespace-nowrap">{a.effectiveTo ? displayDate(a.effectiveTo) : "No end date"}</TableCell>
                <TableCell><div className="flex gap-1"><Button variant="ghost" size="sm" aria-label={`View assignment details for ${a.subjectCode} in ${a.classCode || a.classId}`} onClick={() => showDetails(a.id)}><Eye className="size-4" />Details</Button>
                {canUpdate && <Button variant="ghost" size="sm" aria-label={`Edit assignment for ${a.subjectCode} in ${a.classCode || a.classId}`} onClick={() => setEditing(a.id)}><Pencil className="size-4" />Edit</Button>}
                {canUpdate && <Button variant="ghost" size="sm" aria-label={`End assignment for ${a.subjectCode} in ${a.classCode || a.classId}`} onClick={() => setLifecycle({ mode: "end", assignment: a })}><CalendarOff className="size-4" />End</Button>}
                {canDelete && <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" aria-label={`Delete assignment for ${a.subjectCode} in ${a.classCode || a.classId}`} onClick={() => setLifecycle({ mode: "delete", assignment: a })}><Trash2 className="size-4" />Delete</Button>}</div></TableCell>
              </TableRow>)}</TableBody></Table>}
          {!assignments.isPending && !assignments.isError && data && <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-4">
            <p className="text-sm text-muted-foreground" role="status">{data.content.length ? `${page * size + 1}–${page * size + data.content.length}` : "0"} / {total} assignments</p>
            <div className="flex flex-wrap items-center gap-2"><Label htmlFor="assignment-size">Rows</Label><AppliedNumberInput key={`${resetVersion}:size:${size}`} id="assignment-size" value={size} className="w-20" onCommit={(value) => change("size", String(value))} />
              <Button variant="outline" size="icon" aria-label="Previous page" disabled={page === 0 || assignments.isFetching} onClick={() => change("page", String(page - 1))}><ChevronLeft className="size-4" /></Button>
              <span className="text-sm">Page {page + 1} / {Math.max(1, pages)}</span>
              <Button variant="outline" size="icon" aria-label="Next page" disabled={page + 1 >= pages || assignments.isFetching} onClick={() => change("page", String(page + 1))}><ChevronRight className="size-4" /></Button>
            </div>
          </div>}
        </CardContent></Card>
      </>}
    </div>
    {creating && canCreate && <CreateAssignmentDialog initialClassId={params.classId}
      onClose={() => setCreating(false)} onCreated={() => { setCreating(false); }} />}
    {detailId && canRead && <AssignmentDetailDialog key={detailId} assignmentId={detailId} onClose={() => showDetails()} />}
    {editing && canUpdate && <EditAssignmentDialog key={editing} assignmentId={editing} onClose={() => setEditing(null)} />}
    {lifecycle && (lifecycle.mode === "end" ? canUpdate : canDelete) && <AssignmentLifecycleDialog key={`${lifecycle.mode}:${lifecycle.assignment.id}`} mode={lifecycle.mode} assignment={lifecycle.assignment}
      onClose={() => setLifecycle(null)} onDeleted={() => { setLifecycle(null); if (page > 0 && data?.content.length === 1) change("page", String(page - 1)); }}
      onEndInstead={canUpdate ? () => setLifecycle({ ...lifecycle, mode: "end" }) : undefined} />}
  </MainLayout>;
}
