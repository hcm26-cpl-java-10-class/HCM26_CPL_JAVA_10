import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  SlidersHorizontal,
  Info,
  ArrowUp,
  ArrowDown,
  Scale,
  Sparkles,
} from "lucide-react";
import type { AssessmentItem } from "./topicSyllabusData";
import { DEFAULT_ASSESSMENT_SCHEME } from "./topicSyllabusData";

interface AssessmentSchemeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialScheme: AssessmentItem[];
  initialPassScore?: string;
  topicName: string;
  onSave: (newScheme: AssessmentItem[], passScore: string) => void;
}

const CATEGORY_PRESETS = [
  {
    name: "Class Participation & Attendance",
    shortName: "Attendance",
    method: "Daily attendance roll-call, seminar discussion & active engagement",
    passingScore: ">= 80%",
    weight: 10,
  },
  {
    name: "Hands-on Assignments & Lab Exercises",
    shortName: "Lab / Assignment",
    method: "Evaluation of practical lab problems, code cleanlines & Git commit history",
    passingScore: ">= 6.0 / 10",
    weight: 40,
  },
  {
    name: "Final Practical Examination",
    shortName: "Final Practical",
    method: "Comprehensive capstone coding exam covering core competencies",
    passingScore: ">= 6.0 / 10",
    weight: 35,
  },
  {
    name: "Final Knowledge Quiz",
    shortName: "Final Quiz",
    method: "Multiple-choice online assessment on key concepts & best practices",
    passingScore: ">= 6.0 / 10",
    weight: 15,
  },
  {
    name: "Capstone Mini-Project",
    shortName: "Capstone Project",
    method: "End-of-module functional prototype review & presentation",
    passingScore: ">= 6.0 / 10",
    weight: 30,
  },
  {
    name: "Mid-Term Progress Test",
    shortName: "Mid-Term Exam",
    method: "Intermediate coding test evaluating fundamentals",
    passingScore: ">= 6.0 / 10",
    weight: 20,
  },
  {
    name: "Technical Presentation & Seminar",
    shortName: "Presentation",
    method: "Team technical presentation & architectural defense",
    passingScore: ">= 6.0 / 10",
    weight: 10,
  },
];

const PASS_SCORE_SUGGESTIONS = [
  ">= 6.0 / 10",
  ">= 5.0 / 10",
  ">= 7.0 / 10",
  ">= 80%",
  ">= 70%",
  "Pass / Fail",
];

function parseWeightNumber(weightStr: string | number | undefined): number {
  if (typeof weightStr === "number") return weightStr;
  if (!weightStr) return 0;
  const cleaned = String(weightStr).replace("%", "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export function AssessmentSchemeDialog({
  open,
  onOpenChange,
  initialScheme,
  initialPassScore = ">= 6.0 / 10",
  topicName,
  onSave,
}: AssessmentSchemeDialogProps) {
  const [items, setItems] = useState<AssessmentItem[]>([]);
  const [overallPassScore, setOverallPassScore] = useState<string>(initialPassScore);
  const [overallCondition, setOverallCondition] = useState<string>(
    "Completed 100% Online video, Quiz, Labs, Final Test"
  );

  useEffect(() => {
    if (open) {
      if (initialScheme && initialScheme.length > 0) {
        setItems(
          initialScheme.map((item, idx) => ({
            ...item,
            id: item.id || `scheme-${Date.now()}-${idx}`,
            weightedNumber: parseWeightNumber(item.weight),
          }))
        );
      } else {
        setItems(
          DEFAULT_ASSESSMENT_SCHEME.map((item, idx) => ({
            ...item,
            id: `default-${idx}`,
            weightedNumber: parseWeightNumber(item.weight),
          }))
        );
      }
      setOverallPassScore(initialPassScore || ">= 6.0 / 10");
    }
  }, [open, initialScheme, initialPassScore]);

  // Total weight sum
  const totalWeight = items.reduce(
    (sum, item) => sum + (parseWeightNumber(item.weight) || 0),
    0
  );

  const isTotalValid = Math.abs(totalWeight - 100) < 0.01;
  const isAllFilled =
    items.length > 0 &&
    items.every(
      (item) => item.category.trim().length > 0 && item.method.trim().length > 0
    );

  const getWeightDisplay = (w: string | number | undefined): string => {
    if (w === undefined || w === null || w === "") return "";
    return String(w).replace("%", "").trim();
  };

  const handleWeightChange = (index: number, rawVal: string) => {
    // Strip non-digit characters
    const digitsOnly = rawVal.replace(/[^0-9]/g, "");

    // Allow completely empty field when user deletes/backspaces
    if (digitsOnly === "") {
      setItems((prev) =>
        prev.map((item, idx) => {
          if (idx !== index) return item;
          return {
            ...item,
            weightedNumber: 0,
            weight: "",
          };
        })
      );
      return;
    }

    // Parse int to automatically strip leading zeros (e.g. "010" -> 10, "05" -> 5)
    let num = parseInt(digitsOnly, 10);
    if (isNaN(num)) num = 0;
    if (num > 100) num = 100;

    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        return {
          ...item,
          weightedNumber: num,
          weight: `${num}%`,
        };
      })
    );
  };

  const handleWeightBlur = (index: number) => {
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        if (!item.weight || item.weight.trim() === "") {
          return {
            ...item,
            weightedNumber: 0,
            weight: "0%",
          };
        }
        return item;
      })
    );
  };

  const handleAdjustWeight = (index: number, delta: number) => {
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const current = parseWeightNumber(item.weight);
        const next = Math.max(0, Math.min(100, current + delta));
        return {
          ...item,
          weightedNumber: next,
          weight: `${next}%`,
        };
      })
    );
  };

  const handleFieldChange = (
    index: number,
    field: "category" | "method" | "passingScore" | "notes",
    val: string
  ) => {
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        return {
          ...item,
          [field]: val,
        };
      })
    );
  };

  const handleAddItem = () => {
    const remainingWeight = Math.max(0, 100 - totalWeight);
    const newItem: AssessmentItem = {
      id: `custom-${Date.now()}`,
      category: "",
      method: "",
      passingScore: ">= 6.0 / 10",
      weight: `${remainingWeight}%`,
      weightedNumber: remainingWeight,
      count: 1,
      notes: "",
    };
    setItems((prev) => [...prev, newItem]);
  };

  const handleDeleteItem = (index: number) => {
    if (items.length <= 1) {
      toast.error("Assessment scheme must have at least 1 evaluation category");
      return;
    }
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setItems((prev) => {
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index === items.length - 1) return;
    setItems((prev) => {
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const handleApplyPreset = (preset: (typeof CATEGORY_PRESETS)[0]) => {
    const remainingWeight = Math.max(0, 100 - totalWeight);
    const assignedWeight = remainingWeight > 0 ? Math.min(preset.weight, remainingWeight) : preset.weight;
    const newItem: AssessmentItem = {
      id: `preset-${Date.now()}`,
      category: preset.name,
      method: preset.method,
      passingScore: preset.passingScore,
      weight: `${assignedWeight}%`,
      weightedNumber: assignedWeight,
      count: 1,
      notes: "",
    };
    setItems((prev) => [...prev, newItem]);
    toast.info(`Added "${preset.name}" (${assignedWeight}%)`);
  };

  // Auto balance all weights evenly to sum to 100%
  const handleAutoBalance = () => {
    if (items.length === 0) return;
    const count = items.length;
    const base = Math.floor(100 / count);
    const remainder = 100 - base * count;

    setItems((prev) =>
      prev.map((item, idx) => {
        const w = idx === count - 1 ? base + remainder : base;
        return {
          ...item,
          weightedNumber: w,
          weight: `${w}%`,
        };
      })
    );
    toast.success("Automatically balanced weights to 100%!");
  };

  // Fill remaining percentage into the last item
  const handleFillRemainder = () => {
    if (items.length === 0) return;
    const remaining = 100 - totalWeight;
    if (remaining === 0) {
      toast.info("Total weight is already 100%");
      return;
    }
    const lastIdx = items.length - 1;
    const currentLast = parseWeightNumber(items[lastIdx].weight);
    const newLast = Math.max(0, currentLast + remaining);

    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== lastIdx) return item;
        return {
          ...item,
          weightedNumber: newLast,
          weight: `${newLast}%`,
        };
      })
    );
    toast.success(`Adjusted last category by ${remaining > 0 ? `+${remaining}%` : `${remaining}%`} to reach exactly 100%!`);
  };

  const handleResetToDefault = () => {
    setItems(
      DEFAULT_ASSESSMENT_SCHEME.map((item, idx) => ({
        ...item,
        id: `default-${idx}`,
        weightedNumber: parseWeightNumber(item.weight),
      }))
    );
    setOverallPassScore(">= 6.0 / 10");
    setOverallCondition("Completed 100% Online video, Quiz, Labs, Final Test");
    toast.success("Restored standard assessment scheme (100%)");
  };

  const handleSave = () => {
    if (!isAllFilled) {
      toast.error("Please fill in Category Name and Evaluation Method for all rows");
      return;
    }
    if (!isTotalValid) {
      toast.error(
        `Total weight must equal 100%. Current sum: ${totalWeight}%. Please adjust the weights.`
      );
      return;
    }

    const cleanedItems: AssessmentItem[] = items.map((item) => ({
      category: item.category.trim(),
      method: item.method.trim(),
      passingScore: item.passingScore.trim() || ">= 6.0 / 10",
      weight: `${parseWeightNumber(item.weight)}%`,
      weightedNumber: parseWeightNumber(item.weight),
      count: item.count || 1,
      notes: item.notes || item.method.trim(),
    }));

    onSave(cleanedItems, overallPassScore.trim() || ">= 6.0 / 10");
    toast.success("Assessment scheme configured and saved successfully!");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-4xl md:max-w-5xl lg:max-w-6xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-slate-50/50 shadow-2xl rounded-2xl border border-gray-200">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-gray-200 bg-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-purple-100 text-[#5b52e0] flex items-center justify-center font-bold shadow-sm">
                <SlidersHorizontal className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-base font-bold text-gray-900">
                    Configure Assessment Scheme &amp; Passing Standard
                  </DialogTitle>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-[#5b52e0] font-semibold border border-purple-200">
                    Standard Scheme
                  </span>
                </div>
                <DialogDescription className="text-xs text-gray-500 mt-0.5">
                  Customize evaluation categories, weights, and passing requirements for{" "}
                  <span className="font-semibold text-gray-800">{topicName}</span>
                </DialogDescription>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetToDefault}
              className="text-xs text-gray-600 hover:text-[#5b52e0] border-dashed h-8 gap-1.5 self-start sm:self-auto"
            >
              <RotateCcw className="size-3.5" />
              Reset Default
            </Button>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Real-time Weight Progress & Balance Dashboard Card */}
          <div
            className={`p-4 rounded-xl border transition-all shadow-xs ${
              isTotalValid
                ? "bg-emerald-50/70 border-emerald-200"
                : totalWeight > 100
                ? "bg-rose-50/70 border-rose-200"
                : "bg-amber-50/70 border-amber-200"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                {isTotalValid ? (
                  <CheckCircle2 className="size-5 text-emerald-600 flex-shrink-0" />
                ) : (
                  <AlertTriangle
                    className={`size-5 flex-shrink-0 ${
                      totalWeight > 100 ? "text-rose-600" : "text-amber-600"
                    }`}
                  />
                )}
                <span className="text-xs font-bold text-gray-900">
                  Total Assessment Weight:
                </span>
                <span
                  className={`text-base font-extrabold font-mono px-2.5 py-0.5 rounded-md ${
                    isTotalValid
                      ? "text-emerald-700 bg-emerald-100"
                      : totalWeight > 100
                      ? "text-rose-700 bg-rose-100"
                      : "text-amber-700 bg-amber-100"
                  }`}
                >
                  {totalWeight}%
                </span>

                {isTotalValid ? (
                  <Badge className="bg-emerald-600 text-white hover:bg-emerald-600 text-xs gap-1 py-0.5">
                    <CheckCircle2 className="size-3" />
                    Valid 100% Scheme
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className={`text-xs font-semibold py-0.5 ${
                      totalWeight > 100
                        ? "border-rose-300 text-rose-700 bg-white"
                        : "border-amber-300 text-amber-700 bg-white"
                    }`}
                  >
                    {totalWeight > 100
                      ? `Exceeds 100% by +${totalWeight - 100}%`
                      : `Needs +${100 - totalWeight}% to reach 100%`}
                  </Badge>
                )}
              </div>

              {/* Quick Weight Balance Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAutoBalance}
                  className="h-7 text-xs gap-1 text-[#5b52e0] bg-white hover:bg-purple-50 border-purple-200"
                  title="Divide 100% proportionally across all categories"
                >
                  <Scale className="size-3" />
                  Auto-balance Evenly
                </Button>
                {!isTotalValid && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleFillRemainder}
                    className="h-7 text-xs gap-1 text-emerald-700 bg-white hover:bg-emerald-50 border-emerald-300"
                    title="Automatically adjust the last item to reach 100%"
                  >
                    <Sparkles className="size-3" />
                    Fill Remainder ({100 - totalWeight > 0 ? `+${100 - totalWeight}%` : `${100 - totalWeight}%`})
                  </Button>
                )}
              </div>
            </div>

            {/* Visual meter bar */}
            <div className="w-full bg-white/90 rounded-full h-2.5 overflow-hidden border border-gray-200/60 shadow-inner">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  isTotalValid
                    ? "bg-emerald-500"
                    : totalWeight > 100
                    ? "bg-rose-500"
                    : "bg-amber-500"
                }`}
                style={{ width: `${Math.min(totalWeight, 100)}%` }}
              />
            </div>
          </div>

          {/* Scheme Editor Table */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                <SlidersHorizontal className="size-3.5 text-[#5b52e0]" />
                Assessment Categories ({items.length})
              </Label>
              <div className="text-[11px] text-gray-500 flex items-center gap-2">
                <span>Click arrows to reorder</span>
                <span>&bull;</span>
                <span>Enter weight (%) per component</span>
              </div>
            </div>

            {/* Table Container with spacious layout */}
            <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold text-[11px]">
                  <tr>
                    <th className="text-center px-2 py-3 w-14">#</th>
                    <th className="text-left px-3 py-3 w-64 md:w-72">Assessment Category</th>
                    <th className="text-left px-3 py-3">Evaluation Method &amp; Description</th>
                    <th className="text-left px-3 py-3 w-36">Passing Score</th>
                    <th className="text-center px-3 py-3 w-40">Weight (%)</th>
                    <th className="text-center px-2 py-3 w-16">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors group">
                      {/* Order and re-arrange */}
                      <td className="px-2 py-2.5 text-center text-gray-400 font-mono text-[11px]">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleMoveUp(idx)}
                            disabled={idx === 0}
                            className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-20"
                            title="Move up"
                          >
                            <ArrowUp className="size-3" />
                          </button>
                          <span className="font-bold text-gray-700 min-w-[14px]">{idx + 1}</span>
                          <button
                            type="button"
                            onClick={() => handleMoveDown(idx)}
                            disabled={idx === items.length - 1}
                            className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-20"
                            title="Move down"
                          >
                            <ArrowDown className="size-3" />
                          </button>
                        </div>
                      </td>

                      {/* Category Name */}
                      <td className="px-3 py-2.5">
                        <Input
                          value={item.category}
                          onChange={(e) => handleFieldChange(idx, "category", e.target.value)}
                          placeholder="e.g. Hands-on Assignments & Lab Exercises"
                          className="h-8 text-xs font-semibold text-gray-900 focus-visible:ring-[#5b52e0] bg-white"
                        />
                      </td>

                      {/* Evaluation Method */}
                      <td className="px-3 py-2.5">
                        <Input
                          value={item.method}
                          onChange={(e) => handleFieldChange(idx, "method", e.target.value)}
                          placeholder="e.g. Evaluation of practical lab problems, code cleanlines & Git history"
                          className="h-8 text-xs text-gray-700 focus-visible:ring-[#5b52e0] bg-white"
                        />
                      </td>

                      {/* Passing Score */}
                      <td className="px-3 py-2.5">
                        <Input
                          value={item.passingScore}
                          onChange={(e) => handleFieldChange(idx, "passingScore", e.target.value)}
                          placeholder=">= 6.0 / 10"
                          className="h-8 text-xs text-gray-800 font-mono focus-visible:ring-[#5b52e0] bg-white"
                        />
                      </td>

                      {/* Weight (%) with quick -5% / +5% buttons */}
                      <td className="px-3 py-2.5 text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleAdjustWeight(idx, -5)}
                            className="size-7 rounded border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-600 font-bold text-xs flex items-center justify-center transition-colors"
                            title="Decrease 5%"
                          >
                            -
                          </button>
                          <div className="relative w-18">
                            <Input
                              type="text"
                              inputMode="numeric"
                              placeholder="0"
                              value={getWeightDisplay(item.weight)}
                              onChange={(e) => handleWeightChange(idx, e.target.value)}
                              onBlur={() => handleWeightBlur(idx)}
                              className="h-8 text-xs text-center font-bold text-[#5b52e0] font-mono px-2 pr-5 focus-visible:ring-[#5b52e0] bg-white"
                            />
                            <span className="absolute right-1.5 top-2 text-[10px] text-gray-400 font-semibold pointer-events-none">
                              %
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAdjustWeight(idx, 5)}
                            className="size-7 rounded border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-600 font-bold text-xs flex items-center justify-center transition-colors"
                            title="Increase 5%"
                          >
                            +
                          </button>
                        </div>
                      </td>

                      {/* Delete */}
                      <td className="px-2 py-2.5 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteItem(idx)}
                          disabled={items.length <= 1}
                          className="size-7 text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-20"
                          title="Remove criterion"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>

                {/* Footer total row */}
                <tfoot className="bg-slate-50 border-t border-gray-200 font-bold text-gray-900">
                  <tr>
                    <td className="px-2 py-2.5 text-center text-gray-500 font-mono text-[11px]">
                      &Sigma;
                    </td>
                    <td className="px-3 py-2.5 text-gray-900 font-semibold">Overall Topic Result</td>
                    <td className="px-3 py-2.5 text-gray-500 font-normal text-[11px]">
                      Comprehensive evaluation standard for topic completion
                    </td>
                    <td className="px-3 py-2.5 text-[#5b52e0] font-mono font-bold">
                      {overallPassScore || ">= 6.0 / 10"}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-center font-mono text-sm font-extrabold ${
                        isTotalValid ? "text-emerald-600" : "text-amber-600"
                      }`}
                    >
                      {totalWeight}%
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      {isTotalValid ? (
                        <CheckCircle2 className="size-4 text-emerald-600 mx-auto" />
                      ) : (
                        <AlertTriangle className="size-4 text-amber-500 mx-auto" />
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Quick Add and Preset buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddItem}
                className="text-xs text-[#5b52e0] bg-purple-50 hover:bg-purple-100 border-purple-200 gap-1.5 h-8 font-semibold shadow-xs"
              >
                <Plus className="size-3.5" />
                Add New Criterion
              </Button>

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-gray-400 font-medium mr-1">Quick Presets:</span>
                {CATEGORY_PRESETS.map((preset) => (
                  <Button
                    key={preset.name}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleApplyPreset(preset)}
                    className="h-7 text-[11px] text-gray-600 hover:text-[#5b52e0] hover:bg-purple-50 px-2.5 border border-gray-200 bg-white shadow-2xs"
                  >
                    + {preset.shortName} ({preset.weight}%)
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Overall Passing Requirements Settings */}
          <div className="p-4 bg-white border border-gray-200 rounded-xl space-y-3 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-800">
              <Info className="size-4 text-[#5b52e0]" />
              Overall Topic Passing Requirements
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-[11px] font-semibold text-gray-600 mb-1 block">
                  Overall Minimum Passing Score
                </Label>
                <Input
                  value={overallPassScore}
                  onChange={(e) => setOverallPassScore(e.target.value)}
                  placeholder=">= 6.0 / 10"
                  className="h-8 text-xs font-mono bg-gray-50/50"
                />
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  {PASS_SCORE_SUGGESTIONS.slice(0, 4).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setOverallPassScore(s)}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-purple-50 hover:text-[#5b52e0] transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2">
                <Label className="text-[11px] font-semibold text-gray-600 mb-1 block">
                  Completion Conditions &amp; Principles
                </Label>
                <Input
                  value={overallCondition}
                  onChange={(e) => setOverallCondition(e.target.value)}
                  placeholder="Completed 100% Online video, Quiz, Labs, Final Test"
                  className="h-8 text-xs bg-gray-50/50"
                />
                <p className="text-[10px] text-gray-400 mt-1.5">
                  Applied when calculating trainee completion certificate and final grade pass status.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-3.5 border-t border-gray-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-gray-500 w-full sm:w-auto">
            {!isTotalValid ? (
              <span className="text-amber-600 font-medium flex items-center gap-1.5">
                <AlertTriangle className="size-3.5 flex-shrink-0" />
                Adjust component weights so total equals 100% before saving.
              </span>
            ) : (
              <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 flex-shrink-0" />
                Scheme is perfectly balanced (100%). Ready to apply.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs h-8 px-4"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={!isTotalValid || !isAllFilled}
              className="text-xs h-8 px-4 bg-[#5b52e0] hover:bg-[#4a41d0] text-white disabled:opacity-50 shadow-xs"
            >
              Save Assessment Scheme
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
