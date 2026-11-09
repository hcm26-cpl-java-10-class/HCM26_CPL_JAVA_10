import React from "react";
import { Plus, Edit2, Trash2 } from "lucide-react";
import type { ModuleGroupItem } from "../types";
import { TooltipWrapper } from "@/components/datatable/common/TooltipWrapper";

interface ModuleGroupListProps {
    groups: ModuleGroupItem[];
    selectedGroupId: string;
    onSelectGroup: (groupId: string) => void;
    onAddGroup: () => void;
    onEditGroup: (group: ModuleGroupItem) => void;
    onDeleteGroup: (group: ModuleGroupItem) => void;
    isLoading?: boolean;
}

export const ModuleGroupList: React.FC<ModuleGroupListProps> = ({
    groups,
    selectedGroupId,
    onSelectGroup,
    onAddGroup,
    onEditGroup,
    onDeleteGroup,
    isLoading = false,
}) => {
    return (
        <div className="bg-white dark:bg-card rounded-xl border border-gray-100 dark:border-border shadow-xs p-5 flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-border mb-3">
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                    Module Groups
                </h3>
                <TooltipWrapper content="Thêm nhóm module">
                    <button
                        type="button"
                        onClick={onAddGroup}
                        className="h-7 w-7 rounded-lg border border-gray-200 dark:border-border flex items-center justify-center text-gray-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/50 transition-colors cursor-pointer"
                        aria-label="Add Group"
                    >
                        <Plus className="h-4 w-4" />
                    </button>
                </TooltipWrapper>
            </div>

            {/* Groups list */}
            <div className="space-y-1.5 flex-1 overflow-y-auto pr-1">
                {isLoading ? (
                    <div className="py-8 flex flex-col items-center justify-center text-gray-400 gap-2">
                        <div className="h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs">Đang tải danh sách...</span>
                    </div>
                ) : groups.length === 0 ? (
                    <div className="text-center py-8 text-sm text-gray-400">
                        Chưa có nhóm module nào
                    </div>
                ) : (
                    groups.map((group) => {
                        const isSelected = group.id === selectedGroupId;

                        return (
                            <div
                                key={group.id}
                                onClick={() => onSelectGroup(group.id)}
                                className={`group relative flex items-center justify-between px-3.5 py-3 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                                    isSelected
                                        ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 font-semibold"
                                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-accent/60"
                                }`}
                            >
                                <span className="truncate pr-2">{group.name}</span>

                                {/* Actions on hover or active */}
                                <div
                                    className={`flex items-center gap-1 transition-opacity ${
                                        isSelected
                                            ? "opacity-100"
                                            : "opacity-0 group-hover:opacity-100"
                                    }`}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <button
                                        type="button"
                                        onClick={() => onEditGroup(group)}
                                        className="p-1 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
                                        title="Chỉnh sửa nhóm"
                                    >
                                        <Edit2 className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onDeleteGroup(group)}
                                        className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                                        title="Xóa nhóm"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
