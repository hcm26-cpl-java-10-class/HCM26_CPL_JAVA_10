import { useState, useEffect, useCallback } from "react";
import { topicApi } from "@/api/features/topic.api";
import type { TopicItem } from "@/types/features/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Download,
  Upload,
  Copy,
  Edit2,
  Trash2,
  MoreVertical,
  SlidersHorizontal,
  Eye,
  RefreshCw,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TopicDetailModal } from "./TopicDetailModal";

interface TopicListProps {
  onViewDetail?: (topic: TopicItem) => void;
}

export function TopicList({ onViewDetail }: TopicListProps = {}) {
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [technicalGroup, setTechnicalGroup] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<TopicItem | null>(null);
  const [isCloneOpen, setIsCloneOpen] = useState(false);
  const [cloningTopic, setCloningTopic] = useState<TopicItem | null>(null);
  const [newVersion, setNewVersion] = useState("");
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<{ rowNumber: number; message: string }[]>([]);
  const [detailTopic, setDetailTopic] = useState<TopicItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const handleOpenDetail = (t: TopicItem) => {
    if (onViewDetail) {
      onViewDetail(t);
    } else {
      setDetailTopic(t);
      setIsDetailOpen(true);
    }
  };

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    version: "1.0",
    technicalGroup: "Backend",
    durationHours: 40,
    description: "",
    isActive: true,
  });

  const loadTopics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await topicApi.getPage({
        page,
        size: 10,
        search: search.trim() || undefined,
        technicalGroup: technicalGroup !== "ALL" ? technicalGroup : undefined,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
      });
      setTopics(res.content || []);
      setTotalPages(res.totalPages || 1);
      setTotalElements(res.totalElements || 0);
    } catch {
      toast.error("Cannot load topics");
    } finally {
      setLoading(false);
    }
  }, [page, search, technicalGroup, statusFilter]);

  useEffect(() => { loadTopics(); }, [loadTopics]);

  const handleOpenCreate = () => {
    setEditingTopic(null);
    setFormData({ code: "", name: "", version: "1.0", technicalGroup: "Backend", durationHours: 40, description: "", isActive: true });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (t: TopicItem) => {
    setEditingTopic(t);
    setFormData({
      code: t.code,
      name: t.name,
      version: t.version,
      technicalGroup: t.technicalGroup || "Backend",
      durationHours: t.durationHours,
      description: t.description || "",
      isActive: t.isActive,
    });
    setIsFormOpen(true);
  };

  const handleSaveTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTopic) {
        await topicApi.update(editingTopic.id, {
          name: formData.name,
          version: formData.version,
          technicalGroup: formData.technicalGroup,
          durationHours: formData.durationHours,
          description: formData.description,
          isActive: formData.isActive,
        });
        toast.success("Topic updated successfully!");
      } else {
        await topicApi.create({
          code: formData.code,
          name: formData.name,
          version: formData.version,
          technicalGroup: formData.technicalGroup,
          durationHours: formData.durationHours,
          description: formData.description,
          isActive: formData.isActive,
        });
        toast.success("Topic created successfully!");
      }
      setIsFormOpen(false);
      loadTopics();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Save failed");
    }
  };

  const handleOpenClone = (t: TopicItem) => {
    setCloningTopic(t);
    const parts = t.version.split(".");
    const minor = parseInt(parts[1], 10);
    setNewVersion(`${parts[0]}.${isNaN(minor) ? 1 : minor + 1}`);
    setIsCloneOpen(true);
  };

  const handleCloneTopic = async () => {
    if (!cloningTopic || !newVersion.trim()) return;
    try {
      await topicApi.create({
        code: cloningTopic.code,
        name: cloningTopic.name,
        version: newVersion.trim(),
        technicalGroup: cloningTopic.technicalGroup,
        durationHours: cloningTopic.durationHours,
        description: cloningTopic.description,
        isActive: true,
      });
      toast.success(`Cloned to version ${newVersion}`);
      setIsCloneOpen(false);
      loadTopics();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Clone failed");
    }
  };

  const handleToggleStatus = async (t: TopicItem) => {
    try {
      await topicApi.changeStatus(t.id, !t.isActive);
      toast.success(t.isActive ? `Deactivated ${t.code}` : `Activated ${t.code}`);
      loadTopics();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Status change failed");
    }
  };

  const handleDeleteTopic = async (t: TopicItem) => {
    try {
      const isRef = await topicApi.isReferenced(t.id);
      if (isRef) {
        toast.error(`Topic ${t.code} is referenced in programs. Deactivate instead.`);
        return;
      }
      if (!confirm(`Delete topic ${t.code} - ${t.name}?`)) return;
      await topicApi.delete(t.id);
      toast.success("Topic deleted");
      loadTopics();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Delete failed");
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await topicApi.downloadImportTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "topic-import-template.xlsx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Đã tải xuống file mẫu import môn học");
    } catch {
      toast.error("Không thể tải file mẫu");
    }
  };

  const handleExport = async (format: "EXCEL" | "CSV" = "EXCEL") => {
    try {
      const blob = await topicApi.exportFile(format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = format === "CSV" ? "csv" : "xlsx";
      a.download = `topics_${new Date().toISOString().slice(0, 10)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success(`Exported ${format === "CSV" ? "CSV" : "Excel"} successfully!`);
    } catch {
      toast.error("Export failed");
    }
  };

  const handleImport = async () => {
    if (!importFile) { toast.error("Please select a file"); return; }
    setIsImporting(true);
    setImportErrors([]);
    try {
      const res = await topicApi.importFile(importFile);
      if (res.errors && res.errors.length > 0) {
        setImportErrors(res.errors);
        toast.warning(`Imported ${res.successCount || 0} successfully, but ${res.failureCount || 0} rows failed.`);
      } else {
        toast.success(`Import successful! ${res.successCount || 0} topics added.`);
        setIsImportOpen(false);
        setImportFile(null);
      }
      loadTopics();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Import failed");
    } finally {
      setIsImporting(false);
    }
  };

  const activeFilters = [technicalGroup !== "ALL", statusFilter !== "ALL"].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800">Syllabus / Topic</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <Input
              placeholder="Enter keyword..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-9 w-64 bg-white border-gray-300 text-sm"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-white border-gray-300 text-gray-700"
            onClick={() => setShowFilterPanel((v) => !v)}
          >
            <SlidersHorizontal className="size-4" />
            Filter
            {activeFilters > 0 && (
              <span className="ml-0.5 px-1.5 py-0 text-[10px] bg-purple-600 text-white rounded-full">
                {activeFilters}
              </span>
            )}
          </Button>
          <Button variant="outline" size="sm" className="gap-2 bg-white border-gray-300" onClick={() => setIsImportOpen(true)}>
            <Upload className="size-4" /> Import
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 bg-white border-gray-300">
                <Download className="size-4" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport("EXCEL")}>
                Export Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("CSV")}>
                Export CSV (.csv)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" className="gap-2 bg-[#5b52e0] hover:bg-[#4d44cb] text-white" onClick={handleOpenCreate}>
            <Plus className="size-4" /> Add
          </Button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilterPanel && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-4 shadow-sm">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Technical Group</label>
            <Select value={technicalGroup} onValueChange={(v) => { setTechnicalGroup(v); setPage(0); }}>
              <SelectTrigger className="w-[160px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Groups</SelectItem>
                <SelectItem value="Backend">Backend</SelectItem>
                <SelectItem value="Frontend">Frontend</SelectItem>
                <SelectItem value="Database">Database</SelectItem>
                <SelectItem value="DevOps">DevOps</SelectItem>
                <SelectItem value="Testing">Testing</SelectItem>
                <SelectItem value="Common">Common / Soft skills</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
          <Button
            variant="ghost"
            size="sm"
            className="mt-4 text-xs text-gray-500"
            onClick={() => { setTechnicalGroup("ALL"); setStatusFilter("ALL"); setPage(0); }}
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
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 w-8">#</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 w-[130px]">Code</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 w-16">Version</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 w-28">Technical Group</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 w-28">Duration</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 w-24">Status</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && topics.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-gray-400">
                    <RefreshCw className="size-5 animate-spin mx-auto mb-2 text-purple-500" />
                    Loading...
                  </td>
                </tr>
              ) : topics.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-gray-400 text-sm">
                    No data available in table
                  </td>
                </tr>
              ) : (
                topics.map((t, idx) => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 text-xs">{page * 10 + idx + 1}</td>
                    <td className="px-4 py-3">
                      <button
                        className="font-mono text-xs font-semibold text-blue-600 hover:underline"
                        onClick={() => handleOpenDetail(t)}
                      >
                        {t.code}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="text-[#5b52e0] hover:underline font-medium text-sm text-left line-clamp-1"
                        onClick={() => handleOpenDetail(t)}
                      >
                        {t.name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs font-mono">{t.version}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{t.technicalGroup || "—"}</td>
                    <td className="px-4 py-3 text-right text-gray-700 text-xs font-medium">{t.durationHours}h</td>
                    <td className="px-4 py-3">
                      {t.isActive ? (
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
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => handleOpenDetail(t)}>
                            <Eye className="size-3.5 mr-2" /> View Detail
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenEdit(t)}>
                            <Edit2 className="size-3.5 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenClone(t)}>
                            <Copy className="size-3.5 mr-2" /> Clone Version
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleToggleStatus(t)} className={t.isActive ? "text-orange-600" : "text-green-600"}>
                            {t.isActive ? "Deactivate" : "Activate"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDeleteTopic(t)} className="text-red-600">
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

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-500">
          <span>Showing {topics.length} of {totalElements} entries</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-7 px-3 text-xs" disabled={page <= 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span className="px-2 font-medium">{page + 1} / {totalPages}</span>
            <Button variant="outline" size="sm" className="h-7 px-3 text-xs" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      </div>

      {/* Topic Detail Modal */}
      <TopicDetailModal
        topic={detailTopic}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onEdit={(t) => { setIsDetailOpen(false); handleOpenEdit(t); }}
      />

      {/* Create / Edit Topic Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSaveTopic}>
            <DialogHeader>
              <DialogTitle>{editingTopic ? `Edit Topic: ${editingTopic.code}` : "Create New Topic"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Code <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="e.g. JAVA_CORE"
                    value={formData.code}
                    disabled={!!editingTopic}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="font-mono text-sm"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Version <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="1.0"
                    value={formData.version}
                    onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                    className="font-mono text-sm"
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Name <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="Topic full name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Technical Group</Label>
                  <Select value={formData.technicalGroup} onValueChange={(v) => setFormData({ ...formData, technicalGroup: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Backend">Backend</SelectItem>
                      <SelectItem value="Frontend">Frontend</SelectItem>
                      <SelectItem value="Database">Database</SelectItem>
                      <SelectItem value="DevOps">DevOps</SelectItem>
                      <SelectItem value="Testing">Testing</SelectItem>
                      <SelectItem value="Common">Common / Soft skills</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Duration (Hours) <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    min="1"
                    max="1000"
                    value={formData.durationHours}
                    onChange={(e) => setFormData({ ...formData, durationHours: Number(e.target.value) })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Description</Label>
                <Textarea
                  rows={3}
                  placeholder="Topic objectives and skills..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white">
                {editingTopic ? "Save Changes" : "Create Topic"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Clone Dialog */}
      <Dialog open={isCloneOpen} onOpenChange={setIsCloneOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Clone Topic Version</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <p className="text-sm text-gray-600">
              Cloning <b>{cloningTopic?.code}</b> (v{cloningTopic?.version}) to a new version.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">New Version</Label>
              <Input placeholder="e.g. 1.1" value={newVersion} onChange={(e) => setNewVersion(e.target.value)} className="font-mono" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCloneOpen(false)}>Cancel</Button>
            <Button onClick={handleCloneTopic} className="bg-purple-600 hover:bg-purple-700 text-white">Confirm Clone</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={isImportOpen} onOpenChange={(open) => { setIsImportOpen(open); if (!open) setImportErrors([]); }}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Import Topics from File</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-gray-500">
                Supports Excel (.xlsx, .xls) or .csv. Required columns: Code, Name, Version, Technical Group, Duration (Hours).
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs text-[#5b52e0] border-[#5b52e0] hover:bg-purple-50 shrink-0"
                onClick={handleDownloadTemplate}
              >
                <Download className="size-3.5" /> Download Template
              </Button>
            </div>
            <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => { setImportFile(e.target.files?.[0] || null); setImportErrors([]); }} />

            {importErrors.length > 0 && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-xs font-semibold text-red-700 mb-1.5">
                  Import Errors ({importErrors.length} rows):
                </p>
                <div className="max-h-40 overflow-y-auto space-y-1 text-xs text-red-600">
                  {importErrors.map((err, idx) => (
                    <div key={idx} className="flex gap-2">
                      <span className="font-mono font-semibold">Row {err.rowNumber}:</span>
                      <span>{err.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsImportOpen(false); setImportErrors([]); }}>Close</Button>
            <Button onClick={handleImport} disabled={!importFile || isImporting} className="bg-purple-600 hover:bg-purple-700 text-white">
              {isImporting ? "Processing..." : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
