import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Eye, MoreVertical, Pencil, RotateCcw, Save, Search, Trash2, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { utils, writeFile } from "xlsx";
import {
    type TraineeBatchPayload,
    type TraineeFormInput,
    traineeService,
} from "@/api/features/trainee.api";
import { ApiErrorState } from "@/components/common/ApiErrorState";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { externalKeys, useClassTrainees } from "@/hooks/useExternalLookups";
import { cn } from "@/lib/utils";
import type { ExternalClass, Trainee } from "@/types";
import { formatDate, splitLocalDateTime } from "@/utils/session.utils";
import {
    formatFptStudentIdForSite,
    normalizeTraineeGender,
    normalizeTraineeStatus,
    resolveTraineeStatusBadge,
    TraineeModal,
    type TraineeModalMode,
} from "./TraineeModal";

function formatDob(dob?: string) {
    if (!dob || !dob.trim()) return "";
    return formatDate(dob);
}

function isSameTrainee(baseline: Trainee | undefined, candidate: Trainee, site?: string): boolean {
    if (!baseline) return false;

    const baseDob = baseline.dob ? splitLocalDateTime(baseline.dob).date : "";
    const candDob = candidate.dob ? splitLocalDateTime(candidate.dob).date : "";
    const baseStudentId = formatFptStudentIdForSite(
        baseline.fptAccount ?? baseline.code,
        site,
        baseline.id,
    );
    const candStudentId = formatFptStudentIdForSite(
        candidate.fptAccount ?? candidate.code,
        site,
        candidate.id,
    );

    return (
        (baseline.fullName ?? "").trim() === (candidate.fullName ?? "").trim() &&
        baseStudentId === candStudentId &&
        (baseline.personalEmail ?? baseline.email ?? "").trim() ===
            (candidate.personalEmail ?? candidate.email ?? "").trim() &&
        (baseline.nationalId ?? "").trim() === (candidate.nationalId ?? "").trim() &&
        (baseline.employeeId ?? "").trim() === (candidate.employeeId ?? "").trim() &&
        (baseline.accessCardId ?? "").trim() === (candidate.accessCardId ?? "").trim() &&
        baseDob === candDob &&
        normalizeTraineeGender(baseline.gender) === normalizeTraineeGender(candidate.gender) &&
        normalizeTraineeStatus(baseline.status) === normalizeTraineeStatus(candidate.status)
    );
}

function toFormInput(trainee: Trainee, site?: string): TraineeFormInput {
    return {
        fullName: (trainee.fullName ?? "").trim(),
        fptAccount: formatFptStudentIdForSite(trainee.fptAccount ?? trainee.code, site, trainee.id),
        personalEmail: (trainee.personalEmail ?? trainee.email ?? "").trim(),
        nationalId: (trainee.nationalId ?? "").trim(),
        employeeId: (trainee.employeeId ?? "").trim(),
        accessCardId: (trainee.accessCardId ?? "").trim(),
        dob: trainee.dob ? splitLocalDateTime(trainee.dob).date : "",
        gender: normalizeTraineeGender(trainee.gender),
        status: normalizeTraineeStatus(trainee.status),
    };
}

export interface TraineeListTabProps {
    classItem: ExternalClass;
    onDirtyChange?: (isDirty: boolean) => void;
}

export function TraineeListTab({ classItem, onDirtyChange }: TraineeListTabProps) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const classId = String(classItem.id);
    const classSite = classItem.site;
    const { data: serverTrainees = [], isPending, isError, error, refetch } = useClassTrainees(classId);

    // Local staging state: null means synchronized with serverTrainees
    const [draftTrainees, setDraftTrainees] = useState<Trainee[] | null>(null);
    const [search, setSearch] = useState("");
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    // Modal state for Create / Edit / View Profile
    const [modalState, setModalState] = useState<{
        open: boolean;
        mode: TraineeModalMode;
        trainee: Trainee | null;
    }>({
        open: false,
        mode: "create",
        trainee: null,
    });

    // Confirmation dialog state for single row Delete & Bulk Delete
    const [deleteTarget, setDeleteTarget] = useState<Trainee | null>(null);
    const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

    const activeTrainees = draftTrainees ?? serverTrainees;

    const selectedTrainees = useMemo(
        () => activeTrainees.filter((trainee) => selectedIds.has(trainee.id)),
        [activeTrainees, selectedIds],
    );
    const selectedCount = selectedTrainees.length;

    const pendingChanges = useMemo(() => {
        if (draftTrainees === null) {
            return {
                created: [] as TraineeFormInput[],
                updated: [] as Trainee[],
                deletedIds: [] as number[],
                updatedIdSet: new Set<number>(),
                total: 0,
            };
        }

        const baselineById = new Map(serverTrainees.map((item) => [item.id, item]));
        const draftIdSet = new Set(draftTrainees.map((item) => item.id));

        const created = draftTrainees.filter((item) => item.id < 0).map((item) => toFormInput(item, classSite));
        const updated = draftTrainees
            .filter((item) => item.id > 0 && !isSameTrainee(baselineById.get(item.id), item, classSite))
            .map((item) => {
                const studentId = formatFptStudentIdForSite(item.fptAccount ?? item.code, classSite, item.id);
                return {
                    ...item,
                    code: studentId,
                    fptAccount: studentId,
                };
            });
        const deletedIds = serverTrainees
            .filter((item) => !draftIdSet.has(item.id))
            .map((item) => item.id);

        return {
            created,
            updated,
            deletedIds,
            updatedIdSet: new Set(updated.map((item) => item.id)),
            total: created.length + updated.length + deletedIds.length,
        };
    }, [classSite, draftTrainees, serverTrainees]);

    const hasUnsavedChanges = pendingChanges.total > 0;

    useEffect(() => {
        onDirtyChange?.(hasUnsavedChanges);
    }, [hasUnsavedChanges, onDirtyChange]);

    useEffect(() => {
        return () => {
            onDirtyChange?.(false);
        };
    }, [onDirtyChange]);

    useEffect(() => {
        if (!hasUnsavedChanges) return;
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [hasUnsavedChanges]);

    const saveMutation = useMutation({
        mutationFn: (payload: TraineeBatchPayload) => traineeService.batchUpdate(classId, payload),
        onSuccess: (response) => {
            queryClient.setQueryData(externalKeys.classTrainees(classId), response.trainees);
            void queryClient.invalidateQueries({ queryKey: externalKeys.classTrainees(classId) });
            void queryClient.invalidateQueries({ queryKey: externalKeys.class(classId) });
            void queryClient.invalidateQueries({ queryKey: externalKeys.classes });
            setDraftTrainees(null);
            setSelectedIds(new Set());
            toast.success("Trainee changes saved successfully!");
        },
        onError: (err: unknown) => {
            const message =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                "Failed to save trainee changes. Please try again.";
            toast.error(message);
        },
    });

    const filteredTrainees = useMemo(() => {
        const keyword = search.trim().toLowerCase();
        if (!keyword) return activeTrainees;

        return activeTrainees.filter((trainee) => {
            const studentId = formatFptStudentIdForSite(
                trainee.fptAccount ?? trainee.code,
                classSite,
                trainee.id,
            );
            return [
                trainee.fullName,
                studentId,
                trainee.fptAccount ?? trainee.code,
                trainee.personalEmail ?? trainee.email,
                trainee.nationalId,
                formatDob(trainee.dob),
                trainee.gender,
                trainee.status,
            ].some((field) => String(field ?? "").toLowerCase().includes(keyword));
        });
    }, [activeTrainees, classSite, search]);

    const selectedVisibleCount = useMemo(
        () => filteredTrainees.filter((trainee) => selectedIds.has(trainee.id)).length,
        [filteredTrainees, selectedIds],
    );

    const selectAllState: boolean | "indeterminate" =
        filteredTrainees.length > 0 && selectedVisibleCount === filteredTrainees.length
            ? true
            : selectedVisibleCount > 0
              ? "indeterminate"
              : false;

    const handleToggleAll = (checked: boolean) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            for (const trainee of filteredTrainees) {
                if (checked) next.add(trainee.id);
                else next.delete(trainee.id);
            }
            return next;
        });
    };

    const handleToggleRow = (id: number, checked: boolean) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
        });
    };

    const handleOpenCreate = () => {
        setModalState({ open: true, mode: "create", trainee: null });
    };

    const handleOpenEdit = (trainee: Trainee) => {
        setModalState({ open: true, mode: "edit", trainee });
    };

    const handleOpenView = (trainee: Trainee) => {
        setModalState({ open: true, mode: "view", trainee });
    };

    const handleModalSubmit = (values: TraineeFormInput) => {
        const currentList = draftTrainees ?? serverTrainees;
        const normalizedStudentId = values.fptAccount.trim().toUpperCase();

        if (modalState.mode === "create") {
            const tempId = Math.min(0, ...currentList.map((item) => item.id)) - 1;
            const stagedTrainee: Trainee = {
                id: tempId,
                code: normalizedStudentId,
                fptAccount: normalizedStudentId,
                fullName: values.fullName,
                personalEmail: values.personalEmail,
                email: values.personalEmail,
                nationalId: values.nationalId,
                employeeId: values.employeeId ?? "",
                accessCardId: values.accessCardId ?? "",
                dob: values.dob ?? "",
                gender: values.gender,
                status: values.status,
            };
            setDraftTrainees([...currentList, stagedTrainee]);
        } else if (modalState.mode === "edit" && modalState.trainee) {
            const targetId = modalState.trainee.id;
            setDraftTrainees(
                currentList.map((item) =>
                    item.id === targetId
                        ? {
                              ...item,
                              code: normalizedStudentId,
                              fptAccount: normalizedStudentId,
                              fullName: values.fullName,
                              personalEmail: values.personalEmail,
                              email: values.personalEmail,
                              nationalId: values.nationalId,
                              employeeId: values.employeeId ?? "",
                              accessCardId: values.accessCardId ?? "",
                              dob: values.dob ?? "",
                              gender: values.gender,
                              status: values.status,
                          }
                        : item,
                ),
            );
        }

        setModalState((prev) => ({ ...prev, open: false }));
    };

    const handleConfirmDelete = () => {
        if (!deleteTarget) return;
        const currentList = draftTrainees ?? serverTrainees;
        const removedId = deleteTarget.id;

        setDraftTrainees(currentList.filter((item) => item.id !== removedId));
        setSelectedIds((prev) => {
            if (!prev.has(removedId)) return prev;
            const next = new Set(prev);
            next.delete(removedId);
            return next;
        });
        setDeleteTarget(null);
    };

    const handleConfirmBulkDelete = () => {
        if (selectedCount === 0) return;
        const currentList = draftTrainees ?? serverTrainees;
        setDraftTrainees(currentList.filter((item) => !selectedIds.has(item.id)));
        setSelectedIds(new Set());
        setBulkDeleteOpen(false);
        toast.info(
            `Removed ${selectedCount} selected ${selectedCount === 1 ? "trainee" : "trainees"} (staged). Click Save Changes to persist.`,
        );
    };

    const handleExportSelected = () => {
        if (selectedCount === 0) return;

        const rows = selectedTrainees.map((trainee, index) => ({
            "No.": index + 1,
            "Full Name": trainee.fullName ?? "",
            "FPT Student ID": formatFptStudentIdForSite(
                trainee.fptAccount || trainee.code,
                classSite,
                trainee.id,
            ),
            "Personal Email": trainee.personalEmail || trainee.email || "",
            "National ID": trainee.nationalId ?? "",
            DOB: formatDob(trainee.dob),
            Gender: trainee.gender ?? "",
            Status: resolveTraineeStatusBadge(trainee.status).label,
        }));

        const worksheet = utils.json_to_sheet(rows);
        const workbook = utils.book_new();
        utils.book_append_sheet(workbook, worksheet, "Selected Trainees");
        const fileName = `${classItem.code ?? `Class_${classId}`}_Selected_Trainees.xlsx`;
        writeFile(workbook, fileName);
        toast.success(`Exported ${selectedCount} selected ${selectedCount === 1 ? "trainee" : "trainees"} to ${fileName}`);
    };

    const handleDiscardChanges = () => {
        setDraftTrainees(null);
        setSelectedIds((prev) => {
            const validIds = new Set(serverTrainees.map((item) => item.id));
            const next = new Set<number>();
            for (const id of prev) {
                if (validIds.has(id)) next.add(id);
            }
            return next;
        });
        toast.info("Unsaved trainee changes discarded.");
    };

    const handleSaveChanges = () => {
        if (!hasUnsavedChanges || saveMutation.isPending) return;
        saveMutation.mutate({
            created: pendingChanges.created,
            updated: pendingChanges.updated,
            deletedIds: pendingChanges.deletedIds,
        });
    };

    const handleTopicMark = () => {
        const params = new URLSearchParams({
            classId,
            ...(classItem.code ? { classCode: classItem.code } : {}),
        });
        navigate(`/topic-marks?${params.toString()}`);
    };

    const handleAttendance = () => {
        toast.info(
            `Attendance for ${classItem.code ?? `Class #${classId}`} will be connected once the Attendance API is ready.`,
        );
    };

    if (isError) {
        return <ApiErrorState error={error} resource="trainee list" onRetry={() => void refetch()} />;
    }

    return (
        <div className="space-y-4">
            {/* Top Action Bar */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2.5">
                    <div className="relative w-full sm:w-72">
                        <Search
                            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                            aria-hidden
                        />
                        <Input
                            aria-label="Search trainees"
                            placeholder="Search trainees"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            className="pl-9"
                        />
                    </div>

                    {hasUnsavedChanges ? (
                        <Badge
                            variant="secondary"
                            className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                        >
                            {pendingChanges.total} unsaved {pendingChanges.total === 1 ? "change" : "changes"}
                        </Badge>
                    ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2.5 self-end sm:self-auto">
                    <Button
                        type="button"
                        onClick={handleOpenCreate}
                        disabled={isPending || saveMutation.isPending}
                        className="bg-[#283593] text-white hover:bg-[#1a237e] dark:bg-blue-600 dark:hover:bg-blue-500"
                    >
                        + Add Trainee
                    </Button>

                    <Button
                        type="button"
                        variant="outline"
                        disabled={selectedCount === 0 || isPending || saveMutation.isPending}
                        onClick={handleExportSelected}
                        className={cn(
                            selectedCount > 0 &&
                                "border-blue-600 text-blue-700 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-300 dark:hover:bg-blue-950/40",
                        )}
                    >
                        <Download className="size-4" aria-hidden />
                        <span>Export Selected</span>
                        {selectedCount > 0 ? (
                            <span className="ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-blue-100 px-1.5 text-xs font-semibold text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                {selectedCount}
                            </span>
                        ) : null}
                    </Button>

                    <Button
                        type="button"
                        variant={selectedCount > 0 ? "destructive" : "outline"}
                        disabled={selectedCount === 0 || isPending || saveMutation.isPending}
                        onClick={() => setBulkDeleteOpen(true)}
                    >
                        <Trash2 className="size-4" aria-hidden />
                        <span>Delete Selected</span>
                        {selectedCount > 0 ? (
                            <span className="ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-white/25 px-1.5 text-xs font-semibold">
                                {selectedCount}
                            </span>
                        ) : null}
                    </Button>

                    <Button type="button" variant="outline" onClick={handleTopicMark}>
                        Topic Mark
                    </Button>
                    <Button type="button" variant="outline" onClick={handleAttendance}>
                        Attendance
                    </Button>
                </div>
            </div>

            {/* Trainee Table */}
            <div className="max-h-[540px] overflow-auto rounded-md border">
                <Table
                    aria-label="Trainee List"
                    className="min-w-[960px] border-collapse [&_td]:border-r [&_td:last-child]:border-r-0 [&_th]:border-r [&_th:last-child]:border-r-0"
                >
                    <TableHeader className="sticky top-0 z-10 bg-muted/40">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-11 px-3 text-center">
                                <Checkbox
                                    aria-label="Select all trainees"
                                    checked={selectAllState}
                                    disabled={isPending || filteredTrainees.length === 0}
                                    onCheckedChange={(checked) => handleToggleAll(checked === true)}
                                />
                            </TableHead>
                            <TableHead className="w-12 px-3 font-semibold text-foreground">No.</TableHead>
                            <TableHead className="px-3 font-semibold text-foreground">Full Name</TableHead>
                            <TableHead className="px-3 font-semibold text-foreground">FPT Student ID</TableHead>
                            <TableHead className="px-3 font-semibold text-foreground">Personal Email</TableHead>
                            <TableHead className="px-3 font-semibold text-foreground">National ID</TableHead>
                            <TableHead className="px-3 font-semibold text-foreground">DOB</TableHead>
                            <TableHead className="px-3 font-semibold text-foreground">Gender</TableHead>
                            <TableHead className="px-3 font-semibold text-foreground">Status</TableHead>
                            <TableHead className="w-16 px-3 text-center font-semibold text-foreground">Action</TableHead>
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        {isPending ? (
                            Array.from({ length: 6 }, (_, rowIdx) => (
                                <TableRow key={rowIdx}>
                                    {Array.from({ length: 10 }, (_, colIdx) => (
                                        <TableCell key={colIdx} className="px-3 py-3">
                                            <Skeleton className="h-4 w-full" />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : filteredTrainees.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={10} className="py-12 text-center text-muted-foreground">
                                    <div className="flex flex-col items-center gap-2">
                                        <Users className="size-7 text-muted-foreground/70" aria-hidden />
                                        <p className="text-sm">
                                            {search.trim()
                                                ? "No trainees match your search."
                                                : "No trainees enrolled in this class yet."}
                                        </p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredTrainees.map((trainee, index) => {
                                const isSelected = selectedIds.has(trainee.id);
                                const isNewRow = trainee.id < 0;
                                const isEditedRow = pendingChanges.updatedIdSet.has(trainee.id);
                                const studentId = formatFptStudentIdForSite(
                                    trainee.fptAccount || trainee.code,
                                    classSite,
                                    trainee.id,
                                );
                                const personalEmail = trainee.personalEmail || trainee.email || "";
                                const statusBadge = resolveTraineeStatusBadge(trainee.status);

                                return (
                                    <TableRow
                                        key={trainee.id}
                                        data-state={isSelected ? "selected" : undefined}
                                        className={cn(
                                            "data-[state=selected]:bg-blue-50/50 dark:data-[state=selected]:bg-blue-950/20",
                                            isNewRow && "bg-emerald-50/40 dark:bg-emerald-950/15",
                                            isEditedRow && "bg-amber-50/40 dark:bg-amber-950/15",
                                        )}
                                    >
                                        <TableCell className="px-3 py-3 text-center">
                                            <Checkbox
                                                aria-label={`Select ${trainee.fullName ?? studentId ?? trainee.id}`}
                                                checked={isSelected}
                                                onCheckedChange={(checked) =>
                                                    handleToggleRow(trainee.id, checked === true)
                                                }
                                            />
                                        </TableCell>
                                        <TableCell className="px-3 py-3 text-sm text-foreground">{index + 1}</TableCell>
                                        <TableCell className="px-3 py-3 text-sm font-medium text-[#3b4cb8] dark:text-blue-300">
                                            <div className="flex items-center gap-2">
                                                <span>{trainee.fullName || "—"}</span>
                                                {isNewRow ? (
                                                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                                        New
                                                    </span>
                                                ) : isEditedRow ? (
                                                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                                        Edited
                                                    </span>
                                                ) : null}
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-3 py-3 text-sm text-[#3b4cb8] dark:text-blue-300">
                                            {studentId}
                                        </TableCell>
                                        <TableCell className="px-3 py-3 text-sm text-foreground">
                                            {personalEmail}
                                        </TableCell>
                                        <TableCell className="px-3 py-3 text-sm text-foreground">
                                            {trainee.nationalId ?? ""}
                                        </TableCell>
                                        <TableCell className="px-3 py-3 text-sm whitespace-nowrap text-foreground">
                                            {formatDob(trainee.dob)}
                                        </TableCell>
                                        <TableCell className="px-3 py-3 text-sm text-foreground">
                                            {trainee.gender ?? ""}
                                        </TableCell>
                                        <TableCell className="px-3 py-3">
                                            <Badge
                                                variant="secondary"
                                                className={cn(
                                                    "rounded-full px-3 py-0.5 text-xs font-medium",
                                                    statusBadge.className,
                                                )}
                                            >
                                                {statusBadge.label}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="px-3 py-3 text-center">
                                            <DropdownMenu modal={false}>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        aria-label={`Actions for ${trainee.fullName ?? studentId ?? trainee.id}`}
                                                    >
                                                        <MoreVertical className="size-4 text-muted-foreground" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-44">
                                                    <DropdownMenuItem onClick={() => handleOpenView(trainee)}>
                                                        <Eye className="size-4" /> View Profile
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleOpenEdit(trainee)}>
                                                        <Pencil className="size-4" /> Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        variant="destructive"
                                                        onClick={() => setDeleteTarget(trainee)}
                                                    >
                                                        <Trash2 className="size-4" /> Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
                {hasUnsavedChanges ? (
                    <Button
                        type="button"
                        variant="outline"
                        disabled={saveMutation.isPending}
                        onClick={handleDiscardChanges}
                    >
                        <RotateCcw className="size-4" aria-hidden /> Discard
                    </Button>
                ) : null}

                <Button
                    type="button"
                    disabled={!hasUnsavedChanges || saveMutation.isPending}
                    onClick={handleSaveChanges}
                    className={cn(
                        hasUnsavedChanges
                            ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                            : "",
                    )}
                >
                    <Save className="size-4" aria-hidden />
                    <span>{saveMutation.isPending ? "Saving..." : "Save Changes"}</span>
                    {hasUnsavedChanges ? (
                        <span className="ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-white/25 px-1.5 text-xs font-semibold">
                            {pendingChanges.total}
                        </span>
                    ) : null}
                </Button>
            </div>

            {/* Add / Edit / View Profile Modal */}
            <TraineeModal
                open={modalState.open}
                mode={modalState.mode}
                site={classSite}
                trainee={modalState.trainee}
                existingTrainees={activeTrainees}
                onOpenChange={(open) => setModalState((prev) => ({ ...prev, open }))}
                onSubmit={handleModalSubmit}
                onSwitchToEdit={
                    modalState.trainee
                        ? () => setModalState((prev) => ({ ...prev, mode: "edit" }))
                        : undefined
                }
            />

            {/* Single Row Delete Confirmation Modal */}
            <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Remove Trainee</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to remove this trainee from class?
                        </DialogDescription>
                    </DialogHeader>

                    {deleteTarget ? (
                        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                            <p className="font-medium text-foreground">{deleteTarget.fullName || "—"}</p>
                            <p className="text-xs text-muted-foreground">
                                {formatFptStudentIdForSite(
                                    deleteTarget.fptAccount || deleteTarget.code,
                                    classSite,
                                    deleteTarget.id,
                                ) || "—"}{" "}
                                • {deleteTarget.personalEmail || deleteTarget.email || "—"}
                            </p>
                        </div>
                    ) : null}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
                            Cancel
                        </Button>
                        <Button type="button" variant="destructive" onClick={handleConfirmDelete}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Bulk Delete Selected Confirmation Modal */}
            <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Remove Selected Trainees</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to remove {selectedCount} selected{" "}
                            {selectedCount === 1 ? "trainee" : "trainees"} from class?
                        </DialogDescription>
                    </DialogHeader>

                    {selectedCount > 0 ? (
                        <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-md border bg-muted/30 p-3 text-sm">
                            {selectedTrainees.map((trainee) => (
                                <div key={trainee.id} className="flex items-center justify-between gap-2">
                                    <span className="truncate font-medium text-foreground">
                                        {trainee.fullName || "—"}
                                    </span>
                                    <span className="shrink-0 text-xs text-muted-foreground">
                                        {formatFptStudentIdForSite(
                                            trainee.fptAccount || trainee.code,
                                            classSite,
                                            trainee.id,
                                        )}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : null}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setBulkDeleteOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="button" variant="destructive" onClick={handleConfirmBulkDelete}>
                            Delete Selected ({selectedCount})
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default TraineeListTab;
