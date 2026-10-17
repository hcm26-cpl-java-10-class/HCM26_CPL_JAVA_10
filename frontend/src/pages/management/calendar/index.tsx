import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { calendarVersionApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";
import type {
    CalendarSummary,
    CalendarVersionCreationMode,
    CalendarVersionStatus,
    EntityConfig,
    EntitySchema,
} from "@/types";
import {
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Filter,
    GitBranch,
    Plus,
} from "lucide-react";
import { CreateVersionDialog } from "./components/CreateVersionDialog";

const calendarSchema: EntitySchema = {
    entityName: "calendar",
    idField: "id",
    fields: [
        {
            name: "name",
            label: "Calendar Name",
            type: "text",
            sortable: true,
            bold: true,
        },
        {
            name: "description",
            label: "Description",
            type: "text",
            sortable: false,
        },
        {
            name: "activeVersionNumber",
            label: "Active Version",
            type: "text",
            sortable: true,
        },
    ],
};

export const entityConfig: EntityConfig = {
    name: "Calendar",
    path: "/calendars",
    api: calendarVersionApi,
    schema: calendarSchema,
};

const formatDate = (value: string | null | undefined): string => {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
};

export default function CalendarManagementPage() {
    const [calendars, setCalendars] = useState<CalendarSummary[]>([]);
    const [selectedCalendarId, setSelectedCalendarId] = useState<number | null>(
        null,
    );
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    const [page, setPage] = useState(0);
    const [statusFilter, setStatusFilter] = useState<
        CalendarVersionStatus | "ALL"
    >("ALL");
    const [versionNumberInput, setVersionNumberInput] = useState("");

    const { hasPermission } = usePermissions();
    const queryClient = useQueryClient();

    const parsedVersionNumber =
        versionNumberInput.trim() === ""
            ? undefined
            : Number(versionNumberInput);

    const versionNumberValid =
        parsedVersionNumber === undefined ||
        (Number.isInteger(parsedVersionNumber) && parsedVersionNumber > 0);

    const canReadVersions = hasPermission("CALENDARVERSION_READ");

    const loadCalendars = useCallback(async () => {
        setIsLoading(true);
        setLoadError(null);

        try {
            const data = await calendarVersionApi.list();

            setCalendars(data);
            setSelectedCalendarId((currentId) =>
                data.some((calendar) => calendar.id === currentId)
                    ? currentId
                    : (data[0]?.id ?? null),
            );
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Could not load calendars.";

            setLoadError(message);
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadCalendars();
    }, [loadCalendars]);

    const selectedCalendar = calendars.find(
        (calendar) => calendar.id === selectedCalendarId,
    );

    const versionsQuery = useQuery({
        queryKey: [
            "calendar-versions",
            selectedCalendarId,
            page,
            statusFilter,
            versionNumberInput,
        ],
        enabled:
            selectedCalendarId !== null &&
            canReadVersions &&
            versionNumberValid,
        queryFn: () => {
            if (selectedCalendarId === null) {
                throw new Error("Select a calendar to view its versions.");
            }

            return calendarVersionApi.getVersions(
                selectedCalendarId,
                page,
                10,
                {
                    ...(statusFilter !== "ALL"
                        ? { status: statusFilter }
                        : {}),
                    ...(parsedVersionNumber !== undefined
                        ? { versionNumber: parsedVersionNumber }
                        : {}),
                },
            );
        },
    });

    const handleSelectCalendar = (calendarId: number) => {
        setSelectedCalendarId(calendarId);
        setPage(0);
    };

    const handleCreateVersion = async (
        mode: CalendarVersionCreationMode,
    ): Promise<void> => {
        if (!selectedCalendar) {
            toast.error("Please select a calendar.");
            return;
        }

        try {
            const result = await calendarVersionApi.create(selectedCalendar.id, {
                mode,
            });

            toast.success(
                `Version ${result.versionNumber} created with status ${result.status}.`,
            );

            setDialogOpen(false);
            setPage(0);

            await Promise.all([
                loadCalendars(),
                queryClient.invalidateQueries({
                    queryKey: ["calendar-versions", selectedCalendar.id],
                }),
            ]);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Could not create calendar version.";

            toast.error(message);
        }
    };

    return (
        <MainLayout pathName={{ calendars: "Calendar Management" }}>
            <div className="mx-auto w-full max-w-6xl space-y-8">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CalendarDays className="size-4" />
                            Calendar Management
                        </div>
                        <h1 className="mt-2 text-3xl font-bold tracking-tight">
                            Calendar Versions
                        </h1>
                        <p className="mt-2 text-sm text-muted-foreground">
                            View and filter versions for an academic calendar.
                        </p>
                    </div>
                </header>

                <section className="space-y-4">
                    <h2 className="text-lg font-semibold">Select a calendar</h2>

                    {isLoading ? (
                        <p role="status" className="text-sm text-muted-foreground">
                            Loading calendars...
                        </p>
                    ) : loadError ? (
                        <div className="flex items-center gap-3">
                            <p role="alert" className="text-sm text-destructive">
                                Could not load calendars.
                            </p>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void loadCalendars()}
                            >
                                Retry
                            </Button>
                        </div>
                    ) : calendars.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No active calendars found.
                        </p>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {calendars.map((calendar) => {
                                const isSelected =
                                    calendar.id === selectedCalendarId;

                                return (
                                    <button
                                        key={calendar.id}
                                        type="button"
                                        onClick={() =>
                                            handleSelectCalendar(calendar.id)
                                        }
                                        aria-pressed={isSelected}
                                        className={`rounded-2xl border bg-card p-5 text-left shadow-sm transition-colors ${
                                            isSelected
                                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                                : "hover:bg-muted/50"
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <h3 className="font-semibold">
                                                    {calendar.name}
                                                </h3>
                                                <p className="mt-2 text-sm text-muted-foreground">
                                                    {calendar.description ||
                                                        "No description"}
                                                </p>
                                            </div>
                                            <CalendarDays className="size-5 shrink-0 text-muted-foreground" />
                                        </div>

                                        <div className="mt-4 flex flex-wrap items-center gap-2">
                                            <Badge variant="outline">
                                                ID: {calendar.id}
                                            </Badge>

                                            {calendar.activeVersionNumber !=
                                            null ? (
                                                <Badge>
                                                    ACTIVE v
                                                    {calendar.activeVersionNumber}
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary">
                                                    No active version
                                                </Badge>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </section>

                <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="font-semibold">
                                {selectedCalendar?.name ?? "No calendar selected"}
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Create a new draft version for the selected
                                calendar.
                            </p>
                        </div>

                        <Button
                            disabled={
                                isLoading ||
                                loadError !== null ||
                                !selectedCalendar
                            }
                            onClick={() => setDialogOpen(true)}
                        >
                            <Plus className="size-4" />
                            Create version
                        </Button>
                    </div>

                    {selectedCalendar && (
                        <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
                            <GitBranch className="size-4" />
                            Selected Calendar ID: {selectedCalendar.id}
                        </div>
                    )}
                </section>

                <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="font-semibold">Calendar Versions</h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Versions for{" "}
                                {selectedCalendar?.name ?? "the selected calendar"}.
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row">
                            <Select
                                value={statusFilter}
                                onValueChange={(value) => {
                                    setStatusFilter(
                                        value as CalendarVersionStatus | "ALL",
                                    );
                                    setPage(0);
                                }}
                                disabled={!selectedCalendar || !canReadVersions}
                            >
                                <SelectTrigger className="w-full sm:w-44">
                                    <SelectValue placeholder="Filter by status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">
                                        All statuses
                                    </SelectItem>
                                    <SelectItem value="DRAFT">Draft</SelectItem>
                                    <SelectItem value="ACTIVE">Active</SelectItem>
                                    <SelectItem value="INACTIVE">
                                        Inactive
                                    </SelectItem>
                                </SelectContent>
                            </Select>

                            <Input
                                type="number"
                                min={1}
                                step={1}
                                className="w-full sm:w-44"
                                placeholder="Version number"
                                aria-label="Filter by version number"
                                value={versionNumberInput}
                                disabled={!selectedCalendar || !canReadVersions}
                                onChange={(event) => {
                                    setVersionNumberInput(event.target.value);
                                    setPage(0);
                                }}
                            />

                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setStatusFilter("ALL");
                                    setVersionNumberInput("");
                                    setPage(0);
                                }}
                                disabled={
                                    statusFilter === "ALL" &&
                                    versionNumberInput === ""
                                }
                            >
                                <Filter className="size-4" />
                                Clear
                            </Button>
                        </div>
                    </div>

                    {!selectedCalendar ? (
                        <p className="mt-6 text-sm text-muted-foreground">
                            Select a calendar to view its versions.
                        </p>
                    ) : !canReadVersions ? (
                        <p className="mt-6 text-sm text-destructive">
                            You do not have permission to view calendar versions.
                        </p>
                    ) : !versionNumberValid ? (
                        <p className="mt-6 text-sm text-destructive">
                            Version number must be a positive whole number.
                        </p>
                    ) : versionsQuery.isPending ? (
                        <p
                            role="status"
                            className="mt-6 text-sm text-muted-foreground"
                        >
                            Loading calendar versions...
                        </p>
                    ) : versionsQuery.isError ? (
                        <div role="alert" className="mt-6 space-y-3">
                            <p className="text-sm text-destructive">
                                Could not load calendar versions.
                            </p>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void versionsQuery.refetch()}
                            >
                                Try again
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div className="mt-6">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Version</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Created</TableHead>
                                            <TableHead>Activated</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {versionsQuery.data.content.length ===
                                        0 ? (
                                            <TableRow>
                                                <TableCell
                                                    colSpan={4}
                                                    className="h-24 text-center text-muted-foreground"
                                                >
                                                    No matching calendar
                                                    versions found.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            versionsQuery.data.content.map(
                                                (version) => (
                                                    <TableRow
                                                        key={
                                                            version.id ??
                                                            version.versionNumber
                                                        }
                                                    >
                                                        <TableCell className="font-medium">
                                                            v
                                                            {
                                                                version.versionNumber
                                                            }
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline">
                                                                {version.status}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            {formatDate(
                                                                version.createdAt,
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {formatDate(
                                                                version.activatedAt,
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ),
                                            )
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm text-muted-foreground">
                                    {versionsQuery.data.totalElements} version(s)
                                    {" · "}Page {versionsQuery.data.number + 1}{" "}
                                    of{" "}
                                    {Math.max(
                                        versionsQuery.data.totalPages,
                                        1,
                                    )}
                                </p>

                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={versionsQuery.data.first}
                                        onClick={() =>
                                            setPage((current) =>
                                                Math.max(0, current - 1),
                                            )
                                        }
                                    >
                                        <ChevronLeft className="size-4" />
                                        Previous
                                    </Button>

                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={versionsQuery.data.last}
                                        onClick={() =>
                                            setPage((current) => current + 1)
                                        }
                                    >
                                        Next
                                        <ChevronRight className="size-4" />
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </section>

                <CreateVersionDialog
                    open={dialogOpen}
                    calendarName={selectedCalendar?.name ?? ""}
                    hasActiveVersion={
                        selectedCalendar?.activeVersionNumber != null
                    }
                    onOpenChange={setDialogOpen}
                    onSubmit={handleCreateVersion}
                />
            </div>
        </MainLayout>
    );
}