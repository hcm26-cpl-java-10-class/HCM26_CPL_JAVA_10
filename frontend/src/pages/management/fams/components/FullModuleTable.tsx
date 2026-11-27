import React, { useMemo, useState } from "react";
import { Search, MoreVertical, Edit2, Trash2, ChevronLeft, ChevronRight, Layers } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { ModuleGroupItem, ModuleItem } from "@/pages/management/fams/types";

interface FullModuleTableProps {
    modules: ModuleItem[];
    groups: ModuleGroupItem[];
    selectedGroupId: string; // "ALL" or specific group ID
    onSelectGroupId: (groupId: string) => void;
    selectedStatus: string; // "ALL" | "Active" | "Inactive"
    onSelectStatus: (status: string) => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    onEditModule: (module: ModuleItem) => void;
    onDeleteModule: (module: ModuleItem) => void;
    isLoading?: boolean;
}

export const FullModuleTable: React.FC<FullModuleTableProps> = ({
    modules,
    groups,
    selectedGroupId,
    onSelectGroupId,
    selectedStatus,
    onSelectStatus,
    searchQuery,
    onSearchChange,
    onEditModule,
    onDeleteModule,
    isLoading = false,
}) => {
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;

    // Create lookup map for group names
    const groupMap = useMemo(() => {
        const map: Record<string, string> = {};
        groups.forEach((g) => {
            map[g.id] = g.name;
        });
        return map;
    }, [groups]);

    // Filter modules based on group filter, status filter, and search query
    const filteredModules = useMemo(() => {
        return modules.filter((m) => {
            // Group filter
            if (selectedGroupId && selectedGroupId !== "ALL") {
                const groupMatches =
                    m.groupId === selectedGroupId ||
                    String(m.groupId) === String(selectedGroupId);
                if (!groupMatches) return false;
            }

            // Status filter
            if (selectedStatus && selectedStatus !== "ALL") {
                if (m.status !== selectedStatus) return false;
            }

            // Search query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const groupName = groupMap[m.groupId] || "";
                const matches =
                    m.code.toLowerCase().includes(q) ||
                    m.name.toLowerCase().includes(q) ||
                    m.url.toLowerCase().includes(q) ||
                    m.linkInfo.toLowerCase().includes(q) ||
                    m.status.toLowerCase().includes(q) ||
                    groupName.toLowerCase().includes(q);
                if (!matches) return false;
            }

            return true;
        });
    }, [modules, selectedGroupId, selectedStatus, searchQuery, groupMap]);

    // Pagination calculations
    const totalItems = filteredModules.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safeCurrentPage = Math.min(currentPage, totalPages);

    const paginatedModules = useMemo(() => {
        const start = (safeCurrentPage - 1) * pageSize;
        return filteredModules.slice(start, start + pageSize);
    }, [filteredModules, safeCurrentPage, pageSize]);

    const startIndex = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
    const endIndex = Math.min(safeCurrentPage * pageSize, totalItems);

    return (
        <div className="bg-white dark:bg-card rounded-xl border border-gray-100 dark:border-border shadow-xs p-5 flex flex-col gap-4">
            {/* Toolbar: Group filter, Status filter, and Search input */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-border">
                <div className="flex flex-wrap items-center gap-3">
                    {/* Module Group Filter */}
                    <div className="w-48 sm:w-56">
                        <Select
                            value={selectedGroupId}
                            onValueChange={(val) => {
                                onSelectGroupId(val);
                                setCurrentPage(1);
                            }}
                        >
                            <SelectTrigger className="h-9 text-xs rounded-lg border-gray-200 dark:border-border">
                                <div className="flex items-center gap-1.5 truncate">
                                    <Layers className="size-3.5 text-gray-400 shrink-0" />
                                    <SelectValue placeholder="Tất cả nhóm" />
                                </div>
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                                <SelectItem value="ALL" className="text-xs font-medium">
                                    Tất cả nhóm
                                </SelectItem>
                                {groups.map((g) => (
                                    <SelectItem key={g.id} value={g.id} className="text-xs">
                                        {g.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Status Filter */}
                    <div className="w-36">
                        <Select
                            value={selectedStatus}
                            onValueChange={(val) => {
                                onSelectStatus(val);
                                setCurrentPage(1);
                            }}
                        >
                            <SelectTrigger className="h-9 text-xs rounded-lg border-gray-200 dark:border-border">
                                <SelectValue placeholder="Tất cả trạng thái" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL" className="text-xs">
                                    Tất cả trạng thái
                                </SelectItem>
                                <SelectItem value="Active" className="text-xs">
                                    Active
                                </SelectItem>
                                <SelectItem value="Inactive" className="text-xs">
                                    Inactive
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Search Input */}
                <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        type="text"
                        placeholder="Tìm kiếm mã, tên, url..."
                        value={searchQuery}
                        onChange={(e) => {
                            onSearchChange(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="pl-9 h-9 text-sm rounded-lg border-gray-200 dark:border-border bg-gray-50/50 dark:bg-accent/40 focus:bg-white dark:focus:bg-card transition-colors"
                    />
                </div>
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-x-auto min-h-[300px]">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-gray-100 dark:border-border bg-gray-50/50 dark:bg-accent/20">
                            <th className="py-3 px-4 text-xs font-semibold text-gray-600 dark:text-gray-300">
                                Mã
                            </th>
                            <th className="py-3 px-4 text-xs font-semibold text-gray-600 dark:text-gray-300">
                                Tên module
                            </th>
                            <th className="py-3 px-4 text-xs font-semibold text-gray-600 dark:text-gray-300">
                                Nhóm (Module Group)
                            </th>
                            <th className="py-3 px-4 text-xs font-semibold text-gray-600 dark:text-gray-300">
                                URL
                            </th>
                            <th className="py-3 px-4 text-xs font-semibold text-gray-600 dark:text-gray-300">
                                Liên kết
                            </th>
                            <th className="py-3 px-4 text-xs font-semibold text-gray-600 dark:text-gray-300">
                                Trạng thái
                            </th>
                            <th className="py-3 px-4 text-xs font-semibold text-gray-600 dark:text-gray-300 text-right w-16">
                                <span className="sr-only">Thao tác</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-border text-sm">
                        {isLoading ? (
                            <tr>
                                <td colSpan={7} className="py-16 text-center text-gray-400">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <div className="h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                        <span className="text-xs">Đang tải danh sách module...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : paginatedModules.map((item) => {
                            const groupName = groupMap[item.groupId] || "Chưa phân nhóm";
                            return (
                                <tr
                                    key={item.id}
                                    className="hover:bg-gray-50/80 dark:hover:bg-accent/30 transition-colors"
                                >
                                    <td className="py-3.5 px-4 font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                                        {item.code}
                                    </td>
                                    <td className="py-3.5 px-4 text-gray-800 dark:text-gray-200 whitespace-nowrap">
                                        {item.name}
                                    </td>
                                    <td className="py-3.5 px-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50/70 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-100 dark:border-blue-900/40">
                                            <Layers className="size-3 text-blue-500" />
                                            <span>{groupName}</span>
                                        </span>
                                    </td>
                                    <td className="py-3.5 px-4 text-gray-600 dark:text-gray-400 whitespace-nowrap font-mono text-xs">
                                        {item.url}
                                    </td>
                                    <td className="py-3.5 px-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                        {item.linkInfo}
                                    </td>
                                    <td className="py-3.5 px-4 whitespace-nowrap">
                                        <span
                                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                                item.status === "Active"
                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200/70 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800"
                                                    : "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
                                            }`}
                                        >
                                            {item.status}
                                        </span>
                                    </td>
                                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button
                                                    type="button"
                                                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-accent transition-colors cursor-pointer"
                                                    aria-label="Actions"
                                                >
                                                    <MoreVertical className="h-4 w-4" />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-36">
                                                <DropdownMenuItem
                                                    onClick={() => onEditModule(item)}
                                                    className="cursor-pointer gap-2"
                                                >
                                                    <Edit2 className="h-3.5 w-3.5 text-blue-600" />
                                                    <span>Chỉnh sửa</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => onDeleteModule(item)}
                                                    className="cursor-pointer gap-2 text-red-600 focus:text-red-600"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                    <span>Xóa</span>
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </td>
                                </tr>
                            );
                        })}

                        {!isLoading && paginatedModules.length === 0 && (
                            <tr>
                                <td colSpan={7} className="py-12 text-center text-sm text-gray-400">
                                    {searchQuery || selectedGroupId !== "ALL" || selectedStatus !== "ALL"
                                        ? "Không tìm thấy module nào khớp với bộ lọc"
                                        : "Chưa có module nào trong hệ thống"}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Footer with Result Count and Pagination */}
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
    );
};
