
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import {
    CheckCircle2,
    CircleAlert,
    RefreshCw,
    LockKeyhole,
    Send,
    Undo2,
} from "lucide-react";

import {
    syllabusApi,
    type SyllabusProgress,
} from "@/api/features/demo/syllabus.api";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { usePermissions } from "@/hooks/usePermissions";

type Props = {
    syllabusId: number;
};

function errorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
        const data = error.response?.data as
            | {
            message?: string;
            detail?: string;
            errors?: Record<string, string[]>;
        }
            | undefined;

        const firstError = data?.errors
            ? Object.values(data.errors).flat()[0]
            : undefined;

        if (typeof firstError === "string") {
            return firstError;
        }

        if (typeof data?.detail === "string") {
            return data.detail;
        }

        if (typeof data?.message === "string") {
            return data.message;
        }

        if (error.response?.status === 403) {
            return "You do not have permission to change this Syllabus.";
        }

        return `Request failed (HTTP ${error.response?.status ?? "unknown"}).`;
    }

    return "Unable to change Syllabus status.";
}

export default function SyllabusWorkflowPanel({
                                                  syllabusId,
                                              }: Props) {
    const qc = useQueryClient();
    const { hasPermission } = usePermissions();

    const canUpdate = hasPermission("SYLLABUS_UPDATE");
    const [busy, setBusy] = useState(false);

    const query = useQuery<SyllabusProgress>({
        queryKey: ["syllabus-progress", syllabusId],
        queryFn: () => syllabusApi.progress(syllabusId),
        enabled:
            Number.isSafeInteger(syllabusId) &&
            syllabusId > 0,
    });

    const progress = query.data;

    async function refreshAfterStatusChange() {
        await Promise.all([
            qc.invalidateQueries({
                queryKey: ["syllabus-progress", syllabusId],
            }),
            qc.invalidateQueries({
                queryKey: ["syllabus", syllabusId],
            }),
            qc.invalidateQueries({
                queryKey: ["syllabuses"],
            }),
        ]);
    }

    async function changeStatus(
        action: "publish" | "draft"
    ) {
        if (!progress || !canUpdate || busy) {
            return;
        }

        const confirmed = window.confirm(
            action === "publish"
                ? "Publish this Syllabus? All editing actions will be locked."
                : "Return this Syllabus to Draft so it can be edited again?"
        );

        if (!confirmed) {
            return;
        }

        setBusy(true);

        try {
            if (action === "publish") {
                await syllabusApi.publish(syllabusId);
            } else {
                await syllabusApi.returnToDraft(syllabusId);
            }

            await refreshAfterStatusChange();

            toast.success(
                action === "publish"
                    ? "Syllabus published successfully."
                    : "Syllabus returned to Draft."
            );
        } catch (error) {
            toast.error(errorMessage(error));

            await qc.invalidateQueries({
                queryKey: ["syllabus-progress", syllabusId],
            });
        } finally {
            setBusy(false);
        }
    }

    if (query.isPending) {
        return (
            <section className="rounded-xl border bg-card p-5">
                Loading Completion Progress...
            </section>
        );
    }

    if (query.isError || !progress) {
        return (
            <section className="space-y-3 rounded-xl border bg-card p-5">
                <p className="text-sm text-destructive">
                    Could not load Syllabus Completion Progress.
                </p>

                <Button
                    variant="outline"
                    onClick={() => void query.refetch()}
                >
                    <RefreshCw className="size-4" />
                    Retry
                </Button>
            </section>
        );
    }

    const published = progress.status === "PUBLISHED";

    return (
        <section className="w-full space-y-5 rounded-xl border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-xl font-semibold">
                        Completion Progress
                    </h2>

                    <p className="mt-1 text-sm text-muted-foreground">
                        Check required content before publishing.
                    </p>
                </div>

                <span
                    className={
                        published
                            ? "inline-flex items-center gap-2 rounded-full border border-green-500/40 bg-green-500/10 px-3 py-1 text-sm font-medium text-green-700 dark:text-green-400"
                            : "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium"
                    }
                >
                    {published && (
                        <LockKeyhole className="size-4" />
                    )}

                    {published ? "Published" : "Draft"}
                </span>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                        Syllabus completion
                    </span>

                    <span className="text-xl font-bold">
                        {progress.completionPercent}%
                    </span>
                </div>

                <Progress
                    value={progress.completionPercent}
                    className="h-3"
                />

                <p className="text-xs text-muted-foreground">
                    {
                        progress.checks.filter(
                            (check) => check.complete
                        ).length
                    }{" "}
                    of {progress.checks.length} requirements completed
                </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
                {progress.checks.map((check) => (
                    <div
                        key={check.key}
                        className="flex items-start gap-3 rounded-lg border p-3"
                    >
                        {check.complete ? (
                            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-green-600" />
                        ) : (
                            <CircleAlert className="mt-0.5 size-5 shrink-0 text-amber-500" />
                        )}

                        <div>
                            <p className="text-sm font-medium">
                                {check.label}
                            </p>

                            <p className="text-xs text-muted-foreground">
                                {check.complete
                                    ? "Completed"
                                    : "Needs attention"}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {!progress.canPublish && !published && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                    <p className="mb-2 font-medium">
                        Complete these requirements:
                    </p>

                    <ul className="list-inside list-disc space-y-1 text-sm">
                        {progress.missing.map((item) => (
                            <li key={item}>{item}</li>
                        ))}
                    </ul>
                </div>
            )}

            {progress.canPublish && !published && (
                <p className="text-sm text-green-600">
                    All required content is complete. This
                    Syllabus is ready to publish.
                </p>
            )}

            {published && (
                <p className="text-sm text-muted-foreground">
                    This Syllabus is published and read-only.
                    Return it to Draft before making changes.
                </p>
            )}

            <div className="flex flex-wrap justify-between gap-3 border-t pt-4">
                <Button
                    type="button"
                    variant="outline"
                    disabled={query.isFetching || busy}
                    onClick={() => void query.refetch()}
                >
                    <RefreshCw className="size-4" />
                    Refresh Progress
                </Button>

                {canUpdate && !published && (
                    <Button
                        type="button"
                        disabled={
                            busy ||
                            !progress.canPublish
                        }
                        onClick={() =>
                            void changeStatus("publish")
                        }
                    >
                        <Send className="size-4" />
                        {busy
                            ? "Processing..."
                            : "Publish Syllabus"}
                    </Button>
                )}

                {canUpdate && published && (
                    <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                            void changeStatus("draft")
                        }
                    >
                        <Undo2 className="size-4" />
                        {busy
                            ? "Processing..."
                            : "Return to Draft"}
                    </Button>
                )}
            </div>
        </section>
    );
}
