import { useState, useEffect, useCallback } from "react";
import { topicApi } from "@/api/features/topic.api";
import type { TopicItem } from "@/types/features/content";
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
  Clock,
  BookOpen,
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
import { TopicSyllabusEditorDialog } from "./TopicSyllabusEditorDialog";
import { SyllabusImportDialog } from "./SyllabusImportDialog";

interface TopicListProps {
  onViewDetail?: (topic: TopicItem) => void;
}

const renderTechnicalGroupBadge = (group?: string) => {
  if (!group) return <span className="text-gray-400 text-xs">—</span>;
  const g = group.toLowerCase();
  let color = "bg-gray-100 text-gray-700 border-gray-200";
  if (g.includes("java")) {
    color = "bg-blue-50 text-blue-700 border-blue-200";
  } else if (g.includes("react") || g.includes("frontend")) {
    color = "bg-cyan-50 text-cyan-700 border-cyan-200";
  } else if (g.includes("backend")) {
    color = "bg-indigo-50 text-indigo-700 border-indigo-200";
  } else if (g.includes("database")) {
    color = "bg-emerald-50 text-emerald-700 border-emerald-200";
  } else if (g.includes("devops")) {
    color = "bg-violet-50 text-violet-700 border-violet-200";
  } else if (g.includes("testing") || g.includes("qa")) {
    color = "bg-amber-50 text-amber-700 border-amber-200";
  } else if (g.includes("soft")) {
    color = "bg-rose-50 text-rose-700 border-rose-200";
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${color}`}>
      {group}
    </span>
  );
};

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
  const [isSyllabusImportOpen, setIsSyllabusImportOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [detailTopic, setDetailTopic] = useState<TopicItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [outlineEditorTopic, setOutlineEditorTopic] = useState<TopicItem | null>(null);
  const [isOutlineEditorOpen, setIsOutlineEditorOpen] = useState(false);

  const handleOpenDetail = (t: TopicItem) => {
    if (onViewDetail) {
      onViewDetail(t);
    } else {
      setDetailTopic(t);
      setIsDetailOpen(true);
    }
  };

  const handleOpenOutlineEditor = (t: TopicItem) => {
    setOutlineEditorTopic(t);
    setIsOutlineEditorOpen(true);
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
        const created = await topicApi.create({
          code: formData.code.toUpperCase().trim(),
          name: formData.name,
          version: formData.version,
          technicalGroup: formData.technicalGroup,
          durationHours: formData.durationHours,
          description: formData.description,
          isActive: formData.isActive,
        });
        toast.success("Topic created successfully!", {
          action: {
            label: "Configure Outline",
            onClick: () => handleOpenOutlineEditor(created),
          },
        });
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
      {/* Action Toolbar */}
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
              <Badge className="ml-0.5 px-1.5 py-0 text-[10px] bg-purple-600 text-white rounded-full">
                {activeFilters}
              </Badge>
            )}
          </Button>

          {/* Import Syllabus (FSOFT Format) */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-indigo-700 border-indigo-200 hover:bg-indigo-50 font-medium"
            onClick={() => setIsSyllabusImportOpen(true)}
          >
            <Upload className="size-4 text-indigo-600" /> Import Syllabus
          </Button>

          {/* Import Button */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-white border-gray-300"
            onClick={() => setIsImportOpen(true)}
          >
            <Upload className="size-4" /> Import CSV
          </Button>

          {/* Export Button */}
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
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs w-8">#</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs w-[150px]">Topic Code</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs">Topic Name</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs w-20">Version</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs w-36">Technical Group</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs w-28">Duration</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs w-24">Status</th>
                <th className="w-10"></th>
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
                topics.map((t, idx) => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 text-xs">{page * 10 + idx + 1}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleOpenDetail(t)}
                        className="font-mono text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline text-left cursor-pointer"
                      >
                        {t.code}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleOpenDetail(t)}
                        className="text-gray-900 hover:text-purple-700 hover:underline text-left font-medium text-sm line-clamp-1 cursor-pointer"
                      >
                        {t.name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs font-mono">
                      <span className="inline-block px-1.5 py-0.5 text-[11px] font-mono bg-purple-50 text-purple-700 border border-purple-200 rounded">
                        v{t.version}
                      </span>
                    </td>
                    <td className="px-4 py-3">{renderTechnicalGroupBadge(t.technicalGroup)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1 font-mono text-xs text-gray-700">
                        <Clock className="size-3 text-gray-400" />
                        {t.durationHours}h
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(t)}
                        title="Click to toggle status"
                        className="cursor-pointer"
                      >
                        {t.isActive ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200 hover:bg-green-200 transition-colors">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200 transition-colors">
                            Inactive
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="px-2 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-7 text-gray-400 hover:text-gray-600">
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => handleOpenDetail(t)} className="gap-2 text-xs">
                            <Eye className="size-3.5 text-gray-500" /> View Schedule
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenOutlineEditor(t)} className="gap-2 text-xs">
                            <BookOpen className="size-3.5 text-[#5b52e0]" /> Edit Schedule Outline
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
                            {t.isActive ? "Deactivate Topic" : "Activate Topic"}
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

        {/* Footer pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-500">
          <span>
            Showing {topics.length > 0 ? page * 10 + 1 : 0} to {Math.min((page + 1) * 10, totalElements)} of {totalElements} entries
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
      <TopicDetailModal topic={detailTopic} open={isDetailOpen} onOpenChange={setIsDetailOpen} />

      {/* Create/Edit Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[540px] max-h-[90vh] flex flex-col p-6 overflow-hidden">
          <DialogHeader className="shrink-0 pb-1">
            <DialogTitle>{editingTopic ? "Edit Topic" : "Create New Topic"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveTopic} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-2 -mr-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">
                      Topic Code <span className="text-red-500">*</span>
                    </Label>
                    <span
                      className={`text-[10px] font-mono ${
                        formData.code.length >= 50 ? "text-amber-600 font-semibold" : "text-muted-foreground"
                      }`}
                    >
                      {formData.code.length}/50
                    </span>
                  </div>
                  <Input
                    disabled={!!editingTopic}
                    placeholder="e.g. L1_AL_CCGM"
                    value={formData.code}
                    maxLength={50}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="font-mono uppercase text-xs"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">
                      Version <span className="text-red-500">*</span>
                    </Label>
                    <span
                      className={`text-[10px] font-mono ${
                        formData.version.length >= 20 ? "text-amber-600 font-semibold" : "text-muted-foreground"
                      }`}
                    >
                      {formData.version.length}/20
                    </span>
                  </div>
                  <Input
                    placeholder="e.g. 1.0"
                    value={formData.version}
                    maxLength={20}
                    onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                    className="font-mono text-xs"
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">
                    Topic Name <span className="text-red-500">*</span>
                  </Label>
                  <span
                    className={`text-[10px] font-mono ${
                      formData.name.length >= 255 ? "text-amber-600 font-semibold" : "text-muted-foreground"
                    }`}
                  >
                    {formData.name.length}/255
                  </span>
                </div>
                <Input
                  placeholder="e.g. Clean Code and Git Multi-platform"
                  value={formData.name}
                  maxLength={255}
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
                    onChange={(e) => setFormData({ ...formData, durationHours: Math.max(1, parseInt(e.target.value, 10) || 1) })}
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
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Description</Label>
                  <span
                    className={`text-[10px] font-mono ${
                      (formData.description?.length || 0) >= 1000
                        ? "text-amber-600 font-semibold"
                        : "text-muted-foreground"
                    }`}
                  >
                    {formData.description?.length || 0}/1000
                  </span>
                </div>
                <Textarea
                  rows={4}
                  placeholder="Detailed objectives, outline..."
                  value={formData.description}
                  maxLength={1000}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="text-xs resize-y min-h-[90px] max-h-[220px]"
                />
              </div>
            </div>
            <DialogFooter className="pt-3 border-t mt-3 flex justify-end gap-2 shrink-0">
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
                placeholder="e.g. 1.1"
                value={newVersion}
                maxLength={20}
                onChange={(e) => setNewVersion(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCloneOpen(false)}>Cancel</Button>
            <Button onClick={handleCloneTopic} className="bg-purple-600 hover:bg-purple-700 text-white">Confirm Clone</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <TopicImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onSuccess={loadTopics}
      />

      {/* Syllabus Import Dialog (FSOFT Format) */}
      <SyllabusImportDialog
        open={isSyllabusImportOpen}
        onOpenChange={setIsSyllabusImportOpen}
        onSuccess={loadTopics}
      />

      {/* Export Dialog */}
      <TopicExportDialog
        open={isExportOpen}
        onOpenChange={setIsExportOpen}
      />

      {/* Schedule Outline Editor Dialog */}
      {outlineEditorTopic && (
        <TopicSyllabusEditorDialog
          topic={outlineEditorTopic}
          open={isOutlineEditorOpen}
          onOpenChange={(v) => {
            setIsOutlineEditorOpen(v);
            if (!v) setOutlineEditorTopic(null);
          }}
          onSaved={() => {
            loadTopics();
          }}
        />
      )}
    </div>
  );
}
