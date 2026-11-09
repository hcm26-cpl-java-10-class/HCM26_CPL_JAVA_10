import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, Layers, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { ModuleGroupModal } from "@/pages/management/fams/components/ModuleGroupModal";
import { DeleteConfirmDialog } from "@/pages/management/fams/components/DeleteConfirmDialog";
import { ModuleGroupTable } from "@/pages/management/fams/components/ModuleGroupTable";
import { initialModuleGroups } from "@/pages/management/fams/mockData";
import { moduleGroupApi } from "@/api/features/menu/module_group.api";
import { moduleApi } from "@/api/features/menu/module.api";
import type {
    ModuleGroupItem,
    ModuleGroupFormData,
} from "@/pages/management/fams/types";

export const ModuleGroupsPage: React.FC = () => {
    const navigate = useNavigate();

    // Data states
    const [groups, setGroups] = useState<ModuleGroupItem[]>(initialModuleGroups);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;

    // Modal & Dialog states
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<ModuleGroupItem | null>(null);
    const [deleteDialog, setDeleteDialog] = useState<{
        open: boolean;
        group: ModuleGroupItem | null;
    }>({
        open: false,
        group: null,
    });

    // Load module groups and module counts
    const loadGroups = useCallback(async () => {
        setIsLoading(true);
        try {
            const [groupResponse, moduleResponse] = await Promise.all([
                moduleGroupApi.getPage(
                    { page: 0, size: 500, sort: ["displayOrder,asc", "name,asc"] }
                ),
                moduleApi.getPage(
                    { page: 0, size: 9999 }
                ).catch(() => ({ content: [] as any[] })),
            ]);

            const modulesList = ((moduleResponse as any)?.content ?? (moduleResponse as any)?.items ?? []) as Array<{ moduleGroupId?: number | string }>;
            const countsByGroupId: Record<string, number> = {};
            modulesList.forEach((m) => {
                if (m.moduleGroupId != null) {
                    const gId = String(m.moduleGroupId);
                    countsByGroupId[gId] = (countsByGroupId[gId] || 0) + 1;
                }
            });

            if (groupResponse && Array.isArray(groupResponse.content) && groupResponse.content.length > 0) {
                const mapped: ModuleGroupItem[] = groupResponse.content.map((dto) => {
                    const strId = String(dto.id);
                    return {
                        id: strId,
                        name: dto.name || "",
                        description: dto.description || "",
                        displayOrder: dto.displayOrder ?? 0,
                        moduleCount: countsByGroupId[strId] ?? 0,
                    };
                });
                setGroups(mapped);
            }
        } catch (error: any) {
            console.warn("Backend not reachable or error loading groups:", error);
            setGroups((prev) => (prev.length > 0 ? prev : initialModuleGroups));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadGroups();
    }, [loadGroups]);

    // Filter by search query
    const filteredGroups = useMemo(() => {
        if (!searchQuery.trim()) return groups;
        const q = searchQuery.toLowerCase().trim();
        return groups.filter(
            (g) =>
                g.name.toLowerCase().includes(q) ||
                (g.description && g.description.toLowerCase().includes(q))
        );
    }, [groups, searchQuery]);

    // Pagination
    const totalItems = filteredGroups.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safeCurrentPage = Math.min(currentPage, totalPages);

    const paginatedGroups = useMemo(() => {
        const start = (safeCurrentPage - 1) * pageSize;
        return filteredGroups.slice(start, start + pageSize);
    }, [filteredGroups, safeCurrentPage, pageSize]);

    const startIndex = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
    const endIndex = Math.min(safeCurrentPage * pageSize, totalItems);

    // Handlers
    const handleAddGroup = () => {
        setEditingGroup(null);
        setIsGroupModalOpen(true);
    };

    const handleEditGroup = (group: ModuleGroupItem) => {
        setEditingGroup(group);
        setIsGroupModalOpen(true);
    };

    const handleSaveGroup = async (data: ModuleGroupFormData) => {
        try {
            if (editingGroup) {
                await moduleGroupApi.update(String(editingGroup.id), {
                    id: Number(editingGroup.id),
                    name: data.name,
                    description: data.description,
                    displayOrder: data.displayOrder,
                });
                toast.success("Cập nhật nhóm module thành công!");
                await loadGroups();
            } else {
                await moduleGroupApi.create({
                    name: data.name,
                    description: data.description,
                    displayOrder: data.displayOrder,
                    isActive: true,
                });
                toast.success("Thêm nhóm module thành công!");
                await loadGroups();
            }
            setIsGroupModalOpen(false);
            setEditingGroup(null);
        } catch (error: any) {
            const errMsg =
                error.response?.data?.message ||
                (error.response?.data?.errors
                    ? Object.values(error.response.data.errors).flat().join(", ")
                    : null) ||
                "Đã có lỗi xảy ra khi lưu nhóm module.";
            toast.error(errMsg);
        }
    };

    const handleDeleteGroupRequest = (group: ModuleGroupItem) => {
        setDeleteDialog({
            open: true,
            group,
        });
    };

    const handleConfirmDelete = async () => {
        if (!deleteDialog.group) return;
        const groupToDelete = deleteDialog.group;

        try {
            await moduleGroupApi.delete(String(groupToDelete.id));
            toast.success(`Đã xóa nhóm module "${groupToDelete.name}" thành công!`);
            await loadGroups();
        } catch (error: any) {
            const errMsg =
                error.response?.data?.message ||
                "Không thể xóa nhóm module vì có lỗi xảy ra.";
            toast.error(errMsg);
        }

        setDeleteDialog({ open: false, group: null });
    };

    const handleViewModules = (group: ModuleGroupItem) => {
        navigate(`/modules?groupId=${encodeURIComponent(group.id)}`);
    };

    return (
        <MainLayout>
            <div className="flex flex-col gap-5 font-sans">
                {/* Header */}
                <div className="flex flex-col gap-2">
                    {/* Breadcrumbs */}
                    <div className="flex items-center text-xs text-gray-500 font-medium">
                        <span className="text-gray-500">System</span>
                        <span className="mx-2 text-gray-300">/</span>
                        <span className="text-gray-800 dark:text-gray-200 font-semibold">
                            Module Groups
                        </span>
                    </div>

                    {/* Title & Primary Action */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                                Module Groups
                            </h1>
                            <p className="text-sm text-gray-500 mt-1">
                                Quản lý nhóm chức năng trong hệ thống
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={handleAddGroup}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
                        >
                            <Plus className="h-4 w-4" />
                            <span>+ Thêm nhóm</span>
                        </button>
                    </div>
                </div>

                {/* Management Card */}
                <div className="bg-white dark:bg-card rounded-xl border border-gray-100 dark:border-border shadow-xs p-5 flex flex-col gap-4">
                    {/* Card Title & Search */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-border">
                        <div className="flex items-center gap-2">
                            <Layers className="size-5 text-blue-600 dark:text-blue-400" />
                            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                                Danh sách Module Groups
                            </h3>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-muted text-gray-600 dark:text-gray-400 font-medium ml-1">
                                {totalItems}
                            </span>
                        </div>

                        <div className="relative w-full sm:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                type="text"
                                placeholder="Tìm kiếm tên nhóm, mô tả..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="pl-9 h-9 text-sm rounded-lg border-gray-200 dark:border-border bg-gray-50/50 dark:bg-accent/40 focus:bg-white dark:focus:bg-card transition-colors"
                            />
                        </div>
                    </div>

                    {/* Table */}
                    <ModuleGroupTable
                        groups={paginatedGroups}
                        onViewModules={handleViewModules}
                        onEditGroup={handleEditGroup}
                        onDeleteGroup={handleDeleteGroupRequest}
                        isLoading={isLoading}
                    />

                    {/* Footer / Pagination */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-border text-sm text-gray-500">
                        <div>
                            Hiển thị {startIndex}–{endIndex} trong {totalItems} kết quả
                        </div>

                        {totalPages > 1 && (
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                    disabled={safeCurrentPage <= 1}
                                    className="h-8 w-8 rounded-lg border border-gray-200 dark:border-border flex items-center justify-center text-gray-500 hover:bg-gray-50 dark:hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                    aria-label="Previous page"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>

                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
                                    <button
                                        key={pageNumber}
                                        type="button"
                                        onClick={() => setCurrentPage(pageNumber)}
                                        className={`h-8 w-8 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                                            pageNumber === safeCurrentPage
                                                ? "bg-blue-600 text-white font-semibold shadow-xs"
                                                : "border border-gray-200 dark:border-border text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-accent"
                                        }`}
                                    >
                                        {pageNumber}
                                    </button>
                                ))}

                                <button
                                    type="button"
                                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={safeCurrentPage >= totalPages}
                                    className="h-8 w-8 rounded-lg border border-gray-200 dark:border-border flex items-center justify-center text-gray-500 hover:bg-gray-50 dark:hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                    aria-label="Next page"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modals & Dialogs */}
            <ModuleGroupModal
                open={isGroupModalOpen}
                onOpenChange={setIsGroupModalOpen}
                initialData={editingGroup}
                onSubmit={handleSaveGroup}
            />

            <DeleteConfirmDialog
                open={deleteDialog.open}
                onOpenChange={(open) =>
                    setDeleteDialog((prev) => ({ ...prev, open }))
                }
                title="Xóa nhóm module"
                description="Bạn có chắc chắn muốn xóa nhóm module này khỏi hệ thống? (Nhóm đang chứa module sẽ bị từ chối xóa)"
                itemName={deleteDialog.group?.name}
                onConfirm={handleConfirmDelete}
            />
        </MainLayout>
    );
};

export default ModuleGroupsPage;
