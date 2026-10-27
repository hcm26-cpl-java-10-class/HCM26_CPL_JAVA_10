import React, { useMemo, useState } from "react";
import { Search, MoreVertical, Edit2, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ModuleItem } from "../types";

interface ModuleTableProps {
    modules: ModuleItem[];
    onEditModule: (module: ModuleItem) => void;
    onDeleteModule: (module: ModuleItem) => void;
}

export const ModuleTable: React.FC<ModuleTableProps> = ({
    modules,
    onEditModule,
    onDeleteModule,
}) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 5;

    const filteredModules = useMemo(() => {
        if (!searchQuery.trim()) return modules;

        const q = searchQuery.toLowerCase().trim();
        return modules.filter(
            (m) =>
                m.code.toLowerCase().includes(q) ||
                m.name.toLowerCase().includes(q) ||
                m.url.toLowerCase().includes(q) ||
                m.linkInfo.toLowerCase().includes(q) ||
                m.status.toLowerCase().includes(q),
        );
    }, [modules, searchQuery]);

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
        <div className="bg-white dark:bg-card rounded-xl border border-gray-100 dark:border-border shadow-xs p-5 flex flex-col h-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100 dark:border-border">
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                    Modules
                </h3>

                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        type="text"
                        placeholder="Tìm kiếm"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="pl-9 h-9 text-sm rounded-lg border-gray-200 dark:border-border bg-gray-50/50 dark:bg-accent/40 focus:bg-white dark:focus:bg-card transition-colors"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-x-auto min-h-[300px]">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-gray-100 dark:border-border bg-gray-50/50 dark:bg-accent/20">
                            <th className="py-3 px-4 text-xs font-semibold text-gray-600 dark:text-gray-300">
                                Mã
                            </th>
                            <th className="py-3 px-4 text-xs font-semibold text-gray-600 dark:text-gray-300">
                                Tên
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
                        {paginatedModules.map((item) => (
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
                                <td className="py-3.5 px-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
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
                        ))}

                        {paginatedModules.length === 0 && (
                            <tr>
                                <td colSpan={6} className="py-12 text-center text-sm text-gray-400">
                                    {searchQuery
                                        ? "Không tìm thấy module nào khớp với từ khóa tìm kiếm"
                                        : "Chưa có module nào trong nhóm này"}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-100 dark:border-border text-sm text-gray-500">
                <div>
                    Hiển thị {startIndex}–{endIndex} trong {totalItems} kết quả
                </div>

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
                                    ? "bg-orange-500 text-white font-semibold shadow-xs"
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
            </div>
        </div>
    );
};
