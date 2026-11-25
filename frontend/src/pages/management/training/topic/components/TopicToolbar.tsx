import { Download, Plus, RefreshCw, Search, SlidersHorizontal, Upload, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TECHNICAL_GROUP_OPTIONS } from "@/schemas/topic.schema";

interface TopicToolbarProps {
  totalElements: number;
  search: string;
  onSearchChange: (value: string) => void;
  technicalGroup: string;
  onTechnicalGroupChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  showFilterPanel: boolean;
  onToggleFilterPanel: () => void;
  onResetFilters: () => void;
  canCreate: boolean;
  onOpenImport: () => void;
  onOpenExport: () => void;
  onOpenCreate: () => void;
}

export function TopicToolbar({
  totalElements,
  search,
  onSearchChange,
  technicalGroup,
  onTechnicalGroupChange,
  statusFilter,
  onStatusFilterChange,
  showFilterPanel,
  onToggleFilterPanel,
  onResetFilters,
  canCreate,
  onOpenImport,
  onOpenExport,
  onOpenCreate,
}: TopicToolbarProps) {
  const activeFilters = [technicalGroup !== "ALL", statusFilter !== "ALL"].filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">Topic List</span>
          <Badge variant="secondary" className="text-xs px-2 py-0.5 font-mono">
            {totalElements} {totalElements === 1 ? "entry" : "entries"}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <Input
              placeholder="Enter keyword..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 pr-8 w-64 bg-white border-gray-300 text-sm"
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded"
                title="Clear search"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-white border-gray-300 text-gray-700"
            onClick={onToggleFilterPanel}
          >
            <SlidersHorizontal className="size-4" />
            Filter
            {activeFilters > 0 && (
              <Badge className="ml-0.5 px-1.5 py-0 text-[10px] bg-purple-600 text-white rounded-full">
                {activeFilters}
              </Badge>
            )}
          </Button>

          {canCreate && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 bg-white border-gray-300"
              onClick={onOpenImport}
            >
              <Upload className="size-4" /> Import CSV
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-white border-gray-300"
            onClick={onOpenExport}
          >
            <Download className="size-4" /> Export
          </Button>

          {canCreate && (
            <Button
              size="sm"
              className="gap-2 bg-[#5b52e0] hover:bg-[#4d44cb] text-white"
              onClick={onOpenCreate}
            >
              <Plus className="size-4" /> Add
            </Button>
          )}
        </div>
      </div>

      {showFilterPanel && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-4 shadow-sm">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Technical Group</label>
            <Select value={technicalGroup} onValueChange={onTechnicalGroupChange}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="All Groups" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Groups</SelectItem>
                {TECHNICAL_GROUP_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Status</label>
            <Select value={statusFilter} onValueChange={onStatusFilterChange}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end flex-1 justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-gray-500 gap-1.5"
              onClick={onResetFilters}
            >
              <RefreshCw className="size-3" /> Reset
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
