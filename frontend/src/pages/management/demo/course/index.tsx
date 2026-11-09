import axios from "@/api/axios";
import * as XLSX from "xlsx";
import { ImportModal } from "./components/dataio/ImportModal";
import { ExportModal } from "./components/dataio/ExportModal";
import { ImportResultModal } from "./components/dataio/ImportResultModal";
import { downloadBlob } from "@/components/datatable/util/dataio.utils";
import type { ImportResult as ApiImportResult, FileFormat } from "@/types";
import { useState, useMemo, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  Filter,
  Search,
  LayoutGrid,
  Table as TableIcon,
  Upload,
  Download,
  Plus,
  GraduationCap,
  Eye,
  Pencil,
  Trash2,
  X,
  RotateCcw,
} from "lucide-react";

import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { courseApi } from "@/api/features/demo/course.api";
import {
  type EntityConfig,
  type EntitySchema,
  auditableFieldsSchema,
  type FieldSchema,
} from "@/types";
import CourseDetailPage from "./CourseDetailPage";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSelector, useStore } from "react-redux";
import type { RootState } from "@/store/store";
import { usePermissions } from "@/hooks/usePermissions";
import { courseData, courseError, legacyCourseSummary, type BackendCourse } from "@/integrations/courses/course-data";
import { coursePageKey, refreshCourseViews } from "@/integrations/courses/course-queries";
import { previewCourseWorkbook, previewCourseRows, persistCourseImport, courseWorkbook, type ImportPreview, type ImportResult } from "@/integrations/courses/course-workbook";
import { CourseTable } from "./components/CourseTable";
import { CourseModal } from "./components/CourseModal";
import { CourseDetailModal } from "./components/CourseDetailModal";
import { DeleteConfirmDialog } from "./components/DeleteConfirmDialog";
import type {
  CourseItem,
  CourseFormData,
  SortField,
  SortState,
} from "./types";

// Schema export for compatibility with entity system & build-router
const courseSchema: EntitySchema = {
  entityName: "course",
  idField: "id",
  fields: [
    {
      name: "name",
      label: "Course Name",
      type: "text",
      sortable: true,
      bold: true,
    },
    {
      name: "instructor",
      label: "Instructor",
      type: "text",
      sortable: true,
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      sortable: false,
    },
    {
      name: "thumbnailUrl",
      label: "Thumbnail URL",
      type: "text",
      sortable: false,
    },
    ...(auditableFieldsSchema as FieldSchema[]),
  ],
};

export const entityConfig: EntityConfig = {
  name: "Course",
  path: "/courses",
  api: courseApi,
  schema: courseSchema,
  actionPages: {
    detail: { path: ":id", component: CourseDetailPage, requiredPermission: "COURSE_READ" },
  },
};

export default function CourseManagementPage() {
  const { email, isAuthenticated } = useSelector((state: RootState) => state.auth);
  const authStore = useStore<RootState>();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission("COURSE_CREATE");
  const canUpdate = hasPermission("COURSE_UPDATE");
  const canDelete = hasPermission("COURSE_DELETE");
  const canRead = hasPermission("COURSE_READ");
  const client = useQueryClient();
  const legacy = useMemo(legacyCourseSummary, []);
  const [busy, setBusy] = useState(false);
  const mutationLock = useRef(false);
  const [result, setResult] = useState<ApiImportResult | null>(null);
  const [resultOpen,setResultOpen]=useState(false);
  const [isImportOpen,setIsImportOpen]=useState(false);



  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Sorting state
  const [sortState, setSortState] = useState<SortState>({
    field: null,
    direction: null,
  });

  // Filter state
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [metadataFilters,setMetadataFilters]=useState<Record<string,string>>({});
  const filterMetadata=useQuery({queryKey:["course-data",email,"metadata"],queryFn:()=>courseData.all(),enabled:isAuthenticated&&canRead,retry:false});
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [autoPageSize,setAutoPageSize]=useState(true);
  useEffect(()=>{if(!autoPageSize)return;const resize=()=>setPageSize(Math.max(1,Math.min(100,Math.floor((window.innerHeight-240)/54))));resize();window.addEventListener("resize",resize);return()=>window.removeEventListener("resize",resize);},[autoPageSize]);

  // Modals state
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [viewingCourse, setViewingCourse] = useState<CourseItem | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingCourse, setDeletingCourse] = useState<CourseItem | null>(null);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);

  // Handle Sort Change
  const handleSortChange = (field: SortField) => {
    setCurrentPage(1);
    setSortState((prev) => {
      if (prev.field !== field) {
        return { field, direction: "asc" };
      }
      if (prev.direction === "asc") {
        return { field, direction: "desc" };
      }
      return { field: null, direction: null };
    });
  };

  const activeFiltersCount = (filterStatus === "ALL" ? 0 : 1)+Object.values(metadataFilters).filter(Boolean).length;
  const resetFilters = () => { setFilterStatus("ALL"); setMetadataFilters({}); setSearchQuery(""); setCurrentPage(1); };
  const options = { ...metadataFilters, page: currentPage - 1, size: pageSize, search: searchQuery,
    sort: sortState.field && sortState.direction ? `${sortState.field},${sortState.direction}` : "id,asc",
    ...(filterStatus === "ALL" ? {} : { isActive: filterStatus === "Active" }) };
  const query = useQuery({ queryKey: coursePageKey(email, options),
    queryFn: ({ signal }) => courseData.page(options, signal), enabled: isAuthenticated && canRead, retry: false });
  const toItem = (course: BackendCourse): CourseItem => ({ ...course, courseName: course.name,
    instructor: course.instructor ?? "", description: course.description ?? "", thumbnailUrl: course.thumbnailUrl ?? "",
    category: course.category || "Not available", courseLevel: course.courseLevel || "Not available", publicationStatus: course.publicationStatus || "Not available", createdAt: course.createdAt ?? "" });
  const courses = (query.data?.content ?? []).map(toItem);
  const paginatedCourses = courses;
  const totalItems = query.data?.totalElements ?? 0;
  const totalPages = Math.max(1, query.data?.totalPages ?? 1);
  const safeCurrentPage = Math.min(currentPage, totalPages);
  useEffect(() => { if (query.isSuccess && currentPage > totalPages) setCurrentPage(totalPages); }, [query.isSuccess, currentPage, totalPages]);
  useEffect(() => { setCurrentPage(1); setSelectedIds(new Set()); setResult(null);setResultOpen(false);setIsImportOpen(false); }, [email]);

  // Row Selection Handlers
  const handleToggleSelectRow = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    const currentPageIds = paginatedCourses.map((c) => c.id);
    const isAllPageSelected = currentPageIds.every((id) => selectedIds.has(id));

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isAllPageSelected) {
        currentPageIds.forEach((id) => next.delete(id));
      } else {
        currentPageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const mutation = async <T,>(operation: () => Promise<T>): Promise<T> => {
    if (mutationLock.current) throw new Error("Another Course operation is still pending.");
    mutationLock.current = true; setBusy(true);
    try { return await operation(); }
    finally { await refreshCourseViews(client); mutationLock.current = false; setBusy(false); }
  };
  const currentSession = () => {
    const before = authStore.getState().auth;
    return () => { const now = authStore.getState().auth; return now.isAuthenticated && now.email === before.email && now.token === before.token && now.permissions.includes("COURSE_CREATE"); };
  };
  const handleToggleStatus = async (course: CourseItem) => {
    if (!canUpdate) return;
    try {
      await mutation(() => courseData.update(course.id, { ...course, isActive: !course.isActive }));
      toast.success(`Course status updated to ${course.isActive ? "Inactive" : "Active"}.`);
    } catch (error) { toast.error(courseError(error)); }
  };
  const handleSaveCourse = async (formData: CourseFormData) => {
    if (editingCourse ? !canUpdate : !canCreate) throw new Error("You do not have permission to save this course.");
    await mutation(() => editingCourse ? courseData.update(editingCourse.id, formData) : courseData.create(formData));
    toast.success(editingCourse ? "Course details updated successfully." : "Course created successfully.");
  };
  const handleDeleteCourse = async (course: CourseItem) => {
    if (!canDelete) throw new Error("You do not have permission to delete courses.");
    await mutation(() => courseData.remove(course.id));
    setSelectedIds(previous => { const next = new Set(previous); next.delete(course.id); return next; });
    toast.success("Course deleted successfully.");
  };
  const handleImport = async (preview: ImportPreview): Promise<ImportResult> => {
    if (!canCreate) throw new Error("You do not have permission to import courses.");
    if (preview.updateExisting && !canUpdate) throw new Error("Updating existing Courses requires COURSE_UPDATE permission.");
    const isCurrent = currentSession();
    const result = await mutation(() => persistCourseImport(preview, isCurrent));
    if (isCurrent()) {

      const message = `Imported ${result.imported}; updated ${result.updated || 0}; skipped ${result.skipped}; failed ${result.failed}; not attempted ${result.unattempted}.`;
      if (result.failed || result.unattempted) toast.warning(message);
      else toast.success(message);
    }
    return result;
  };

  return (
    <MainLayout pathName={{ courses: "Courses" }}>
      <div className="flex min-h-full w-full min-w-0 flex-col gap-4">
        {/* Page Title & Overview */}
        <div className="sr-only">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100 flex items-center gap-2">
              <GraduationCap className="size-6 text-slate-800 dark:text-zinc-200" />
              Courses
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Manage backend course records, instructors, and active state.
            </p>
          </div>
        </div>

        {(legacy.local > 0 || legacy.session > 0 || legacy.unreadable) && <div role="note" className="rounded-lg border p-3 text-sm text-muted-foreground">
          Legacy browser Course data detected ({legacy.local} local / {legacy.session} session records{legacy.unreadable ? "; some stored data could not be read" : ""}).
          It is preserved in browser storage and has not been migrated or deleted. This page lists backend records only.
        </div>}
        <p className="sr-only">Category, level and publication status come from saved Course metadata. Active is a separate state.</p>

        {/* 2. TOP ACTION TOOLBAR (Above the Table) */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left Group */}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {/* Filters Button */}
            <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Open filter options"
                  className="h-9 px-3 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium flex items-center gap-2 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filters</span>
                  {activeFiltersCount > 0 && (
                    <span className="ml-0.5 size-4 rounded-full bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-[10px] flex items-center justify-center font-bold">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-80 p-4 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 shadow-lg text-xs space-y-3"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
                  <span className="font-semibold text-slate-900 dark:text-zinc-100">
                    Filter Courses
                  </span>
                  {activeFiltersCount > 0 && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="size-3" /> Reset
                    </button>
                  )}
                </div>

                {["Category", "Course Level", "Publication Status"].map(label => <div key={label} className="space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground">{label}</span>
                  <select aria-label={label} value={metadataFilters[label==="Category"?"category":label.toLowerCase().includes("level")?"courseLevel":"publicationStatus"]||""} onChange={e=>{const key=label==="Category"?"category":label.toLowerCase().includes("level")?"courseLevel":"publicationStatus";setMetadataFilters(p=>({...p,[key]:e.target.value}));setCurrentPage(1);}} className="h-8 w-full rounded border bg-background px-2 text-xs"><option value="">All</option>{Array.from(new Set((filterMetadata.data||[]).map(c=>String(c[label==="Category"?"category":label.toLowerCase().includes("level")?"courseLevel":"publicationStatus"]||"")).filter(Boolean))).sort().map(v=><option key={v} value={v}>{v}</option>)}</select>
                </div>)}

                {/* Filter: Active Status */}
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                    Active Status
                  </span>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="h-8 text-xs bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
                      <SelectItem value="ALL" className="text-xs">
                        All Statuses
                      </SelectItem>
                      <SelectItem value="Active" className="text-xs">
                        Active
                      </SelectItem>
                      <SelectItem value="Inactive" className="text-xs">
                        Inactive
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </PopoverContent>
            </Popover>

            {/* Search Input */}
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
              <input
                type="text"
                aria-label="Search courses"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-zinc-600 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Grid/View Toggle Button */}
            <button
              type="button"
              aria-label="Toggle grid or table view"
              title={viewMode === "table" ? "Switch to Cards Grid" : "Switch to Data Table"}
              onClick={() => setViewMode(viewMode === "table" ? "grid" : "table")}
              className={`h-9 w-9 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                viewMode === "grid"
                  ? "bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100"
                  : "text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800"
              }`}
            >
              {viewMode === "table" ? (
                <LayoutGrid className="w-4 h-4" />
              ) : (
                <TableIcon className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Right Group */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Import Button (triggers Excel .xlsx upload) */}
            <button
              type="button"
              disabled={!canCreate || busy}
              onClick={() => setIsImportOpen(true)}
              className="h-9 px-3.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium flex items-center gap-1.5 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import</span>
            </button>

            {/* Export Button */}
            <button
              type="button"
              onClick={() => setIsImportExportOpen(true)}
              className="h-9 px-3.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium flex items-center gap-1.5 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>

            {/* Create Button */}
            <button
              type="button"
              disabled={!canCreate || busy}
              onClick={() => {
                setEditingCourse(null);
                setIsCourseModalOpen(true);
              }}
              className="h-9 px-4 rounded-lg bg-slate-900 text-white hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create</span>
            </button>
          </div>
        </div>

        {/* Active Filter Chips */}
        {activeFiltersCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 pb-1">
            <span className="text-xs text-slate-500 dark:text-zinc-400">Active filters:</span>
            {filterStatus !== "ALL" && (
              <Badge
                variant="secondary"
                className="text-xs gap-1 cursor-pointer"
                onClick={() => setFilterStatus("ALL")}
              >
                Status: {filterStatus} <X className="size-3" />
              </Badge>
            )}
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer ml-1"
            >
              Clear all
            </button>
          </div>
        )}

        {/* 3. COURSES DATA TABLE or CARD GRID */}
        {!canRead ? <p role="alert">You do not have permission to read courses.</p>
          : query.isPending ? <p role="status" className="rounded-xl border p-8 text-center">Loading courses...</p>
          : query.isError ? <div role="alert" className="rounded-xl border border-destructive/30 p-6"><p>{courseError(query.error)}</p><Button onClick={() => void query.refetch()} variant="outline">Try again</Button></div>
          : viewMode === "table" ? (
          <CourseTable
            courses={paginatedCourses}
            totalItems={totalItems}
            totalCoursesCount={totalItems}
            selectedIds={selectedIds}
            onToggleSelectRow={handleToggleSelectRow}
            onToggleSelectAll={handleToggleSelectAll}
            sortState={sortState}
            onSortChange={handleSortChange}
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            autoPageSize={autoPageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setAutoPageSize(newSize===0); if(newSize) setPageSize(newSize);
              setCurrentPage(1);
            }}
            onViewCourse={(c) => {
              setViewingCourse(c);
              setIsDetailModalOpen(true);
            }}
            onEditCourse={(c) => {
              setEditingCourse(c);
              setIsCourseModalOpen(true);
            }}
            onDeleteCourse={(c) => {
              setDeletingCourse(c);
              setIsDeleteDialogOpen(true);
            }}
            onToggleStatus={handleToggleStatus}
            canUpdate={canUpdate}
            canDelete={canDelete}
            busy={busy}
            onImportClick={canCreate ? () => setIsImportOpen(true) : undefined}
            onCreateClick={canCreate ? () => { setEditingCourse(null); setIsCourseModalOpen(true); } : undefined}
          />
        ) : (
          /* Cards Grid View (Secondary view) */
          <div className="space-y-4">
            {courses.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 p-16 text-center bg-white dark:bg-zinc-900/40">
                <div className="flex flex-col items-center justify-center max-w-md mx-auto space-y-3">
                  <div className="size-12 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-400 dark:text-zinc-500">
                    <GraduationCap className="size-6" />
                  </div>
                  <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                    No courses available. Click 'Import' to upload an .xlsx file or '+ Create' to add a new course.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={!canCreate || busy}
              onClick={() => setIsImportOpen(true)}
                      className="h-8 px-3.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Import .xlsx</span>
                    </button>
                    <button
                      type="button"
                      disabled={!canCreate || busy}
                      onClick={() => {
                        setEditingCourse(null);
                        setIsCourseModalOpen(true);
                      }}
                      className="h-8 px-3 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium flex items-center gap-1.5 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Create</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : paginatedCourses.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 p-12 text-center text-xs text-slate-400">
                No courses found matching your criteria.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {paginatedCourses.map((course) => {
                    const courseTitle = course.courseName || course.name;
                    return (
                      <div
                        key={course.id}
                        className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 overflow-hidden flex flex-col shadow-xs hover:shadow-md transition-shadow"
                      >
                        <div className="relative h-40 bg-slate-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
                          {course.thumbnailUrl ? (
                            <img
                              src={course.thumbnailUrl}
                              alt={courseTitle}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <GraduationCap className="size-16 text-slate-300 dark:text-zinc-600" />
                          )}
                          <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/95 text-slate-700 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700">
                            {course.category}
                          </span>
                          <span className="absolute top-2.5 right-2.5 text-[11px] px-2 py-0.5 rounded font-medium bg-slate-900/80 text-white">
                            {course.courseLevel}
                          </span>
                        </div>

                        <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                          <div>
                            <h3
                              className="font-semibold text-sm text-slate-900 dark:text-zinc-100 line-clamp-1 cursor-pointer hover:underline"
                              onClick={() => {
                                setViewingCourse(course);
                                setIsDetailModalOpen(true);
                              }}
                            >
                              {courseTitle}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                              By {course.instructor}
                            </p>
                            <p className="text-xs text-slate-600 dark:text-zinc-300 line-clamp-2 mt-2">
                              {course.description}
                            </p>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800">
                            <span className="text-[11px] text-slate-400 font-mono">
                              {course.createdAt}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                title="View Details"
                                onClick={() => {
                                  setViewingCourse(course);
                                  setIsDetailModalOpen(true);
                                }}
                                className="w-7 h-7 rounded-md border border-slate-200 dark:border-zinc-700/80 bg-transparent hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 flex items-center justify-center cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                title="Edit Course"
                                disabled={!canUpdate || busy}
                                onClick={() => {
                                  setEditingCourse(course);
                                  setIsCourseModalOpen(true);
                                }}
                                className="w-7 h-7 rounded-md border border-slate-200 dark:border-zinc-700/80 bg-transparent hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 flex items-center justify-center cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                title="Delete Course"
                                disabled={!canDelete || busy}
                                onClick={() => {
                                  setDeletingCourse(course);
                                  setIsDeleteDialogOpen(true);
                                }}
                                className="w-7 h-7 rounded-md border border-red-500/20 dark:border-red-900/50 bg-red-500/5 hover:bg-red-500/15 text-red-500 flex items-center justify-center cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination for Grid view */}
                <div className="flex items-center justify-between px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 text-xs text-slate-500 dark:text-zinc-400">
                  <div>
                    Showing <strong className="font-semibold text-slate-900 dark:text-zinc-100">{paginatedCourses.length}</strong> of{" "}
                    <strong className="font-semibold text-slate-900 dark:text-zinc-100">{totalItems}</strong> courses
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => p - 1)}
                      className="text-xs h-8"
                    >
                      Previous
                    </Button>
                    <span>
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => p + 1)}
                      className="text-xs h-8"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Modal: Create & Edit Course */}
        <CourseModal
          open={isCourseModalOpen}
          onOpenChange={setIsCourseModalOpen}
          course={editingCourse}
          onSave={handleSaveCourse}
        />

        {/* Modal: View Course Details */}
        <CourseDetailModal
          open={isDetailModalOpen}
          onOpenChange={setIsDetailModalOpen}
          course={viewingCourse}
        />

        {/* Modal: Delete Confirmation */}
        <DeleteConfirmDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          course={deletingCourse}
          onConfirm={handleDeleteCourse}
        />

        <ImportModal open={isImportOpen} onOpenChange={setIsImportOpen} title="Import Course" canImport={canCreate}
          table={{schema:{entityName:"course"},importFile:async(file:File)=>{
            let preview:ImportPreview;
            if(file.name.toLowerCase().endsWith(".csv")){
              const wb=XLSX.read(await file.arrayBuffer(),{type:"array"});preview=previewCourseRows(XLSX.utils.sheet_to_json<Record<string,unknown>>(wb.Sheets[wb.SheetNames[0]],{defval:""}));
            }else preview=previewCourseWorkbook(await file.arrayBuffer());
            const imported=await handleImport(preview);
            return {successCount:imported.imported,updatedCount:imported.updated||0,skippedCount:imported.skipped,failureCount:imported.failed,errors:imported.rows.filter(r=>r.status==="failed"||r.status==="not attempted").map(r=>({rowNumber:r.row,message:r.message||"Import failed"}))};
          }}}
          onImportSuccess={value=>{setResult(value);setResultOpen(true);}}
          onDownloadTemplate={async()=>{
            const wb=courseWorkbook([]);
            XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([["Course Name","Section Title","Order Index","Active"]]),"Sections");
            XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([["Course Name","Section Title","Lesson Title","Content Type","Content URL","Text Content","Duration (seconds)","Order Index","Active"]]),"Lessons");
            XLSX.writeFile(wb,"course-import-template.xlsx");
          }} />
        <ImportResultModal open={resultOpen} onOpenChange={setResultOpen} result={result} onBackToImport={()=>{setResultOpen(false);setIsImportOpen(true);}} />
        <ExportModal open={isImportExportOpen} onOpenChange={setIsImportExportOpen} title="Export Course" canExport={canRead}
          table={{schema:{entityName:"course"},exportFile:async(format:FileFormat)=>{
            if(format==="CSV"){
              const rows=await courseData.all();downloadBlob(new Blob([XLSX.utils.sheet_to_csv(courseWorkbook(rows).Sheets.Courses)],{type:"text/csv;charset=utf-8"}),"courses.csv");
            }else{
              const response=await axios.get(format==="EXCEL"?"/courses/export-bundle":"/courses/export",{params:format==="EXCEL"?undefined:{format},responseType:"blob"});downloadBlob(response.data,format==="EXCEL"?"course-bundle.xlsx":"courses.pdf");
            }
          }}} />
      </div>
    </MainLayout>
  );
}
