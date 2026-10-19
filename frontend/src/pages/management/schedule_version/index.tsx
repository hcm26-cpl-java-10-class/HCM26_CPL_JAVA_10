import { useState } from "react";
import { scheduleVersionApi } from "@/api/features/schedule-version.api";
import { ProTable } from "@/components/datatable/ProTable";
import { useProTable } from "@/components/datatable/hook/useProTable";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import {
    auditableFieldsSchema,
    type EntityConfig,
    type EntitySchema,
    type FieldSchema,
    type ScheduleVersionDTO,
} from "@/types";
import {
    Calendar,
    Copy,
    History,
    Plus,
    Rocket,
    ShieldCheck,
    Trash2,
} from "lucide-react";
import { toast } from "sonner";

const statusOptions = [
    { value: "DRAFT", label: "DRAFT (Bản nháp)", color: "amber" },
    { value: "ACTIVE", label: "ACTIVE (Đang áp dụng)", color: "green" },
    { value: "ARCHIVED", label: "ARCHIVED (Đã lưu trữ)", color: "gray" },
];

export const scheduleVersionSchema: EntitySchema = {
    entityName: "schedule-version",
    idField: "id",
    fields: [
        {
            name: "id",
            label: "ID",
            type: "number",
            sortable: true,
            filterable: true,
            filterType: "numberRange",
        },
        {
            name: "classId",
            label: "Mã lớp (Class ID)",
            type: "text",
            sortable: true,
            filterable: true,
            filterType: "text",
            bold: true,
        },
        {
            name: "versionNumber",
            label: "Phiên bản (Version)",
            type: "number",
            sortable: true,
            filterable: true,
            filterType: "numberRange",
        },
        {
            name: "status",
            label: "Trạng thái",
            type: "select",
            options: statusOptions,
            sortable: true,
            filterable: true,
            filterType: "select",
        },
        {
            name: "note",
            label: "Ghi chú",
            type: "textarea",
        },
        {
            name: "clonedFromVersionId",
            label: "Nhân bản từ",
            type: "text",
        },
        {
            name: "totalSessions",
            label: "Tổng số buổi học",
            type: "number",
            sortable: true,
        },
        {
            name: "activatedAt",
            label: "Thời điểm kích hoạt",
            type: "datetime",
            sortable: true,
            filterType: "dateRange",
        },
        {
            name: "activatedBy",
            label: "Người kích hoạt",
            type: "text",
        },
        ...(auditableFieldsSchema as FieldSchema[]).filter((f) => f.name !== "isActive"),
    ],
};

export const entityConfig: EntityConfig = {
    name: "Schedule Versions",
    path: "/schedule-versions",
    api: scheduleVersionApi,
    schema: scheduleVersionSchema,
};

export default function ScheduleVersionPage() {
    const table = useProTable(scheduleVersionApi, scheduleVersionSchema);
    const queryClient = useQueryClient();

    const refreshTable = () => {
        queryClient.invalidateQueries({ queryKey: [scheduleVersionSchema.entityName] });
    };

    // Dialog state: Create Draft
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [createClassId, setCreateClassId] = useState("");
    const [createNote, setCreateNote] = useState("");
    const [createLoading, setCreateLoading] = useState(false);

    // Dialog state: Clone
    const [isCloneOpen, setIsCloneOpen] = useState(false);
    const [cloneVersionId, setCloneVersionId] = useState("");
    const [cloneNote, setCloneNote] = useState("");
    const [cloneLoading, setCloneLoading] = useState(false);

    // Dialog state: History
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [historyClassId, setHistoryClassId] = useState("");
    const [historyList, setHistoryList] = useState<ScheduleVersionDTO[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Handle Create Draft
    const handleCreateDraft = async () => {
        if (!createClassId.trim()) {
            toast.error("Vui lòng nhập mã lớp học (Class ID)");
            return;
        }
        setCreateLoading(true);
        try {
            const res = await scheduleVersionApi.createDraft(createClassId.trim(), {
                note: createNote.trim() || undefined,
            });
            toast.success(`Đã tạo bản nháp Version ${res.versionNumber} cho lớp ${res.classId}!`);
            setIsCreateOpen(false);
            setCreateClassId("");
            setCreateNote("");
            refreshTable();
        } catch (error: any) {
            const msg = error?.response?.data?.message || "Lỗi khi tạo bản nháp mới";
            toast.error(msg);
        } finally {
            setCreateLoading(false);
        }
    };

    // Handle Clone
    const handleClone = async () => {
        if (!cloneVersionId.trim()) {
            toast.error("Vui lòng nhập ID phiên bản cần nhân bản");
            return;
        }
        setCloneLoading(true);
        try {
            const res = await scheduleVersionApi.cloneVersion(cloneVersionId.trim(), {
                note: cloneNote.trim() || undefined,
            });
            toast.success(`Đã nhân bản thành công sang Version ${res.versionNumber} (DRAFT)!`);
            setIsCloneOpen(false);
            setCloneVersionId("");
            setCloneNote("");
            refreshTable();
        } catch (error: any) {
            const msg = error?.response?.data?.message || "Lỗi khi nhân bản phiên bản";
            toast.error(msg);
        } finally {
            setCloneLoading(false);
        }
    };

    // Handle Check History
    const handleCheckHistory = async () => {
        if (!historyClassId.trim()) {
            toast.error("Vui lòng nhập mã lớp cần xem lịch sử");
            return;
        }
        setHistoryLoading(true);
        try {
            const list = await scheduleVersionApi.getHistory(historyClassId.trim());
            setHistoryList(list);
            if (list.length === 0) {
                toast.info(`Lớp ${historyClassId} chưa có phiên bản lịch nào.`);
            }
        } catch (error: any) {
            toast.error(error?.response?.data?.message || "Không thể tải lịch sử phiên bản");
        } finally {
            setHistoryLoading(false);
        }
    };

    // Handle Check Editable Status
    const handleCheckEditable = async (id: number | string) => {
        try {
            const res = await scheduleVersionApi.getEditableStatus(id);
            if (res.isEditable) {
                toast.success(`[Quyền Sửa]: Cho phép chỉnh sửa (Bản này đang là DRAFT)`);
            } else {
                toast.warning(`[Quyền Sửa]: ĐÃ KHÓA! ${res.editableMessage || "Chỉ bản DRAFT mới được sửa."}`);
            }
        } catch (error: any) {
            toast.error(error?.response?.data?.message || "Lỗi khi kiểm tra quyền sửa");
        }
    };

    // Handle Activate Version
    const handleActivateVersion = async (row: any) => {
        if (row.status !== "DRAFT") {
            toast.error("Chỉ có thể kích hoạt phiên bản đang ở trạng thái DRAFT!");
            return;
        }
        if (!confirm(`Bạn có chắc chắn muốn KÍCH HOẠT phiên bản Version ${row.versionNumber} của lớp ${row.classId}?\nBản này sẽ trở thành ACTIVE chính thức và bản ACTIVE cũ (nếu có) sẽ chuyển thành ARCHIVED.`)) {
            return;
        }
        try {
            await scheduleVersionApi.activateVersion(row.id);
            toast.success(`Đã kích hoạt thành công Version ${row.versionNumber} của lớp ${row.classId} thành ACTIVE!`);
            refreshTable();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || "Lỗi khi kích hoạt phiên bản");
        }
    };

    // Handle Delete Draft
    const handleDeleteDraft = async (row: any) => {
        if (row.status !== "DRAFT") {
            toast.error("Chỉ có thể xóa phiên bản đang ở trạng thái DRAFT!");
            return;
        }
        if (!confirm(`Bạn có chắc muốn xóa bản nháp Version ${row.versionNumber} của lớp ${row.classId}?`)) {
            return;
        }
        try {
            await scheduleVersionApi.deleteDraft(row.id);
            toast.success(`Đã xóa thành công bản nháp ID: ${row.id}`);
            refreshTable();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || "Lỗi khi xóa bản nháp");
        }
    };

    return (
        <MainLayout pathName={{ "schedule-versions": "Schedule Versions" }}>
            <div className="space-y-6">
                {/* Header Banner */}
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                            <Calendar className="size-4" />
                            <span>QUẢN LÝ LỊCH HỌC</span>
                        </div>
                        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
                            Phiên bản và Lịch sử Lịch học (Schedule Versions)
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Tạo nháp, clone phiên bản, quản lý vòng đời (DRAFT &rarr; ACTIVE &rarr; ARCHIVED) và xem lịch sử thay đổi.
                        </p>
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Dialog Tạo Nháp */}
                        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                            <DialogTrigger asChild>
                                <Button className="gap-2">
                                    <Plus className="size-4" />
                                    Tạo nháp mới
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Tạo phiên bản lịch nháp rỗng</DialogTitle>
                                    <DialogDescription>
                                        Tạo bản DRAFT mới cho lớp học. Hệ thống sẽ tự động sinh số thứ tự version tiếp theo.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-3">
                                    <div className="space-y-2">
                                        <Label htmlFor="classId">Mã lớp học (Class ID) *</Label>
                                        <Input
                                            id="classId"
                                            placeholder="Ví dụ: CLASS_2026_JAVA_01"
                                            value={createClassId}
                                            onChange={(e) => setCreateClassId(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="createNote">Ghi chú (Tùy chọn)</Label>
                                        <Textarea
                                            id="createNote"
                                            placeholder="Lý do tạo bản nháp này..."
                                            value={createNote}
                                            onChange={(e) => setCreateNote(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Hủy</Button>
                                    <Button onClick={handleCreateDraft} disabled={createLoading}>
                                        {createLoading ? "Đang tạo..." : "Xác nhận tạo nháp"}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        {/* Dialog Clone */}
                        <Dialog open={isCloneOpen} onOpenChange={setIsCloneOpen}>
                            <DialogTrigger asChild>
                                <Button variant="secondary" className="gap-2">
                                    <Copy className="size-4" />
                                    Clone phiên bản
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Nhân bản phiên bản (Clone to Draft)</DialogTitle>
                                    <DialogDescription>
                                        Sao chép toàn bộ thông tin từ một phiên bản cũ sang bản nháp DRAFT mới để chỉnh sửa.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-3">
                                    <div className="space-y-2">
                                        <Label htmlFor="cloneVersionId">ID phiên bản nguồn *</Label>
                                        <Input
                                            id="cloneVersionId"
                                            placeholder="Ví dụ: 1"
                                            value={cloneVersionId}
                                            onChange={(e) => setCloneVersionId(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="cloneNote">Ghi chú nhân bản</Label>
                                        <Textarea
                                            id="cloneNote"
                                            placeholder="Lý do clone phiên bản..."
                                            value={cloneNote}
                                            onChange={(e) => setCloneNote(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsCloneOpen(false)}>Hủy</Button>
                                    <Button onClick={handleClone} disabled={cloneLoading}>
                                        {cloneLoading ? "Đang xử lý..." : "Xác nhận Clone"}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        {/* Dialog Lịch sử */}
                        <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="gap-2">
                                    <History className="size-4" />
                                    Xem lịch sử lớp
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>Lịch sử các phiên bản của lớp</DialogTitle>
                                    <DialogDescription>
                                        Xem toàn bộ quá trình thay đổi lịch học của một lớp cụ thể.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-3">
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="Nhập Class ID cần tra cứu..."
                                            value={historyClassId}
                                            onChange={(e) => setHistoryClassId(e.target.value)}
                                        />
                                        <Button onClick={handleCheckHistory} disabled={historyLoading}>
                                            {historyLoading ? "Đang tìm..." : "Tra cứu"}
                                        </Button>
                                    </div>

                                    {historyList.length > 0 && (
                                        <div className="rounded-md border divide-y text-sm">
                                            {historyList.map((item) => (
                                                <div key={item.id} className="p-3 flex items-center justify-between">
                                                    <div>
                                                        <div className="font-semibold flex items-center gap-2">
                                                            <span>Version {item.versionNumber}</span>
                                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                                item.status === "ACTIVE"
                                                                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                                                    : item.status === "DRAFT"
                                                                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                                                                    : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"
                                                            }`}>
                                                                {item.status}
                                                            </span>
                                                        </div>
                                                        <div className="text-xs text-muted-foreground mt-1">
                                                            Ghi chú: {item.note || "Không có"} &bull; Tạo lúc: {item.createdAt ? new Date(item.createdAt).toLocaleString("vi-VN") : "N/A"}
                                                        </div>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground text-right">
                                                        {item.totalSessions ? `${item.totalSessions} buổi học` : "0 buổi"}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                {/* Main Data Table */}
                <div className="rounded-xl border bg-card shadow-sm p-1">
                    <ProTable
                        table={table}
                        renderRowActions={(row: any) => (
                            <div className="flex items-center gap-1">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 px-2 text-xs"
                                    onClick={() => handleCheckEditable(row.id)}
                                    title="Kiểm tra quyền sửa"
                                >
                                    <ShieldCheck className="size-3.5 mr-1" />
                                    Quyền sửa
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 px-2 text-xs"
                                    onClick={() => {
                                        setCloneVersionId(String(row.id));
                                        setIsCloneOpen(true);
                                    }}
                                    title="Clone bản này"
                                >
                                    <Copy className="size-3.5 mr-1" />
                                    Clone
                                </Button>
                                {row.status === "DRAFT" && (
                                    <>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 font-medium"
                                            onClick={() => handleActivateVersion(row)}
                                            title="Kích hoạt áp dụng chính thức"
                                        >
                                            <Rocket className="size-3.5 mr-1" />
                                            Kích hoạt
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10"
                                            onClick={() => handleDeleteDraft(row)}
                                            title="Xóa bản nháp"
                                        >
                                            <Trash2 className="size-3.5 mr-1" />
                                            Xóa
                                        </Button>
                                    </>
                                )}
                            </div>
                        )}
                    />
                </div>
            </div>
        </MainLayout>
    );
}
