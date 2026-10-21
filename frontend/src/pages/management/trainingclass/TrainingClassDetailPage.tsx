import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, BookOpen, CalendarDays, Users, History } from "lucide-react";

import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";

import ClassCalendarTab from "./ClassCalendarTab";
import ClassTraineesTab from "./ClassTraineesTab";
import TrainingClassRevisionPanel from "./TrainingClassRevisionPanel";
import {
    getTrainingClass,
    type TrainingClassResponse,
} from "@/api/features/schedule/training-class.api";

type ClassTab = "info" | "trainees" | "calendar" | "revisions";

function formatDate(value: string): string {
    const parts = value.split("-");

    if (parts.length !== 3) return value;

    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export default function TrainingClassDetailPage() {
    const { classId } = useParams<{ classId: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const { hasPermission } = usePermissions();
    const canViewRevisions = ["TRAINING_CLASS_CREATE", "TRAINING_CLASS_UPDATE", "TRAINING_CLASS_SUBMIT", "TRAINING_CLASS_APPROVE"].some(hasPermission);

    const requestedTab = searchParams.get("tab");
    const activeTab: ClassTab =
        requestedTab === "calendar" || requestedTab === "trainees" || (requestedTab === "revisions" && canViewRevisions)
            ? requestedTab
            : "info";

    const [data, setData] = useState<TrainingClassResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [reload, setReload] = useState(0);

    function selectTab(tab: ClassTab) {
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

                let message =
                    "Unable to load class details. Please try again.";

                if (axios.isAxiosError(err)) {
                    switch (err.response?.status) {
                        case 401:
                            message = "Please log in to view this class.";
                            break;
                        case 403:
                            message =
                                "You do not have permission to view this class.";
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

    const tabs = [
        { id: "info" as const, label: "Class Info", icon: BookOpen },
        { id: "trainees" as const, label: "Trainees", icon: Users },
        ...(canViewRevisions ? [{ id: "revisions" as const, label: "Revisions & Approval", icon: History }] : []),
        ...(hasPermission("CALENDAR_READ")
            ? [{
                id: "calendar" as const,
                label: "Calendar",
                icon: CalendarDays,
            }]
            : []),
    ];

    const information: [string, string | number][] = data
        ? [
            ["Class Code", data.code],
            ["Class Name", data.name],
            ["Description / Notes", data.description || "—"],
            ["Site", data.site],
            ["Location", data.location],
            ["Trainee Type", data.traineeType],
            ["Delivery Format", data.deliveryFormat],
            ["Program Version ID", data.programVersionId],
            ["Capacity", data.capacity],
            ["Start Date", formatDate(data.startDate)],
            ["End Date", formatDate(data.endDate)],
        ]
        : [];

    return (
        <MainLayout
            pathName={{
                "training-classes": "Training Classes",
                ...(classId ? { [classId]: "Class Details" } : {}),
            }}
        >
            <div className="w-full min-w-0 space-y-5 rounded-xl bg-muted/40 p-4 sm:p-6">
                <Link
                    to="/training-classes"
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Training Classes
                </Link>

                {loading && (
                    <div
                        role="status"
                        className="rounded-lg border bg-card p-6 text-sm text-muted-foreground"
                    >
                        Loading class details...
                    </div>
                )}

                {error && (
                    <div
                        role="alert"
                        className="space-y-4 rounded-lg border bg-card p-6"
                    >
                        <h1 className="text-xl font-semibold">
                            Class Details
                        </h1>
                        <p className="text-sm text-destructive">{error}</p>
                        <Button
                            variant="outline"
                            onClick={() => setReload((value) => value + 1)}
                        >
                            Retry
                        </Button>
                    </div>
                )}

                {!loading && !error && data && (
                    <>
                        <header className="space-y-3 rounded-xl border bg-card p-5 shadow-sm">
                            <div className="flex flex-wrap items-center gap-3">
                                <h1 className="break-words text-2xl font-semibold">
                                    {data.name}
                                </h1>
                                <Badge variant="secondary">
                                    {data.status.replace(/_/g, " ")}
                                </Badge>
                                <Badge variant="outline">{data.currentRevisionNo ? `Active v${data.currentRevisionNo}` : "Not approved"}</Badge>
                                {canViewRevisions && data.pendingRevisionNo && <Button variant="outline" size="sm" onClick={() => selectTab("revisions")}>{data.pendingRevisionStatus?.replace(/_/g, " ")} v{data.pendingRevisionNo}</Button>}
                            </div>

                            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                                <span>{data.code}</span>
                                <span>Site: {data.site}</span>
                                <span>Class ID: {data.id}</span>
                            </div>
                        </header>

                        <nav
                            aria-label="Class sections"
                            className="flex gap-1 overflow-x-auto border-b"
                        >
                            {tabs.map((tab) => {
                                const Icon = tab.icon;
                                const selected = activeTab === tab.id;

                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        aria-current={
                                            selected ? "page" : undefined
                                        }
                                        onClick={() => selectTab(tab.id)}
                                        className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                                            selected
                                                ? "border-foreground bg-muted text-foreground"
                                                : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                        }`}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </nav>

                        {activeTab === "info" && (
                            <section
                                aria-label="Class information"
                                className="rounded-lg border bg-card"
                            >
                                <div className="rounded-t-lg border-b bg-muted/40 px-5 py-4">
                                    <h2 className="font-semibold">
                                        Class Information
                                    </h2>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        {data.currentRevisionNo ? `Approved information from Active v${data.currentRevisionNo}.` : "Draft preview. This class has no approved revision yet."}
                                    </p>
                                </div>

                                <dl className="grid sm:grid-cols-2 xl:grid-cols-3">
                                    {information.map(([label, value]) => (
                                        <div
                                            key={label}
                                            className="min-w-0 border-b px-5 py-4 transition-colors hover:bg-muted/30"
                                        >
                                            <dt className="text-sm text-muted-foreground">
                                                {label}
                                            </dt>
                                            <dd className="mt-2 whitespace-pre-wrap break-words text-sm font-medium">
                                                {value}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                            </section>
                        )}

                        {activeTab === "trainees" && (
                            <section
                                aria-label="Class trainees"
                                className="min-w-0 rounded-lg border bg-card p-5"
                            >
                                <ClassTraineesTab
                                    key={data.id}
                                    classId={data.id}
                                />
                            </section>
                        )}

                        {activeTab === "revisions" && canViewRevisions && <TrainingClassRevisionPanel data={data} onChanged={setData} />}

                        {activeTab === "calendar" && (
                            <section
                                aria-label="Class calendar"
                                className="min-w-0 rounded-lg border bg-card p-5"
                            >
                                {hasPermission("CALENDAR_READ") ? (
                                    <ClassCalendarTab
                                        key={data.id}
                                        classId={data.id}
                                    />
                                ) : (
                                    <p
                                        role="alert"
                                        className="text-sm text-destructive"
                                    >
                                        You do not have permission to view calendars.
                                    </p>
                                )}
                            </section>
                        )}
                    </>
                )}
            </div>
        </MainLayout>
    );
}
