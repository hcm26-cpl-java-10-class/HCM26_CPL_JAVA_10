import React, { useState, useMemo } from "react";
import {
  Search,
  MoreVertical,
  Edit2,
  Trash2,
  Building2,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { DepartmentItem } from "../types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TooltipWrapper } from "@/components/datatable/common/TooltipWrapper";

interface DepartmentTableCardProps {
  departments: DepartmentItem[];
  selectedLocationName?: string;
  onEditDepartment: (dept: DepartmentItem) => void;
  onDeleteDepartment: (dept: DepartmentItem) => void;
}

export const DepartmentTableCard: React.FC<DepartmentTableCardProps> = ({
  departments,
  selectedLocationName,
  onEditDepartment,
  onDeleteDepartment,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "Active" | "Inactive">("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  // Filter departments by search query and status
  const filteredDepartments = useMemo(() => {
    return departments.filter((dept) => {
      const matchSearch =
        searchQuery.trim() === "" ||
        dept.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        dept.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        dept.locationName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        dept.linkedEntities.toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus =
        statusFilter === "ALL" || dept.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [departments, searchQuery, statusFilter]);

  // Reset to page 1 on filter or page size changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, pageSize, departments.length]);

  // Pagination calculation
  const totalItems = filteredDepartments.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedDepartments = filteredDepartments.slice(startIndex, endIndex);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs flex flex-col gap-4 min-w-0 w-full">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100 min-w-0">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 tracking-tight flex items-center gap-2 flex-wrap">
            <span>Departments</span>
            {selectedLocationName && (
              <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 truncate max-w-[200px]">
                {selectedLocationName}
              </span>
            )}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {totalItems} department{totalItems !== 1 ? "s" : ""} found
          </p>
        </div>

        {/* Search & Status Filters */}
        <div className="flex flex-wrap items-center gap-2.5 sm:shrink-0">
          {/* Search Input */}
          <div className="relative min-w-[200px] sm:min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by code, name..."
              className="w-full pl-9 pr-8 py-1.5 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Quick Status Filter Tabs */}
          <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                statusFilter === "ALL"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("Active")}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                statusFilter === "Active"
                  ? "bg-white text-emerald-700 shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("Inactive")}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                statusFilter === "Inactive"
                  ? "bg-white text-gray-700 shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Inactive
            </button>
          </div>
        </div>
      </div>

      {/* Table Container with Controlled Fixed Layout */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full table-fixed text-left text-sm text-gray-700 min-w-[540px] md:min-w-full">
          <colgroup>
            <col className="w-[13%] min-w-[70px]" />
            <col className="w-[42%] min-w-[150px]" />
            <col className="w-[14%] min-w-[85px]" />
            <col className="w-[13%] min-w-[80px]" />
            <col className="w-[12%] min-w-[78px]" />
            <col className="w-[6%] min-w-[40px]" />
          </colgroup>
          <thead className="bg-gray-50/80 text-xs uppercase text-gray-500 font-semibold border-b border-gray-200">
            <tr>
              <th scope="col" className="px-3 py-3 font-semibold truncate">
                Code
              </th>
              <th scope="col" className="px-3 py-3 font-semibold truncate">
                Name
              </th>
              <th scope="col" className="px-3 py-3 font-semibold truncate">
                Location
              </th>
              <th scope="col" className="px-3 py-3 font-semibold truncate">
                Linked Entities
              </th>
              <th scope="col" className="px-3 py-3 font-semibold truncate">
                Status
              </th>
              <th scope="col" className="px-2 py-3 text-right">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedDepartments.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Building2 className="h-10 w-10 text-gray-300" />
                    <p className="text-sm font-medium text-gray-900">
                      No departments found
                    </p>
                    <p className="text-xs text-gray-500">
                      Try adjusting your search criteria or selecting another location
                    </p>
                    {(searchQuery || statusFilter !== "ALL") && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery("");
                          setStatusFilter("ALL");
                        }}
                        className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium underline cursor-pointer"
                      >
                        Reset filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              paginatedDepartments.map((dept) => (
                <tr
                  key={dept.id}
                  className="hover:bg-blue-50/40 transition-colors group"
                >
                  {/* Code */}
                  <td className="px-3 py-3 font-semibold text-gray-900 truncate">
                    {dept.code}
                  </td>

                  {/* Name with Expanded Column Width, Tooltip & Description */}
                  <td className="px-3 py-3 font-medium text-gray-800 min-w-0">
                    <TooltipWrapper
                      content={`${dept.name}${dept.description ? ` — ${dept.description}` : ""}`}
                    >
                      <div className="min-w-0 cursor-default" title={dept.name}>
                        <div className="truncate text-gray-900 font-medium">
                          {dept.name}
                        </div>
                        {dept.description && (
                          <div className="text-xs text-gray-400 truncate">
                            {dept.description}
                          </div>
                        )}
                      </div>
                    </TooltipWrapper>
                  </td>

                  {/* Location - Optimized Compact Column */}
                  <td className="px-3 py-3 text-gray-600 min-w-0">
                    <div
                      className="inline-flex items-center gap-1.5 max-w-full"
                      title={dept.locationName}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                      <span className="truncate">{dept.locationName}</span>
                    </div>
                  </td>

                  {/* Linked Entities */}
                  <td className="px-3 py-3 text-gray-600 min-w-0">
                    <span
                      className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-medium inline-block truncate max-w-full"
                      title={dept.linkedEntities}
                    >
                      {dept.linkedEntities}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    {dept.status === "Active" ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
                        Inactive
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-2 py-3 text-right whitespace-nowrap">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                          aria-label="Actions"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem
                          onClick={() => onEditDepartment(dept)}
                          className="cursor-pointer text-gray-700 flex items-center gap-2"
                        >
                          <Edit2 className="h-3.5 w-3.5 text-blue-600" />
                          <span>Edit</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onDeleteDepartment(dept)}
                          className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 flex items-center gap-2"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination & Count Footer (English) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-sm text-gray-600 min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <span>
            Showing{" "}
            <span className="font-semibold text-gray-900">
              {totalItems === 0 ? 0 : startIndex + 1}–{endIndex}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-gray-900">{totalItems}</span> results
          </span>

          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span>/ page:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="border border-gray-300 rounded px-1.5 py-0.5 bg-white text-xs text-gray-700 focus:outline-none focus:border-blue-600"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
          </div>
        </div>

        {/* Page navigation with Blue Theme */}
        {totalPages > 1 && (
          <div className="flex items-center gap-1 self-end sm:self-auto shrink-0">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                type="button"
                onClick={() => setCurrentPage(pageNum)}
                className={`inline-flex items-center justify-center h-8 w-8 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  safePage === pageNum
                    ? "bg-blue-600 text-white shadow-xs"
                    : "border border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {pageNum}
              </button>
            ))}

            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
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
