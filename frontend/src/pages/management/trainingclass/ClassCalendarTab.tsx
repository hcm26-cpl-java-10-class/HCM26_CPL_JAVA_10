import { useEffect, useState } from "react";
import axios from "axios";
import { calendarVersionApi } from "@/api";
import type { CalendarSummary } from "@/types";

interface Props {
    classId: number;
}

export default function ClassCalendarTab({ classId }: Props) {
    const [calendars, setCalendars] = useState<CalendarSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [reload, setReload] = useState(0);

    useEffect(() => {
        let active = true;

        setCalendars([]);
        setLoading(true);
        setError("");

        calendarVersionApi.list()
            .then((result) => {
                if (!active) return;

                if (result.some((calendar) => calendar.classId == null)) {
                    setError("Calendar data is missing its class reference.");
                    return;
                }

                setCalendars(
                    result.filter(
                        (calendar) => String(calendar.classId) === String(classId),
                    ),
                );
            })
            .catch((err: unknown) => {
                if (!active) return;

                let message = "Unable to load the class calendar.";

                if (axios.isAxiosError(err)) {
                    if (err.response?.status === 403) {
                        message = "You do not have permission to view calendars.";
                    } else if (err.response?.status === 401) {
                        message = "Please log in to view calendars.";
                    }
                }

                setError(message);
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [classId, reload]);

    if (loading) {
        return <p role="status">Loading class calendar...</p>;
    }

    if (error) {
        return (
            <div role="alert">
                <p className="text-red-600">{error}</p>
                <button
                    type="button"
                    className="mt-3 rounded border px-4 py-2"
                    onClick={() => setReload((value) => value + 1)}
                >
                    Retry
                </button>
            </div>
        );
    }

    if (calendars.length === 0) {
        return <p>No calendar is available for this class.</p>;
    }

    return (
        <div className="space-y-4">
            {calendars.map((calendar) => (
                <article key={calendar.id} className="rounded-lg border p-4">
                    <h2 className="font-semibold">{calendar.name}</h2>

                    <p className="mt-2 text-sm text-slate-500">
                        {calendar.description || "No description."}
                    </p>

                    <dl className="mt-4 space-y-2">
                        <div>
                            <dt className="inline font-medium">Calendar ID: </dt>
                            <dd className="inline">{calendar.id}</dd>
                        </div>
                        <div>
                            <dt className="inline font-medium">Class ID: </dt>
                            <dd className="inline">{calendar.classId}</dd>
                        </div>
                        <div>
                            <dt className="inline font-medium">Active Version: </dt>
                            <dd className="inline">
                                {calendar.activeVersionNumber == null
                                    ? "No active version"
                                    : `v${calendar.activeVersionNumber}`}
                            </dd>
                        </div>
                    </dl>
                </article>
            ))}
        </div>
    );
}