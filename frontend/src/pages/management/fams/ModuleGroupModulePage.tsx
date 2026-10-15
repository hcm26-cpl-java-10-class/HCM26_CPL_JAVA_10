import React, { useMemo, useState } from "react";
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
import type {
    ModuleGroupItem,
    ModuleItem,
    ModuleGroupFormData,
    ModuleFormData,
} from "./types";

export const ModuleGroupModulePage: React.FC = () => {
    // In-memory data states
    const [groups, setGroups] = useState<ModuleGroupItem[]>(initialModuleGroups);
    const [modules, setModules] = useState<ModuleItem[]>(initialModules);
    const [selectedGroupId, setSelectedGroupId] = useState<string>("group-system");

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

    // Modules filtered by selected group
    const currentGroupModules = useMemo(() => {
        return modules.filter((m) => m.groupId === selectedGroupId);
    }, [modules, selectedGroupId]);

    // Group handlers
    const handleAddGroup = () => {
        setEditingGroup(null);
        setIsGroupModalOpen(true);
    };

    const handleEditGroup = (group: ModuleGroupItem) => {
        setEditingGroup(group);
        setIsGroupModalOpen(true);
    };

    const handleSaveGroup = (data: ModuleGroupFormData) => {
        if (editingGroup) {
            setGroups((prev) =>
                prev.map((g) =>
                    g.id === editingGroup.id
                        ? { ...g, ...data }
                        : g
                )
            );
            toast.success("Cập nhật nhóm module thành công!");
        } else {
            const newGroup: ModuleGroupItem = {
                id: `group-${Date.now()}`,
                name: data.name,
                description: data.description,
                displayOrder: data.displayOrder,
                moduleCount: 0,
            };
            setGroups((prev) => [...prev, newGroup]);
            setSelectedGroupId(newGroup.id);
            toast.success("Thêm nhóm module thành công!");
        }
        setEditingGroup(null);
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

    const handleConfirmDelete = () => {
        if (!deleteDialog.item) return;

        if (deleteDialog.type === "group") {
            const groupToDelete = deleteDialog.item as ModuleGroupItem;
            setGroups((prev) => prev.filter((g) => g.id !== groupToDelete.id));
            setModules((prev) => prev.filter((m) => m.groupId !== groupToDelete.id));

            if (selectedGroupId === groupToDelete.id) {
                const remaining = groups.filter((g) => g.id !== groupToDelete.id);
                if (remaining.length > 0) {
                    setSelectedGroupId(remaining[0].id);
                }
            }
            toast.success(`Đã xóa nhóm module "${groupToDelete.name}" thành công!`);
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
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium shadow-xs transition-colors cursor-pointer"
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
                        ? "Bạn có chắc chắn muốn xóa nhóm module này? Tất cả module thuộc nhóm cũng sẽ bị xóa."
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
