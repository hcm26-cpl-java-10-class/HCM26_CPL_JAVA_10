import React, { useCallback, useEffect, useState } from "react";
import { Download, Plus } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { FullModuleTable } from "@/pages/management/fams/components/FullModuleTable";
import { ModuleModal } from "@/pages/management/fams/components/ModuleModal";
import { DeleteConfirmDialog } from "@/pages/management/fams/components/DeleteConfirmDialog";
import { ImportExportModal } from "@/pages/management/fams/components/ImportExportModal";
import { initialModuleGroups, initialModules } from "@/pages/management/fams/mockData";
import { moduleGroupApi } from "@/api/features/menu/module_group.api";
import { moduleApi } from "@/api/features/menu/module.api";
import type {
    ModuleGroupItem,
    ModuleItem,
    ModuleFormData,
} from "@/pages/management/fams/types";

export const ModulesPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const queryGroupId = searchParams.get("groupId") || "ALL";

    // Data states
    const [groups, setGroups] = useState<ModuleGroupItem[]>(initialModuleGroups);
    const [modules, setModules] = useState<ModuleItem[]>(initialModules);
    const [isLoading, setIsLoading] = useState(false);

    // Filter states
    const [selectedGroupId, setSelectedGroupId] = useState<string>(queryGroupId);
    const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
    const [searchQuery, setSearchQuery] = useState<string>("");

    // Modal & Dialog states
    const [isModuleModalOpen, setIsModuleModalOpen] = useState(false);
    const [editingModule, setEditingModule] = useState<ModuleItem | null>(null);
    const [isImportExportOpen, setIsImportExportOpen] = useState(false);
    const [deleteDialog, setDeleteDialog] = useState<{
        open: boolean;
        module: ModuleItem | null;
    }>({
        open: false,
        module: null,
    });

    // Synchronize query param when URL changes
    useEffect(() => {
        const paramGroup = searchParams.get("groupId");
        if (paramGroup) {
            setSelectedGroupId(paramGroup);
        } else {
            setSelectedGroupId("ALL");
        }
    }, [searchParams]);

    // Handle group filter change and update URL query param
    const handleSelectGroupId = (groupId: string) => {
        setSelectedGroupId(groupId);
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            if (groupId && groupId !== "ALL") {
                next.set("groupId", groupId);
            } else {
                next.delete("groupId");
            }
            return next;
        });
    };

    // Load data from backend
    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [groupResponse, moduleResponse] = await Promise.all([
                moduleGroupApi.getPage(
                    { page: 0, size: 500, sort: ["displayOrder,asc", "name,asc"] }
                ),
                moduleApi.getPage(
                    { page: 0, size: 9999, sort: ["displayOrder,asc", "title,asc"] }
                ),
            ]);

            const mappedGroups: ModuleGroupItem[] =
                groupResponse && Array.isArray(groupResponse.content) && groupResponse.content.length > 0
                    ? groupResponse.content.map((dto) => ({
                          id: String(dto.id),
                          name: dto.name || "",
                          description: dto.description || "",
                          displayOrder: dto.displayOrder ?? 0,
                      }))
                    : initialModuleGroups;

            setGroups(mappedGroups);

            const beModules = (moduleResponse as any)?.content ?? (moduleResponse as any)?.items ?? [];
            if (Array.isArray(beModules) && beModules.length > 0) {
                const mappedModules: ModuleItem[] = beModules.map((m: any, idx: number) => {
                    const code = m.url
                        ? m.url.replace(/^\//, "").replace(/\//g, "-").toUpperCase() || `MOD-${m.id ?? idx + 1}`
                        : `MOD-${m.id ?? idx + 1}`;
                    return {
                        id: String(m.id ?? `mod-${idx + 1}`),
                        groupId: String(m.moduleGroupId ?? ""),
                        code: code,
                        name: m.title || "Module",
                        url: m.url || "",
                        linkInfo: m.requiredPermission ? `${m.requiredPermission}` : "System Access",
                        status: m.isActive === false ? "Inactive" : "Active",
                        displayOrder: m.displayOrder ?? idx + 1,
                        description: m.description,
                    };
                });
                setModules(mappedModules);
            } else {
                setModules(initialModules);
            }
        } catch (error: any) {
            console.warn("Backend not reachable or error loading modules:", error);
            setGroups((prev) => (prev.length > 0 ? prev : initialModuleGroups));
            setModules((prev) => (prev.length > 0 ? prev : initialModules));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Module Handlers
    const handleAddModule = () => {
        setEditingModule(null);
        setIsModuleModalOpen(true);
    };

    const handleEditModule = (module: ModuleItem) => {
        setEditingModule(module);
        setIsModuleModalOpen(true);
    };

    const handleSaveModule = async (data: ModuleFormData) => {
        try {
            const numericGroupId = Number(data.groupId);
            const payload: any = {
                title: data.name,
                url: data.url,
                moduleGroupId: isNaN(numericGroupId) ? undefined : numericGroupId,
                description: data.description || "",
                isActive: data.status === "Active",
            };

            if (editingModule && !editingModule.id.startsWith("mod-")) {
                await moduleApi.update(String(editingModule.id), {
                    id: Number(editingModule.id),
                    ...payload,
                });
                toast.success("Cập nhật module thành công!");
                await loadData();
            } else if (!editingModule && !isNaN(numericGroupId)) {
                await moduleApi.create(payload);
                toast.success("Thêm mới module thành công!");
                await loadData();
            } else {
                // In-memory fallback
                if (editingModule) {
                    setModules((prev) =>
                        prev.map((m) =>
                            m.id === editingModule.id ? { ...m, ...data } : m
                        )
                    );
                    toast.success("Cập nhật module thành công!");
                } else {
                    const newModule: ModuleItem = {
                        id: `mod-${Date.now()}`,
                        ...data,
                        displayOrder: modules.length + 1,
                    };
                    setModules((prev) => [...prev, newModule]);
                    toast.success("Thêm mới module thành công!");
                }
            }
            setIsModuleModalOpen(false);
            setEditingModule(null);
        } catch (error: any) {
            const errMsg =
                error.response?.data?.message ||
                (error.response?.data?.errors
                    ? Object.values(error.response.data.errors).flat().join(", ")
                    : null) ||
                "Đã có lỗi xảy ra khi lưu module.";
            toast.error(errMsg);
        }
    };

    const handleDeleteModuleRequest = (module: ModuleItem) => {
        setDeleteDialog({
            open: true,
            module,
        });
    };

    const handleConfirmDelete = async () => {
        if (!deleteDialog.module) return;
        const moduleToDelete = deleteDialog.module;

        try {
            if (!moduleToDelete.id.startsWith("mod-")) {
                await moduleApi.delete(String(moduleToDelete.id));
                toast.success(`Đã xóa module "${moduleToDelete.name}" thành công!`);
                await loadData();
            } else {
                setModules((prev) => prev.filter((m) => m.id !== moduleToDelete.id));
                toast.success(`Đã xóa module "${moduleToDelete.code}" thành công!`);
            }
        } catch (error: any) {
            const errMsg =
                error.response?.data?.message ||
                "Không thể xóa module vì có lỗi xảy ra.";
            toast.error(errMsg);
        }

        setDeleteDialog({ open: false, module: null });
    };

    const handleImportModules = (newModules: ModuleItem[]) => {
        setModules((prev) => [...prev, ...newModules]);
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
                            Modules
                        </span>
                    </div>

                    {/* Title & Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                                Modules
                            </h1>
                            <p className="text-sm text-gray-500 mt-1">
                                Quản lý các module chức năng của hệ thống
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setIsImportExportOpen(true)}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-border bg-white dark:bg-card text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-50 dark:hover:bg-accent shadow-xs transition-colors cursor-pointer"
                            >
                                <Download className="h-4 w-4 text-gray-500" />
                                <span>Import / Export</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleAddModule}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-xs transition-colors cursor-pointer"
                            >
                                <Plus className="h-4 w-4" />
                                <span>+ Thêm module</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Full-width Management Table Card */}
                <FullModuleTable
                    modules={modules}
                    groups={groups}
                    selectedGroupId={selectedGroupId}
                    onSelectGroupId={handleSelectGroupId}
                    selectedStatus={selectedStatus}
                    onSelectStatus={setSelectedStatus}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    onEditModule={handleEditModule}
                    onDeleteModule={handleDeleteModuleRequest}
                    isLoading={isLoading}
                />
            </div>

            {/* Modals & Dialogs */}
            <ModuleModal
                open={isModuleModalOpen}
                onOpenChange={setIsModuleModalOpen}
                groups={groups}
                defaultGroupId={selectedGroupId !== "ALL" ? selectedGroupId : undefined}
                initialData={editingModule}
                onSubmit={handleSaveModule}
            />

            <DeleteConfirmDialog
                open={deleteDialog.open}
                onOpenChange={(open) =>
                    setDeleteDialog((prev) => ({ ...prev, open }))
                }
                title="Xóa module"
                description="Bạn có chắc chắn muốn xóa module này khỏi hệ thống?"
                itemName={deleteDialog.module?.name}
                onConfirm={handleConfirmDelete}
            />

            <ImportExportModal
                open={isImportExportOpen}
                onOpenChange={setIsImportExportOpen}
                modules={modules}
                onImportModules={handleImportModules}
            />
        </MainLayout>
    );
};

export default ModulesPage;
