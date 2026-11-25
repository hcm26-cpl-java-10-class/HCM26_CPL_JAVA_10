import { categoryLabel, metadataLabel } from "@/integrations/courses/course-presentation";
import { useState } from "react";
import {
  ArrowUpDown,
  Columns3,
  Eye,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Upload,
  Plus,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type {
  CourseItem,
  SortField,
  SortState,
  ColumnVisibility,
} from "../types";

interface CourseTableProps {
  courses: CourseItem[];
  totalItems: number;
  totalCoursesCount?: number;
  selectedIds: Set<number>;
  onToggleSelectRow: (id: number) => void;
  onToggleSelectAll: () => void;
  sortState: SortState;
  onSortChange: (field: SortField) => void;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  autoPageSize?:boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onViewCourse: (course: CourseItem) => void;
  onEditCourse: (course: CourseItem) => void;
  onDeleteCourse: (course: CourseItem) => void;
  onToggleStatus: (course: CourseItem) => void;
  canUpdate?: boolean;
  canDelete?: boolean;
  busy?: boolean;
  onImportClick?: () => void;
  onCreateClick?: () => void;
}

export const CourseTable: React.FC<CourseTableProps> = ({
  courses,
  totalItems,
  totalCoursesCount,
  selectedIds,
  onToggleSelectRow,
  onToggleSelectAll,
  sortState,
  onSortChange,
  currentPage,
  totalPages,
  pageSize,
  autoPageSize,
  onPageChange,
  onPageSizeChange,
  onViewCourse,
  onEditCourse,
  onDeleteCourse,
  onToggleStatus,
  canUpdate = false,
  canDelete = false,
  busy = false,
  onImportClick,
  onCreateClick,
}) => {
  const [columns, setColumns] = useState<ColumnVisibility>({
    name: true,
    instructor: true,
    category: true,
    publicationStatus: true,
    courseLevel: true,
    description: true,
    thumbnailUrl: true,
    status: true,
    createdAt: true,
  });

  const toggleColumn = (key: keyof ColumnVisibility) => {
    setColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isAllCurrentSelected =
    courses.length > 0 && courses.every((c) => selectedIds.has(c.id));
  const isSomeSelected =
    courses.some((c) => selectedIds.has(c.id)) && !isAllCurrentSelected;

  // Generate page numbers to display
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="flex min-h-[65vh] flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-neutral-900">
      <div className="w-full flex-1 overflow-auto">
        <table className="w-full min-w-[1450px] border-collapse text-left">
          {/* Table Header (<thead>) */}
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 dark:border-zinc-800 dark:bg-neutral-950 dark:text-zinc-200 [&_th]:whitespace-nowrap [&_th]:py-3 [&_th:not(:last-child)]:border-r [&_th]:border-slate-200 dark:[&_th]:border-zinc-800">
            <tr>
              {/* 1. Checkbox */}
              <th className="w-10 px-3 py-3.5 text-center">
                <input
                  type="checkbox"
                  aria-label="Select all courses"
                  checked={isAllCurrentSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = isSomeSelected;
                  }}
                  onChange={onToggleSelectAll}
                  className="size-4 rounded border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 focus:ring-slate-900 dark:focus:ring-zinc-400 cursor-pointer"
                />
              </th>

              {/* 2. # (Index) */}
              <th className="w-10 px-2 py-3.5 text-center text-slate-500 dark:text-zinc-400 font-medium">
                #
              </th>

              {/* 3. Course Name */}
              {columns.name && (
                <th
                  onClick={() => onSortChange("name")}
                  className="px-3 py-3.5 cursor-pointer select-none hover:text-slate-900 dark:hover:text-zinc-100 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Course Name</span>
                    <ArrowUpDown
                      className={`w-3.5 h-3.5 ${
                        sortState.field === "name"
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-slate-400 dark:text-zinc-500"
                      }`}
                    />
                  </div>
                </th>
              )}

              {/* 4. Instructor */}
              {columns.instructor && (
                <th
                  onClick={() => onSortChange("instructor")}
                  className="px-3 py-3.5 cursor-pointer select-none hover:text-slate-900 dark:hover:text-zinc-100 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Instructor</span>
                    <ArrowUpDown
                      className={`w-3.5 h-3.5 ${
                        sortState.field === "instructor"
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-slate-400 dark:text-zinc-500"
                      }`}
                    />
                  </div>
                </th>
              )}

              {/* 5. Categories */}
              {columns.category && (
                <th className="px-3 py-3.5">
                  <span>Categories</span>
                </th>
              )}

              {/* 6. Publication status */}
              {columns.publicationStatus && (
                <th

                  className="px-3 py-3.5 "
                >
                  <div className="flex items-center gap-1.5">
                    <span className="truncate max-w-[110px]" title="Publication status">
                      Publication status
                    </span>
                  </div>
                </th>
              )}

              {/* 7. Course level */}
              {columns.courseLevel && (
                <th

                  className="px-3 py-3.5 "
                >
                  <div className="flex items-center gap-1.5">
                    <span>Course level</span>
                  </div>
                </th>
              )}

              {/* 8. Description */}
              {columns.description && (
                <th className="px-3 py-3.5">
                  <span>Description</span>
                </th>
              )}

              {/* 9. Thumbnail URL */}
              {columns.thumbnailUrl && (
                <th className="px-3 py-3.5">
                  <span>Thumbnail URL</span>
                </th>
              )}

              {/* 10. Status */}
              {columns.status && (
                <th className="px-3 py-3.5 text-center">
                  <span>Status</span>
                </th>
              )}

              {/* 11. Created At */}
              {columns.createdAt && (
                <th
                  onClick={() => onSortChange("createdAt")}
                  className="px-3 py-3.5 cursor-pointer select-none hover:text-slate-900 dark:hover:text-zinc-100 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Created At</span>
                    <ArrowUpDown
                      className={`w-3.5 h-3.5 ${
                        sortState.field === "createdAt"
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-slate-400 dark:text-zinc-500"
                      }`}
                    />
                  </div>
                </th>
              )}

              {/* 12. Actions + Column Visibility Toggle */}
              <th className="sticky right-0 z-20 w-36 bg-slate-50 px-3 py-3.5 text-right dark:bg-neutral-950">
                <div className="flex items-center justify-end gap-2">
                  <span className="font-semibold">Actions</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        aria-label="Toggle column visibility"
                        title="Customize columns"
                        className="h-7 w-7 rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-center text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                      >
                        <Columns3 className="w-3.5 h-3.5" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="end"
                      className="w-52 p-2 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 shadow-md text-xs"
                    >
                      <div className="font-semibold text-slate-800 dark:text-zinc-200 px-2 py-1.5 border-b border-slate-100 dark:border-zinc-800 mb-1">
                        Visible Columns
                      </div>
                      <div className="space-y-1">
                        {(
                          [
                            ["name", "Course Name"],
                            ["instructor", "Instructor"],
                            ["category", "Categories"],
                            ["publicationStatus", "Publication Status"],
                            ["courseLevel", "Course Level"],
                            ["description", "Description"],
                            ["thumbnailUrl", "Thumbnail URL"],
                            ["status", "Status"],
                            ["createdAt", "Created At"],
                          ] as [keyof ColumnVisibility, string][]
                        ).map(([key, label]) => (
                          <label
                            key={key}
                            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer text-slate-700 dark:text-zinc-300"
                          >
                            <input
                              type="checkbox"
                              checked={columns[key]}
                              onChange={() => toggleColumn(key)}
                              className="size-3.5 rounded border-slate-300 text-slate-900 dark:border-zinc-700"
                            />
                            <span>{label}</span>
                          </label>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </th>
            </tr>
          </thead>

          {/* Table Body (<tbody>) */}
          <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
            {(totalCoursesCount !== undefined ? totalCoursesCount === 0 : totalItems === 0) ? (
              <tr>
                <td
                  colSpan={12}
                  className="px-4 py-16 text-center text-slate-500 dark:text-zinc-400 text-xs"
                >
                  <div className="flex flex-col items-center justify-center max-w-md mx-auto space-y-3">
                    <div className="size-12 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-400 dark:text-zinc-500">
                      <GraduationCap className="size-6" />
                    </div>
                    <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                      No courses available. Click 'Import' to upload an .xlsx file or '+ Create' to add a new course.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      {onImportClick && (
                        <button
                          type="button"
                          disabled={!onImportClick || busy}
                          onClick={onImportClick}
                          className="h-8 px-3.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Import .xlsx</span>
                        </button>
                      )}
                      {onCreateClick && (
                        <button
                          type="button"
                          disabled={!onCreateClick || busy}
                          onClick={onCreateClick}
                          className="h-8 px-3 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium flex items-center gap-1.5 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>+ Create</span>
                        </button>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            ) : courses.length === 0 ? (
              <tr>
                <td
                  colSpan={12}
                  className="px-4 py-12 text-center text-slate-400 dark:text-zinc-500 text-xs"
                >
                  No courses found matching your criteria.
                </td>
              </tr>
            ) : (
              courses.map((course, idx) => {
                const rowIndex = (currentPage - 1) * pageSize + idx + 1;
                const isSelected = selectedIds.has(course.id);

                return (
                  <tr
                    key={course.id}
                    className={`h-[54px] border-b border-slate-200 text-sm transition-colors hover:bg-blue-50 dark:border-zinc-800 dark:hover:bg-neutral-700 ${
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-950/40"
                        : idx % 2 === 0 ? "bg-slate-100 dark:bg-neutral-800" : "bg-white dark:bg-neutral-950"
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="w-10 px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelectRow(course.id)}
                        className="size-4 rounded border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 focus:ring-slate-900 dark:focus:ring-zinc-400 cursor-pointer"
                      />
                    </td>

                    {/* # Index */}
                    <td className="w-10 px-2 py-2 text-center text-slate-400 dark:text-zinc-400">
                      {rowIndex}
                    </td>

                    {/* Course Name */}
                    {columns.name && (
                      <td className="px-3 py-2">
                        <span
                          className="block max-w-[190px] cursor-pointer truncate font-semibold text-slate-900 hover:underline dark:text-zinc-100"
                          title={course.name}
                          onClick={() => onViewCourse(course)}
                        >
                          {course.name}
                        </span>
                      </td>
                    )}

                    {/* Instructor */}
                    {columns.instructor && (
                      <td className="px-3 py-2 text-slate-600 dark:text-zinc-300 truncate max-w-[130px]">
                        <span title={course.instructor}>{course.instructor}</span>
                      </td>
                    )}

                    {/* Categories Pill Badge */}
                    {columns.category && (
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-neutral-700 dark:text-zinc-100" title="Category from saved Course metadata.">
                          {categoryLabel(course.categoryName || course.category)}
                        </span>
                      </td>
                    )}

                    {/* Publication status */}
                    {columns.publicationStatus && (
                      <td className="px-3 py-2 whitespace-nowrap text-slate-700 dark:text-zinc-300">
                        <span title="Saved publication status. Active is a separate state.">
                          {metadataLabel(course.publicationStatus)}
                        </span>
                      </td>
                    )}

                    {/* Course level */}
                    {columns.courseLevel && (
                      <td className="px-3 py-2 whitespace-nowrap text-slate-700 dark:text-zinc-300">
                        {metadataLabel(course.courseLevel)}
                      </td>
                    )}

                    {/* Description */}
                    {columns.description && (
                      <td className="px-3 py-2">
                        <span
                          className="truncate max-w-[160px] block text-slate-500 dark:text-zinc-300 cursor-help"
                          title={course.description}
                        >
                          {course.description || "—"}
                        </span>
                      </td>
                    )}

                    {/* Thumbnail URL */}
                    {columns.thumbnailUrl && (
                      <td className="px-3 py-2">
                        <span
                          className="block max-w-[140px] cursor-help truncate text-sm text-slate-500 dark:text-zinc-300"
                          title={course.thumbnailUrl}
                        >
                          {course.thumbnailUrl || "—"}
                        </span>
                      </td>
                    )}

                    {/* Status Toggle Switch */}
                    {columns.status && (
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={course.isActive}
                          disabled={!canUpdate || busy}
                          onClick={() => onToggleStatus(course)}
                          title={course.isActive ? "Active (click to deactivate)" : "Inactive (click to activate)"}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                            course.isActive
                              ? "bg-zinc-200 dark:bg-zinc-200"
                              : "bg-slate-200 dark:bg-zinc-800"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full transition duration-200 ease-in-out my-0.5 ${
                              course.isActive
                                ? "translate-x-4 bg-zinc-900 shadow-xs"
                                : "translate-x-0.5 bg-white dark:bg-zinc-400 shadow-xs"
                            }`}
                          />
                        </button>
                      </td>
                    )}

                    {/* Created At */}
                    {columns.createdAt && (
                      <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-slate-600 dark:text-zinc-300" title={course.createdAt}>
                        {course.createdAt && Number.isFinite(Date.parse(course.createdAt)) ? new Date(course.createdAt).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})+" "+new Date(course.createdAt).toLocaleDateString("en-GB") : course.createdAt || "Not available"}
                      </td>
                    )}

                    {/* 3 Inline Square Action Buttons */}
                    <td className="sticky right-0 bg-inherit px-3 py-2 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* View */}
                        <button
                          type="button"
                          aria-label="View course"
                          title="View Details"
                          onClick={() => onViewCourse(course)}
                          className="w-9 h-9 rounded-lg border border-slate-200 dark:border-zinc-700/80 bg-transparent hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* Edit */}
                        <button
                          type="button"
                          aria-label="Edit course"
                          disabled={!canUpdate || busy}
                          title="Edit Course"
                          onClick={() => onEditCourse(course)}
                          className="w-9 h-9 rounded-lg border border-slate-200 dark:border-zinc-700/80 bg-transparent hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          aria-label="Delete course"
                          disabled={!canDelete || busy}
                          title="Delete Course"
                          onClick={() => onDeleteCourse(course)}
                          className="w-9 h-9 rounded-lg border border-red-500/20 dark:border-red-900/50 bg-red-500/5 hover:bg-red-500/15 text-red-500 flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 4. Bottom Pagination & Selection Footer */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-t border-slate-200 bg-white px-4 py-4 text-sm text-slate-500 dark:border-zinc-800 dark:bg-neutral-950 dark:text-zinc-400">
        {/* Left Side: Selected rows counter */}
        <div>
          <strong className="font-semibold text-slate-900 dark:text-zinc-100">
            {selectedIds.size}
          </strong>{" "}
          of{" "}
          <strong className="font-semibold text-slate-900 dark:text-zinc-100">
            {totalItems}
          </strong>{" "}
          rows selected
        </div>

        {/* Right Side: Rows per page, Page indicator, and Pagination buttons */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          {/* Rows per page selector */}
          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <select
              aria-label="Rows per page"
              value={autoPageSize?0:pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 px-2.5 rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
            >
              <option value={0}>Auto</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>

          {/* Page Indicator */}
          <div>
            Page{" "}
            <strong className="font-semibold text-slate-900 dark:text-zinc-100">
              {currentPage}
            </strong>{" "}
            of{" "}
            <strong className="font-semibold text-slate-900 dark:text-zinc-100">
              {totalPages}
            </strong>
          </div>

          {/* Pagination Buttons */}
          <div className="flex items-center gap-1">
            {/* Previous button */}
            <button
              type="button"
              aria-label="Previous page"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
              className="w-8 h-8 rounded-md border border-slate-200 dark:border-zinc-800 flex items-center justify-center disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Page number buttons */}
            {pageNumbers.map((num) => {
              const isActive = num === currentPage;
              return (
                <button
                  key={num}
                  type="button"
                  aria-label={`Page ${num}`}
                  onClick={() => onPageChange(num)}
                  className={`w-8 h-8 rounded-md text-xs transition-colors cursor-pointer flex items-center justify-center ${
                    isActive
                      ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold shadow-xs"
                      : "border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300"
                  }`}
                >
                  {num}
                </button>
              );
            })}

            {/* Next button */}
            <button
              type="button"
              aria-label="Next page"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(currentPage + 1)}
              className="w-8 h-8 rounded-md border border-slate-200 dark:border-zinc-800 flex items-center justify-center disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
