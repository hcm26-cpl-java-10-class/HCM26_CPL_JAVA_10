import React, { useEffect, useMemo, useState } from "react";
import { Download, Plus } from "lucide-react";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { ModuleGroupList } from "./components/ModuleGroupList";
import { ModuleTable } from "./components/ModuleTable";
import { ModuleGroupModal } from "./components/ModuleGroupModal";
import { ModuleModal } from "./components/ModuleModal";
import { DeleteConfirmDialog } from "./components/DeleteConfirmDialog";
import { ImportExportModal } from "./components/ImportExportModal";
import { initialModuleGroups, initialModules } from "./mockData";
import { moduleGroupApi } from "@/api/features/menu/module_group.api";
import type {
    ModuleGroupItem,
    ModuleItem,
    ModuleGroupFormData,
    ModuleFormData,
} from "./types";

export const ModuleGroupModulePage: React.FC = () => {
    // Backend & In-memory data states
    const [groups, setGroups] = useState<ModuleGroupItem[]>(initialModuleGroups);
    const [modules, setModules] = useState<ModuleItem[]>(initialModules);
    const [selectedGroupId, setSelectedGroupId] = useState<string>("group-system");
    const [isLoadingGroups, setIsLoadingGroups] = useState(false);

    // Modal states
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<ModuleGroupItem | null>(null);

    const [isModuleModalOpen, setIsModuleModalOpen] = useState(false);
    const [editingModule, setEditingModule] = useState<ModuleItem | null>(null);

    const [isImportExportOpen, setIsImportExportOpen] = useState(false);

    // Delete dialog state
    const [deleteDialog, setDeleteDialog] = useState<{
        open: boolean;
        type: "group" | "module";
        item: ModuleGroupItem | ModuleItem | null;
    }>({
        open: false,
        type: "module",
        item: null,
    });

    // Load module groups from backend
    const loadGroups = async () => {
        setIsLoadingGroups(true);
        try {
            const response = await moduleGroupApi.getPage(
                { page: 0, size: 100, sort: ["displayOrder,asc", "name,asc"] }
            );
            if (response && Array.isArray(response.content) && response.content.length > 0) {
                const mapped: ModuleGroupItem[] = response.content.map((dto) => ({
                    id: String(dto.id),
                    name: dto.name || "",
                    description: dto.description || "",
                    displayOrder: dto.displayOrder ?? 0,
                    moduleCount: 0,
                }));
                setGroups(mapped);
                setSelectedGroupId((prev) => {
                    if (!prev || !mapped.some((g) => g.id === prev)) {
                        return mapped[0].id;
                    }
                    return prev;
                });
            }
        } catch (error: any) {
            console.warn("Backend not reachable or error loading groups:", error);
            setGroups((prev) => (prev.length > 0 ? prev : initialModuleGroups));
        } finally {
            setIsLoadingGroups(false);
        }
    };

    useEffect(() => {
        loadGroups();
    }, []);

    // Modules filtered by selected group with smart matching
    const currentGroupModules = useMemo(() => {
        const exactMatches = modules.filter((m) => m.groupId === selectedGroupId);
        if (exactMatches.length > 0) return exactMatches;

        const activeGroup = groups.find((g) => g.id === selectedGroupId);
        if (activeGroup) {
            const normalizedGroupName = activeGroup.name
                .toLowerCase()
                .replace(/group|management/gi, "")
                .trim();
            const matched = modules.filter((m) => {
                const normGroupId = m.groupId.toLowerCase().replace("group-", "").trim();
                return (
                    normalizedGroupName.includes(normGroupId) ||
                    normGroupId.includes(normalizedGroupName)
                );
            });
            if (matched.length > 0) return matched;
        }

        return modules;
    }, [modules, selectedGroupId, groups]);

    // Group handlers
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
                const created = await moduleGroupApi.create({
                    name: data.name,
                    description: data.description,
                    displayOrder: data.displayOrder,
                    isActive: true,
                });
                toast.success("Thêm nhóm module thành công!");
                await loadGroups();
                if (created && created.id) {
                    setSelectedGroupId(String(created.id));
                }
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
            type: "group",
            item: group,
        });
    };

    // Module handlers
    const handleAddModule = () => {
        setEditingModule(null);
        setIsModuleModalOpen(true);
    };

    const handleEditModule = (module: ModuleItem) => {
        setEditingModule(module);
        setIsModuleModalOpen(true);
    };

    const handleSaveModule = (data: ModuleFormData) => {
        if (editingModule) {
            setModules((prev) =>
                prev.map((m) =>
                    m.id === editingModule.id
                        ? { ...m, ...data }
                        : m
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
        setEditingModule(null);
    };

    const handleDeleteModuleRequest = (module: ModuleItem) => {
        setDeleteDialog({
            open: true,
            type: "module",
            item: module,
        });
    };

    const handleConfirmDelete = async () => {
        if (!deleteDialog.item) return;

        if (deleteDialog.type === "group") {
            const groupToDelete = deleteDialog.item as ModuleGroupItem;
            try {
                await moduleGroupApi.delete(String(groupToDelete.id));
                toast.success(`Đã xóa nhóm module "${groupToDelete.name}" thành công!`);
                await loadGroups();

                if (selectedGroupId === groupToDelete.id) {
                    const remaining = groups.filter((g) => g.id !== groupToDelete.id);
                    if (remaining.length > 0) {
                        setSelectedGroupId(remaining[0].id);
                    }
                }
            } catch (error: any) {
                const errMsg =
                    error.response?.data?.message ||
                    "Không thể xóa nhóm module vì có lỗi xảy ra.";
                toast.error(errMsg);
            }
        } else {
            const moduleToDelete = deleteDialog.item as ModuleItem;
            setModules((prev) => prev.filter((m) => m.id !== moduleToDelete.id));
            toast.success(`Đã xóa module "${moduleToDelete.code}" thành công!`);
        }

        setDeleteDialog({ open: false, type: "module", item: null });
    };

    const handleImportModules = (newModules: ModuleItem[]) => {
        setModules((prev) => [...prev, ...newModules]);
    };

    return (
        <MainLayout>
            <div className="flex flex-col gap-5 font-sans">
                {/* Page Header Area */}
                <div className="flex flex-col gap-2">
                    {/* Breadcrumbs */}
                    <div className="flex items-center text-xs text-gray-500 font-medium">
                        <span className="text-gray-500">FAMS &amp; LMS</span>
                        <span className="mx-2 text-gray-300">/</span>
                        <span className="text-gray-500">System</span>
                        <span className="mx-2 text-gray-300">/</span>
                        <span className="text-gray-800 dark:text-gray-200 font-semibold">
                            Module Group &amp; Module
                        </span>
                    </div>

                    {/* Title and Top Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                                Module Group &amp; Module
                            </h1>
                            <p className="text-sm text-gray-500 mt-1">
                                Quản lý dữ liệu và quy trình theo quyền được cấp
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
                                <span>+ Thêm mới</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main 2-Panel Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                    {/* Left Panel: Module Groups (~28-30% width) */}
                    <div className="lg:col-span-4 xl:col-span-3">
                        <ModuleGroupList
                            groups={groups}
                            selectedGroupId={selectedGroupId}
                            onSelectGroup={setSelectedGroupId}
                            onAddGroup={handleAddGroup}
                            onEditGroup={handleEditGroup}
                            onDeleteGroup={handleDeleteGroupRequest}
                            isLoading={isLoadingGroups}
                        />
                    </div>

                    {/* Right Panel: Modules (~70-72% width) */}
                    <div className="lg:col-span-8 xl:col-span-9">
                        <ModuleTable
                            modules={currentGroupModules}
                            onEditModule={handleEditModule}
                            onDeleteModule={handleDeleteModuleRequest}
                        />
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

            <ModuleModal
                open={isModuleModalOpen}
                onOpenChange={setIsModuleModalOpen}
                groups={groups}
                defaultGroupId={selectedGroupId}
                initialData={editingModule}
                onSubmit={handleSaveModule}
            />

            <DeleteConfirmDialog
                open={deleteDialog.open}
                onOpenChange={(open) =>
                    setDeleteDialog((prev) => ({ ...prev, open }))
                }
                title={
                    deleteDialog.type === "group"
                        ? "Xóa nhóm module"
                        : "Xóa module"
                }
                description={
                    deleteDialog.type === "group"
                        ? "Bạn có chắc chắn muốn xóa nhóm module này khỏi hệ thống? (Nhóm đang chứa module sẽ bị từ chối xóa)"
                        : "Bạn có chắc chắn muốn xóa module này khỏi hệ thống?"
                }
                itemName={
                    deleteDialog.type === "group"
                        ? (deleteDialog.item as ModuleGroupItem)?.name
                        : (deleteDialog.item as ModuleItem)?.name
                }
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

export default ModuleGroupModulePage;
