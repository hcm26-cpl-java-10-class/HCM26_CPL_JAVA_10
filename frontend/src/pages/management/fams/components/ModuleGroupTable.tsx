import React from "react";
import { Edit2, Trash2, Layers, ArrowRight } from "lucide-react";
import { TooltipWrapper } from "@/components/datatable/common/TooltipWrapper";
import type { ModuleGroupItem } from "@/pages/management/fams/types";

interface ModuleGroupTableProps {
    groups: ModuleGroupItem[];
    onViewModules: (group: ModuleGroupItem) => void;
    onEditGroup: (group: ModuleGroupItem) => void;
    onDeleteGroup: (group: ModuleGroupItem) => void;
    isLoading?: boolean;
}

export const ModuleGroupTable: React.FC<ModuleGroupTableProps> = ({
    groups,
    onViewModules,
    onEditGroup,
    onDeleteGroup,
    isLoading = false,
}) => {
    return (
        <div className="flex-1 overflow-x-auto min-h-[300px]">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="border-b border-gray-100 dark:border-border bg-gray-50/50 dark:bg-accent/20">
                        <th className="py-3 px-4 text-xs font-semibold text-gray-600 dark:text-gray-300">
                            Tên nhóm
                        </th>
                        <th className="py-3 px-4 text-xs font-semibold text-gray-600 dark:text-gray-300">
                            Mô tả
                        </th>
                        <th className="py-3 px-4 text-xs font-semibold text-gray-600 dark:text-gray-300 text-center w-32">
                            Số Modules
                        </th>
                        <th className="py-3 px-4 text-xs font-semibold text-gray-600 dark:text-gray-300 text-center w-32">
                            Thứ tự hiển thị
                        </th>
                        <th className="py-3 px-4 text-xs font-semibold text-gray-600 dark:text-gray-300 text-right w-44">
                            <span className="sr-only">Thao tác</span>
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-border text-sm">
                    {isLoading ? (
                        <tr>
                            <td colSpan={5} className="py-16 text-center text-gray-400">
                                <div className="flex flex-col items-center justify-center gap-2">
                                    <div className="h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                    <span className="text-xs">Đang tải danh sách nhóm module...</span>
                                </div>
                            </td>
                        </tr>
                    ) : groups.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="py-16 text-center text-sm text-gray-400">
                                Không tìm thấy nhóm module nào
                            </td>
                        </tr>
                    ) : (
                        groups.map((item) => (
                            <tr
                                key={item.id}
                                className="hover:bg-gray-50/80 dark:hover:bg-accent/30 transition-colors group"
                            >
                                <td className="py-3.5 px-4 font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                                    <div className="flex items-center gap-2.5">
                                        <div className="size-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-900/40">
                                            <Layers className="size-4" />
                                        </div>
                                        <span>{item.name}</span>
                                    </div>
                                </td>
                                <td className="py-3.5 px-4 text-gray-600 dark:text-gray-400 max-w-md truncate">
                                    {item.description || <span className="text-gray-400 italic">Chưa có mô tả</span>}
                                </td>
                                <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                    <button
                                        type="button"
                                        onClick={() => onViewModules(item)}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-400 dark:hover:bg-blue-900/60 border border-blue-200/60 dark:border-blue-800 transition-colors cursor-pointer"
                                        title="Xem danh sách modules trong nhóm này"
                                    >
                                        <span>{item.moduleCount ?? 0} modules</span>
                                        <ArrowRight className="size-3" />
                                    </button>
                                </td>
                                <td className="py-3.5 px-4 text-center text-gray-600 dark:text-gray-400 whitespace-nowrap font-medium">
                                    {item.displayOrder ?? 0}
                                </td>
                                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-1">
                                        <TooltipWrapper content="Xem Modules">
                                            <button
                                                type="button"
                                                onClick={() => onViewModules(item)}
                                                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors cursor-pointer"
                                            >
                                                <span>Xem Modules</span>
                                            </button>
                                        </TooltipWrapper>

                                        <TooltipWrapper content="Chỉnh sửa nhóm">
                                            <button
                                                type="button"
                                                onClick={() => onEditGroup(item)}
                                                className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors cursor-pointer"
                                                aria-label="Edit"
                                            >
                                                <Edit2 className="size-3.5" />
                                            </button>
                                        </TooltipWrapper>

                                        <TooltipWrapper content="Xóa nhóm">
                                            <button
                                                type="button"
                                                onClick={() => onDeleteGroup(item)}
                                                className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/60 transition-colors cursor-pointer"
                                                aria-label="Delete"
                                            >
                                                <Trash2 className="size-3.5" />
                                            </button>
                                        </TooltipWrapper>
                                    </div>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
};
