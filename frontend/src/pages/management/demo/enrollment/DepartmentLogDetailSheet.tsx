import { enrollmentApi } from "@/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { AuditLogRow, DepartmentLogStudent, PageResponse } from "@/types";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { BookOpen, Building2, Calendar, ChevronLeft, ChevronRight, Search, User, Users } from "lucide-react";
import { useEffect, useState } from "react";

const PAGE_SIZE = 10;

interface Props {
    row: AuditLogRow | null;
    onClose: () => void;
    formatDate: (value?: string | null) => string;
    statusClass: (status?: string | null) => string;
}

export function DepartmentLogDetailSheet({ row, onClose, formatDate, statusClass }: Props) {
    const [search, setSearch] = useState("");
    const [debounced, setDebounced] = useState("");
    const [page, setPage] = useState(0);

    // Reset khi mở log khác
    useEffect(() => {
        setSearch("");
        setDebounced("");
        setPage(0);
    }, [row?.id]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebounced(search.trim());
            setPage(0);
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    const departmentId = row?.departmentId ?? null;
    const courseId = row?.courseId ?? null;

    const { data, isLoading, isError } = useQuery<PageResponse<DepartmentLogStudent>>({
        queryKey: ["audit-department-students", departmentId, courseId, debounced, page],
        queryFn: () =>
            enrollmentApi.getDepartmentLogStudents(departmentId!, courseId!, {
                search: debounced || undefined,
                page,
                size: PAGE_SIZE,
            }),
        enabled: !!row && departmentId != null && courseId != null,
        placeholderData: keepPreviousData,
    });

    const students = data?.content ?? [];
    const totalMatched = data?.totalElements ?? 0;
    const totalPages = data?.totalPages ?? 1;

    return (
        <Sheet open={!!row} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="right" className="flex h-full w-full flex-col gap-0 overflow-hidden p-6 sm:max-w-xl">
                <SheetHeader className="shrink-0 border-b pb-4">
                    <SheetTitle className="flex items-center justify-between text-xl font-bold">
                        <span>Department Assignment</span>
                        {row && (
                            <Badge variant="outline" className={`font-mono text-xs ${statusClass(row.status)}`}>
                                {row.status ?? "UNKNOWN"}
                            </Badge>
                        )}
                    </SheetTitle>
                </SheetHeader>

                {row && (
                    <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4 text-sm">
                        <div className="grid shrink-0 grid-cols-3 gap-3">
                            <div className="rounded-lg border bg-muted/20 p-3">
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Building2 className="size-3.5" /> Department
                                </div>
                                <p className="mt-1 truncate font-semibold text-foreground" title={row.departmentName}>
                                    {row.departmentName ?? "-"}
                                </p>
                            </div>
                            <div className="rounded-lg border bg-muted/20 p-3">
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <BookOpen className="size-3.5" /> Course
                                </div>
                                <p className="mt-1 truncate font-semibold text-foreground" title={row.courseName}>
                                    {row.courseName ?? "-"}
                                </p>
                            </div>
                            <div className="rounded-lg border bg-muted/20 p-3">
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Users className="size-3.5" /> Students
                                </div>
                                <p className="mt-1 text-2xl font-bold leading-none text-foreground">
                                    {(row.studentCount ?? 0).toLocaleString()}
                                </p>
                            </div>
                        </div>

                        <div className="shrink-0 space-y-3 rounded-lg border bg-muted/20 p-4">
                            <div className="flex items-center gap-2 font-semibold text-foreground">
                                <User className="size-4 text-primary" /> Assigned by
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                    <span className="text-muted-foreground">Actor:</span>
                                    <p className="mt-0.5 font-medium text-foreground">{row.actorName ?? "System"}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Email:</span>
                                    <p className="mt-0.5 font-medium text-foreground">{row.actorEmail ?? "-"}</p>
                                </div>
                            </div>
                            <p className="text-xs leading-relaxed text-muted-foreground">{row.detail}</p>
                        </div>

                        <div className="flex min-h-0 flex-1 flex-col gap-3 rounded-lg border p-4">
                            <div className="flex shrink-0 items-center justify-between">
                                <div className="flex items-center gap-2 font-semibold text-foreground">
                                    <Users className="size-4 text-primary" /> Enrolled students
                                    <span className="text-xs font-normal text-muted-foreground">
                                        ({totalMatched.toLocaleString()}
                                        {debounced ? " matched" : ""})
                                    </span>
                                </div>
                            </div>

                            <div className="relative shrink-0">
                                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search student by name or email..."
                                    className="h-9 pl-9 text-xs"
                                />
                            </div>

                            <div className="min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto rounded-md border">
                                {isLoading ? (
                                    <div className="px-3 py-8 text-center text-xs text-muted-foreground">
                                        Loading students...
                                    </div>
                                ) : isError ? (
                                    <div className="px-3 py-8 text-center text-xs text-destructive">
                                        Failed to load students.
                                    </div>
                                ) : students.length === 0 ? (
                                    <div className="px-3 py-8 text-center text-xs text-muted-foreground">
                                        {debounced ? "No student matches your search." : "No students."}
                                    </div>
                                ) : (
                                    students.map((student) => (
                                        <div key={student.studentId} className="flex items-center gap-3 px-3 py-2.5">
                                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                                {(student.fullName?.[0] ?? "?").toUpperCase()}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate text-xs font-medium text-foreground">
                                                    {student.fullName}
                                                </div>
                                                <div className="truncate text-[11px] text-muted-foreground">
                                                    {student.email ?? "-"}
                                                </div>
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <Badge
                                                    variant="outline"
                                                    className={`text-[10px] ${statusClass(student.status)}`}
                                                >
                                                    {student.status}
                                                </Badge>
                                                <div className="mt-0.5 text-[11px] text-muted-foreground">
                                                    {student.progressPercentage}% · {formatDate(student.enrolledAt)}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {totalPages >= 1 && (
                                <div className="flex shrink-0 items-center justify-between text-xs text-muted-foreground">
                                    <span>
                                        Page <span className="font-medium text-foreground">{page + 1}</span> / {totalPages}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="size-7"
                                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                                            disabled={page === 0}
                                        >
                                            <ChevronLeft className="size-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="size-7"
                                            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                                            disabled={page >= totalPages - 1}
                                        >
                                            <ChevronRight className="size-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex shrink-0 items-center justify-between rounded-lg border p-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                                <Calendar className="size-3.5" /> Last assigned
                            </span>
                            <span className="font-medium text-foreground">{formatDate(row.createdAt)}</span>
                        </div>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
