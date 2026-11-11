import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { AlertCircle, ChevronDown, ChevronLeft, ChevronRight, Eye, Filter, LoaderCircle, Pencil, Plus, RefreshCw, Search, Trash2, Users } from "lucide-react";
import { AssignmentLifecycleDialog, type LifecycleMode } from "./components/AssignmentLifecycleDialog";
import { EditAssignmentDialog } from "./components/EditAssignmentDialog";
import { CreateAssignmentDialog } from "./components/CreateAssignmentDialog";
import { AssignmentDetailDialog } from "./components/AssignmentDetailDialog";
import { AssignmentDataIO } from "./components/AssignmentDataIO";
import { BulkDeleteAssignmentsDialog } from "./components/BulkDeleteAssignmentsDialog";
import type { DeleteTarget } from "./assignment-bulk-delete";
import { Checkbox } from "@/components/ui/checkbox";
import { classSetupApi, type AssignmentRole, type AssignmentSearchParams, type TeachingAssignment } from "@/api/features/class-setup.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppliedTextInput, AppliedNumberInput } from "./components/ReferenceInput";
import { trainerTextOptions, type TextOption } from "./assignment-text";
import { AssignmentRoleSelect } from "./components/AssignmentRoleSelect";
import { AssignmentSchedule } from "./components/AssignmentSchedule";
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

const sortOptions = [
  { value: "effectiveFrom,desc", label: "Start date: newest first" },
  { value: "effectiveFrom,asc", label: "Start date: oldest first" },
  { value: "effectiveTo,asc", label: "End date: ascending" },
  { value: "effectiveTo,desc", label: "End date: descending" },
];

export default function TeachingAssignmentPage() {
  const client = useQueryClient();
  const [selection, setSelection] = useState<{ scope: string; ids: Set<number> }>({ scope: "", ids: new Set() });
  const [bulkDelete, setBulkDelete] = useState<DeleteTarget[] | null>(null);
  const { hasPermission } = usePermissions();
  const canRead = hasPermission("ASSIGNMENT_READ");
  const canCreate = hasPermission("ASSIGNMENT_CREATE");
  const canUpdate = hasPermission("ASSIGNMENT_UPDATE");
  const canDelete = hasPermission("ASSIGNMENT_DELETE");
  const [lifecycle, setLifecycle] = useState<{ mode: LifecycleMode; assignment: TeachingAssignment } | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
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
  const search = (url.get("search") ?? "").trim().slice(0, 200);
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
  const selectionScope = JSON.stringify(params);
  const selectedIds = selection.scope === selectionScope ? selection.ids : new Set<number>();
  const selectedRows = (data?.content ?? []).filter((a) => selectedIds.has(a.id));
  const allSelected = Boolean(data?.content.length && selectedRows.length === data.content.length);
  function toggleSelection(id: number, checked: boolean) {
    const ids = new Set(selectedIds);
    if (checked) ids.add(id); else ids.delete(id);
    setSelection({ scope: selectionScope, ids });
  }
  async function onBulkDeleted(ids: number[]) {
    setSelection((current) => ({ ...current, ids: new Set([...current.ids].filter((id) => !ids.includes(id))) }));
    if (!ids.length) return;
    await Promise.all([
      client.invalidateQueries({ queryKey: ["teaching-assignments"] }),
      client.invalidateQueries({ queryKey: ["teaching-assignment-options"] }),
      client.invalidateQueries({ queryKey: ["available-assignments"] }),
      client.invalidateQueries({ queryKey: ["teaching-assignment-create-context"] }),
    ]);
    if (page > 0 && data?.content.every((a) => ids.includes(a.id))) change("page", String(page - 1));
  }
  const total = data?.totalElements ?? 0;
  const pages = data?.totalPages ?? 0;
  const activeFilterCount = [params.classId, params.subjectId, params.trainerId, role, effectiveOn].filter(Boolean).length;
  const filtered = Boolean(search || activeFilterCount);

  return <MainLayout pathName={{ "teaching-assignments": "Teaching Assignments" }}>
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><Users className="size-6 text-primary" />Teaching Assignments</h1></div>
        <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={assignments.isFetching || options.isFetching || !canRead} onClick={() => { void assignments.refetch(); void options.refetch(); }}>
          <RefreshCw className={assignments.isFetching || options.isFetching ? "size-4 animate-spin" : "size-4"} />Refresh
        </Button>
        {canRead && <AssignmentDataIO filters={params} canImport={canCreate} />}
        {canRead && canCreate && <Button onClick={() => setCreating(true)}><Plus className="size-4" />New assignment</Button>}
        </div>
      </div>
      {!canRead ? <Alert variant="destructive"><AlertCircle /><AlertTitle>Access denied</AlertTitle><AlertDescription>You need permission to view teaching assignments.</AlertDescription></Alert> : <>
        {options.isError && <Alert variant="destructive"><AlertCircle /><AlertTitle>Unable to load filter options</AlertTitle><AlertDescription>{errorMessage(options.error)} <Button size="sm" variant="outline" onClick={() => void options.refetch()}>Retry filters</Button></AlertDescription></Alert>}
        <Card><CardContent className="space-y-4 pt-6">
          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen} className="space-y-4">
          <form onSubmit={submitSearch} className="flex flex-wrap items-end gap-2" role="search">
            <CollapsibleTrigger asChild>
              <Button type="button" variant="outline" className={activeFilterCount ? "border-primary/40 text-primary" : undefined}>
                <Filter className="size-4" />Filters{activeFilterCount > 0 && <span className="tabular-nums">({activeFilterCount})</span>}
                <ChevronDown className={`size-4 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <div className="min-w-48 flex-1"><Label className="sr-only" htmlFor="assignment-search">Search assignments</Label><Input key={search} id="assignment-search" name="search" defaultValue={search} maxLength={200} placeholder="Search by class, subject, trainer name or email..." /></div>
            <Button type="submit"><Search className="size-4" />Search</Button>
          </form>
          <CollapsibleContent className="space-y-3 border-t pt-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <FilterInput key={`class:${params.classId ?? ""}`} id="assignment-class" label="Class" value={String(params.classId ?? "")} onChange={(value) => change("classId", value)} options={classOptions} disabled={!options.data} />
            <FilterInput key={`subject:${params.subjectId ?? ""}`} id="assignment-subject" label="Subject" value={String(params.subjectId ?? "")} onChange={(value) => change("subjectId", value)} options={subjectOptions} disabled={!options.data} />
            <FilterInput key={`trainer:${params.trainerId ?? ""}`} id="assignment-trainer" label="Trainer" value={String(params.trainerId ?? "")} onChange={(value) => change("trainerId", value)} options={trainerOptions} disabled={!options.data} />
            <div className="space-y-2"><Label htmlFor="assignment-role">Role</Label><AssignmentRoleSelect id="assignment-role" value={role ?? ""} onChange={(value) => change("role", value)} allowAll /></div>
            <div className="space-y-2"><Label htmlFor="assignment-date">Effective on</Label><Input id="assignment-date" type="date" value={effectiveOn ?? ""} onChange={(e) => change("effectiveOn", e.target.value)} /></div>
          </div>
          <p className="text-xs text-muted-foreground">Enter a code, name or email. Press Enter or leave the field to apply; leave blank to show all.</p>
          </CollapsibleContent>
          </Collapsible>
        </CardContent></Card>
        <Card><CardContent className="space-y-4 pt-6" aria-busy={assignments.isFetching}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Assignment list {data && !assignments.isError && <Badge variant="secondary">{total}</Badge>}</h2>
            <div className="w-full sm:w-64">
              <Label className="sr-only" htmlFor="assignment-sort">Sort order</Label>
              <Select value={sort} onValueChange={(value) => change("sort", value)}>
                <SelectTrigger id="assignment-sort" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{sortOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          {canDelete && selectedRows.length > 0 && !assignments.isError && <div className="flex flex-wrap items-center gap-3 rounded-md border p-3">
            <span role="status" className="text-sm">{selectedRows.length} selected on this page</span>
            <Button variant="destructive" size="sm" disabled={assignments.isFetching} onClick={() => setBulkDelete(selectedRows)}><Trash2 className="size-4" />Delete selected ({selectedRows.length})</Button>
            <Button variant="outline" size="sm" onClick={() => setSelection({ scope: selectionScope, ids: new Set() })}>Clear selection</Button>
          </div>}
          {assignments.isPending ? <div role="status" className="flex items-center justify-center gap-2 py-16 text-muted-foreground"><LoaderCircle className="size-5 animate-spin" />Loading assignments...</div>
            : assignments.isError ? <Alert variant="destructive"><AlertCircle /><AlertTitle>Unable to load assignments</AlertTitle><AlertDescription>{errorMessage(assignments.error)} <Button size="sm" variant="outline" onClick={() => void assignments.refetch()}>Retry list</Button></AlertDescription></Alert>
            : !data?.content.length ? <div role="status" className="space-y-2 rounded-lg border border-dashed px-6 py-14 text-center">
              <p className="font-medium">{total > 0 ? "This page has no records" : filtered ? "No matching assignments" : "No teaching assignments yet"}</p>
              <p className="text-sm text-muted-foreground">{total > 0 ? "Return to the first page to view the current list." : "Try changing the filters or refreshing the list."}</p>
              {total > 0 && <Button variant="outline" onClick={() => change("page", "0")}>Go to first page</Button>}
            </div> : <Table className="[&_th]:px-4 [&_th]:py-3 [&_td]:px-4 [&_td]:py-4 [&_td]:align-top"><TableHeader className="bg-muted/40"><TableRow>{canDelete && <TableHead className="w-10"><Checkbox aria-label="Select all assignments on this page" checked={allSelected ? true : selectedRows.length ? "indeterminate" : false} disabled={assignments.isFetching}
              onCheckedChange={(checked) => setSelection({ scope: selectionScope, ids: new Set(checked === true ? data.content.map((a) => a.id) : []) })} /></TableHead>}<TableHead>Class</TableHead><TableHead>Subject</TableHead><TableHead>Trainer</TableHead><TableHead>Role</TableHead><TableHead>Teaching schedule</TableHead><TableHead>Effective period</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>{data.content.map((a) => <TableRow key={a.id} data-state={selectedIds.has(a.id) ? "selected" : undefined}>
                {canDelete && <TableCell><Checkbox aria-label={`Select assignment for ${a.subjectCode} in ${a.classCode || a.classId}`} checked={selectedIds.has(a.id)} disabled={assignments.isFetching} onCheckedChange={(checked) => toggleSelection(a.id, checked === true)} /></TableCell>}
                <TableCell className="min-w-40 max-w-56 whitespace-normal break-words"><div className="font-medium">{a.className || options.data?.classes.find((c) => c.id === a.classId)?.name || a.classCode || `Class #${a.classId}`}</div><div className="mt-1 text-xs text-muted-foreground">{a.classCode}</div></TableCell>
                <TableCell className="min-w-40 max-w-56 whitespace-normal break-words"><div className="font-medium">{a.subjectName}</div><div className="mt-1 text-xs text-muted-foreground">{a.subjectCode}</div></TableCell>
                <TableCell className="min-w-44 max-w-60 whitespace-normal break-words"><div className="font-medium">{a.trainerName || `Trainer #${a.trainerId}`}</div>{a.trainerEmail && <div className="mt-1 break-all text-xs text-muted-foreground">{a.trainerEmail}</div>}</TableCell>
                <TableCell><Badge variant={a.role === "MAIN" ? "default" : "outline"}>{a.role === "MAIN" ? "Main" : "Assistant"}</Badge></TableCell>
                <TableCell className="min-w-56"><AssignmentSchedule slots={a.teachingSlots} preview onViewAll={() => showDetails(a.id)} /></TableCell>
                <TableCell><dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs"><dt className="text-muted-foreground">From</dt><dd>{displayDate(a.effectiveFrom)}</dd><dt className="text-muted-foreground">To</dt><dd>{a.effectiveTo ? displayDate(a.effectiveTo) : "No end date"}</dd></dl></TableCell>
                <TableCell><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" title="Details" aria-label={`View assignment details for ${a.subjectCode} in ${a.classCode || a.classId}`} onClick={() => showDetails(a.id)}><Eye className="size-4" /></Button>
                {canUpdate && <Button variant="ghost" size="icon" title="Edit" aria-label={`Edit assignment for ${a.subjectCode} in ${a.classCode || a.classId}`} onClick={() => setEditing(a.id)}><Pencil className="size-4" /></Button>}
                {canDelete && <Button variant="ghost" size="icon" title="Delete" className="text-destructive hover:text-destructive" aria-label={`Delete assignment for ${a.subjectCode} in ${a.classCode || a.classId}`} onClick={() => setLifecycle({ mode: "delete", assignment: a })}><Trash2 className="size-4" /></Button>}</div></TableCell>
              </TableRow>)}</TableBody></Table>}
          {!assignments.isPending && !assignments.isError && data && <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-4">
            <p className="text-sm text-muted-foreground" role="status">{data.content.length ? `${page * size + 1}–${page * size + data.content.length}` : "0"} / {total} assignments</p>
            <div className="flex flex-wrap items-center gap-2"><Label htmlFor="assignment-size">Rows</Label><AppliedNumberInput key={`size:${size}`} id="assignment-size" value={size} className="w-20" onCommit={(value) => change("size", String(value))} />
              <Button variant="outline" size="icon" aria-label="Previous page" disabled={page === 0 || assignments.isFetching} onClick={() => change("page", String(page - 1))}><ChevronLeft className="size-4" /></Button>
              <span className="text-sm">Page {page + 1} / {Math.max(1, pages)}</span>
              <Button variant="outline" size="icon" aria-label="Next page" disabled={page + 1 >= pages || assignments.isFetching} onClick={() => change("page", String(page + 1))}><ChevronRight className="size-4" /></Button>
            </div>
          </div>}
        </CardContent></Card>
      </>}
    </div>
    {creating && canCreate && <CreateAssignmentDialog
      onClose={() => setCreating(false)} onCreated={() => { setCreating(false); }} />}
    {bulkDelete && canDelete && <BulkDeleteAssignmentsDialog assignments={bulkDelete} onClose={() => setBulkDelete(null)} onDeleted={onBulkDeleted} />}
    {detailId && canRead && <AssignmentDetailDialog key={detailId} assignmentId={detailId} onClose={() => showDetails()} />}
    {editing && canUpdate && <EditAssignmentDialog key={editing} assignmentId={editing} onClose={() => setEditing(null)} />}
    {lifecycle && (lifecycle.mode === "end" ? canUpdate : canDelete) && <AssignmentLifecycleDialog key={`${lifecycle.mode}:${lifecycle.assignment.id}`} mode={lifecycle.mode} assignment={lifecycle.assignment}
      onClose={() => setLifecycle(null)} onDeleted={() => { setLifecycle(null); if (page > 0 && data?.content.length === 1) change("page", String(page - 1)); }}
      onEndInstead={canUpdate ? () => setLifecycle({ ...lifecycle, mode: "end" }) : undefined} />}
  </MainLayout>;
}
