import { useCallback, useEffect, useState } from "react";
import { calendarVersionApi } from "@/api";
import type {
    CalendarSummary,
    CalendarVersionCreationMode,
    EntityConfig,
    EntitySchema,
} from "@/types";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CalendarDays, GitBranch, Plus } from "lucide-react";
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

export default function CalendarManagementPage() {
    const [calendars, setCalendars] = useState<CalendarSummary[]>([]);
    const [selectedCalendarId, setSelectedCalendarId] = useState<number | null>(
        null,
    );
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    const loadCalendars = useCallback(async () => {
        setIsLoading(true);
        setLoadError(null);

        try {
            const data = await calendarVersionApi.list();

            setCalendars(data);
            setSelectedCalendarId((currentId) =>
                data.some((calendar) => calendar.id === currentId)
                    ? currentId
                    : data[0]?.id ?? null,
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
            await loadCalendars();
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
                            Create draft versions for an academic calendar.
                        </p>
                    </div>
                </header>

                <section className="space-y-4">
                    <h2 className="text-lg font-semibold">Select a calendar</h2>

                    {isLoading ? (
                        <p className="text-sm text-muted-foreground">
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
                                            setSelectedCalendarId(calendar.id)
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
                                                    {calendar.description}
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
                                isLoading || loadError !== null || !selectedCalendar
                            }
                            onClick={() => setDialogOpen(true)}
                        >
                            <Plus className="mr-2 size-4" />
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