import { useState, useEffect, useMemo } from "react";
import { programApi } from "@/api/features/program.api";
import { topicApi } from "@/api/features/topic.api";
import type { TopicItem, TrainingProgramItem, ProgramSubjectItem, ProgramStatus } from "@/types/features/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Search, Trash2, ArrowLeft, ChevronRight, ChevronLeft } from "lucide-react";

interface ProgramBuilderProps {
  initialProgram?: TrainingProgramItem | null;
  onBack: () => void;
  onSaved: () => void;
}

export function ProgramBuilder({ initialProgram, onBack, onSaved }: ProgramBuilderProps) {
  const [allTopics, setAllTopics] = useState<TopicItem[]>([]);
  const [topicSearch, setTopicSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [programType, setProgramType] = useState(initialProgram?.code?.split("_")[0] || "FR");
  const [code, setCode] = useState(initialProgram?.code || "");
  const [name, setName] = useState(initialProgram?.name || "");
  const [version, setVersion] = useState(initialProgram?.version || "1.0");
  const [technicalGroup, setTechnicalGroup] = useState(initialProgram?.technicalGroup || "");
  const [statusActive, setStatusActive] = useState(
    initialProgram ? initialProgram.status === "ACTIVE" : true
  );
  const [region, setRegion] = useState(initialProgram?.region || "");
  const [contentLink, setContentLink] = useState(initialProgram?.contentLink || "");
  const [description, setDescription] = useState(initialProgram?.description || "");

  // Topics selection
  const [selectedTopics, setSelectedTopics] = useState<ProgramSubjectItem[]>([]);
  // Highlighted in source/dest for transfer
  const [highlightedSource, setHighlightedSource] = useState<number[]>([]);
  const [highlightedDest, setHighlightedDest] = useState<number[]>([]);

  useEffect(() => {
    const fetchTopics = async () => {
      setLoading(true);
      try {
        const res = await topicApi.getActive();
        setAllTopics(res || []);
      } catch {
        toast.error("Cannot load topics");
      } finally {
        setLoading(false);
      }
    };
    fetchTopics();

    if (initialProgram?.subjects) {
      setSelectedTopics([...initialProgram.subjects].sort((a, b) => a.orderIndex - b.orderIndex));
    }
  }, [initialProgram]);

  const selectedIds = useMemo(() => new Set(selectedTopics.map((t) => t.subjectId)), [selectedTopics]);

  const filteredAvailable = useMemo(() => {
    const q = topicSearch.trim().toLowerCase();
    return allTopics.filter((t) => {
      const notSelected = !selectedIds.has(t.id);
      if (!q) return notSelected;
      return (
        notSelected &&
        (t.code.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q) ||
          (t.technicalGroup && t.technicalGroup.toLowerCase().includes(q)))
      );
    });
  }, [allTopics, topicSearch, selectedIds]);

  // Move highlighted from source → selected
  const handleMoveRight = () => {
    if (highlightedSource.length === 0) {
      // If nothing highlighted, add all filtered
      const toAdd = filteredAvailable.map((t, i) => ({
        subjectId: t.id,
        code: t.code,
        name: t.name,
        version: t.version,
        durationHours: t.durationHours,
        orderIndex: selectedTopics.length + i + 1,
      }));
      setSelectedTopics([...selectedTopics, ...toAdd]);
      return;
    }
    const toAdd = allTopics
      .filter((t) => highlightedSource.includes(t.id) && !selectedIds.has(t.id))
      .map((t, i) => ({
        subjectId: t.id,
        code: t.code,
        name: t.name,
        version: t.version,
        durationHours: t.durationHours,
        orderIndex: selectedTopics.length + i + 1,
      }));
    const next = [...selectedTopics, ...toAdd].map((item, idx) => ({ ...item, orderIndex: idx + 1 }));
    setSelectedTopics(next);
    setHighlightedSource([]);
  };

  // Move highlighted from selected → source
  const handleMoveLeft = () => {
    if (highlightedDest.length === 0) return;
    const next = selectedTopics
      .filter((t) => !highlightedDest.includes(t.subjectId))
      .map((item, idx) => ({ ...item, orderIndex: idx + 1 }));
    setSelectedTopics(next);
    setHighlightedDest([]);
  };

  const handleToggleSource = (id: number) => {
    setHighlightedSource((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleToggleDest = (id: number) => {
    setHighlightedDest((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleRemoveSingle = (subjectId: number) => {
    const next = selectedTopics
      .filter((t) => t.subjectId !== subjectId)
      .map((item, idx) => ({ ...item, orderIndex: idx + 1 }));
    setSelectedTopics(next);
    setHighlightedDest((prev) => prev.filter((x) => x !== subjectId));
  };

  const handleSave = async (activate = false) => {
    if (!code.trim() || !name.trim() || !version.trim()) {
      toast.error("Please enter Code, Name, and Version");
      return;
    }
    if (selectedTopics.length === 0) {
      toast.error("Training program must include at least 1 topic!");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        version: version.trim(),
        region: region.trim(),
        technicalGroup: technicalGroup.trim(),
        contentLink: contentLink.trim(),
        description: description.trim(),
        status: (activate ? "ACTIVE" : "INACTIVE") as ProgramStatus,
        subjects: selectedTopics.map((t) => ({
          subjectId: t.subjectId,
          orderIndex: t.orderIndex,
        })),
      };

      if (initialProgram?.id) {
        await programApi.update(initialProgram.id, payload);
        toast.success("Updated successfully!");
      } else {
        await programApi.create(payload);
        toast.success(activate ? "Program created and activated!" : "Program saved as Inactive!");
      }

      onSaved();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-gray-600 hover:text-gray-800">
            <ArrowLeft className="size-4" />
            Back to Training Program List
          </Button>
          <span className="text-gray-300">|</span>
          <h1 className="text-lg font-semibold text-gray-800">
            {initialProgram ? `Training Program Edit` : "Training Program Create"}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} disabled={saving}>
            Cancel
          </Button>
          <Button
            className="bg-[#5b52e0] hover:bg-[#4d44cb] text-white"
            onClick={() => handleSave(statusActive)}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* 3-Column Layout */}
      <div className="grid grid-cols-[320px_1fr_1fr] gap-4 items-start">
        {/* === LEFT: Form Fields === */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-gray-700">
                Type <span className="text-red-500">*</span>
              </Label>
              <span
                className={`text-[10px] font-mono ${
                  programType.length >= 50 ? "text-amber-600 font-semibold" : "text-muted-foreground"
                }`}
              >
                {programType.length}/50
              </span>
            </div>
            <Input
              value={programType}
              maxLength={50}
              onChange={(e) => setProgramType(e.target.value)}
              placeholder="FR, CPL, NLS..."
              className="text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-gray-700">
                Code <span className="text-red-500">*</span>
              </Label>
              <span
                className={`text-[10px] font-mono ${
                  code.length >= 50 ? "text-amber-600 font-semibold" : "text-muted-foreground"
                }`}
              >
                {code.length}/50
              </span>
            </div>
            <Input
              value={code}
              maxLength={50}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. NFP_JAVA_2"
              className="text-sm font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-gray-700">
                Version <span className="text-red-500">*</span>
              </Label>
              <span
                className={`text-[10px] font-mono ${
                  version.length >= 20 ? "text-amber-600 font-semibold" : "text-muted-foreground"
                }`}
              >
                {version.length}/20
              </span>
            </div>
            <Input
              value={version}
              maxLength={20}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="1.0"
              className="text-sm font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-gray-700">
                Name <span className="text-red-500">*</span>
              </Label>
              <span
                className={`text-[10px] font-mono ${
                  name.length >= 255 ? "text-amber-600 font-semibold" : "text-muted-foreground"
                }`}
              >
                {name.length}/255
              </span>
            </div>
            <Input
              value={name}
              maxLength={255}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full program name"
              className="text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-700">Technical Group</Label>
            <Select value={technicalGroup} onValueChange={setTechnicalGroup}>
              <SelectTrigger className="w-full text-sm">
                <SelectValue placeholder="Select group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="JAVA">Java</SelectItem>
                <SelectItem value="FRONTEND">Frontend</SelectItem>
                <SelectItem value="AI">AI</SelectItem>
                <SelectItem value="COBOL">COBOL</SelectItem>
                <SelectItem value="CPP">CPP</SelectItem>
                <SelectItem value="PYTHON">Python</SelectItem>
                <SelectItem value="OTHERS">Others</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-700">Status</Label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={statusActive}
                onClick={() => setStatusActive((v) => !v)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                  statusActive ? "bg-purple-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block size-4 rounded-full bg-white shadow transform transition-transform ${
                    statusActive ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
              <span className={`text-sm font-medium ${statusActive ? "text-purple-700" : "text-gray-500"}`}>
                {statusActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-700">Region</Label>
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger className="w-full text-sm">
                <SelectValue placeholder="Select region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="-">—</SelectItem>
                <SelectItem value="FSA.HCM">FSA.HCM</SelectItem>
                <SelectItem value="FSA.HN">FSA.HN</SelectItem>
                <SelectItem value="FSA.DN">FSA.DN</SelectItem>
                <SelectItem value="FSA.QN">FSA.QN</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-gray-700">Content Link</Label>
              <span
                className={`text-[10px] font-mono ${
                  contentLink.length >= 500 ? "text-amber-600 font-semibold" : "text-muted-foreground"
                }`}
              >
                {contentLink.length}/500
              </span>
            </div>
            <Input
              value={contentLink}
              maxLength={500}
              onChange={(e) => setContentLink(e.target.value)}
              placeholder="https://..."
              className="text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-gray-700">Description</Label>
              <span
                className={`text-[10px] font-mono ${
                  description.length >= 1000 ? "text-amber-600 font-semibold" : "text-muted-foreground"
                }`}
              >
                {description.length}/1000
              </span>
            </div>
            <textarea
              value={description}
              maxLength={1000}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Program description..."
              rows={4}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y min-h-[80px] max-h-[220px]"
            />
          </div>
        </div>

        {/* === MIDDLE: Topic Source List === */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Topic <span className="text-red-500">*</span>
            </p>
          </div>
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
              <Input
                placeholder="Choose or Search a Topic"
                value={topicSearch}
                onChange={(e) => setTopicSearch(e.target.value)}
                className="pl-8 text-sm h-8"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto" style={{ maxHeight: 480 }}>
            {loading ? (
              <div className="p-4 text-center text-gray-400 text-sm">Loading topics...</div>
            ) : filteredAvailable.length === 0 ? (
              <div className="p-4 text-center text-gray-400 text-sm">No topics available</div>
            ) : (
              filteredAvailable.map((t) => (
                <div
                  key={t.id}
                  onClick={() => handleToggleSource(t.id)}
                  onDoubleClick={() => {
                    if (!selectedIds.has(t.id)) {
                      const next = [
                        ...selectedTopics,
                        {
                          subjectId: t.id,
                          code: t.code,
                          name: t.name,
                          version: t.version,
                          durationHours: t.durationHours,
                          orderIndex: selectedTopics.length + 1,
                        },
                      ].map((item, idx) => ({ ...item, orderIndex: idx + 1 }));
                      setSelectedTopics(next);
                    }
                  }}
                  className={`px-4 py-2.5 cursor-pointer text-sm border-b border-gray-50 select-none transition-colors ${
                    highlightedSource.includes(t.id)
                      ? "bg-blue-50 text-blue-800"
                      : "hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <div className="font-mono text-xs font-semibold text-gray-800">{t.code} - v{t.version}</div>
                  <div className="text-gray-700 text-xs mt-0.5 line-clamp-1">{t.name}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* === RIGHT: Arrow buttons + Selected Topics === */}
        <div className="flex flex-col gap-4">
          {/* Transfer buttons */}
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-1 text-purple-700 border-purple-300 hover:bg-purple-50"
              onClick={handleMoveRight}
              title="Move selected to program"
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 text-gray-600 border-gray-300"
              onClick={handleMoveLeft}
              disabled={highlightedDest.length === 0}
              title="Remove selected from program"
            >
              <ChevronLeft className="size-4" />
            </Button>
          </div>

          {/* Selected Topic panel */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Selected Topic <span className="text-red-500">*</span>
              </p>
              <span className="text-xs text-gray-400">
                {selectedTopics.length} topics · {selectedTopics.reduce((acc, t) => acc + (t.durationHours || 0), 0)}h total
              </span>
            </div>
            <div className="flex-1 overflow-y-auto" style={{ maxHeight: 480 }}>
              {selectedTopics.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  Double-click or select topics then press → to add
                </div>
              ) : (
                selectedTopics.map((t) => (
                  <div
                    key={t.subjectId}
                    onClick={() => handleToggleDest(t.subjectId)}
                    className={`px-4 py-2.5 border-b border-gray-50 cursor-pointer select-none flex items-center justify-between group transition-colors ${
                      highlightedDest.includes(t.subjectId)
                        ? "bg-purple-50 text-purple-800"
                        : "hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs text-purple-600">
                        [{t.code}] - v{t.version}
                      </div>
                      <div className="text-gray-700 text-xs mt-0.5 line-clamp-1">{t.name}</div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleRemoveSingle(t.subjectId); }}
                      className="ml-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="flex items-center justify-between pt-5 mt-2 border-t border-gray-200">
        <Button variant="ghost" onClick={onBack} className="text-gray-500">
          Back to Training Program List
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} disabled={saving}>Cancel</Button>
          <Button
            className="bg-[#5b52e0] hover:bg-[#4d44cb] text-white"
            onClick={() => handleSave(statusActive)}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
