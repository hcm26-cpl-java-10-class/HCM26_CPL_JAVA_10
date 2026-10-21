import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, Pen, Trash2, History } from "lucide-react";
import axios from "axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import TrainingClassCreateForm from "./TrainingClassCreateForm";
import TrainingClassEditForm from "./TrainingClassEditForm";
import { MainLayout } from "@/components/layout/MainLayout";
import { ProTable } from "@/components/datatable/ProTable";
import { useProTable } from "@/components/datatable/hook/useProTable";
import ActionButton from "@/components/datatable/common/ActionButton";
import { DetailModal } from "@/components/datatable/modal/DetailModal";
import { ConfirmDeleteModal } from "@/components/datatable/modal/ConfirmDeleteModal";
import { usePermissions } from "@/hooks/usePermissions";
import type { EntitySchema } from "@/types";


import {
    getTrainingClassCreateOptions,
    trainingClassTableApi,
    type TrainingClassResponse,
    type TrainingClassTablePagination,
} from "@/api/features/schedule/training-class.api";

import { trainingClassSchema } from "./training-class.schema";

export default function TrainingClassListPage() {
    const queryClient = useQueryClient();
    const { hasPermission } = usePermissions();
    const canRead = hasPermission("TRAINING_CLASS_READ");
    const canViewRevisions = ["TRAINING_CLASS_CREATE", "TRAINING_CLASS_UPDATE", "TRAINING_CLASS_SUBMIT", "TRAINING_CLASS_APPROVE"].some(hasPermission);

    const [detailRow, setDetailRow] =
        useState<TrainingClassResponse | null>(null);
    const [loadError, setLoadError] = useState("");

    const canLoadOptions =
        hasPermission("TRAINING_CLASS_CREATE") ||
        hasPermission("TRAINING_CLASS_UPDATE");

    const createOptionsQuery = useQuery({
        queryKey: ["training-class-create-options"],
        queryFn: getTrainingClassCreateOptions,
        enabled: canLoadOptions,
        staleTime: 60_000,
    });

    const resolvedSchema = useMemo<EntitySchema>(() => {
        const options = createOptionsQuery.data;

        return {
            ...trainingClassSchema,
            fields: trainingClassSchema.fields.map((field) => {
                switch (field.name) {
                    case "code":
                        return {
                            ...field,
                            render: (value: unknown, row: TrainingClassResponse) =>
                                canRead ? (
                                    <Link
                                        to={`/training-classes/${row.id}?tab=info`}
                                        className="font-semibold text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        {String(value ?? "—")}
                                    </Link>
                                ) : String(value ?? "—"),
                        };

                    case "site":
                        return {
                            ...field,
                            type: "select" as const,
                            options: options?.sites ?? [],
                        };

                    case "traineeType":
                        return {
                            ...field,
                            type: "select" as const,
                            options: options?.traineeTypes ?? [],
                        };

                    case "deliveryFormat":
                        return {
                            ...field,
                            type: "select" as const,
                            options: options?.deliveryFormats ?? [],
                        };

                    case "location":
                        return { ...field, options: options?.locations ?? [] };

                    default:
                        return field;
                }
            }),
        };
    }, [createOptionsQuery.data, canRead]);

    const api = useMemo(
        () => ({
            create: trainingClassTableApi.create,
            update: trainingClassTableApi.update,
            delete: trainingClassTableApi.delete,

            async getPage(
                pagination: TrainingClassTablePagination,
                search = "",
                filters: Record<string, unknown> = {},
            ) {
                setLoadError("");

                try {
                    return await trainingClassTableApi.getPage(
                        pagination,
                        search,
                        filters,
                    );
                } catch (error: unknown) {
                    let message =
                        "Unable to load training classes. Please try again.";

                    if (error instanceof Error) {
                        message = error.message;
                    }

                    if (axios.isAxiosError(error)) {
                        if (error.response?.status === 401) {
                            message =
                                "Please log in to view training classes.";
                        } else if (error.response?.status === 403) {
                            message =
                                "You do not have permission to view training classes.";
                        }
                    }

                    setLoadError(message);
                    throw error;
                }
            },
        }),
        [],
    );

    const table = useProTable(api, resolvedSchema, {
        permissionOverrides: {
            canCreate:
                hasPermission("TRAINING_CLASS_CREATE") &&
                createOptionsQuery.isSuccess,
            canUpdate:
                hasPermission("TRAINING_CLASS_UPDATE") &&
                createOptionsQuery.isSuccess,
            canDelete: hasPermission("TRAINING_CLASS_DELETE"),
            canImport: false,
            canExport: false,
        },
    });

    function retry() {
        setLoadError("");

        void queryClient.invalidateQueries({
            queryKey: ["training-class"],
        });
    }

    return (
        <MainLayout
            pathName={{ "training-classes": "Training Classes" }}
        >
            <div className="flex h-full min-h-0 flex-col gap-4">
                {canLoadOptions && createOptionsQuery.isPending && (
                    <p
                        role="status"
                        className="text-sm text-muted-foreground"
                    >
                        Loading class options...
                    </p>
                )}

                {canLoadOptions && createOptionsQuery.isError && (
                    <div
                        role="alert"
                        className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"
                    >
                        <p>Unable to load class options.</p>

                        <button
                            type="button"
                            className="rounded-md border bg-background px-3 py-2"
                            onClick={() =>
                                void createOptionsQuery.refetch()
                            }
                            disabled={createOptionsQuery.isFetching}
                        >
                            Retry
                        </button>
                    </div>
                )}

                {loadError && (
                    <div
                        role="alert"
                        className="flex items-center justify-between gap-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"
                    >
                        <p>{loadError}</p>

                        <button
                            type="button"
                            className="rounded-md border bg-background px-3 py-2"
                            onClick={retry}
                        >
                            Retry
                        </button>
                    </div>
                )}

                <div className="min-h-0 flex-1">
                    <TrainingClassTable
                        table={table}
                        canRead={canRead}
                        canViewRevisions={canViewRevisions}
                        onQuickView={setDetailRow}
                    />
                </div>

                <DetailModal
                    open={detailRow !== null}
                    onClose={(open) => {
                        if (!open) {
                            setDetailRow(null);
                        }
                    }}
                    schema={resolvedSchema}
                    row={detailRow}
                />
            </div>
        </MainLayout>
    );
}

interface TrainingClassTableProps {
    table: ReturnType<typeof useProTable>;
    canRead: boolean;
    canViewRevisions: boolean;
    onQuickView: (row: TrainingClassResponse) => void;
}

function TrainingClassTable({
                                table,
                                canRead,
                                canViewRevisions,
                                onQuickView,
                            }: TrainingClassTableProps) {
    const [deleteRow, setDeleteRow] =
        useState<TrainingClassResponse | null>(null);
    const [deleting, setDeleting] = useState(false);

    async function confirmDelete() {
        if (
            !deleteRow ||
            !table.permission?.canDelete ||
            deleting
        ) {
            return;
        }

        setDeleting(true);

        try {
            const success = await table.remove(deleteRow.id);

            if (success) {
                setDeleteRow(null);
            }
        } finally {
            setDeleting(false);
        }
    }

    return (
        <>
            <ProTable<TrainingClassResponse>
                table={table}
                mode="default"
                renderFormModal={({ open, onClose, schema, initial, onSubmit }) =>
                    initial ? (
                        <TrainingClassEditForm
                            open={open}
                            onClose={onClose}
                            schema={schema}
                            initial={initial}
                            isSubmitting={table.isSubmitting}
                            fieldErrors={table.fieldErrors}
                            onClearErrors={() => table.setFieldErrors({})}
                            onSubmit={onSubmit}
                        />
                    ) : (
                        <TrainingClassCreateForm
                            open={open}
                            onClose={onClose}
                            schema={schema}
                            isSubmitting={table.isSubmitting}
                            fieldErrors={table.fieldErrors}
                            onSubmit={onSubmit}
                        />
                    )
                }
                renderRowActions={(row) => (
                    <>
                        {canRead && (
                            <ActionButton
                                onClick={() => onQuickView(row)}
                                tooltip="View detail"
                                icon={
                                    <Eye
                                        size={10}
                                        className="text-gray-500"
                                    />
                                }
                            />
                        )}

                        {table.permission?.canUpdate &&
                            row.isActive &&
                            ["PLANNING", "ONGOING"].includes(row.status) && (
                                <ActionButton
                                    onClick={() => table.openEdit(row)}
                                    tooltip="Edit draft"
                                    icon={
                                        <Pen
                                            size={10}
                                            className="text-gray-500"
                                        />
                                    }
                                />
                            )}

                        {canRead && canViewRevisions && <Link to={`/training-classes/${row.id}?tab=revisions`} aria-label={`Revisions of ${row.code}`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-muted"><History size={14} /></Link>}

                        {table.permission?.canDelete && (
                            <ActionButton
                                onClick={() => setDeleteRow(row)}
                                tooltip="Deactivate class"
                                icon={
                                    <Trash2
                                        size={10}
                                        className="text-red-500"
                                    />
                                }
                            />
                        )}
                    </>
                )}
            />

            <ConfirmDeleteModal
                open={deleteRow !== null}
                onOpenChange={(open) => {
                    if (!open && !deleting) {
                        setDeleteRow(null);
                    }
                }}
                onConfirm={confirmDelete}
                loading={deleting}
                title="Deactivate Class"
                description={
                    deleteRow
                        ? `Deactivate "${deleteRow.code}"? It will be hidden from the class list. Its record and related data will be retained.`
                        : undefined
                }
            />
        </>
    );
}
