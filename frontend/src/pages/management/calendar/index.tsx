import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { calendarVersionApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirmdialog";
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
    CalendarVersionResponse,
    CalendarVersionStatus,
    CreateCalendarVersionRequest,
    EntityConfig,
    EntitySchema,
    UpdateCalendarVersionRequest,
} from "@/types";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Eye,
    Filter,
    GitBranch,
    Pencil,
    Plus,
    Sparkles,
    Trash2,
} from "lucide-react";
import { CreateVersionDialog } from "./components/CreateVersionDialog";
import { EditVersionDialog } from "./components/EditVersionDialog";
import { VersionSessionsDialog } from "./components/VersionSessionsDialog";

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

const getRequestErrorMessage = (
    error: unknown,
    fallback: string,
): string => {
    if (axios.isAxiosError<{ message?: string }>(error)) {
        return error.response?.data?.message ?? fallback;
    }

    return error instanceof Error ? error.message : fallback;
};

export default function CalendarManagementPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const urlCalendarId = searchParams.get("calendarId");
    const urlVersionId = searchParams.get("versionId");

    const [calendars, setCalendars] = useState<CalendarSummary[]>([]);
    const [selectedCalendarId, setSelectedCalendarId] = useState<number | null>(
        urlCalendarId ? Number(urlCalendarId) : null,
    );
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    const [viewingSessionsVersion, setViewingSessionsVersion] =
        useState<CalendarVersionResponse | null>(null);
    const [editingVersion, setEditingVersion] =
        useState<CalendarVersionResponse | null>(null);
    const [deletingVersion, setDeletingVersion] =
        useState<CalendarVersionResponse | null>(null);
    const [isUpdatingVersion, setIsUpdatingVersion] = useState(false);
    const [isDeletingVersion, setIsDeletingVersion] = useState(false);

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
    const canUpdateVersion = hasPermission("CALENDARVERSION_UPDATE");
    const canDeleteVersion = hasPermission("CALENDARVERSION_DELETE");

    const loadCalendars = useCallback(async () => {
        setIsLoading(true);
        setLoadError(null);

        try {
            const data = await calendarVersionApi.list();

            setCalendars(data);
            setSelectedCalendarId((currentId) => {
                if (urlCalendarId && data.some((c) => c.id === Number(urlCalendarId))) {
                    return Number(urlCalendarId);
                }
                return data.some((calendar) => calendar.id === currentId)
                    ? currentId
                    : (data[0]?.id ?? null);
            });
        } catch (error) {
            const message = getRequestErrorMessage(
                error,
                "Could not load calendars.",
            );

            setLoadError(message);
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    }, [urlCalendarId]);

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

    useEffect(() => {
        if (urlVersionId && versionsQuery.data?.content) {
            const found = versionsQuery.data.content.find(
                (v) => v.id === Number(urlVersionId)
            );
            if (found && !viewingSessionsVersion) {
                setViewingSessionsVersion(found);
            }
        }
    }, [urlVersionId, versionsQuery.data?.content, viewingSessionsVersion]);

    const handleCreateVersion = async (
        request: CreateCalendarVersionRequest,
    ): Promise<void> => {
        if (!selectedCalendar) {
            toast.error("Please select a calendar.");
            return;
        }

        try {
            const result = await calendarVersionApi.create(
                selectedCalendar.id,
                request,
            );

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
            toast.error(
                getRequestErrorMessage(
                    error,
                    "Could not create calendar version.",
                ),
            );
        }
    };

    const handleUpdateVersion = async (
        request: UpdateCalendarVersionRequest,
    ): Promise<void> => {
        if (!selectedCalendar || editingVersion?.id == null) {
            toast.error("Could not identify the calendar version to update.");
            return;
        }

        setIsUpdatingVersion(true);

        try {
            await calendarVersionApi.update(
                selectedCalendar.id,
                editingVersion.id,
                request,
            );

            toast.success("Calendar version updated.");
            setEditingVersion(null);

            await queryClient.invalidateQueries({
                queryKey: ["calendar-versions", selectedCalendar.id],
            });
        } catch (error) {
            toast.error(
                getRequestErrorMessage(
                    error,
                    "Could not update calendar version.",
                ),
            );
        } finally {
            setIsUpdatingVersion(false);
        }
    };

    const handleDeleteVersion = async (): Promise<void> => {
        if (!selectedCalendar || deletingVersion?.id == null) {
            toast.error("Could not identify the calendar version to delete.");
            return;
        }

        setIsDeletingVersion(true);

        try {
            await calendarVersionApi.delete(
                selectedCalendar.id,
                deletingVersion.id,
            );

            toast.success("Calendar version deleted.");
            setDeletingVersion(null);

            if (page > 0 && versionsQuery.data?.content.length === 1) {
                setPage((currentPage) => Math.max(0, currentPage - 1));
            }

            await queryClient.invalidateQueries({
                queryKey: ["calendar-versions", selectedCalendar.id],
            });
        } catch (error) {
            toast.error(
                getRequestErrorMessage(
                    error,
                    "Could not delete calendar version.",
                ),
            );
        } finally {
            setIsDeletingVersion(false);
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
                        <p
                            role="status"
                            className="text-sm text-muted-foreground"
                        >
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
                                            <TableHead>Name</TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Created</TableHead>
                                            <TableHead>Activated</TableHead>
                                            <TableHead className="min-w-[280px]">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {versionsQuery.data.content.length ===
                                        0 ? (
                                            <TableRow>
                                                <TableCell
                                                    colSpan={7}
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
                                                            v{version.versionNumber}
                                                        </TableCell>
                                                        <TableCell>
                                                            {version.name || "—"}
                                                        </TableCell>
                                                        <TableCell className="max-w-xs truncate">
                                                            {version.description ||
                                                                "—"}
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
                                                        <TableCell>
                                                            <div className="flex flex-wrap items-center gap-1.5">
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-8 gap-1 px-2.5 text-xs"
                                                                    onClick={() =>
                                                                        setViewingSessionsVersion(
                                                                            version,
                                                                        )
                                                                    }
                                                                >
                                                                    <Eye className="size-3.5" />
                                                                    Sessions
                                                                </Button>

                                                                {version.status ===
                                                                "DRAFT" && (
                                                                    <>
                                                                        <Button
                                                                            type="button"
                                                                            size="sm"
                                                                            variant="outline"
                                                                            className="h-8 gap-1 px-2.5 text-xs border-primary/40 text-primary hover:bg-primary/10"
                                                                            onClick={() =>
                                                                                navigate(
                                                                                    `/sessions/bulk-generate?calendarId=${selectedCalendar?.id}&versionId=${version.id}&classId=${selectedCalendar?.classId ?? 101}`,
                                                                                )
                                                                            }
                                                                        >
                                                                            <Sparkles className="size-3.5" />
                                                                            Generate
                                                                        </Button>

                                                                        {canUpdateVersion &&
                                                                            version.id !=
                                                                            null && (
                                                                                <Button
                                                                                    type="button"
                                                                                    size="sm"
                                                                                    variant="outline"
                                                                                    className="h-8 gap-1 px-2.5 text-xs"
                                                                                    onClick={() =>
                                                                                        setEditingVersion(
                                                                                            version,
                                                                                        )
                                                                                    }
                                                                                >
                                                                                    <Pencil className="size-3.5" />
                                                                                    Edit
                                                                                </Button>
                                                                            )}

                                                                        {canDeleteVersion &&
                                                                            version.id !=
                                                                            null && (
                                                                                <Button
                                                                                    type="button"
                                                                                    size="sm"
                                                                                    variant="destructive"
                                                                                    className="h-8 gap-1 px-2.5 text-xs"
                                                                                    onClick={() =>
                                                                                        setDeletingVersion(
                                                                                            version,
                                                                                        )
                                                                                    }
                                                                                >
                                                                                    <Trash2 className="size-3.5" />
                                                                                    Delete
                                                                                </Button>
                                                                            )}
                                                                    </>
                                                                )}
                                                            </div>
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

                <EditVersionDialog
                    version={editingVersion}
                    submitting={isUpdatingVersion}
                    onOpenChange={(open) => {
                        if (!open) setEditingVersion(null);
                    }}
                    onSubmit={handleUpdateVersion}
                />

                <ConfirmDialog
                    open={deletingVersion !== null}
                    title="Delete draft calendar version?"
                    description={
                        deletingVersion
                            ? `Delete draft v${deletingVersion.versionNumber}? Its sessions will also be soft deleted.`
                            : undefined
                    }
                    confirmLabel="Delete version"
                    loading={isDeletingVersion}
                    onConfirm={() => void handleDeleteVersion()}
                    onCancel={() => {
                        if (!isDeletingVersion) setDeletingVersion(null);
                    }}
                />

                <VersionSessionsDialog
                    open={viewingSessionsVersion !== null}
                    onOpenChange={(open) => {
                        if (!open) setViewingSessionsVersion(null);
                    }}
                    calendarName={selectedCalendar?.name}
                    version={viewingSessionsVersion}
                />
            </div>
        </MainLayout>
    );
}