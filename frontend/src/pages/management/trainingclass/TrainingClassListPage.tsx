import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Pen, Trash2 } from "lucide-react";
import axios from "axios";

import { MainLayout } from "@/components/layout/MainLayout";
import { ProTable } from "@/components/datatable/ProTable";
import { useProTable } from "@/components/datatable/hook/useProTable";
import ActionButton from "@/components/datatable/common/ActionButton";
import { DetailModal } from "@/components/datatable/modal/DetailModal";
import { usePermissions } from "@/hooks/usePermissions";
import type { EntitySchema } from "@/types";
import { useQueryClient } from "@tanstack/react-query";
import { ConfirmDeleteModal } from "@/components/datatable/modal/ConfirmDeleteModal";

import {
    trainingClassTableApi,
    type TrainingClassResponse,
    type TrainingClassTablePagination,
} from "@/api/features/schedule/training-class.api";

const trainingClassSchema: EntitySchema = {
    entityName: "training-class",
    idField: "id",
    fields: [
        {
            name: "code",
            label: "Class Code",
            type: "text",
            bold: true,
            sortable: true,
            width: 230,
        },
        {
            name: "name",
            label: "Class Name",
            type: "text",
            sortable: true,
            width: 240,
        },
        {
            name: "site",
            label: "Site",
            type: "text",
            sortable: true,
            filterable: true,
            filterType: "text",
            width: 100,
        },
        {
            name: "traineeType",
            label: "Trainee Type",
            type: "text",
            sortable: true,
            width: 140,
        },
        {
            name: "deliveryFormat",
            label: "Delivery Format",
            type: "text",
            sortable: true,
            width: 150,
        },
        {
            name: "programVersionId",
            label: "Program Version ID",
            type: "number",
            sortable: true,
            filterable: true,
            filterType: "text",
            width: 170,
        },
        {
            name: "startDate",
            label: "Start Date",
            type: "date",
            sortable: true,
            filterable: true,
            filterType: "dateRange",
            width: 130,
        },
        {
            name: "endDate",
            label: "End Date",
            type: "date",
            sortable: true,
            visible: false,
            width: 130,
        },
        {
            name: "capacity",
            label: "Capacity",
            type: "number",
            sortable: true,
            width: 110,
        },
        {
            name: "location",
            label: "Location",
            type: "text",
            visible: false,
            width: 180,
        },
        {
            name: "createdAt",
            label: "Created At",
            type: "date",
            editable: false,
            sortable: true,
            visible: false,
            width: 180,
        },
    ],
};

export default function TrainingClassListPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { hasPermission } = usePermissions();

    const [detailRow, setDetailRow] =
        useState<TrainingClassResponse | null>(null);

    const [loadError, setLoadError] = useState("");
    const [retryVersion, setRetryVersion] = useState(0);

    const api = useMemo(
        () => ({
            delete: trainingClassTableApi.delete,
            create: trainingClassTableApi.create,
            update: trainingClassTableApi.update,
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

                    if (axios.isAxiosError(error)) {
                        if (error.response?.status === 401) {
                            message =
                                "Please log in to view training classes.";
                            if (error instanceof Error) {
                                message = error.message;
                            }
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

    const table = useProTable(api, trainingClassSchema, {
        permissionOverrides: {
            canCreate: hasPermission("TRAINING_CLASS_CREATE"),
            canUpdate: hasPermission("TRAINING_CLASS_UPDATE"),
            canDelete: hasPermission("TRAINING_CLASS_DELETE"),
            canImport: false,
            canExport: false,

        },
    });

    function retry() {
        setLoadError("");
        setRetryVersion((value) => value + 1);
        table.setSearch(table.search);
        void queryClient.invalidateQueries({
            queryKey: ["training-class"],
        });
    }

    return (
        <MainLayout
            pathName={{ "training-classes": "Training Classes" }}
        >
            <div className="flex h-full min-h-0 flex-col gap-4">
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

                <div
                    className={
                        loadError
                            ? "hidden"
                            : "min-h-0 flex-1"
                    }
                >
                    <TrainingClassTable
                        key={retryVersion}
                        table={table}
                        onQuickView={setDetailRow}
                        onOpenDetails={(row) =>
                            navigate(`/training-classes/${row.id}`)
                        }
                        canRead={hasPermission("TRAINING_CLASS_READ")}
                    />
                </div>

                <DetailModal
                    open={detailRow !== null}
                    onClose={(open) => {
                        if (!open) setDetailRow(null);
                    }}
                    schema={trainingClassSchema}
                    row={detailRow}
                />
            </div>
        </MainLayout>
    );
}

interface TrainingClassTableProps {
    table: ReturnType<typeof useProTable>;
    canRead: boolean;
    onQuickView: (row: TrainingClassResponse) => void;
    onOpenDetails: (row: TrainingClassResponse) => void;
}

function TrainingClassTable({
                                table,
                                canRead,
                                onQuickView,
                                onOpenDetails,
                            }: TrainingClassTableProps) {
    const [deleteRow, setDeleteRow] =
        useState<TrainingClassResponse | null>(null);
    const [deleting, setDeleting] = useState(false);

    async function confirmDelete() {
        if (!deleteRow || !table.permission?.canDelete || deleting) {
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
                onRowClick={canRead ? onOpenDetails : undefined}
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

                        {table.permission?.canUpdate && (
                            <ActionButton
                                onClick={() => table.openEdit(row)}
                                tooltip="Edit"
                                icon={
                                    <Pen
                                        size={10}
                                        className="text-gray-500"
                                    />
                                }
                            />
                        )}

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