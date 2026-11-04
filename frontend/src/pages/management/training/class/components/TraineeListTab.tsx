import { Eye, MoreVertical, Pencil, Search, UserMinus, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ApiErrorState } from "@/components/common/ApiErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useClassTrainees } from "@/hooks/useExternalLookups";
import { cn } from "@/lib/utils";
import type { ExternalClass, Trainee } from "@/types";
import { formatDate } from "@/utils/session.utils";

function resolveStatusBadge(status?: string) {
    const normalized = (status ?? "Active").trim().toLowerCase();

    if (!normalized || normalized === "active" || normalized === "studying") {
        return {
            label: "Active",
            className: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300",
        };
    }

    if (normalized === "dropped" || normalized === "drop-out" || normalized === "inactive") {
        return {
            label: normalized === "dropped" ? "Dropped" : "Inactive",
            className: "bg-rose-100 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300",
        };
    }

    const raw = (status ?? "").trim();
    return {
        label: raw.charAt(0).toUpperCase() + raw.slice(1),
        className: "bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300",
    };
}

function formatDob(dob?: string) {
    if (!dob || !dob.trim()) return "";
    return formatDate(dob);
}

export function TraineeListTab({ classItem }: { classItem: ExternalClass }) {
    const navigate = useNavigate();
    const classId = String(classItem.id);
    const { data: trainees = [], isPending, isError, error, refetch } = useClassTrainees(classId);

    const [search, setSearch] = useState("");
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    const filteredTrainees = useMemo(() => {
        const keyword = search.trim().toLowerCase();
        if (!keyword) return trainees;

        return trainees.filter((trainee) =>
            [
                trainee.fullName,
                trainee.fptAccount ?? trainee.code,
                trainee.personalEmail ?? trainee.email,
                trainee.nationalId,
                trainee.employeeId,
                trainee.accessCardId,
                formatDob(trainee.dob),
                trainee.gender,
            ].some((field) => String(field ?? "").toLowerCase().includes(keyword)),
        );
    }, [trainees, search]);

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

    const handleTopicMark = () => {
        const params = new URLSearchParams({
            classId,
            ...(classItem.code ? { classCode: classItem.code } : {}),
        });
        navigate(`/topic-marks/gradebook-demo?${params.toString()}`);
    };

    const handleAttendance = () => {
        toast.info(
            `Attendance for ${classItem.code ?? `Class #${classId}`} will be connected once the Attendance API is ready.`,
        );
    };

    const handleRowAction = (action: string, trainee: Trainee) => {
        toast.info(`${action}: ${trainee.fullName ?? trainee.fptAccount ?? `#${trainee.id}`} (API integration pending)`);
    };

    if (isError) {
        return <ApiErrorState error={error} resource="trainee list" onRetry={() => void refetch()} />;
    }

    return (
        <div className="space-y-4">
            {/* Top Action Bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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

                <div className="flex items-center gap-2.5 self-end sm:self-auto">
                    <Button variant="outline" onClick={handleTopicMark}>
                        Topic Mark
                    </Button>
                    <Button variant="outline" onClick={handleAttendance}>
                        Attendance
                    </Button>
                </div>
            </div>

            {/* Trainee Table */}
            <div className="max-h-[540px] overflow-auto rounded-md border">
                <Table
                    aria-label="Trainee List"
                    className="min-w-[1160px] border-collapse [&_td]:border-r [&_td:last-child]:border-r-0 [&_th]:border-r [&_th:last-child]:border-r-0"
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
                            <TableHead className="px-3 font-semibold text-foreground">FPT Student Account</TableHead>
                            <TableHead className="px-3 font-semibold text-foreground">Personal Email</TableHead>
                            <TableHead className="px-3 font-semibold text-foreground">National ID</TableHead>
                            <TableHead className="px-3 font-semibold text-foreground">Employee ID</TableHead>
                            <TableHead className="px-3 font-semibold text-foreground">Access Card ID</TableHead>
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
                                    {Array.from({ length: 12 }, (_, colIdx) => (
                                        <TableCell key={colIdx} className="px-3 py-3">
                                            <Skeleton className="h-4 w-full" />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : filteredTrainees.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={12} className="py-12 text-center text-muted-foreground">
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
                                const account = trainee.fptAccount || trainee.code || "";
                                const personalEmail = trainee.personalEmail || trainee.email || "";
                                const statusBadge = resolveStatusBadge(trainee.status);

                                return (
                                    <TableRow
                                        key={trainee.id}
                                        data-state={isSelected ? "selected" : undefined}
                                        className="data-[state=selected]:bg-blue-50/50 dark:data-[state=selected]:bg-blue-950/20"
                                    >
                                        <TableCell className="px-3 py-3 text-center">
                                            <Checkbox
                                                aria-label={`Select ${trainee.fullName ?? account ?? trainee.id}`}
                                                checked={isSelected}
                                                onCheckedChange={(checked) => handleToggleRow(trainee.id, checked === true)}
                                            />
                                        </TableCell>
                                        <TableCell className="px-3 py-3 text-sm text-foreground">{index + 1}</TableCell>
                                        <TableCell className="px-3 py-3 text-sm font-medium text-[#3b4cb8] dark:text-blue-300">
                                            {trainee.fullName || "—"}
                                        </TableCell>
                                        <TableCell className="px-3 py-3 text-sm text-[#3b4cb8] dark:text-blue-300">
                                            {account}
                                        </TableCell>
                                        <TableCell className="px-3 py-3 text-sm text-foreground">{personalEmail}</TableCell>
                                        <TableCell className="px-3 py-3 text-sm text-foreground">
                                            {trainee.nationalId ?? ""}
                                        </TableCell>
                                        <TableCell className="px-3 py-3 text-sm text-foreground">
                                            {trainee.employeeId ?? ""}
                                        </TableCell>
                                        <TableCell className="px-3 py-3 text-sm text-foreground">
                                            {trainee.accessCardId ?? ""}
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
                                                className={cn("rounded-full px-3 py-0.5 text-xs font-medium", statusBadge.className)}
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
                                                        aria-label={`Actions for ${trainee.fullName ?? account ?? trainee.id}`}
                                                    >
                                                        <MoreVertical className="size-4 text-muted-foreground" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-44">
                                                    <DropdownMenuItem onClick={() => handleRowAction("View trainee profile", trainee)}>
                                                        <Eye className="size-4" /> View Profile
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleRowAction("Edit trainee info", trainee)}>
                                                        <Pencil className="size-4" /> Edit Trainee
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        variant="destructive"
                                                        onClick={() => handleRowAction("Remove from class", trainee)}
                                                    >
                                                        <UserMinus className="size-4" /> Remove from Class
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
        </div>
    );
}

export default TraineeListTab;

