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
  Power,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TopicDetailModal } from "./TopicDetailModal";
import { TopicImportDialog } from "./TopicImportDialog";
import { TopicExportDialog } from "./TopicExportDialog";

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
  const [isExportOpen, setIsExportOpen] = useState(false);
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
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to load topics");
    } finally {
      setLoading(false);
    }
  }, [page, search, technicalGroup, statusFilter]);

  useEffect(() => {
    loadTopics();
  }, [loadTopics]);

  const handleOpenCreate = () => {
    setEditingTopic(null);
    setFormData({
      code: "",
      name: "",
      version: "1.0",
      technicalGroup: "Backend",
      durationHours: 40,
      description: "",
      isActive: true,
    });
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
    if (!formData.code.trim() || !formData.name.trim()) {
      toast.error("Please fill in Code and Name");
      return;
    }
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
          code: formData.code.toUpperCase().trim(),
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

          {/* Import Button */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-white border-gray-300"
            onClick={() => setIsImportOpen(true)}
          >
            <Upload className="size-4" /> Import
          </Button>

          {/* Export Button - Opens Hình 3 Modal */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-white border-gray-300"
            onClick={() => setIsExportOpen(true)}
          >
            <Download className="size-4" /> Export
          </Button>

          {/* Add Button */}
          <Button
            size="sm"
            className="gap-2 bg-[#5b52e0] hover:bg-[#4d44cb] text-white"
            onClick={handleOpenCreate}
          >
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
                <SelectItem value="Java">Java</SelectItem>
                <SelectItem value="React">React</SelectItem>
                <SelectItem value="Frontend">Frontend</SelectItem>
                <SelectItem value="Backend">Backend</SelectItem>
                <SelectItem value="Database">Database</SelectItem>
                <SelectItem value="DevOps">DevOps</SelectItem>
                <SelectItem value="Testing">Testing</SelectItem>
                <SelectItem value="Soft Skills">Soft Skills</SelectItem>
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
          <div className="flex items-end flex-1 justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-gray-500 gap-1.5"
              onClick={() => { setTechnicalGroup("ALL"); setStatusFilter("ALL"); setSearch(""); setPage(0); }}
            >
              <RefreshCw className="size-3" /> Reset
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-[#5b52e0] text-white">
            <tr>
              <th className="p-3 font-semibold">Topic Code</th>
              <th className="p-3 font-semibold">Topic Name</th>
              <th className="p-3 font-semibold">Version</th>
              <th className="p-3 font-semibold">Technical Group</th>
              <th className="p-3 font-semibold text-right">Duration (Hours)</th>
              <th className="p-3 font-semibold text-center">Status</th>
              <th className="p-3 font-semibold text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center p-8 text-gray-500">
                  <RefreshCw className="size-5 animate-spin mx-auto mb-2 text-[#5b52e0]" />
                  Loading topics...
                </td>
              </tr>
            ) : topics.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center p-8 text-gray-500">
                  No topics found
                </td>
              </tr>
            ) : (
              topics.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-3 font-mono font-medium text-gray-900">
                    <button
                      onClick={() => handleOpenDetail(t)}
                      className="text-[#5b52e0] hover:underline cursor-pointer"
                    >
                      {t.code}
                    </button>
                  </td>
                  <td className="p-3 font-medium text-gray-800">
                    <button
                      onClick={() => handleOpenDetail(t)}
                      className="text-left hover:text-[#5b52e0] transition-colors cursor-pointer"
                    >
                      {t.name}
                    </button>
                  </td>
                  <td className="p-3">
                    <span className="inline-block px-2 py-0.5 text-xs font-mono bg-purple-50 text-purple-700 border border-purple-200 rounded">
                      v{t.version}
                    </span>
                  </td>
                  <td className="p-3 text-gray-600">{t.technicalGroup || "—"}</td>
                  <td className="p-3 text-right font-mono text-gray-700">{t.durationHours}h</td>
                  <td className="p-3 text-center">
                    <span
                      onClick={() => handleToggleStatus(t)}
                      title="Click to toggle status"
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                        t.isActive
                          ? "bg-green-100 text-green-800 hover:bg-green-200"
                          : "bg-red-100 text-red-800 hover:bg-red-200"
                      }`}
                    >
                      {t.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8 text-gray-500 hover:text-gray-900">
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => handleOpenDetail(t)} className="gap-2 text-xs">
                          <Eye className="size-3.5 text-gray-500" /> View Schedule
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOpenEdit(t)} className="gap-2 text-xs">
                          <Edit2 className="size-3.5 text-blue-500" /> Edit Topic
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOpenClone(t)} className="gap-2 text-xs">
                          <Copy className="size-3.5 text-purple-500" /> Clone Version
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleToggleStatus(t)}
                          className={`gap-2 text-xs font-medium cursor-pointer ${
                            t.isActive
                              ? "text-orange-600 focus:text-orange-600"
                              : "text-emerald-600 focus:text-emerald-600"
                          }`}
                        >
                          <Power className="size-3.5" />
                          {t.isActive ? "Inactive Topic" : "Active Topic"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDeleteTopic(t)} className="gap-2 text-xs text-red-600">
                          <Trash2 className="size-3.5" /> Delete
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

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div>
          Showing {topics.length > 0 ? page * 10 + 1 : 0} to {Math.min((page + 1) * 10, totalElements)} of {totalElements} topics
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="h-8 text-xs"
          >
            Previous
          </Button>
          <span className="px-2 font-mono">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="h-8 text-xs"
          >
            Next
          </Button>
        </div>
      </div>

      {/* Detail Modal */}
      <TopicDetailModal topic={detailTopic} open={isDetailOpen} onOpenChange={setIsDetailOpen} />

      {/* Create/Edit Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingTopic ? "Edit Topic" : "Create New Topic"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveTopic} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Topic Code <span className="text-red-500">*</span>
                </Label>
                <Input
                  disabled={!!editingTopic}
                  placeholder="e.g. L1_AL_CCGM"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="font-mono uppercase text-xs"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Version <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="e.g. 1.0"
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  className="font-mono text-xs"
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Topic Name <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="e.g. Clean Code and Git Multi-platform"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="text-xs"
                required
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Technical Group</Label>
                <Select
                  value={formData.technicalGroup}
                  onValueChange={(v) => setFormData({ ...formData, technicalGroup: v })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Java">Java</SelectItem>
                    <SelectItem value="React">React</SelectItem>
                    <SelectItem value="Frontend">Frontend</SelectItem>
                    <SelectItem value="Backend">Backend</SelectItem>
                    <SelectItem value="Database">Database</SelectItem>
                    <SelectItem value="DevOps">DevOps</SelectItem>
                    <SelectItem value="Testing">Testing</SelectItem>
                    <SelectItem value="Soft Skills">Soft Skills</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Duration (Hours) <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.durationHours}
                  onChange={(e) => setFormData({ ...formData, durationHours: parseInt(e.target.value, 10) || 1 })}
                  className="text-xs font-mono"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Status</Label>
                <Select
                  value={formData.isActive ? "ACTIVE" : "INACTIVE"}
                  onValueChange={(v) => setFormData({ ...formData, isActive: v === "ACTIVE" })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Description</Label>
              <Textarea
                rows={3}
                placeholder="Detailed objectives, outline..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="text-xs resize-none"
              />
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

      {/* Import Dialog - Theo đúng Hình 2 với tính năng Preview và Rollback */}
      <TopicImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onSuccess={loadTopics}
      />

      {/* Export Dialog - Theo đúng Hình 3 với lựa chọn Excel, CSV, PDF */}
      <TopicExportDialog
        open={isExportOpen}
        onOpenChange={setIsExportOpen}
      />
    </div>
  );
}
