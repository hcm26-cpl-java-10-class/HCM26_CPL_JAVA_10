import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import axios from "axios";
import { usePermissions } from "@/hooks/usePermissions";
import ClassCalendarTab from "./ClassCalendarTab";
import {
    getTrainingClass,
    type TrainingClassResponse,
} from "@/api/features/schedule/training-class.api";
import { MainLayout } from "@/components/layout/MainLayout";
export default function TrainingClassDetailPage() {
    const { classId } = useParams<{ classId: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const { hasPermission } = usePermissions();

    const activeTab =
        searchParams.get("tab") === "calendar" ? "calendar" : "info";

    const [data, setData] = useState<TrainingClassResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [reload, setReload] = useState(0);

    function selectTab(tab: "info" | "calendar") {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set("tab", tab);
        setSearchParams(nextParams);
    }

    useEffect(() => {
        let active = true;

        setData(null);
        setError("");
        setLoading(true);

        if (!classId || !/^[1-9]\d*$/.test(classId)) {
            setError("Invalid class ID.");
            setLoading(false);
            return;
        }

        getTrainingClass(classId)
            .then((result) => {
                if (active) setData(result);
            })
            .catch((err: unknown) => {
                if (!active) return;

                let message = "Unable to load class details. Please try again.";

                if (axios.isAxiosError(err)) {
                    switch (err.response?.status) {
                        case 401:
                            message = "Please log in to view this class.";
                            break;
                        case 403:
                            message = "You do not have permission to view this class.";
                            break;
                        case 404:
                            message = "Class not found.";
                            break;
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

    const fields: [string, string | number][] = data
        ? [
            ["Class Code", data.code],
            ["Class Name", data.name],
            ["Trainee Type", data.traineeType],
            ["Delivery Format", data.deliveryFormat],
            ["Site", data.site],
            ["Location", data.location],
            ["Program Version ID", data.programVersionId],
            ["Start Date", data.startDate],
            ["End Date", data.endDate],
            ["Capacity", data.capacity],
            ["Status", data.status],
        ]
        : [];

    return (
        <MainLayout
            pathName={{
                "training-classes": "Training Classes",
                ...(classId ? { [classId]: "Class Details" } : {}),
            }}
        >
            <section className="mx-auto max-w-4xl rounded-xl border bg-white p-6 shadow-sm">
                <h1 className="text-2xl font-semibold">Class Details</h1>

                {loading && (
                    <p className="mt-6" role="status">
                        Loading class details...
                    </p>
                )}

                {error && (
                    <div className="mt-6" role="alert">
                        <p className="text-red-600">{error}</p>
                        <button
                            type="button"
                            className="mt-3 rounded border px-4 py-2"
                            onClick={() => setReload((value) => value + 1)}
                        >
                            Retry
                        </button>
                    </div>
                )}

                {!loading && data && (
                    <>
                        <p className="mt-2 text-sm text-slate-500">
                            Class ID: {data.id}
                        </p>

                        <nav
                            aria-label="Class sections"
                            className="mt-6 flex gap-2 border-b pb-3"
                        >
                            <button
                                type="button"
                                aria-current={activeTab === "info" ? "page" : undefined}
                                onClick={() => selectTab("info")}
                                className={`rounded px-4 py-2 ${
                                    activeTab === "info"
                                        ? "bg-blue-700 text-white"
                                        : "border"
                                }`}
                            >
                                Class Info
                            </button>

                            {hasPermission("CALENDAR_READ") && (
                                <button
                                    type="button"
                                    aria-current={
                                        activeTab === "calendar" ? "page" : undefined
                                    }
                                    onClick={() => selectTab("calendar")}
                                    className={`rounded px-4 py-2 ${
                                        activeTab === "calendar"
                                            ? "bg-blue-700 text-white"
                                            : "border"
                                    }`}
                                >
                                    Calendar
                                </button>
                            )}
                        </nav>

                        {activeTab === "info" && (
                            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                                {fields.map(([label, value]) => (
                                    <div key={label} className="rounded-lg border p-4">
                                        <dt className="text-sm text-slate-500">{label}</dt>
                                        <dd className="mt-1 break-words font-medium">
                                            {value}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        )}

                        {activeTab === "calendar" && (
                            <section aria-label="Class calendar" className="mt-6">
                                {hasPermission("CALENDAR_READ") ? (
                                    <ClassCalendarTab key={data.id} classId={data.id} />
                                ) : (
                                    <p role="alert" className="text-red-600">
                                        You do not have permission to view calendars.
                                    </p>
                                )}
                            </section>
                        )}
                    </>
                )}
            </section>
        </MainLayout>
    );
}