import { courseApi, invitationApi } from "@/api";
import type {
    GroupInvitationRequest,
    InvitationBulkItemResult,
} from "@/types";
import { ExamScheduleSelector, type ScheduleMode } from "@/components/features/invitation/ExamScheduleSelector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, GraduationCap, RefreshCw, Search, Send, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

interface BulkInviteByClassTabProps {
    examId: number;
    onSuccess?: () => void;
}

interface ClassForm {
    courseId: string;
    note: string;
    availableFrom: string;
    expiresAt: string;
    sendEmail: boolean;
}

const DEFAULT_FORM: ClassForm = {
    courseId: "",
    note: "",
    availableFrom: "",
    expiresAt: "",
    sendEmail: true,
};

const getErrorMessage = (error: unknown, fallback: string): string => {
    const err = error as {
        response?: { status?: number; data?: { errors?: Record<string, string[]>; message?: string } };
    };
    if (err?.response?.status === 403) {
        return "Bạn không có quyền xem danh sách học viên của lớp này.";
    }
    const data = err?.response?.data;
    const fieldError = data?.errors ? Object.values(data.errors).flat()[0] : undefined;
    return fieldError || data?.message || fallback;
};

const BULK_STATUS_VARIANT: Record<
    InvitationBulkItemResult["status"],
    "default" | "secondary" | "destructive" | "outline"
> = {
    SUCCESS: "default",
    SKIPPED: "secondary",
    FAILED: "destructive",
};

export function BulkInviteByClassTab({ examId, onSuccess }: BulkInviteByClassTabProps) {
    const queryClient = useQueryClient();
    const [form, setForm] = useState<ClassForm>(DEFAULT_FORM);
    const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("FLEXIBLE");
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [search, setSearch] = useState("");
    const [results, setResults] = useState<InvitationBulkItemResult[]>([]);

    const courseId = form.courseId ? Number(form.courseId) : null;

    const examQuery = useQuery({
        queryKey: ["exam-detail-for-class-invitation", examId],
        queryFn: async () => {
            const { examApi } = await import("@/api");
            return examApi.getById(String(examId));
        },
        enabled: examId > 0,
        staleTime: 5 * 60 * 1000,
    });
    const durationMinutes = examQuery.data?.durationMinutes || 60;

    const coursesQuery = useQuery({
        queryKey: ["invitation-class-list"],
        queryFn: async () => {
            const response = await courseApi.getPage({ page: 0, size: 100, sort: "name,asc" });
            return response.content ?? [];
        },
        staleTime: 5 * 60 * 1000,
    });

    const studentsQuery = useQuery({
        queryKey: ["invitation-class-students", courseId],
        queryFn: () => invitationApi.getCourseStudents(courseId!),
        enabled: courseId !== null,
        retry: false,
    });

    // Học viên đã có lời mời cho đề này -> không chọn được, hiển thị badge.
    const existingInvitationsQuery = useQuery({
        queryKey: ["exam-invitations", examId],
        queryFn: () => invitationApi.getByExam(examId),
        enabled: examId > 0,
        retry: false,
    });

    const alreadyInvitedIds = useMemo(() => {
        const set = new Set<number>();
        (existingInvitationsQuery.data ?? []).forEach((inv) => {
            if (inv.userId) set.add(inv.userId);
        });
        return set;
    }, [existingInvitationsQuery.data]);

    const students = useMemo(() => {
        const all = studentsQuery.data ?? [];
        const keyword = search.trim().toLowerCase();
        if (!keyword) return all;
        return all.filter(
            (s) =>
                (s.fullName ?? "").toLowerCase().includes(keyword) ||
                (s.email ?? "").toLowerCase().includes(keyword),
        );
    }, [studentsQuery.data, search]);

    const selectableStudents = useMemo(
        () => students.filter((s) => !alreadyInvitedIds.has(s.id)),
        [students, alreadyInvitedIds],
    );

    const bulkMutation = useMutation({
        mutationFn: async () => {
            const request: GroupInvitationRequest = {
                courseId: courseId!,
                userIds: Array.from(selectedIds),
                note: form.note || undefined,
                availableFrom: form.availableFrom ? new Date(form.availableFrom).toISOString() : undefined,
                expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
                sendEmail: form.sendEmail,
            };
            return invitationApi.createByCourse(examId, request);
        },
        onSuccess: (response) => {
            setResults(response.items ?? []);
            const skipped = response.skippedCount ?? 0;
            const failed = response.failureCount ?? 0;
            toast.success(
                `Đã mời ${response.successCount} học viên` +
                    (skipped ? `, bỏ qua ${skipped}` : "") +
                    (failed ? `, lỗi ${failed}` : "") +
                    ".",
            );
            void queryClient.invalidateQueries({ queryKey: ["exam-invitations", examId] });
            void queryClient.invalidateQueries({ queryKey: ["invitation-overviews"] });
            onSuccess?.();
        },
        onError: (error: unknown) => {
            toast.error(getErrorMessage(error, "Không thể mời hàng loạt theo lớp."));
        },
    });

    const toggleStudent = (id: number) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        setSelectedIds((prev) => {
            const allSelected = selectableStudents.every((s) => prev.has(s.id));
            if (allSelected) {
                const next = new Set(prev);
                selectableStudents.forEach((s) => next.delete(s.id));
                return next;
            }
            const next = new Set(prev);
            selectableStudents.forEach((s) => next.add(s.id));
            return next;
        });
    };

    const resetForm = () => {
        setForm(DEFAULT_FORM);
        setSelectedIds(new Set());
        setSearch("");
        setResults([]);
    };

    const allSelected =
        selectableStudents.length > 0 && selectableStudents.every((s) => selectedIds.has(s.id));

    return (
        <div className="space-y-4 pt-4">
            <div className="rounded-md border-2 border-dashed border-primary/30 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                    <GraduationCap className="mt-0.5 size-5 shrink-0 text-primary" />
                    <div>
                        <p className="font-medium">Invite by class</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Pick a class, review its students and send exam invitations in bulk.
                            Students who already have an invitation are skipped automatically.
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <Label>Class</Label>
                <Select
                    value={form.courseId}
                    onValueChange={(v) => {
                        setForm((f) => ({ ...f, courseId: v }));
                        setSelectedIds(new Set());
                        setResults([]);
                    }}
                >
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a class" />
                    </SelectTrigger>
                    <SelectContent>
                        {(coursesQuery.data ?? []).map((course) => (
                            <SelectItem key={course.id} value={String(course.id)}>
                                {course.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {coursesQuery.isError && (
                    <p className="text-xs text-destructive">
                        {getErrorMessage(coursesQuery.error, "Failed to load classes.")}
                    </p>
                )}
            </div>

            {courseId !== null && (
                <>
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                className="pl-8"
                                placeholder="Search students by name or email..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedIds(new Set())}
                            disabled={selectedIds.size === 0}
                        >
                            Clear selection
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={resetForm}
                            disabled={bulkMutation.isPending}
                        >
                            Reset
                        </Button>
                    </div>

                    <div className="max-h-64 overflow-y-auto rounded-md border">
                        {studentsQuery.isLoading && (
                            <p className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
                                <RefreshCw className="size-4 animate-spin" />
                                Loading students...
                            </p>
                        )}

                        {studentsQuery.isError && (
                            <div className="space-y-3 p-4 text-center">
                                <p className="text-sm text-destructive">
                                    {getErrorMessage(
                                        studentsQuery.error,
                                        "Failed to load students of this class.",
                                    )}
                                </p>
                                <Button variant="outline" size="sm" onClick={() => void studentsQuery.refetch()}>
                                    Try again
                                </Button>
                            </div>
                        )}

                        {!studentsQuery.isLoading && !studentsQuery.isError && students.length === 0 && (
                            <p className="p-8 text-center text-sm text-muted-foreground">
                                {search.trim()
                                    ? "No student matches your search."
                                    : "This class has no students yet."}
                            </p>
                        )}

                        {!studentsQuery.isLoading && !studentsQuery.isError && students.length > 0 && (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-10">
                                            <Checkbox
                                                checked={allSelected}
                                                onCheckedChange={toggleAll}
                                                aria-label="Select all students"
                                            />
                                        </TableHead>
                                        <TableHead>Student</TableHead>
                                        <TableHead className="w-32">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {students.map((student) => {
                                        const invited = alreadyInvitedIds.has(student.id);
                                        return (
                                            <TableRow key={student.id}>
                                                <TableCell>
                                                    <Checkbox
                                                        checked={selectedIds.has(student.id)}
                                                        disabled={invited}
                                                        onCheckedChange={() => toggleStudent(student.id)}
                                                        aria-label={`Select ${student.fullName ?? student.email}`}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <p className="font-medium">
                                                        {student.fullName ?? student.email}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {student.email}
                                                    </p>
                                                </TableCell>
                                                <TableCell>
                                                    {invited ? (
                                                        <Badge variant="secondary">Already invited</Badge>
                                                    ) : (
                                                        <Badge variant="outline">Eligible</Badge>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>Ghi chú (Note - tùy chọn)</Label>
                        <Input
                            placeholder="ví dụ: Bài kiểm tra định kỳ lớp A, ca thi sáng..."
                            value={form.note}
                            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                        />
                    </div>

                    <ExamScheduleSelector
                        durationMinutes={durationMinutes}
                        scheduleMode={scheduleMode}
                        onScheduleModeChange={setScheduleMode}
                        availableFrom={form.availableFrom}
                        onAvailableFromChange={(val) => setForm((f) => ({ ...f, availableFrom: val }))}
                        expiresAt={form.expiresAt}
                        onExpiresAtChange={(val) => setForm((f) => ({ ...f, expiresAt: val }))}
                    />

                    <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                            checked={form.sendEmail}
                            onCheckedChange={(v) => setForm((f) => ({ ...f, sendEmail: v === true }))}
                        />
                        Send invitation emails immediately
                    </label>

                    <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-muted-foreground">
                            {selectedIds.size} student(s) selected
                            {studentsQuery.data ? ` of ${studentsQuery.data.length}` : ""}
                        </p>
                        <Button
                            onClick={() => bulkMutation.mutate()}
                            disabled={selectedIds.size === 0 || bulkMutation.isPending}
                        >
                            {bulkMutation.isPending ? (
                                <>
                                    <RefreshCw className="size-4 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <Send className="size-4" />
                                    Invite {selectedIds.size} student(s)
                                </>
                            )}
                        </Button>
                    </div>

                    {results.length > 0 && (
                        <div className="space-y-2 rounded-md border p-3">
                            <p className="flex items-center gap-2 text-sm font-medium">
                                <Users className="size-4" />
                                Result per student
                            </p>
                            <div className="max-h-48 overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Student</TableHead>
                                            <TableHead className="w-28">Status</TableHead>
                                            <TableHead>Reason</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {results.map((item, index) => (
                                            <TableRow key={`${item.userId ?? "unknown"}-${index}`}>
                                                <TableCell className="text-sm">
                                                    {item.userFullName ?? item.userEmail ?? "—"}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={BULK_STATUS_VARIANT[item.status]}>
                                                        {item.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    {item.reason ?? "—"}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            {results.some((r) => r.status === "FAILED") && (
                                <p className="flex items-center gap-2 text-xs text-destructive">
                                    <AlertTriangle className="size-3.5" />
                                    Some students could not be invited. Check the details above.
                                </p>
                            )}
                        </div>
                    )}
                </>
            )}

            {courseId === null && (
                <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                    Select a class to load its students.
                </p>
            )}
        </div>
    );
}
