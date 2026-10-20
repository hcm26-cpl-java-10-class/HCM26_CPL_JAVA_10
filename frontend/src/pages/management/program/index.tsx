import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowRight, BookOpen, CheckCircle2, ChevronLeft, ChevronRight, Clock3, CopyPlus, Download, FileText, Info, MapPin, MoreHorizontal, Pencil, Plus, RefreshCw, Search, X } from "lucide-react";
import { programApi, type ProgramStatus, type TrainingProgramRequest, type TrainingProgramResponse } from "@/api/features/program.api";
import { subjectApi } from "@/api/features/subject.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePermissions } from "@/hooks/usePermissions";
import type { EntityConfig, EntitySchema, SubjectDTO } from "@/types";
import { ProgramEditor } from "./ProgramEditor";
import { ProgramActionDialog, ProgramDetails, type ProgramAction } from "./ProgramDialogs";
import { errorMessage, normalizeSearch, primaryButtonClass, ProgramStatusBadge, statusLabels } from "./program-ui";

const schema: EntitySchema = {
  entityName: "training-program", idField: "id",
  fields: [
    { name: "code", label: "Code", type: "text", sortable: true, filterable: true, filterType: "text" },
    { name: "name", label: "Name", type: "text", sortable: true, filterable: true, filterType: "text" },
    { name: "version", label: "Version", type: "text", sortable: true, filterable: true, filterType: "text" },
    { name: "region", label: "Region", type: "text", sortable: true, filterable: true, filterType: "text" },
    { name: "status", label: "Status", type: "text", sortable: true },
  ],
};
export const entityConfig: EntityConfig = { name: "Training Programs", path: "/programs", api: {} as EntityConfig["api"], schema };

type StatusFilter = "ALL" | ProgramStatus;
const filters: StatusFilter[] = ["ALL", "DRAFT", "ACTIVE", "INACTIVE"];
const pageSize = 8;

export default function TrainingProgramPage() {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission("PROGRAM_CREATE");
  const canUpdate = hasPermission("PROGRAM_UPDATE");
  const [programs, setPrograms] = useState<TrainingProgramResponse[]>([]);
  const [subjects, setSubjects] = useState<SubjectDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [subjectsError, setSubjectsError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [region, setRegion] = useState("ALL");
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<{ program: TrainingProgramResponse | null } | null>(null);
  const [details, setDetails] = useState<TrainingProgramResponse | null>(null);
  const [action, setAction] = useState<ProgramAction | null>(null);
  const requestId = useRef(0);

  const loadPrograms = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true); setLoadError("");
    try {
      const data = await programApi.getAll();
      if (currentRequest === requestId.current) setPrograms(data);
    } catch (error) {
      if (currentRequest === requestId.current) setLoadError(errorMessage(error, "Không tải được chương trình. Vui lòng thử lại."));
    } finally { if (currentRequest === requestId.current) setLoading(false); }
  }, []);
  const loadSubjects = useCallback(async () => {
    setLoadingSubjects(true); setSubjectsError("");
    try { setSubjects(await subjectApi.getActiveSubjects()); }
    catch (error) { setSubjectsError(errorMessage(error, "Không tải được môn học. Vui lòng thử lại.")); }
    finally { setLoadingSubjects(false); }
  }, []);
  useEffect(() => { void loadPrograms(); void loadSubjects(); }, [loadPrograms, loadSubjects]);

  const regions = useMemo(() => [...new Set(programs.map((program) => program.region).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, "vi")), [programs]);
  const filtered = useMemo(() => programs.filter((program) =>
    normalizeSearch(`${program.code} ${program.name}`).includes(normalizeSearch(search))
    && (status === "ALL" || program.status === status)
    && (region === "ALL" || program.region === region)), [programs, region, search, status]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const hasFilters = Boolean(search.trim() || status !== "ALL" || region !== "ALL");
  const clearFilters = () => { setSearch(""); setStatus("ALL"); setRegion("ALL"); setPage(1); };
  const openCreate = () => { setNotice(""); setEditor({ program: null }); };
  const openAction = (type: ProgramAction["type"], program: TrainingProgramResponse) => { setDetails(null); setNotice(""); setAction({ type, program }); };
  const openEdit = (program: TrainingProgramResponse) => { setDetails(null); setNotice(""); setEditor({ program }); };
  const updateList = (program: TrainingProgramResponse) => setPrograms((current) => [program, ...current.filter((item) => item.id !== program.id)].sort((a, b) => b.id - a.id));
  const saveProgram = async (request: TrainingProgramRequest) => {
    const program = editor?.program ? await programApi.update(editor.program.id, request) : await programApi.create(request);
    updateList(program); setEditor(null); clearFilters();
    setNotice(`Đã ${editor?.program ? "cập nhật" : "tạo"} bản nháp ${program.code} · phiên bản ${program.version}.`);
  };
  const confirmAction = async (version: string) => {
    if (!action) return;
    const program = action.type === "clone" ? await programApi.cloneVersion(action.program.id, version) : await programApi.activate(action.program.id);
    updateList(program); setAction(null); clearFilters();
    setNotice(action.type === "clone" ? `Đã tạo bản nháp ${program.code} · phiên bản ${program.version}.` : `Đã kích hoạt ${program.code} · phiên bản ${program.version}.`);
  };
  const exportCsv = () => {
    const cell = (value: unknown) => {
      const text = String(value ?? "");
      return `"${(/^[=+\-@\t\r]/.test(text) ? "'" + text : text).replace(/"/g, '""')}"`;
    };
    const rows = [["Mã chương trình", "Tên chương trình", "Phiên bản", "Khu vực", "Số môn", "Tổng giờ", "Trạng thái"],
      ...filtered.map((program) => [program.code, program.name, program.version, program.region, program.subjects.length, program.totalDurationHours, statusLabels[program.status]])];
    const url = URL.createObjectURL(new Blob(["\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "chuong-trinh-dao-tao.csv"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(`Đã xuất ${filtered.length} chương trình theo bộ lọc hiện tại.`);
  };
  const programMenu = (program: TrainingProgramResponse) => (canCreate || canUpdate) && <DropdownMenu>
    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Thao tác ${program.code} phiên bản ${program.version}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-52">
      <DropdownMenuLabel className="break-all whitespace-normal text-xs text-muted-foreground">{program.code} · v{program.version}</DropdownMenuLabel><DropdownMenuSeparator />
      {canUpdate && program.status === "DRAFT" && <DropdownMenuItem onSelect={() => openEdit(program)}><Pencil />Chỉnh sửa bản nháp</DropdownMenuItem>}
      {canCreate && <DropdownMenuItem onSelect={() => openAction("clone", program)}><CopyPlus />Tạo phiên bản mới</DropdownMenuItem>}
      {canUpdate && program.status !== "ACTIVE" && <DropdownMenuItem onSelect={() => openAction("activate", program)}><CheckCircle2 />{program.status === "INACTIVE" ? "Kích hoạt lại" : "Kích hoạt chương trình"}</DropdownMenuItem>}
    </DropdownMenuContent>
  </DropdownMenu>;

  return <MainLayout pathName={{ programs: "Chương trình đào tạo" }} defaultSidebarHidden>
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-3">
      <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
        <div className="flex items-start gap-3.5"><div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300"><BookOpen className="size-6" /></div>
          <div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Chương trình đào tạo</h1><p className="mt-1.5 max-w-xl text-sm leading-6 text-muted-foreground">Quản lý nội dung, thời lượng và các phiên bản chương trình ở cùng một nơi.</p></div></div>
        <div className="flex shrink-0 flex-wrap gap-2"><Button variant="outline" onClick={exportCsv} disabled={loading || Boolean(loadError) || !filtered.length}><Download />Xuất CSV</Button>
          {canCreate && <Button className={primaryButtonClass} onClick={openCreate}><Plus />Tạo chương trình</Button>}</div>
      </header>

      {notice && <div role="status" className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"><CheckCircle2 className="size-4 shrink-0" /><span className="flex-1">{notice}</span><Button variant="ghost" size="icon-xs" aria-label="Đóng thông báo" onClick={() => setNotice("")}><X /></Button></div>}

      <section className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-sm" aria-label="Danh sách chương trình">
        <div className="overflow-x-auto border-b px-4 pt-2 sm:px-5"><div className="flex w-max gap-4" aria-label="Lọc theo trạng thái">
          {filters.map((item) => <button key={item} type="button" aria-pressed={status === item} className={`flex cursor-pointer items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] ${status === item ? "border-blue-600 text-blue-700 dark:text-blue-300" : "border-transparent text-muted-foreground hover:text-foreground"}`} onClick={() => { setStatus(item); setPage(1); }}>
            {item === "ALL" ? "Tất cả" : statusLabels[item]}<span className={`rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${status === item ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "bg-muted"}`}>{item === "ALL" ? programs.length : programs.filter((program) => program.status === item).length}</span>
          </button>)}
        </div></div>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:px-5">
          <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" aria-hidden="true" /><Input aria-label="Tìm chương trình" className="bg-background pl-9 pr-9" placeholder="Tìm mã hoặc tên chương trình…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
            {search && <Button variant="ghost" size="icon-xs" className="absolute right-1.5 top-1.5" aria-label="Xóa tìm kiếm" onClick={() => { setSearch(""); setPage(1); }}><X /></Button>}</div>
          <div className="flex gap-2"><Select value={region} onValueChange={(value) => { setRegion(value); setPage(1); }}><SelectTrigger aria-label="Lọc khu vực" className="w-full bg-background sm:w-44"><MapPin className="size-4" /><SelectValue placeholder="Tất cả khu vực" /></SelectTrigger><SelectContent><SelectItem value="ALL">Tất cả khu vực</SelectItem>{regions.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
            <Button variant="outline" size="icon" aria-label="Tải lại danh sách" title="Tải lại danh sách" disabled={loading} onClick={() => void loadPrograms()}><RefreshCw className={loading ? "animate-spin" : ""} /></Button></div>
        </div>
        {hasFilters && <div className="flex flex-wrap items-center gap-3 border-t bg-muted/20 px-5 py-2 text-xs"><p role="status" className="text-muted-foreground">{filtered.length} chương trình phù hợp{search.trim() && <> với “{search.trim()}”</>}</p><button type="button" className="cursor-pointer font-medium text-blue-700 hover:underline dark:text-blue-300" onClick={clearFilters}>Xóa bộ lọc</button></div>}

        {loadError ? <div className="border-t p-5"><Alert variant="destructive"><AlertCircle /><AlertDescription>{loadError}<Button variant="outline" size="sm" onClick={() => void loadPrograms()}>Thử tải lại</Button></AlertDescription></Alert></div>
          : loading ? <div className="space-y-3 border-t p-5" role="status" aria-label="Đang tải chương trình">{[1, 2, 3].map((index) => <Skeleton key={index} className="h-16 w-full" />)}<span className="sr-only">Đang tải chương trình…</span></div>
          : !filtered.length ? <div className="flex flex-col items-center border-t px-6 py-16 text-center"><div className="mb-4 rounded-full bg-muted p-4">{hasFilters ? <Search className="size-7 text-muted-foreground" /> : <BookOpen className="size-7 text-muted-foreground" />}</div><h2 className="font-semibold">{hasFilters ? "Không tìm thấy chương trình phù hợp" : "Chưa có chương trình đào tạo"}</h2><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{hasFilters ? "Thử một từ khóa khác hoặc xóa bộ lọc để xem toàn bộ danh sách." : "Tạo chương trình đầu tiên, chọn môn học và sắp xếp nội dung giảng dạy."}</p><Button className="mt-5" variant="outline" onClick={hasFilters ? clearFilters : openCreate} disabled={!hasFilters && !canCreate}>{hasFilters ? "Xóa bộ lọc" : "Tạo chương trình đầu tiên"}</Button></div>
          : <>
            <div className="hidden border-t sm:block"><Table className="table-fixed">
              <TableHeader className="bg-muted/40"><TableRow className="hover:bg-transparent">
                <TableHead className="w-[34%] pl-5 text-xs text-muted-foreground">Chương trình</TableHead><TableHead className="w-[11%] text-xs text-muted-foreground">Phiên bản</TableHead><TableHead className="hidden w-[13%] text-xs text-muted-foreground lg:table-cell">Khu vực</TableHead><TableHead className="w-[16%] text-xs text-muted-foreground">Nội dung</TableHead><TableHead className="w-[20%] text-xs text-muted-foreground">Trạng thái</TableHead><TableHead className="w-24 pr-4 text-right text-xs text-muted-foreground">Thao tác</TableHead>
              </TableRow></TableHeader>
              <TableBody>{visible.map((program) => <TableRow key={program.id} className="group">
                <TableCell className="whitespace-normal py-5 pl-5"><button type="button" className="block cursor-pointer break-words text-left text-sm font-semibold leading-5 hover:text-blue-700 hover:underline dark:hover:text-blue-300" onClick={() => setDetails(program)}>{program.name}</button><p className="mt-1.5 break-all font-mono text-[11px] text-muted-foreground">{program.code}</p></TableCell>
                <TableCell><span className="inline-flex max-w-full break-all whitespace-normal rounded-md border bg-muted/30 px-2 py-1 text-xs font-medium">v{program.version}</span></TableCell>
                <TableCell className="hidden whitespace-normal text-xs text-muted-foreground lg:table-cell">{program.region || "Chưa đặt"}</TableCell>
                <TableCell><p className="text-sm">{program.subjects.length} môn</p><p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="size-3" />{program.totalDurationHours} giờ</p></TableCell>
                <TableCell><ProgramStatusBadge status={program.status} /></TableCell>
                <TableCell className="pr-4"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon-sm" aria-label={`Xem chi tiết ${program.code} phiên bản ${program.version}`} title="Xem chi tiết" onClick={() => setDetails(program)}><ArrowRight className="size-4 text-muted-foreground" /></Button>{programMenu(program)}</div></TableCell>
              </TableRow>)}</TableBody>
            </Table></div>
            <div className="divide-y border-t sm:hidden">{visible.map((program) => <article key={program.id} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="mb-1 break-all font-mono text-xs text-muted-foreground">{program.code} · v{program.version}</p><button className="cursor-pointer break-words text-left font-semibold leading-6" onClick={() => setDetails(program)}>{program.name}</button></div>{programMenu(program)}</div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground"><span>{program.subjects.length} môn · {program.totalDurationHours} giờ</span>{program.region && <span>{program.region}</span>}<ProgramStatusBadge status={program.status} /></div>
              <Button variant="outline" size="sm" className="w-full" onClick={() => setDetails(program)}>Xem chi tiết<ArrowRight /></Button>
            </article>)}</div>
          </>}
        {!loading && !loadError && filtered.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/15 px-5 py-3 text-xs text-muted-foreground"><p aria-live="polite">Hiển thị {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} trong {filtered.length} chương trình</p><div className="flex items-center gap-2"><Button variant="outline" size="icon-xs" aria-label="Trang trước" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft /></Button><span>Trang {currentPage}/{totalPages}</span><Button variant="outline" size="icon-xs" aria-label="Trang sau" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}><ChevronRight /></Button></div></div>}
      </section>
      <div className="flex items-start gap-2.5 rounded-lg bg-muted/40 px-4 py-3 text-xs leading-5 text-muted-foreground"><Info className="mt-0.5 size-4 shrink-0" /><p><span className="font-medium text-foreground">Bản nháp</span> có thể chỉnh sửa. Khi <span className="font-medium text-foreground">đang áp dụng</span>, hãy tạo phiên bản mới để thay đổi nội dung mà vẫn giữ lại phiên bản cũ.</p></div>
      {!canCreate && !canUpdate && <p className="flex items-center gap-2 text-xs text-muted-foreground"><FileText className="size-3.5" />Bạn đang có quyền xem chương trình.</p>}
    </div>
    {editor && <ProgramEditor key={editor.program?.id ?? "new"} program={editor.program} subjects={subjects} loadingSubjects={loadingSubjects} subjectsError={subjectsError} onRetrySubjects={() => void loadSubjects()} onClose={() => setEditor(null)} onSave={saveProgram} />}
    {details && <ProgramDetails program={details} canCreate={canCreate} canUpdate={canUpdate} onClose={() => setDetails(null)} onEdit={() => openEdit(details)} onClone={() => openAction("clone", details)} onActivate={() => openAction("activate", details)} />}
    {action && <ProgramActionDialog key={`${action.type}-${action.program.id}`} action={action} programs={programs} onClose={() => setAction(null)} onConfirm={confirmAction} />}
  </MainLayout>;
}
