import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, ExternalLink } from "lucide-react";
import axios from "axios";

import { MainLayout } from "@/components/layout/MainLayout";
import { ProTable } from "@/components/datatable/ProTable";
import { useProTable } from "@/components/datatable/hook/useProTable";
import ActionButton from "@/components/datatable/common/ActionButton";
import { DetailModal } from "@/components/datatable/modal/DetailModal";
import { usePermissions } from "@/hooks/usePermissions";
import type { EntitySchema } from "@/types";
import { useQueryClient } from "@tanstack/react-query";

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
            width: 170,
        },
        {
            name: "startDate",
            label: "Start Date",
            type: "date",
            sortable: true,
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
            name: "status",
            label: "Class Status",
            type: "text",
            editable: false,
            sortable: true,
            width: 180,
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
            create: trainingClassTableApi.create,
            async getPage(
                pagination: TrainingClassTablePagination,
                search = "",
            ) {
                setLoadError("");

                try {
                    return await trainingClassTableApi.getPage(
                        pagination,
                        search,
                    );
                } catch (error: unknown) {
                    let message =
                        "Unable to load training classes. Please try again.";

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

    const table = useProTable(api, trainingClassSchema, {
        permissionOverrides: {
            canCreate: hasPermission("TRAINING_CLASS_CREATE"),
            canUpdate: false,
            canDelete: false,
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
    return (
        <ProTable<TrainingClassResponse>
            table={table}
            mode="default"
            renderRowActions={(row) =>
                canRead ? (
                    <>
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
                        <ActionButton
                            onClick={() => onOpenDetails(row)}
                            tooltip="Open class details"
                            icon={
                                <ExternalLink
                                    size={10}
                                    className="text-gray-500"
                                />
                            }
                        />
                    </>
                ) : null
            }
        />
    );
}