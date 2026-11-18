import { departmentApi } from "@/api/features/demo/department.api";
import { PermissionGate } from "@/components/PermissionGate";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { usePermissions } from "@/hooks/usePermissions";
import type { DepartmentDTO, DepartmentMember, DepartmentMemberPage } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Search, UserRound, UserRoundPlus, UserRoundX } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";

interface DepartmentMembersDialogProps {
    department: DepartmentDTO;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const EMPTY_PAGE: DepartmentMemberPage = {
    content: [],
    number: 0,
    size: 10,
    totalElements: 0,
    totalPages: 0,
};

export function DepartmentMembersDialog({
    department,
    open,
    onOpenChange,
}: DepartmentMembersDialogProps) {
    const queryClient = useQueryClient();
    const { hasPermission } = usePermissions();
    const canEdit = hasPermission("DEPARTMENT_UPDATE");
    const departmentId = department.id;
    const [search, setSearch] = useState("");
    const [membersPage, setMembersPage] = useState(0);
    const [availablePage, setAvailablePage] = useState(0);
    // Các sinh viên đang được tick (giữ nguyên khi chuyển trang)
    const [selectedMembers, setSelectedMembers] = useState<Set<number>>(new Set());
    const [selectedAvailable, setSelectedAvailable] = useState<Set<number>>(new Set());

    useEffect(() => {
        setSearch("");
        setMembersPage(0);
        setAvailablePage(0);
        setSelectedMembers(new Set());
        setSelectedAvailable(new Set());
    }, [departmentId, open]);

    const membersQuery = useQuery({
        queryKey: ["department-members", departmentId, membersPage, search],
        enabled: open && departmentId !== undefined,
        queryFn: () => departmentApi.getMembers(departmentId!, membersPage, search.trim()),
    });
    const availableQuery = useQuery({
        queryKey: ["department-available-students", departmentId, availablePage, search],
        enabled: open && departmentId !== undefined,
        queryFn: () => departmentApi.getAvailableStudents(departmentId!, availablePage, search.trim()),
    });

    const refreshLists = () =>
        Promise.all([
            queryClient.invalidateQueries({ queryKey: ["department-members", departmentId] }),
            queryClient.invalidateQueries({ queryKey: ["department-available-students", departmentId] }),
            queryClient.invalidateQueries({ queryKey: ["department-overview"] }),
        ]);

    const membershipMutation = useMutation({
        mutationFn: ({ student, remove }: { student: DepartmentMember; remove: boolean }) => {
            if (!departmentId) {
                throw new Error("Cannot update membership because the department ID is missing.");
            }
            return remove
                ? departmentApi.removeStudent(departmentId, student.id)
                : departmentApi.assignStudent(departmentId, student.id);
        },
        onSuccess: async (_, variables) => {
            toast.success(
                variables.remove
                    ? "Student removed from the department."
                    : "Student added to the department.",
            );
            // Bỏ tick của người vừa được xử lý riêng lẻ
            const unselect = (prev: Set<number>) => {
                const next = new Set(prev);
                next.delete(variables.student.id);
                return next;
            };
            if (variables.remove) setSelectedMembers(unselect);
            else setSelectedAvailable(unselect);
            await refreshLists();
        },
        onError: (error) => {
            toast.error(error instanceof Error ? error.message : "Could not update department membership.");
        },
    });

    const bulkMutation = useMutation({
        mutationFn: ({ ids, remove }: { ids: number[]; remove: boolean }) => {
            if (!departmentId) {
                throw new Error("Cannot update membership because the department ID is missing.");
            }
            return remove
                ? departmentApi.removeStudents(departmentId, ids)
                : departmentApi.assignStudents(departmentId, ids);
        },
        onSuccess: async (result, variables) => {
            const total = result.succeeded.length + result.failed.length;
            const action = variables.remove ? "removed from" : "added to";
            if (result.failed.length === 0) {
                toast.success(`${result.succeeded.length} student(s) ${action} the department.`);
            } else {
                toast.warning(
                    `${result.succeeded.length} of ${total} student(s) ${action} the department; ${result.failed.length} failed.`,
                );
            }
            // Chỉ giữ lại tick của những người bị lỗi để có thể thử lại
            const remaining = new Set(result.failed);
            if (variables.remove) setSelectedMembers(remaining);
            else setSelectedAvailable(remaining);
            await refreshLists();
        },
        onError: (error) => {
            toast.error(error instanceof Error ? error.message : "Could not update department membership.");
        },
    });

    const busy = membershipMutation.isPending || bulkMutation.isPending;

    const runBulk = (selected: Set<number>, remove: boolean) => {
        if (selected.size === 0 || busy) return;
        bulkMutation.mutate({ ids: Array.from(selected), remove });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Manage members — {department.name}</DialogTitle>
                    <DialogDescription>
                        Add students to this department or remove them without affecting their other departments.
                        Tick several students to add or remove them at once.
                    </DialogDescription>
                </DialogHeader>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        aria-label="Search students"
                        className="pl-9"
                        placeholder="Search by student name or email"
                        value={search}
                        onChange={(event) => {
                            setSearch(event.target.value);
                            setMembersPage(0);
                            setAvailablePage(0);
                            setSelectedMembers(new Set());
                            setSelectedAvailable(new Set());
                        }}
                    />
                </div>

                <section className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold">Department members</h3>
                        <span className="text-sm text-muted-foreground">
                            {membersQuery.data?.totalElements ?? 0}
                        </span>
                    </div>
                    <StudentList
                        page={membersQuery.data ?? EMPTY_PAGE}
                        isLoading={membersQuery.isLoading}
                        isError={membersQuery.isError}
                        error={membersQuery.error}
                        onRetry={() => void membersQuery.refetch()}
                        emptyMessage="No students match this search in the department."
                        onPageChange={setMembersPage}
                        selection={canEdit ? {
                            selected: selectedMembers,
                            onChange: setSelectedMembers,
                            disabled: busy,
                            actions: (
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    disabled={busy}
                                    onClick={() => runBulk(selectedMembers, true)}
                                >
                                    {bulkMutation.isPending && bulkMutation.variables?.remove
                                        ? <LoaderCircle className="size-4 animate-spin" />
                                        : <UserRoundX className="size-4" />}
                                    Remove selected ({selectedMembers.size})
                                </Button>
                            ),
                        } : undefined}
                    >
                        {(student) => (
                            <PermissionGate permission="DEPARTMENT_UPDATE">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={busy}
                                    onClick={() => membershipMutation.mutate({ student, remove: true })}
                                >
                                    <UserRoundX className="size-4" /> Remove
                                </Button>
                            </PermissionGate>
                        )}
                    </StudentList>
                </section>

                <section className="space-y-3 border-t pt-5">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold">Other students</h3>
                        <span className="text-sm text-muted-foreground">
                            {availableQuery.data?.totalElements ?? 0}
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Students can belong to multiple departments.
                    </p>
                    <StudentList
                        page={availableQuery.data ?? EMPTY_PAGE}
                        isLoading={availableQuery.isLoading}
                        isError={availableQuery.isError}
                        error={availableQuery.error}
                        onRetry={() => void availableQuery.refetch()}
                        emptyMessage="No other active students match this search."
                        onPageChange={setAvailablePage}
                        selection={canEdit ? {
                            selected: selectedAvailable,
                            onChange: setSelectedAvailable,
                            disabled: busy,
                            actions: (
                                <Button
                                    size="sm"
                                    disabled={busy}
                                    onClick={() => runBulk(selectedAvailable, false)}
                                >
                                    {bulkMutation.isPending && !bulkMutation.variables?.remove
                                        ? <LoaderCircle className="size-4 animate-spin" />
                                        : <UserRoundPlus className="size-4" />}
                                    Add selected ({selectedAvailable.size})
                                </Button>
                            ),
                        } : undefined}
                    >
                        {(student) => (
                            <PermissionGate permission="DEPARTMENT_UPDATE">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={busy}
                                    onClick={() => membershipMutation.mutate({ student, remove: false })}
                                >
                                    <UserRoundPlus className="size-4" />
                                    Add
                                </Button>
                            </PermissionGate>
                        )}
                    </StudentList>
                </section>
            </DialogContent>
        </Dialog>
    );
}

interface StudentSelection {
    selected: Set<number>;
    onChange: (next: Set<number>) => void;
    disabled?: boolean;
    /** Nút hành động hàng loạt, chỉ hiện khi đã tick ít nhất 1 sinh viên. */
    actions: ReactNode;
}

function StudentList({
    page,
    isLoading,
    isError,
    error,
    onRetry,
    emptyMessage,
    onPageChange,
    selection,
    children,
}: {
    page: DepartmentMemberPage;
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    onRetry: () => void;
    emptyMessage: string;
    onPageChange: (page: number) => void;
    selection?: StudentSelection;
    children: (student: DepartmentMember) => ReactNode;
}) {
    if (isLoading) {
        return (
            <div role="status" className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" /> Loading students...
            </div>
        );
    }

    if (isError) {
        return (
            <div role="alert" className="space-y-3 rounded-lg border border-destructive/30 p-4">
                <p className="text-sm text-destructive">
                    {error instanceof Error ? error.message : "Could not load students."}
                </p>
                <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>
            </div>
        );
    }

    if (page.content.length === 0) {
        return <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
    }

    const selectedCount = selection?.selected.size ?? 0;
    const allOnPageSelected =
        !!selection && page.content.every((student) => selection.selected.has(student.id));

    const toggleOne = (studentId: number, checked: boolean) => {
        if (!selection) return;
        const next = new Set(selection.selected);
        if (checked) next.add(studentId);
        else next.delete(studentId);
        selection.onChange(next);
    };

    const togglePage = (checked: boolean) => {
        if (!selection) return;
        const next = new Set(selection.selected);
        page.content.forEach((student) => {
            if (checked) next.add(student.id);
            else next.delete(student.id);
        });
        selection.onChange(next);
    };

    return (
        <>
            {selection && (
                <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox
                            checked={allOnPageSelected}
                            disabled={selection.disabled}
                            onCheckedChange={(checked) => togglePage(checked === true)}
                            aria-label="Select all students on this page"
                        />
                        Select all on this page
                    </label>
                    {selectedCount > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{selectedCount} selected</span>
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={selection.disabled}
                                onClick={() => selection.onChange(new Set())}
                            >
                                Clear
                            </Button>
                            {selection.actions}
                        </div>
                    )}
                </div>
            )}
            <div className="max-h-56 divide-y overflow-y-auto rounded-lg border">
                {page.content.map((student) => {
                    const fullName = [student.firstName, student.lastName].filter(Boolean).join(" ") || student.email;
                    const checked = selection?.selected.has(student.id) ?? false;
                    return (
                        <div
                            key={student.id}
                            className={`flex items-center justify-between gap-3 p-3 ${checked ? "bg-muted/50" : ""}`}
                        >
                            <div className="flex min-w-0 items-center gap-3">
                                {selection && (
                                    <Checkbox
                                        checked={checked}
                                        disabled={selection.disabled}
                                        onCheckedChange={(value) => toggleOne(student.id, value === true)}
                                        aria-label={`Select ${fullName}`}
                                    />
                                )}
                                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                                    <UserRound className="size-4 text-muted-foreground" />
                                </span>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-medium">{fullName}</p>
                                    <p className="truncate text-xs text-muted-foreground">
                                        {student.email}
                                        {student.departmentName ? ` · ${student.departmentName}` : ""}
                                    </p>
                                </div>
                            </div>
                            {children(student)}
                        </div>
                    );
                })}
            </div>
            {page.totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                        Page {page.number + 1} of {page.totalPages}
                    </span>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page.number === 0}
                            onClick={() => onPageChange(page.number - 1)}
                        >
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page.number >= page.totalPages - 1}
                            onClick={() => onPageChange(page.number + 1)}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}
        </>
    );
}
