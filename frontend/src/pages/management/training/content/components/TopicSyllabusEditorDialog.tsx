import { useState, useMemo, useEffect } from "react";
import type { TopicItem } from "@/types/features/content";
import {
  getTopicSyllabusPackage,
  saveTopicSyllabusPackage,
  resetTopicSyllabusPackage,
  generateTemplateChapters,
} from "./topicSyllabusData";
import type {
  TopicChapter,
  TopicSession,
  TopicSyllabusPackage,
} from "./topicSyllabusData";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Sparkles,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MoveUp,
  MoveDown,
} from "lucide-react";
import { toast } from "sonner";

interface TopicSyllabusEditorDialogProps {
  topic: TopicItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (pkg: TopicSyllabusPackage) => void;
}

const DELIVERY_TYPES: TopicSession["deliveryType"][] = [
  "Concept/Lecture",
  "Assignment/Lab",
  "Exam",
  "Test/Quiz",
  "Seminar/Workshop",
  "Guides/Review",
  "Class Meeting",
];

export function TopicSyllabusEditorDialog({
  topic,
  open,
  onOpenChange,
  onSaved,
}: TopicSyllabusEditorDialogProps) {
  // Load initial chapters from existing package or empty
  const initialPackage = useMemo(() => getTopicSyllabusPackage(topic), [topic]);
  const [chapters, setChapters] = useState<TopicChapter[]>(() =>
    JSON.parse(JSON.stringify(initialPackage.chapters || []))
  );

  // Sync state whenever dialog opens or topic changes
  useEffect(() => {
    if (open) {
      const pkg = getTopicSyllabusPackage(topic);
      setChapters(JSON.parse(JSON.stringify(pkg.chapters || [])));
    }
  }, [open, topic]);

  // Expanded state for chapter cards
  const [expandedChapters, setExpandedChapters] = useState<Record<number, boolean>>({});

  const targetHours = topic.durationHours || 40;

  // Real-time calculation of allocated hours
  const { totalAllocatedHours, totalSessions, labHours, lectureHours, examHours } =
    useMemo(() => {
      let totalAlloc = 0;
      let sessCount = 0;
      let labH = 0;
      let lecH = 0;
      let exH = 0;

      chapters.forEach((ch) => {
        ch.sessions.forEach((s) => {
          sessCount++;
          const h = Number(s.durationHours) || 0;
          totalAlloc += h;
          if (s.deliveryType === "Assignment/Lab" || s.deliveryType === "Seminar/Workshop") {
            labH += h;
          } else if (s.deliveryType === "Exam" || s.deliveryType === "Test/Quiz") {
            exH += h;
          } else {
            lecH += h;
          }
        });
      });

      return {
        totalAllocatedHours: totalAlloc,
        totalSessions: sessCount,
        labHours: labH,
        lectureHours: lecH,
        examHours: exH,
      };
    }, [chapters]);

  const hoursDiff = totalAllocatedHours - targetHours;

  const toggleChapter = (chId: number) => {
    setExpandedChapters((prev) => ({
      ...prev,
      [chId]: prev[chId] !== undefined ? !prev[chId] : false,
    }));
  };

  const isChapterOpen = (chId: number) => {
    return expandedChapters[chId] !== false; // default open
  };

  // Re-number sessions consecutively across all chapters
  const renumberSessions = (chList: TopicChapter[]): TopicChapter[] => {
    let sessionCount = 1;
    return chList.map((ch) => ({
      ...ch,
      sessions: ch.sessions.map((sess) => ({
        ...sess,
        session: sessionCount++,
        duration: `${sess.durationHours || 0}h`,
      })),
    }));
  };

  // Add Chapter
  const handleAddChapter = () => {
    const newId = chapters.length > 0 ? Math.max(...chapters.map((c) => c.id)) + 1 : 1;
    const newChapter: TopicChapter = {
      id: newId,
      title: `${chapters.length + 1}. Chapter Title`,
      sessions: [
        {
          session: totalSessions + 1,
          content: "",
          objectives: "",
          deliveryType: "Concept/Lecture",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Online",
          materials: "",
        },
      ],
    };
    setChapters(renumberSessions([...chapters, newChapter]));
    toast.success("New chapter added");
  };

  // Delete Chapter
  const handleDeleteChapter = (chId: number) => {
    const filtered = chapters.filter((c) => c.id !== chId);
    setChapters(renumberSessions(filtered));
    toast.info("Chapter deleted");
  };

  // Move Chapter
  const handleMoveChapter = (idx: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= chapters.length) return;
    const next = [...chapters];
    const [moved] = next.splice(idx, 1);
    next.splice(targetIdx, 0, moved);
    setChapters(renumberSessions(next));
  };

  // Update Chapter Title
  const handleUpdateChapterTitle = (chId: number, title: string) => {
    setChapters((prev) =>
      prev.map((c) => (c.id === chId ? { ...c, title } : c))
    );
  };

  // Add Session to Chapter
  const handleAddSession = (chId: number) => {
    setChapters((prev) => {
      const updated = prev.map((ch) => {
        if (ch.id !== chId) return ch;
        const newSession: TopicSession = {
          session: 0,
          content: "",
          objectives: "",
          deliveryType: "Assignment/Lab",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Offline",
          materials: "",
        };
        return {
          ...ch,
          sessions: [...ch.sessions, newSession],
        };
      });
      return renumberSessions(updated);
    });
  };

  // Delete Session
  const handleDeleteSession = (chId: number, sessIdx: number) => {
    setChapters((prev) => {
      const updated = prev.map((ch) => {
        if (ch.id !== chId) return ch;
        const nextSessions = [...ch.sessions];
        nextSessions.splice(sessIdx, 1);
        return { ...ch, sessions: nextSessions };
      });
      return renumberSessions(updated);
    });
  };

  // Move Session within Chapter
  const handleMoveSession = (chId: number, sessIdx: number, direction: "up" | "down") => {
    setChapters((prev) => {
      const updated = prev.map((ch) => {
        if (ch.id !== chId) return ch;
        const targetIdx = direction === "up" ? sessIdx - 1 : sessIdx + 1;
        if (targetIdx < 0 || targetIdx >= ch.sessions.length) return ch;
        const nextSessions = [...ch.sessions];
        const [moved] = nextSessions.splice(sessIdx, 1);
        nextSessions.splice(targetIdx, 0, moved);
        return { ...ch, sessions: nextSessions };
      });
      return renumberSessions(updated);
    });
  };

  // Update Session Field
  const handleUpdateSession = (
    chId: number,
    sessIdx: number,
    field: keyof TopicSession,
    value: any
  ) => {
    setChapters((prev) => {
      const updated = prev.map((ch) => {
        if (ch.id !== chId) return ch;
        const nextSessions = [...ch.sessions];
        const cur = { ...nextSessions[sessIdx] };

        if (field === "durationHours") {
          const num = Math.max(0.5, parseFloat(value) || 1);
          cur.durationHours = num;
          cur.duration = `${num}h`;
        } else {
          (cur as any)[field] = value;
        }

        nextSessions[sessIdx] = cur;
        return { ...ch, sessions: nextSessions };
      });
      return updated;
    });
  };

  // Auto-generate Template matching topic duration
  const handleAutoGenerate = () => {
    const template = generateTemplateChapters(topic);
    setChapters(renumberSessions(template));
    toast.success(`Generated balanced template matching target ${targetHours} hours!`);
  };

  // Reset to original curated default (or empty if none)
  const handleResetToDefault = () => {
    if (confirm("Reset schedule outline for this topic?")) {
      resetTopicSyllabusPackage(topic.id, topic.code);
      const defPkg = getTopicSyllabusPackage(topic);
      setChapters(renumberSessions(JSON.parse(JSON.stringify(defPkg.chapters || []))));
      toast.info("Schedule outline reset.");
    }
  };

  // Save Schedule Outline
  const handleSave = () => {
    if (chapters.length > 0) {
      let hasEmpty = false;
      chapters.forEach((ch) => {
        ch.sessions.forEach((s) => {
          if (!s.content || !s.content.trim()) {
            hasEmpty = true;
          }
        });
      });

      if (hasEmpty) {
        toast.error("Please fill in content/title for all sessions.");
        return;
      }
    }

    // Persist custom syllabus
    const finalChapters = renumberSessions(chapters);
    const updatedPkg = saveTopicSyllabusPackage(topic.id, finalChapters, topic);

    if (finalChapters.length === 0) {
      toast.info("Schedule outline cleared.");
    } else if (hoursDiff !== 0) {
      toast.warning(
        `Schedule outline saved! Note: Total allocated (${totalAllocatedHours}h) ${
          hoursDiff > 0 ? `exceeds target by ${hoursDiff}h` : `is under target by ${Math.abs(hoursDiff)}h`
        }.`
      );
    } else {
      toast.success("Schedule outline saved and synchronized successfully!");
    }

    onSaved?.(updatedPkg);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-5xl md:max-w-5xl lg:max-w-6xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-gray-50/50">
        {/* Header */}
        <div className="px-6 py-4 bg-white border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-purple-50 text-[#5b52e0] border border-purple-200">
                  {topic.code}
                </span>
                <DialogTitle className="text-lg font-bold text-gray-900">
                  Schedule Outline Editor
                </DialogTitle>
                <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">
                  v{topic.version}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                {topic.name} &bull; Technical Group: {topic.technicalGroup || "General"}
              </p>
            </div>

            {/* Target vs Allocated Metric Badge */}
            <div className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium ${
                  hoursDiff === 0
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                    : hoursDiff < 0
                    ? "bg-amber-50 text-amber-700 border-amber-300"
                    : "bg-rose-50 text-rose-700 border-rose-300"
                }`}
              >
                {hoursDiff === 0 ? (
                  <CheckCircle2 className="size-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="size-4" />
                )}
                <span>
                  Allocated: <strong>{totalAllocatedHours}h</strong> / Target: <strong>{targetHours}h</strong>
                </span>
                <span className="ml-1 text-[11px] font-semibold">
                  ({hoursDiff === 0 ? "Matched" : hoursDiff < 0 ? `${hoursDiff}h` : `+${hoursDiff}h`})
                </span>
              </div>
            </div>
          </div>

          {/* Allocation Breakdown Chips */}
          <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-gray-100 text-xs">
            <div className="flex items-center gap-3 text-gray-600">
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-[#4361ee]" />
                Lab: <strong>{labHours}h</strong>
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-[#2ec4b6]" />
                Lecture: <strong>{lectureHours}h</strong>
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-[#ff9f1c]" />
                Exam/Quiz: <strong>{examHours}h</strong>
              </span>
              <span className="text-gray-400">|</span>
              <span className="text-gray-500">
                <strong>{chapters.length}</strong> Chapters &bull; <strong>{totalSessions}</strong> Sessions
              </span>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleAutoGenerate}
                className="h-7 text-xs gap-1 text-[#5b52e0] border-[#5b52e0]/30 hover:bg-purple-50"
              >
                <Sparkles className="size-3" />
                Auto-generate Template
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetToDefault}
                className="h-7 text-xs gap-1 text-gray-500 hover:text-gray-700"
              >
                <RotateCcw className="size-3" />
                Reset
              </Button>
            </div>
          </div>
        </div>

        {/* Editor Body: Chapters & Sessions */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {chapters.length === 0 ? (
            <div className="text-center py-16 px-6 bg-white border border-dashed border-gray-300 rounded-xl my-4">
              <div className="size-14 rounded-full bg-purple-50 text-[#5b52e0] flex items-center justify-center mx-auto mb-3">
                <Sparkles className="size-6" />
              </div>
              <h3 className="text-sm font-bold text-gray-800">No Chapters or Sessions Added Yet</h3>
              <p className="text-xs text-gray-500 max-w-md mx-auto mt-1.5 mb-6">
                This topic currently has no schedule outline. You can start creating chapters manually, or auto-generate a balanced template matching your target duration ({targetHours}h).
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button
                  onClick={handleAddChapter}
                  className="bg-[#5b52e0] hover:bg-[#4a41d0] text-white gap-1.5 text-xs shadow-sm"
                >
                  <Plus className="size-3.5" />
                  Add First Chapter
                </Button>
                <Button
                  variant="outline"
                  onClick={handleAutoGenerate}
                  className="text-[#5b52e0] border-[#5b52e0]/40 hover:bg-purple-50 gap-1.5 text-xs"
                >
                  <Sparkles className="size-3.5" />
                  Auto-generate Template ({targetHours}h)
                </Button>
              </div>
            </div>
          ) : (
            chapters.map((ch, chIdx) => {
              const isOpen = isChapterOpen(ch.id);
              const chHours = ch.sessions.reduce(
                (acc, s) => acc + (Number(s.durationHours) || 0),
                0
              );

              return (
                <div
                  key={ch.id}
                  className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden transition-all"
                >
                  {/* Chapter Header */}
                  <div className="bg-gray-50/80 px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1">
                      <button
                        onClick={() => toggleChapter(ch.id)}
                        className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                        title={isOpen ? "Collapse Chapter" : "Expand Chapter"}
                      >
                        {isOpen ? (
                          <ChevronUp className="size-4" />
                        ) : (
                          <ChevronDown className="size-4" />
                        )}
                      </button>
                      <div className="flex-1 max-w-xl">
                        <Input
                          value={ch.title}
                          onChange={(e) => handleUpdateChapterTitle(ch.id, e.target.value)}
                          placeholder="Chapter Title (e.g. 1. Core Architecture)"
                          className="h-8 text-xs font-semibold bg-white border-gray-300 focus:border-[#5b52e0]"
                        />
                      </div>
                      <span className="text-[11px] font-medium text-gray-500 px-2 py-0.5 rounded bg-gray-200/60 whitespace-nowrap">
                        {ch.sessions.length} sessions &bull; {chHours}h
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={chIdx === 0}
                        onClick={() => handleMoveChapter(chIdx, "up")}
                        className="size-7 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                        title="Move Chapter Up"
                      >
                        <MoveUp className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={chIdx === chapters.length - 1}
                        onClick={() => handleMoveChapter(chIdx, "down")}
                        className="size-7 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                        title="Move Chapter Down"
                      >
                        <MoveDown className="size-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddSession(ch.id)}
                        className="h-7 text-xs gap-1 text-[#5b52e0] border-[#5b52e0]/30 hover:bg-purple-50 ml-1"
                      >
                        <Plus className="size-3" />
                        Add Session
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteChapter(ch.id)}
                        className="size-7 text-rose-500 hover:text-rose-700 hover:bg-rose-50 ml-1"
                        title="Delete Chapter"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Chapter Body: Sessions Table */}
                  {isOpen && (
                    <div className="p-3">
                      {ch.sessions.length === 0 ? (
                        <div className="text-center py-6 border border-dashed border-gray-200 rounded-lg text-xs text-gray-400">
                          No sessions in this chapter yet. Click{" "}
                          <button
                            onClick={() => handleAddSession(ch.id)}
                            className="text-[#5b52e0] font-semibold hover:underline"
                          >
                            + Add Session
                          </button>{" "}
                          to add one.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[850px] text-xs">
                            <thead>
                              <tr className="text-gray-500 font-semibold border-b border-gray-200">
                                <th className="w-12 text-center py-2 px-1">#</th>
                                <th className="text-left py-2 px-2 min-w-[200px]">Content / Topic</th>
                                <th className="text-left py-2 px-2 min-w-[180px]">Learning Objectives</th>
                                <th className="text-left py-2 px-2 w-36">Delivery Type</th>
                                <th className="text-center py-2 px-2 w-20">Hours</th>
                                <th className="text-center py-2 px-2 w-24">Format</th>
                                <th className="text-left py-2 px-2 min-w-[160px]">Materials / Notes</th>
                                <th className="w-20 text-center py-2 px-1">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {ch.sessions.map((sess, sessIdx) => (
                                <tr key={sessIdx} className="hover:bg-gray-50/60 group">
                                  <td className="py-2 px-1 text-center font-mono font-bold text-gray-500">
                                    {sess.session}
                                  </td>
                                  <td className="py-2 px-2">
                                    <textarea
                                      rows={2}
                                      value={sess.content}
                                      onChange={(e) =>
                                        handleUpdateSession(ch.id, sessIdx, "content", e.target.value)
                                      }
                                      placeholder="Session topics & contents..."
                                      className="w-full text-xs p-1.5 rounded border border-gray-200 focus:border-[#5b52e0] focus:ring-1 focus:ring-[#5b52e0] resize-none"
                                    />
                                  </td>
                                  <td className="py-2 px-2">
                                    <textarea
                                      rows={2}
                                      value={sess.objectives}
                                      onChange={(e) =>
                                        handleUpdateSession(ch.id, sessIdx, "objectives", e.target.value)
                                      }
                                      placeholder="Learning objectives..."
                                      className="w-full text-xs p-1.5 rounded border border-gray-200 focus:border-[#5b52e0] focus:ring-1 focus:ring-[#5b52e0] resize-none text-gray-600"
                                    />
                                  </td>
                                  <td className="py-2 px-2">
                                    <Select
                                      value={sess.deliveryType}
                                      onValueChange={(val) =>
                                        handleUpdateSession(ch.id, sessIdx, "deliveryType", val)
                                      }
                                    >
                                      <SelectTrigger className="h-8 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {DELIVERY_TYPES.map((dt) => (
                                          <SelectItem key={dt} value={dt} className="text-xs">
                                            {dt}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </td>
                                  <td className="py-2 px-2 text-center">
                                    <Input
                                      type="number"
                                      min={0.5}
                                      step={0.5}
                                      value={sess.durationHours}
                                      onChange={(e) =>
                                        handleUpdateSession(ch.id, sessIdx, "durationHours", e.target.value)
                                      }
                                      className="h-8 text-xs text-center font-mono font-semibold"
                                    />
                                  </td>
                                  <td className="py-2 px-2 text-center">
                                    <Select
                                      value={sess.trainingFormat}
                                      onValueChange={(val) =>
                                        handleUpdateSession(ch.id, sessIdx, "trainingFormat", val)
                                      }
                                    >
                                      <SelectTrigger className="h-8 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="Online" className="text-xs">
                                          Online
                                        </SelectItem>
                                        <SelectItem value="Offline" className="text-xs">
                                          Offline
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </td>
                                  <td className="py-2 px-2">
                                    <Input
                                      value={sess.materials}
                                      onChange={(e) =>
                                        handleUpdateSession(ch.id, sessIdx, "materials", e.target.value)
                                      }
                                      placeholder="URL link or slide.pdf..."
                                      className="h-8 text-xs text-gray-600"
                                    />
                                  </td>
                                  <td className="py-2 px-1 text-center">
                                    <div className="flex items-center justify-center gap-0.5">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        disabled={sessIdx === 0}
                                        onClick={() => handleMoveSession(ch.id, sessIdx, "up")}
                                        className="size-6 text-gray-400 hover:text-gray-700 disabled:opacity-20"
                                        title="Move Session Up"
                                      >
                                        <MoveUp className="size-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        disabled={sessIdx === ch.sessions.length - 1}
                                        onClick={() => handleMoveSession(ch.id, sessIdx, "down")}
                                        className="size-6 text-gray-400 hover:text-gray-700 disabled:opacity-20"
                                        title="Move Session Down"
                                      >
                                        <MoveDown className="size-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDeleteSession(ch.id, sessIdx)}
                                        className="size-6 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                                        title="Delete Session"
                                      >
                                        <Trash2 className="size-3" />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Add Chapter Button */}
          {chapters.length > 0 && (
            <div className="text-center pt-2">
              <Button
                variant="outline"
                onClick={handleAddChapter}
                className="gap-1.5 border-dashed border-gray-300 text-gray-700 hover:text-[#5b52e0] hover:border-[#5b52e0] bg-white w-full sm:w-auto px-6"
              >
                <Plus className="size-4" />
                Add Another Chapter
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            * Changes saved here will instantly recalculate the Time Allocation chart and update the
            Schedule Detail accordion view.
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="bg-[#5b52e0] hover:bg-[#4a41d0] text-white gap-1.5 shadow-sm"
            >
              <CheckCircle2 className="size-4" />
              Save Schedule Outline
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
