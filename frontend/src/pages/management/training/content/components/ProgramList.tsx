import { useState, useEffect, useCallback } from "react";
import { programApi } from "@/api/features/program.api";
import type { TrainingProgramItem, ProgramStatus } from "@/types/features/content";
import { ProgramDetailModal } from "./ProgramDetailModal";
import { ProgramImportDialog } from "./ProgramImportDialog";
import { ProgramExportDialog } from "./ProgramExportDialog";
import { ProgramTopicsCell } from "./ProgramTopicsCell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Download,
  Upload,
  RefreshCw,
  Copy,
  Edit2,
  Trash2,
  Eye,
  MoreVertical,
  SlidersHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ProgramListProps {
  onOpenCreate: () => void;
  onEditProgram: (program: TrainingProgramItem) => void;
  onViewDetail?: (program: TrainingProgramItem) => void;
}

export function ProgramList({ onOpenCreate, onEditProgram, onViewDetail }: ProgramListProps) {
  const [programs, setPrograms] = useState<TrainingProgramItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ACTIVE");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [regionFilter, setRegionFilter] = useState<string>("ALL");
  const [availableRegions, setAvailableRegions] = useState<string[]>([
    "GLOBAL", "FSA.HCM", "FSA.HN", "FSA.DN", "FSA.QN", "HCM", "HN"
  ]);

  useEffect(() => {
    programApi.getRegions().then((regs) => {
      if (regs && regs.length > 0) {
        setAvailableRegions(Array.from(new Set(["GLOBAL", "FSA.HCM", "FSA.HN", "FSA.DN", "FSA.QN", ...regs])).filter(Boolean));
      }
    }).catch(() => {});
  }, []);

  // Modals
  const [selectedProgram, setSelectedProgram] = useState<TrainingProgramItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCloneOpen, setIsCloneOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [cloningProgram, setCloningProgram] = useState<TrainingProgramItem | null>(null);
  const [newVersion, setNewVersion] = useState("1.1");

  const loadPrograms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await programApi.getPage({
        page,
        size: 10,
        search: search.trim() || undefined,
        status: statusFilter !== "ALL" ? (statusFilter as ProgramStatus) : undefined,
        region: regionFilter !== "ALL" ? regionFilter : undefined,
      });
      setPrograms(res.content || []);
      setTotalPages(res.totalPages || 1);
      setTotalElements(res.totalElements || 0);
    } catch {
      toast.error("Failed to load training programs");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, regionFilter]);

  useEffect(() => {
    loadPrograms();
  }, [loadPrograms]);

  const handleOpenDetail = (p: TrainingProgramItem) => {
    if (onViewDetail) {
      onViewDetail(p);
    } else {
      setSelectedProgram(p);
      setIsDetailOpen(true);
    }
  };

  const handleOpenClone = (p: TrainingProgramItem) => {
    setCloningProgram(p);
    const parts = (p.version || "1.0").split(".");
    const minor = parseInt(parts[1] ?? "0", 10);
    setNewVersion(`${parts[0]}.${isNaN(minor) ? 1 : minor + 1}`);
    setIsCloneOpen(true);
  };

  const handleCloneConfirm = async () => {
    if (!cloningProgram || !newVersion.trim()) return;
    try {
      await programApi.cloneVersion(cloningProgram.id, newVersion.trim());
      toast.success(`Successfully cloned to version ${newVersion}`);
      setIsCloneOpen(false);
      loadPrograms();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Clone failed");
    }
  };

  const handleToggleStatus = async (p: TrainingProgramItem) => {
    try {
      if (p.status === "ACTIVE") {
        await programApi.changeStatus(p.id, "INACTIVE");
        toast.success(`Deactivated "${p.name}"`);
      } else {
        await programApi.changeStatus(p.id, "ACTIVE");
        toast.success(`Activated "${p.name}"`);
      }
      loadPrograms();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Status change failed");
    }
  };

  const handleDeleteProgram = async (p: TrainingProgramItem) => {
    if (!confirm(`Delete training program "${p.name}"?`)) return;
    try {
      await programApi.delete(p.id);
      toast.success("Training program deleted successfully");
      loadPrograms();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Cannot delete this training program");
    }
  };



  const activeFilterCount = [
    statusFilter !== "ACTIVE" ? 1 : 0,
    regionFilter !== "ALL" ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">Program List</span>
          <Badge variant="secondary" className="text-xs px-2 py-0.5 font-mono">
            {totalElements} {totalElements === 1 ? "entry" : "entries"}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <Input
              placeholder="Enter keyword..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-9 w-64 bg-white border-gray-300 text-sm"
            />
          </div>

          {/* Filter */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-white border-gray-300 text-gray-700"
            onClick={() => setShowFilterPanel((v) => !v)}
          >
            <SlidersHorizontal className="size-4" />
            Filter
            {activeFilterCount > 0 && (
              <Badge className="ml-0.5 px-1.5 py-0 text-[10px] bg-purple-600 text-white rounded-full">
                {activeFilterCount}
              </Badge>
            )}
          </Button>

          {/* Import */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-white border-gray-300 text-gray-700"
            onClick={() => setIsImportOpen(true)}
          >
            <Upload className="size-4" />
            Import
          </Button>

          {/* Export */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-white border-gray-300 text-gray-700"
            onClick={() => setIsExportOpen(true)}
          >
            <Download className="size-4" />
            Export
          </Button>

          {/* Add */}
          <Button size="sm" className="gap-2 bg-[#5b52e0] hover:bg-[#4d44cb] text-white" onClick={onOpenCreate}>
            <Plus className="size-4" />
            Add
          </Button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilterPanel && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-4 shadow-sm">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Status</label>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[140px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Region</label>
            <Select value={regionFilter} onValueChange={(v) => { setRegionFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[140px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Regions</SelectItem>
                {availableRegions.map((reg) => (
                  <SelectItem key={reg} value={reg}>
                    {reg}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-4 text-xs text-gray-500"
            onClick={() => { setStatusFilter("ACTIVE"); setRegionFilter("ALL"); setPage(0); }}
          >
            Reset
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs w-8">#</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs w-[150px]">Course Code</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs w-16">Version</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs w-28">Region</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs w-[220px]">Topics</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs w-32">Last Modified</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs w-24">Status</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && programs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-gray-400">
                    <RefreshCw className="size-5 animate-spin mx-auto mb-2 text-purple-500" />
                    Loading...
                  </td>
                </tr>
              ) : programs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-gray-400 text-sm">
                    No data available in table
                  </td>
                </tr>
              ) : (
                programs.map((p, idx) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 text-xs">{page * 10 + idx + 1}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="font-mono text-xs font-semibold text-gray-800 hover:text-[#5b52e0] text-left cursor-pointer transition-colors"
                        onClick={() => handleOpenDetail(p)}
                      >
                        {p.code}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs font-mono">{p.version}</td>
                    <td className="px-4 py-3">
                      <button
                        className="text-purple-700 hover:text-purple-900 hover:underline text-left font-medium text-sm line-clamp-1"
                        onClick={() => handleOpenDetail(p)}
                      >
                        {p.name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{p.region || "—"}</td>
                    <td className="px-4 py-3">
                      <ProgramTopicsCell
                        subjects={p.subjects}
                        programCode={p.code}
                        programName={p.name}
                        onViewDetail={() => handleOpenDetail(p)}
                      />
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {p.status === "ACTIVE" ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-7 text-gray-400 hover:text-gray-600">
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => handleOpenDetail(p)}>
                            <Eye className="size-3.5 mr-2" /> View Detail
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onEditProgram(p)}>
                            <Edit2 className="size-3.5 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenClone(p)}>
                            <Copy className="size-3.5 mr-2" /> Clone Version
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleToggleStatus(p)} className={p.status === "ACTIVE" ? "text-orange-600" : "text-green-600"}>
                            {p.status === "ACTIVE" ? "Deactivate" : "Activate"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDeleteProgram(p)} className="text-red-600">
                            <Trash2 className="size-3.5 mr-2" /> Delete
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

        {/* Footer pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-500">
          <span>
            Showing {programs.length} of {totalElements} entries
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-3 text-xs"
              disabled={page <= 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="px-2 font-medium">{page + 1} / {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-3 text-xs"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <ProgramDetailModal
        program={selectedProgram}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onEdit={(prog) => onEditProgram(prog)}
      />

      {/* Clone Dialog */}
      <Dialog open={isCloneOpen} onOpenChange={setIsCloneOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Clone Version</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <p className="text-sm text-gray-600">
              Cloning <b>{cloningProgram?.code}</b> (current version: <b>v{cloningProgram?.version}</b>).
              The new version will have a separate ID.
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">New Version</Label>
                <span
                  className={`text-[10px] font-mono ${
                    newVersion.length >= 20 ? "text-amber-600 font-semibold" : "text-muted-foreground"
                  }`}
                >
                  {newVersion.length}/20
                </span>
              </div>
              <Input
                placeholder="e.g. 1.1 or 2.0"
                value={newVersion}
                maxLength={20}
                onChange={(e) => setNewVersion(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCloneOpen(false)}>Cancel</Button>
            <Button onClick={handleCloneConfirm} className="bg-purple-600 hover:bg-purple-700 text-white">Confirm Clone</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <ProgramImportDialog
        open={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImported={loadPrograms}
      />

      {/* Export Dialog */}
      <ProgramExportDialog
        open={isExportOpen}
        onOpenChange={setIsExportOpen}
        search={search}
        status={statusFilter !== "ALL" ? (statusFilter as ProgramStatus) : undefined}
        region={regionFilter !== "ALL" ? regionFilter : undefined}
      />
    </div>
  );
}
