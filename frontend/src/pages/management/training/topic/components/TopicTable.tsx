import {
  BookOpen,
  Clock,
  Copy,
  Edit2,
  Eye,
  MoreVertical,
  Power,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import type { TopicItem } from "@/types/features/content";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getTechnicalGroupBadgeClass } from "@/schemas/topic.schema";

interface TopicTableProps {
  topics: TopicItem[];
  loading: boolean;
  page: number;
  pageSize: number;
  totalPages: number;
  totalElements: number;
  onPageChange: (nextPage: number) => void;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  onOpenDetail: (topic: TopicItem) => void;
  onOpenOutlineEditor: (topic: TopicItem) => void;
  onOpenSyllabusImport: (topic: TopicItem) => void;
  onOpenEdit: (topic: TopicItem) => void;
  onOpenClone: (topic: TopicItem) => void;
  onToggleStatus: (topic: TopicItem) => void;
  onRequestDelete: (topic: TopicItem) => void;
}

export function TopicTable({
  topics,
  loading,
  page,
  pageSize,
  totalPages,
  totalElements,
  onPageChange,
  canCreate,
  canUpdate,
  canDelete,
  onOpenDetail,
  onOpenOutlineEditor,
  onOpenSyllabusImport,
  onOpenEdit,
  onOpenClone,
  onToggleStatus,
  onRequestDelete,
}: TopicTableProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs w-8">#</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs w-[150px]">
                Topic Code
              </th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs">
                Topic Name
              </th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs w-20">
                Version
              </th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs w-36">
                Technical Group
              </th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs w-28">
                Duration
              </th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs w-24">
                Status
              </th>
              <th className="w-10" />
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center py-16 text-gray-400">
                  <RefreshCw className="size-5 animate-spin mx-auto mb-2 text-purple-500" />
                  Loading topics...
                </td>
              </tr>
            ) : topics.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-16 text-gray-400 text-sm">
                  No topics found
                </td>
              </tr>
            ) : (
              topics.map((topic, idx) => (
                <tr key={topic.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-500 text-xs">{page * pageSize + idx + 1}</td>

                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onOpenDetail(topic)}
                      className="font-mono text-xs font-semibold text-gray-800 hover:text-[#5b52e0] text-left cursor-pointer transition-colors"
                    >
                      {topic.code}
                    </button>
                  </td>

                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onOpenDetail(topic)}
                      className="text-gray-900 hover:text-purple-700 hover:underline text-left font-medium text-sm line-clamp-1 cursor-pointer"
                    >
                      {topic.name}
                    </button>
                  </td>

                  <td className="px-4 py-3 text-gray-600 text-xs font-mono">
                    <span className="inline-block px-1.5 py-0.5 text-[11px] font-mono bg-purple-50 text-purple-700 border border-purple-200 rounded">
                      v{topic.version}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    {topic.technicalGroup ? (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${getTechnicalGroupBadgeClass(
                          topic.technicalGroup
                        )}`}
                      >
                        {topic.technicalGroup}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center gap-1 font-mono text-xs text-gray-700">
                      <Clock className="size-3 text-gray-400" />
                      {topic.durationHours}h
                    </span>
                  </td>

                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      disabled={!canUpdate}
                      onClick={() => canUpdate && onToggleStatus(topic)}
                      title={canUpdate ? "Click to toggle status" : undefined}
                      className={canUpdate ? "cursor-pointer" : "cursor-default"}
                    >
                      {topic.isActive ? (
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200 ${
                            canUpdate ? "hover:bg-green-200 transition-colors" : ""
                          }`}
                        >
                          Active
                        </span>
                      ) : (
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200 ${
                            canUpdate ? "hover:bg-gray-200 transition-colors" : ""
                          }`}
                        >
                          Inactive
                        </span>
                      )}
                    </button>
                  </td>

                  <td className="px-2 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-gray-400 hover:text-gray-600"
                        >
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          onClick={() => onOpenDetail(topic)}
                          className="gap-2 text-xs"
                        >
                          <Eye className="size-3.5 text-gray-500" /> View Details
                        </DropdownMenuItem>

                        {canUpdate && (
                          <>
                            <DropdownMenuItem
                              onClick={() => onOpenOutlineEditor(topic)}
                              className="gap-2 text-xs"
                            >
                              <BookOpen className="size-3.5 text-[#5b52e0]" /> Edit Syllabus
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onOpenSyllabusImport(topic)}
                              className="gap-2 text-xs"
                            >
                              <Upload className="size-3.5 text-indigo-600" /> Import Syllabus
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onOpenEdit(topic)}
                              className="gap-2 text-xs"
                            >
                              <Edit2 className="size-3.5 text-blue-500" /> Edit Topic
                            </DropdownMenuItem>
                          </>
                        )}

                        {canCreate && (
                          <DropdownMenuItem
                            onClick={() => onOpenClone(topic)}
                            className="gap-2 text-xs"
                          >
                            <Copy className="size-3.5 text-purple-500" /> Clone Version
                          </DropdownMenuItem>
                        )}

                        {canUpdate && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => onToggleStatus(topic)}
                              className={`gap-2 text-xs font-medium cursor-pointer ${
                                topic.isActive
                                  ? "text-orange-600 focus:text-orange-600"
                                  : "text-emerald-600 focus:text-emerald-600"
                              }`}
                            >
                              <Power className="size-3.5" />
                              {topic.isActive ? "Deactivate Topic" : "Activate Topic"}
                            </DropdownMenuItem>
                          </>
                        )}

                        {canDelete && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => onRequestDelete(topic)}
                              className="gap-2 text-xs text-red-600"
                            >
                              <Trash2 className="size-3.5" /> Delete Topic
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-500">
        <span>
          Showing {topics.length > 0 ? page * pageSize + 1 : 0} to{" "}
          {Math.min((page + 1) * pageSize, totalElements)} of {totalElements} entries
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-3 text-xs"
            disabled={page <= 0}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <span className="px-2 font-medium">
            {page + 1} / {Math.max(1, totalPages)}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-3 text-xs"
            disabled={page >= totalPages - 1}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
