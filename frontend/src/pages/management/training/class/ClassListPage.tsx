import {
    ArrowDown,
    ArrowUp,
    CalendarDays,
    ChevronsUpDown,
    Download,
    Eye,
    GraduationCap,
    HelpCircle,
    ListChecks,
    MoreHorizontal,
    Pencil,
    Plus,
    RefreshCw,
    Search,
    SlidersHorizontal,
    Trash2,
    Upload,
    X,
    AlertTriangle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import { ApiErrorState } from "@/components/common/ApiErrorState";
import { NativeSelect } from "@/components/common/NativeSelect";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useClasses } from "@/hooks/useClasses";
import { clsApi } from "@/api/features/cls.api";
import { cn } from "@/lib/utils";
import type { ExternalClass } from "@/types";
import {
    classTitle,
    countActiveFilters,
    filterClasses,
    getClassStatusMeta,
    paginate,
    programLabel,
    sortClasses,
    type ClassSortKey,
} from "@/utils/class.utils";
import { formatDate } from "@/utils/session.utils";
import { ClassStatusBadge } from "./components/ClassStatusBadge";
import { ClassModal } from "./components/ClassModal";
import { ClassImportModal } from "./components/ClassImportModal";
import { PAGE_SIZES, useClassListState, type ClassListState } from "./useClassListState";

const UNAVAILABLE_TITLE = "Not provided by the master training system";

function Unavailable() {
    return (
        <span className="text-muted-foreground" title={UNAVAILABLE_TITLE}>
            —
        </span>
    );
}

function SortHead({
    label,
    sortKey,
    state,
    onSort,
}: {
    label: string;
    sortKey: ClassSortKey;
    state: Pick<ClassListState, "sortKey" | "sortDirection">;
    onSort: (key: ClassSortKey) => void;
}) {
    const active = state.sortKey === sortKey;
    const Icon = !active ? ChevronsUpDown : state.sortDirection === "asc" ? ArrowUp : ArrowDown;

    return (
        <TableHead aria-sort={active ? (state.sortDirection === "asc" ? "ascending" : "descending") : "none"}>
            <button
                type="button"
                onClick={() => onSort(sortKey)}
                className="inline-flex items-center gap-1.5 rounded-sm py-2 hover:text-blue-800 focus-visible:outline-2 dark:hover:text-blue-300"
            >
                {label}
                <Icon className={cn("size-3.5", !active && "text-muted-foreground")} aria-hidden />
            </button>
        </TableHead>
    );
}

function RowActions({
    item,
    listSearch,
    onEdit,
    onDelete,
}: {
    item: ExternalClass;
    listSearch: string;
    onEdit: (item: ExternalClass) => void;
    onDelete: (item: ExternalClass) => void;
}) {
    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${classTitle(item)}`}>
                    <MoreHorizontal />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                    <Link to={`/classes/${item.id}`} state={{ listSearch }}>
                        <Eye className="size-4 mr-2" /> View details
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <Link to={`/classes/${item.id}?tab=calendar`} state={{ listSearch }}>
                        <CalendarDays className="size-4 mr-2" /> View calendar
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <Link to={`/sessions?classId=${item.id}`}>
                        <ListChecks className="size-4 mr-2" /> View sessions
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onEdit(item)} className="cursor-pointer">
                    <Pencil className="size-4 mr-2 text-blue-600" /> Chỉnh sửa lớp
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => onDelete(item)}
                    className="cursor-pointer text-red-600 focus:text-red-600 dark:text-red-400"
                >
                    <Trash2 className="size-4 mr-2" /> Xóa lớp học
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function ClassTableSkeleton() {
    return (
        <div role="status" aria-busy="true" aria-label="Loading classes" className="divide-y">
            {Array.from({ length: 8 }, (_, row) => (
                <div key={row} className="flex items-center gap-6 px-4 py-4">
                    <Skeleton className="h-5 w-8" />
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-28" />
                    <Skeleton className="ml-auto h-6 w-28 rounded-full" />
                </div>
            ))}
        </div>
    );
}

function EmptyState({ filtered, onClear, onCreate }: { filtered: boolean; onClear: () => void; onCreate: () => void }) {
    return (
        <div className="flex flex-col items-center gap-3 px-6 py-14 text-center text-muted-foreground">
            <GraduationCap className="size-8" aria-hidden />
            <p className="text-sm">
                {filtered ? "No classes match your search or filters." : "The master training system has no classes yet."}
            </p>
            {filtered ? (
                <Button variant="outline" size="sm" onClick={onClear} aria-label="Clear search and filters">
                    Clear search and filters
                </Button>
            ) : (
                <Button size="sm" onClick={onCreate} className="bg-blue-800 hover:bg-blue-900 text-white gap-1.5">
                    <Plus className="size-4" /> Tạo lớp học đầu tiên
                </Button>
            )}
        </div>
    );
}

export default function ClassListPage() {
    const list = useClassListState();
    const classes = useClasses();
    const { state } = list;
    const { filters, sortKey, sortDirection, page, pageSize } = state;
    const data = classes.data;

    // Modals state
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [editingClass, setEditingClass] = useState<ExternalClass | null>(null);

    // Delete confirmation state
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deletingClass, setDeletingClass] = useState<ExternalClass | null>(null);
    const [deleteError, setDeleteError] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);

    // Selected rows state
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    const statusChoices = useMemo(
        () => [...new Set((data ?? []).map((item) => getClassStatusMeta(item.status).label))].sort(),
        [data],
    );
    const programChoices = useMemo(
        () =>
            [...new Set((data ?? []).map((item) => item.programId).filter((value): value is number => value != null))].sort(
                (a, b) => a - b,
            ),
        [data],
    );
    const visible = useMemo(
        () => sortClasses(filterClasses(data ?? [], filters), sortKey, sortDirection),
        [data, filters, sortKey, sortDirection],
    );

    const slice = paginate(visible, page, pageSize);
    const activeFilterCount = countActiveFilters(filters);
    const hasCriteria = activeFilterCount > 0 || filters.search.trim() !== "";

    const countText = classes.isPending
        ? "Loading…"
        : classes.isError
          ? "Could not load"
          : `${visible.length} ${visible.length === 1 ? "class" : "classes"}${
                data && visible.length !== data.length ? ` of ${data.length}` : ""
            }`;

    // Export to Excel function
    const handleExportExcel = () => {
        const exportData = (visible.length > 0 ? visible : (data ?? [])).map((item, index) => ({
            "STT": index + 1,
            "Mã lớp (Class Code)": item.code || "",
            "Tên lớp (Class Name)": item.name || item.code || "",
            "Khu vực (Site)": item.site || "HCM",
            "Đối tượng (Trainee Type)": item.traineeType || "Fresher",
            "Chương trình đào tạo (Program)": item.program || programLabel(item.programId),
            "Quản lý lớp (Class Admin)": item.classAdmin || "—",
            "Sĩ số học viên (Trainees)": item.enrolledTrainees != null ? `${item.enrolledTrainees} / ${item.plannedSize ?? "—"}` : `— / ${item.plannedSize ?? "—"}`,
            "Ngày bắt đầu (Start Date)": item.startDate ? formatDate(item.startDate) : "—",
            "Ngày kết thúc (End Date)": item.endDate ? formatDate(item.endDate) : "—",
            "Giảng viên chính (Master Trainer)": item.masterTrainer || "—",
            "Trạng thái (Status)": getClassStatusMeta(item.status).label,
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Class List");
        const today = new Date().toISOString().split("T")[0];
        XLSX.writeFile(wb, `FAMS_Danh_Sach_Lop_Hoc_${today}.xlsx`);
    };

    // Edit handler
    const handleOpenEdit = (item: ExternalClass) => {
        setEditingClass(item);
        setEditModalOpen(true);
    };

    // Delete handler
    const handleOpenDelete = (item: ExternalClass) => {
        setDeletingClass(item);
        setDeleteError("");
        setDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!deletingClass) return;

        // Business Rule 5: Cannot delete active, completed or class with enrolled students
        if (deletingClass.enrolledTrainees && deletingClass.enrolledTrainees > 0) {
            setDeleteError(`Quy tắc xóa: Không thể xóa lớp '${deletingClass.code}' vì đã có ${deletingClass.enrolledTrainees} học viên.`);
            return;
        }
        if (deletingClass.status === "active" || deletingClass.status === "completed") {
            setDeleteError(`Quy tắc xóa: Không thể xóa lớp học đang ở trạng thái '${getClassStatusMeta(deletingClass.status).label}'.`);
            return;
        }

        setIsDeleting(true);
        try {
            await clsApi.deleteClass(deletingClass.id);
            setDeleteModalOpen(false);
            classes.refetch();
        } catch (err: any) {
            setDeleteError(err.response?.data?.message || err.message || "Lỗi khi xóa lớp học.");
        } finally {
            setIsDeleting(false);
        }
    };

    // Toggle select all
    const handleToggleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(new Set(slice.items.map(item => item.id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    // Toggle single row select
    const handleToggleSelect = (id: number, checked: boolean) => {
        const next = new Set(selectedIds);
        if (checked) {
            next.add(id);
        } else {
            next.delete(id);
        }
        setSelectedIds(next);
    };

    return (
        <MainLayout pathName={{ classes: "Class List" }}>
            <section className="w-full min-w-0 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
                <header className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg font-semibold">Class List</h1>
                            <span title="Quản lý danh sách lớp học đào tạo FAMS">
                                <HelpCircle className="size-4 text-muted-foreground" aria-hidden />
                            </span>
                        </div>
                        <p className="text-sm text-muted-foreground" aria-live="polite">
                            {countText}
                        </p>
                    </div>

                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                        {/* Search Input */}
                        <div className="relative min-w-[12rem] flex-1 sm:w-60 sm:flex-none">
                            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                            <Input
                                aria-label="Search classes"
                                placeholder="Search classes..."
                                value={filters.search}
                                onChange={(event) => list.setSearch(event.target.value)}
                                className="px-9"
                            />
                            {filters.search && (
                                <button
                                    type="button"
                                    aria-label="Clear search"
                                    onClick={() => list.setSearch("")}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground"
                                >
                                    <X className="size-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Filter Popover */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline">
                                    <SlidersHorizontal /> Filter
                                    {activeFilterCount > 0 && <Badge className="bg-blue-800 text-white">{activeFilterCount}</Badge>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-80 space-y-4">
                                <div className="grid gap-1.5">
                                    <Label htmlFor="class-filter-status">Status</Label>
                                    <NativeSelect
                                        id="class-filter-status"
                                        value={filters.status}
                                        onChange={(event) => list.setFilters({ status: event.target.value })}
                                    >
                                        <option value="">All statuses</option>
                                        {statusChoices.map((choice) => (
                                            <option key={choice} value={choice}>
                                                {choice}
                                            </option>
                                        ))}
                                    </NativeSelect>
                                </div>
                                <div className="grid gap-1.5">
                                    <Label htmlFor="class-filter-program">Program</Label>
                                    <NativeSelect
                                        id="class-filter-program"
                                        value={filters.programId}
                                        onChange={(event) => list.setFilters({ programId: event.target.value })}
                                    >
                                        <option value="">All programs</option>
                                        {programChoices.map((id) => (
                                            <option key={id} value={String(id)}>
                                                {programLabel(id)}
                                            </option>
                                        ))}
                                    </NativeSelect>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="class-filter-from">Start date from</Label>
                                        <Input
                                            id="class-filter-from"
                                            type="date"
                                            value={filters.startFrom}
                                            onChange={(event) => list.setFilters({ startFrom: event.target.value })}
                                        />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="class-filter-to">Start date to</Label>
                                        <Input
                                            id="class-filter-to"
                                            type="date"
                                            value={filters.startTo}
                                            onChange={(event) => list.setFilters({ startTo: event.target.value })}
                                        />
                                    </div>
                                </div>
                                <Button variant="ghost" size="sm" className="w-full" disabled={!hasCriteria} onClick={list.clearFilters}>
                                    Clear search and filters
                                </Button>
                            </PopoverContent>
                        </Popover>

                        {/* Reload Button */}
                        <Button
                            variant="outline"
                            size="icon"
                            aria-label="Refresh class list"
                            title="Reload from the master training system"
                            disabled={classes.isFetching}
                            onClick={() => void classes.refetch()}
                        >
                            <RefreshCw className={cn(classes.isFetching && "animate-spin")} />
                        </Button>

                        {/* Export Button */}
                        <Button
                            variant="outline"
                            onClick={handleExportExcel}
                            title="Xuất danh sách lớp ra file Excel"
                            className="gap-1.5"
                        >
                            <Download className="size-4 text-emerald-600" /> Export
                        </Button>

                        {/* Import Button */}
                        <Button
                            variant="outline"
                            onClick={() => setImportModalOpen(true)}
                            title="Nhập danh sách lớp từ file Excel"
                            className="gap-1.5"
                        >
                            <Upload className="size-4 text-blue-600" /> Import
                        </Button>

                        {/* Create Class Button */}
                        <Button
                            onClick={() => setCreateModalOpen(true)}
                            className="bg-blue-800 hover:bg-blue-900 text-white gap-1.5"
                        >
                            <Plus className="size-4" /> Create Class
                        </Button>
                    </div>
                </header>

                {classes.isError ? (
                    <ApiErrorState error={classes.error} resource="class list" onRetry={() => void classes.refetch()} />
                ) : classes.isPending ? (
                    <ClassTableSkeleton />
                ) : !data || data.length === 0 ? (
                    <EmptyState filtered={false} onClear={list.clearFilters} onCreate={() => setCreateModalOpen(true)} />
                ) : visible.length === 0 ? (
                    <EmptyState filtered onClear={list.clearFilters} onCreate={() => setCreateModalOpen(true)} />
                ) : (
                    <>
                        <Table aria-label="Classes" className="min-w-[1100px] [&_td]:px-4 [&_td]:py-3 [&_th]:px-4">
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="w-10">
                                        <Checkbox
                                            checked={slice.items.length > 0 && slice.items.every(item => selectedIds.has(item.id))}
                                            onCheckedChange={(checked) => handleToggleSelectAll(Boolean(checked))}
                                            aria-label="Select all classes on page"
                                        />
                                    </TableHead>
                                    <TableHead className="w-12">#</TableHead>
                                    <SortHead label="Class" sortKey="code" state={state} onSort={list.toggleSort} />
                                    <TableHead>Site</TableHead>
                                    <TableHead>Trainee Type</TableHead>
                                    <SortHead label="Program" sortKey="program" state={state} onSort={list.toggleSort} />
                                    <TableHead>Class Admin</TableHead>
                                    <SortHead label="Trainees" sortKey="trainees" state={state} onSort={list.toggleSort} />
                                    <SortHead label="Start Date" sortKey="startDate" state={state} onSort={list.toggleSort} />
                                    <TableHead>Master Trainer</TableHead>
                                    <SortHead label="Status" sortKey="status" state={state} onSort={list.toggleSort} />
                                    <TableHead className="w-20 text-center">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {slice.items.map((item, index) => (
                                    <TableRow key={item.id} className={selectedIds.has(item.id) ? "bg-muted/30" : ""}>
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedIds.has(item.id)}
                                                onCheckedChange={(checked) => handleToggleSelect(item.id, Boolean(checked))}
                                                aria-label={`Select ${classTitle(item)}`}
                                            />
                                        </TableCell>
                                        <TableCell className="text-muted-foreground font-medium">{slice.from + index}</TableCell>
                                        <TableCell>
                                            <Link
                                                to={`/classes/${item.id}`}
                                                state={{ listSearch: list.queryString }}
                                                className="font-medium text-blue-800 hover:underline dark:text-blue-300"
                                            >
                                                {classTitle(item)}
                                            </Link>
                                            {item.code && item.name && item.code !== item.name ? (
                                                <div className="max-w-64 truncate text-xs text-muted-foreground">{item.name}</div>
                                            ) : null}
                                        </TableCell>
                                        <TableCell>
                                            {item.site || <Unavailable />}
                                        </TableCell>
                                        <TableCell>
                                            {item.traineeType || <Unavailable />}
                                        </TableCell>
                                        <TableCell>{item.program || programLabel(item.programId)}</TableCell>
                                        <TableCell>
                                            {item.classAdmin || <Unavailable />}
                                        </TableCell>
                                        <TableCell>
                                            {item.enrolledTrainees != null ? (
                                                <span className="font-semibold text-foreground">
                                                    {item.enrolledTrainees} / {item.plannedSize ?? "—"}
                                                </span>
                                            ) : item.plannedSize != null ? (
                                                <>
                                                    <span className="text-muted-foreground" title="Enrolled trainees are not provided by the master training system">
                                                        —
                                                    </span>{" "}
                                                    / {item.plannedSize}
                                                </>
                                            ) : (
                                                <Unavailable />
                                            )}
                                        </TableCell>
                                        <TableCell>{item.startDate ? formatDate(item.startDate) : <Unavailable />}</TableCell>
                                        <TableCell>
                                            {item.masterTrainer || <Unavailable />}
                                        </TableCell>
                                        <TableCell>
                                            <ClassStatusBadge status={item.status} />
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <RowActions
                                                item={item}
                                                listSearch={list.queryString}
                                                onEdit={handleOpenEdit}
                                                onDelete={handleOpenDelete}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>

                        <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm sm:px-5">
                            <p className="text-muted-foreground" aria-live="polite">
                                Showing {slice.from}–{slice.to} of {visible.length} {visible.length === 1 ? "class" : "classes"}
                            </p>
                            <div className="flex flex-wrap items-center gap-3">
                                <label className="flex items-center gap-2 text-muted-foreground">
                                    Rows per page
                                    <NativeSelect
                                        className="h-8 w-[4.5rem]"
                                        value={pageSize}
                                        onChange={(event) => list.setPageSize(Number(event.target.value))}
                                    >
                                        {PAGE_SIZES.map((size) => (
                                            <option key={size} value={size}>
                                                {size}
                                            </option>
                                        ))}
                                    </NativeSelect>
                                </label>
                                <span className="text-muted-foreground">
                                    Page {slice.page + 1} of {slice.totalPages}
                                </span>
                                <div className="flex gap-1">
                                    <Button variant="outline" size="sm" disabled={slice.page === 0} onClick={() => list.setPage(slice.page - 1)}>
                                        Previous
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={slice.page + 1 >= slice.totalPages}
                                        onClick={() => list.setPage(slice.page + 1)}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        </footer>
                    </>
                )}
            </section>

            {/* Create Class Modal */}
            <ClassModal
                open={createModalOpen}
                onOpenChange={setCreateModalOpen}
                classItem={null}
                existingClasses={data ?? []}
                onSuccess={() => classes.refetch()}
            />

            {/* Edit Class Modal */}
            <ClassModal
                open={editModalOpen}
                onOpenChange={setEditModalOpen}
                classItem={editingClass}
                existingClasses={data ?? []}
                onSuccess={() => classes.refetch()}
            />

            {/* Import Classes Modal */}
            <ClassImportModal
                open={importModalOpen}
                onOpenChange={setImportModalOpen}
                onSuccess={() => classes.refetch()}
            />

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold flex items-center gap-2 text-red-600 dark:text-red-400">
                            <AlertTriangle className="size-5" /> Xác nhận xóa lớp học
                        </DialogTitle>
                        <DialogDescription className="text-sm pt-2">
                            Bạn có chắc chắn muốn xóa lớp học <strong>{deletingClass?.code}</strong> ({deletingClass?.name}) không?
                            Hành động này sẽ không thể khôi phục.
                        </DialogDescription>
                    </DialogHeader>

                    {deleteError && (
                        <div className="p-3 text-xs rounded-lg bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300">
                            {deleteError}
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0 pt-3">
                        <Button variant="outline" onClick={() => setDeleteModalOpen(false)} disabled={isDeleting}>
                            Hủy
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleConfirmDelete}
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {isDeleting ? "Đang xóa..." : "Xóa vĩnh viễn"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </MainLayout>
    );
}
