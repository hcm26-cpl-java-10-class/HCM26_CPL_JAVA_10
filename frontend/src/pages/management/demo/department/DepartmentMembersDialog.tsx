import { departmentApi } from "@/api/features/demo/department.api";
import { PermissionGate } from "@/components/PermissionGate";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { DepartmentDTO, DepartmentMember, DepartmentMemberPage } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Search, UserRound, UserRoundPlus, UserRoundX } from "lucide-react";
import { useEffect, useState } from "react";
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
    const departmentId = department.id;
    const [search, setSearch] = useState("");
    const [membersPage, setMembersPage] = useState(0);
    const [availablePage, setAvailablePage] = useState(0);

    useEffect(() => {
        setSearch("");
        setMembersPage(0);
        setAvailablePage(0);
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
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["department-members", departmentId] }),
                queryClient.invalidateQueries({ queryKey: ["department-available-students", departmentId] }),
                queryClient.invalidateQueries({ queryKey: ["department-overview"] }),
            ]);
        },
        onError: (error) => {
            toast.error(error instanceof Error ? error.message : "Could not update department membership.");
        },
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Manage members — {department.name}</DialogTitle>
                    <DialogDescription>
                        Add students to this department or remove them without affecting their other departments.
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
                    >
                        {(student) => (
                            <PermissionGate permission="DEPARTMENT_UPDATE">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={membershipMutation.isPending}
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
                    >
                        {(student) => (
                            <PermissionGate permission="DEPARTMENT_UPDATE">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={membershipMutation.isPending}
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

function StudentList({
    page,
    isLoading,
    isError,
    error,
    onRetry,
    emptyMessage,
    onPageChange,
    children,
}: {
    page: DepartmentMemberPage;
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    onRetry: () => void;
    emptyMessage: string;
    onPageChange: (page: number) => void;
    children: (student: DepartmentMember) => React.ReactNode;
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

    return (
        <>
            <div className="max-h-56 divide-y overflow-y-auto rounded-lg border">
                {page.content.map((student) => (
                    <div key={student.id} className="flex items-center justify-between gap-3 p-3">
                        <div className="flex min-w-0 items-center gap-3">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                                <UserRound className="size-4 text-muted-foreground" />
                            </span>
                            <div className="min-w-0">
                                <p className="truncate text-sm font-medium">
                                    {[student.firstName, student.lastName].filter(Boolean).join(" ") || student.email}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                    {student.email}
                                    {student.departmentName ? ` · ${student.departmentName}` : ""}
                                </p>
                            </div>
                        </div>
                        {children(student)}
                    </div>
                ))}
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
