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
} from "lucide-react";
import type { AssessmentItem } from "./topicSyllabusData";
import { DEFAULT_FSOFT_ASSESSMENT_SCHEME } from "./topicSyllabusData";

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
    method: "Daily attendance roll-call, seminar discussion & active engagement",
    passingScore: ">= 80%",
    weight: 10,
  },
  {
    name: "Hands-on Assignments & Lab Exercises",
    method: "Evaluation of practical lab problems, code cleanlines & Git commit history",
    passingScore: ">= 6.0 / 10",
    weight: 40,
  },
  {
    name: "Final Practical Examination",
    method: "Comprehensive capstone coding exam covering core competencies",
    passingScore: ">= 6.0 / 10",
    weight: 35,
  },
  {
    name: "Final Knowledge Quiz",
    method: "Multiple-choice online assessment on key concepts & best practices",
    passingScore: ">= 6.0 / 10",
    weight: 15,
  },
  {
    name: "Capstone Mini-Project",
    method: "End-of-module functional prototype review & presentation",
    passingScore: ">= 6.0 / 10",
    weight: 30,
  },
  {
    name: "Mid-Term Progress Test",
    method: "Intermediate coding test evaluating fundamentals",
    passingScore: ">= 6.0 / 10",
    weight: 20,
  },
  {
    name: "Technical Presentation & Seminar",
    method: "Team technical presentation & architectural defense",
    passingScore: ">= 6.0 / 10",
    weight: 10,
  },
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
          DEFAULT_FSOFT_ASSESSMENT_SCHEME.map((item, idx) => ({
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

  const handleWeightChange = (index: number, rawVal: string) => {
    const num = parseFloat(rawVal) || 0;
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
    const newItem: AssessmentItem = {
      id: `preset-${Date.now()}`,
      category: preset.name,
      method: preset.method,
      passingScore: preset.passingScore,
      weight: `${preset.weight}%`,
      weightedNumber: preset.weight,
      count: 1,
      notes: "",
    };
    setItems((prev) => [...prev, newItem]);
    toast.info(`Added "${preset.name}" criterion`);
  };

  const handleResetToDefault = () => {
    setItems(
      DEFAULT_FSOFT_ASSESSMENT_SCHEME.map((item, idx) => ({
        ...item,
        id: `fsoft-default-${idx}`,
        weightedNumber: parseWeightNumber(item.weight),
      }))
    );
    setOverallPassScore(">= 6.0 / 10");
    setOverallCondition("Completed 100% Online video, Quiz, Labs, Final Test");
    toast.success("Restored FSOFT standard assessment scheme (100%)");
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
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-indigo-50/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center font-bold">
                <SlidersHorizontal className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-gray-900">
                  Configure Assessment Scheme &amp; Passing Standard
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-500 mt-0.5">
                  Adjust evaluation categories, weights, and passing requirements for{" "}
                  <span className="font-semibold text-gray-800">{topicName}</span>
                </DialogDescription>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetToDefault}
              className="text-xs text-gray-600 hover:text-indigo-600 border-dashed"
            >
              <RotateCcw className="size-3.5 mr-1.5" />
              Reset FSOFT Default
            </Button>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Real-time Weight Progress & Validation Banner */}
          <div
            className={`p-4 rounded-xl border transition-colors ${
              isTotalValid
                ? "bg-emerald-50/70 border-emerald-200"
                : totalWeight > 100
                ? "bg-rose-50/70 border-rose-200"
                : "bg-amber-50/70 border-amber-200"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {isTotalValid ? (
                  <CheckCircle2 className="size-5 text-emerald-600" />
                ) : (
                  <AlertTriangle
                    className={`size-5 ${
                      totalWeight > 100 ? "text-rose-600" : "text-amber-600"
                    }`}
                  />
                )}
                <span className="text-xs font-bold text-gray-900">
                  Total Assessment Weight:
                </span>
                <span
                  className={`text-sm font-extrabold font-mono px-2 py-0.5 rounded ${
                    isTotalValid
                      ? "text-emerald-700 bg-emerald-100/70"
                      : totalWeight > 100
                      ? "text-rose-700 bg-rose-100/70"
                      : "text-amber-700 bg-amber-100/70"
                  }`}
                >
                  {totalWeight}%
                </span>
              </div>

              <div>
                {isTotalValid ? (
                  <Badge className="bg-emerald-600 text-white hover:bg-emerald-600 text-[11px] gap-1">
                    <CheckCircle2 className="size-3" />
                    Valid 100% Scheme
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className={`text-[11px] font-semibold ${
                      totalWeight > 100
                        ? "border-rose-300 text-rose-700 bg-white"
                        : "border-amber-300 text-amber-700 bg-white"
                    }`}
                  >
                    {totalWeight > 100
                      ? `Exceeds 100% by +${totalWeight - 100}%`
                      : `Needs +${100 - totalWeight}% more to equal 100%`}
                  </Badge>
                )}
              </div>
            </div>

            {/* Visual meter bar */}
            <div className="w-full bg-white/80 rounded-full h-2 overflow-hidden border border-gray-200/50">
              <div
                className={`h-full transition-all duration-300 ${
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
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                <SlidersHorizontal className="size-3.5 text-indigo-600" />
                Assessment Categories ({items.length})
              </Label>
              <div className="text-[11px] text-gray-500">
                Official FSOFT Syllabus Section 3 structure
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold text-[11px]">
                  <tr>
                    <th className="text-center px-2 py-2.5 w-10">#</th>
                    <th className="text-left px-3 py-2.5 w-52">Assessment Category</th>
                    <th className="text-left px-3 py-2.5">Evaluation Method &amp; Description</th>
                    <th className="text-left px-3 py-2.5 w-32">Passing Score</th>
                    <th className="text-right px-3 py-2.5 w-24">Weight (%)</th>
                    <th className="text-center px-2 py-2.5 w-20">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-slate-50/60 transition-colors">
                      {/* Order and re-arrange */}
                      <td className="px-2 py-2.5 text-center text-gray-400 font-mono text-[11px]">
                        <div className="flex flex-col items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => handleMoveUp(idx)}
                            disabled={idx === 0}
                            className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-20"
                            title="Move up"
                          >
                            <ArrowUp className="size-3" />
                          </button>
                          <span className="font-bold text-gray-700">{idx + 1}</span>
                          <button
                            type="button"
                            onClick={() => handleMoveDown(idx)}
                            disabled={idx === items.length - 1}
                            className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-20"
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
                          placeholder="e.g. Hands-on Lab Exercises"
                          className="h-8 text-xs font-semibold text-gray-900 focus-visible:ring-indigo-500"
                        />
                      </td>

                      {/* Evaluation Method */}
                      <td className="px-3 py-2.5">
                        <Input
                          value={item.method}
                          onChange={(e) => handleFieldChange(idx, "method", e.target.value)}
                          placeholder="e.g. Practical lab problems, clean code & Git history"
                          className="h-8 text-xs text-gray-700 focus-visible:ring-indigo-500"
                        />
                      </td>

                      {/* Passing Score */}
                      <td className="px-3 py-2.5">
                        <Input
                          value={item.passingScore}
                          onChange={(e) => handleFieldChange(idx, "passingScore", e.target.value)}
                          placeholder=">= 6.0 / 10"
                          className="h-8 text-xs text-gray-800 font-mono focus-visible:ring-indigo-500"
                        />
                      </td>

                      {/* Weight (%) */}
                      <td className="px-3 py-2.5 text-right">
                        <div className="relative">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={5}
                            value={parseWeightNumber(item.weight)}
                            onChange={(e) => handleWeightChange(idx, e.target.value)}
                            className="h-8 text-xs text-right font-bold text-indigo-600 pr-6 font-mono focus-visible:ring-indigo-500"
                          />
                          <span className="absolute right-2 top-2 text-[11px] text-gray-400 font-semibold pointer-events-none">
                            %
                          </span>
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
                          className="size-7 text-gray-400 hover:text-red-600 hover:bg-red-50"
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
                    <td className="px-3 py-2.5 text-center text-gray-500 font-mono text-[11px]">
                      &Sigma;
                    </td>
                    <td className="px-3 py-2.5 text-gray-900">Overall Topic Result</td>
                    <td className="px-3 py-2.5 text-gray-500 font-normal text-[11px]">
                      Minimum standard across all evaluations
                    </td>
                    <td className="px-3 py-2.5 text-[#5b52e0] font-mono">
                      {overallPassScore || ">= 6.0 / 10"}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-mono text-sm ${
                        isTotalValid ? "text-[#5b52e0]" : "text-amber-600"
                      }`}
                    >
                      {totalWeight}%
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      {isTotalValid && <CheckCircle2 className="size-4 text-emerald-600 mx-auto" />}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Quick Add and Preset buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddItem}
                className="text-xs text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100/60 border-indigo-200"
              >
                <Plus className="size-3.5 mr-1" />
                Add New Criterion
              </Button>

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-gray-400 font-medium mr-1">Quick Add:</span>
                {CATEGORY_PRESETS.slice(0, 4).map((preset) => (
                  <Button
                    key={preset.name}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleApplyPreset(preset)}
                    className="h-7 text-[11px] text-gray-600 hover:text-indigo-600 hover:bg-indigo-50/60 px-2 border border-gray-200/60"
                  >
                    + {preset.name.split(" ")[0]} ({preset.weight}%)
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Overall Passing Criteria Settings */}
          <div className="p-4 bg-gray-50/80 border border-gray-200 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-800">
              <Info className="size-4 text-indigo-600" />
              Overall Passing Requirements
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
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="md:col-span-2">
                <Label className="text-[11px] font-semibold text-gray-600 mb-1 block">
                  Completion Conditions &amp; Notes
                </Label>
                <Input
                  value={overallCondition}
                  onChange={(e) => setOverallCondition(e.target.value)}
                  placeholder="Completed 100% Online video, Quiz, Labs, Final Test"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-3.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between sm:justify-between">
          <div className="text-xs text-gray-500">
            {!isTotalValid ? (
              <span className="text-amber-600 font-medium flex items-center gap-1.5">
                <AlertTriangle className="size-3.5" />
                Adjust weights so total equals 100% before saving.
              </span>
            ) : (
              <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5" />
                Scheme is balanced (100%). Ready to apply.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={!isTotalValid || !isAllFilled}
              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
            >
              Save Assessment Scheme
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

