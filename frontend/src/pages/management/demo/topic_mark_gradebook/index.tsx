import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Copy,
  Download,
  Info,
  Pencil,
  RotateCcw,
  Save,
  Search,
  Upload,
  Users,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { read, utils, writeFile } from "xlsx";
import { createTopicMarkGradebookApi, topicMarkGradebookApi } from "@/api";
import { ApiErrorState } from "@/components/common/ApiErrorState";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { TopicMarkGradebookTableRow } from "@/types";

export interface GradebookColumnDef {
  key: string;
  label: string;
}

export interface EditableGradebookRow {
  id: string | number;
  userId: string;
  fullName: string;
  email: string;
  values: Record<string, number | null>;
  finalScore: number | null;
  isPassed: boolean;
  hasZeroInMandatory: boolean;
}

// 1. Chronological Column Priority Order
const CHRONOLOGICAL_ORDER = [
  "attendance",
  "quiz1",
  "quiz2",
  "assignment",
  "practice",
  "project",
  "midterm",
  "final",
  "bonus",
];

const DEFAULT_GRADEBOOK_COLUMNS: GradebookColumnDef[] = [
  { key: "attendance", label: "Attendance" },
  { key: "quiz1", label: "Quiz 1" },
  { key: "quiz2", label: "Quiz 2" },
  { key: "assignment", label: "Assignment" },
  { key: "practice", label: "Practice" },
  { key: "project", label: "Project" },
  { key: "midterm", label: "Midterm" },
  { key: "final", label: "Final" },
  { key: "bonus", label: "Bonus" },
];

export interface ImportColumnSpec {
  canonical: string;
  field: string;
  aliases: string[];
  isScore: boolean;
  requiredScore?: boolean;
}

export const REQUIRED_IMPORT_COLUMNS: ImportColumnSpec[] = [
  { canonical: "Student", field: "fullName", aliases: ["student", "student name", "fullname", "full name", "trainee"], isScore: false },
  { canonical: "Email", field: "email", aliases: ["email", "personal email", "student email"], isScore: false },
  { canonical: "Attendance", field: "attendance", aliases: ["attendance", "chuyen can", "att"], isScore: true, requiredScore: true },
  { canonical: "Quiz 1", field: "quiz1", aliases: ["quiz 1", "quiz1", "q1"], isScore: true, requiredScore: true },
  { canonical: "Quiz 2", field: "quiz2", aliases: ["quiz 2", "quiz2", "q2"], isScore: true, requiredScore: true },
  { canonical: "Assignment", field: "assignment", aliases: ["assignment", "asm", "asg"], isScore: true, requiredScore: true },
  { canonical: "Practice", field: "practice", aliases: ["practice", "prac"], isScore: true, requiredScore: true },
  { canonical: "Project", field: "project", aliases: ["project", "proj"], isScore: true, requiredScore: true },
  { canonical: "Midterm", field: "midterm", aliases: ["midterm", "mid-term", "mid term"], isScore: true, requiredScore: true },
  { canonical: "Final", field: "final", aliases: ["final", "final exam", "fe"], isScore: true, requiredScore: true },
  { canonical: "Bonus", field: "bonus", aliases: ["bonus", "bonus score"], isScore: true, requiredScore: false },
];

function getColumnPriority(key: string, label: string): number {
  const normKey = (key || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const normLabel = (label || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  for (let i = 0; i < CHRONOLOGICAL_ORDER.length; i++) {
    const target = CHRONOLOGICAL_ORDER[i];
    if (normKey === target || normLabel === target || normKey.includes(target) || normLabel.includes(target)) {
      return i;
    }
  }
  return 100;
}

function calculateRowFinalScore(values: Record<string, number | null | undefined>): number | null {
  const validScores: number[] = [];
  for (const [key, val] of Object.entries(values)) {
    if (key === "FINAL_SCORE" || key === "IS_PASSED") continue;
    if (typeof val === "number" && !isNaN(val)) {
      validScores.push(val);
    }
  }
  if (validScores.length === 0) return null;
  const sum = validScores.reduce((acc, score) => acc + score, 0);
  return Math.round((sum / validScores.length) * 100) / 100;
}

export const MANDATORY_SCORE_KEYS = [
  "quiz1",
  "quiz2",
  "assignment",
  "practice",
  "project",
  "midterm",
  "final",
] as const;

export function isMandatoryScoreColumn(key: string, label?: string): boolean {
  const normKey = (key || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const normLabel = (label || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  // Explicitly exclude meta keys, Attendance, and Bonus
  if (normKey.includes("finalscore") || normLabel.includes("finalscore")) return false;
  if (
    normKey.includes("ispassed") ||
    normLabel.includes("ispassed") ||
    normKey.includes("status") ||
    normLabel.includes("status")
  ) {
    return false;
  }
  if (normKey.includes("attendance") || normLabel.includes("attendance")) return false;
  if (normKey.includes("bonus") || normLabel.includes("bonus")) return false;

  return MANDATORY_SCORE_KEYS.some((target) => {
    return (
      normKey === target ||
      normLabel === target ||
      normKey.includes(target) ||
      normLabel.includes(target)
    );
  });
}

export function getScoreForComponent(
  values: Record<string, number | null | undefined>,
  componentName: string,
  columns?: GradebookColumnDef[],
): number | null {
  const normTarget = componentName.toLowerCase().replace(/[^a-z0-9]/g, "");

  // 1. Direct match on values keys
  for (const [k, v] of Object.entries(values)) {
    if (k === "FINAL_SCORE" || k === "IS_PASSED") continue;
    const normK = k.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (normK === normTarget) {
      return typeof v === "number" && !isNaN(v) ? v : null;
    }
  }

  // 2. Match via columns array (col.key or col.label)
  if (columns && columns.length > 0) {
    for (const col of columns) {
      const normKey = (col.key || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const normLabel = (col.label || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      if (
        normKey === normTarget ||
        normLabel === normTarget ||
        normKey.includes(normTarget) ||
        normLabel.includes(normTarget)
      ) {
        const v = values[col.key] ?? values[col.label];
        return typeof v === "number" && !isNaN(v) ? v : null;
      }
    }
  }

  // 3. Fallback: check if any key in values includes the component name
  for (const [k, v] of Object.entries(values)) {
    if (k === "FINAL_SCORE" || k === "IS_PASSED") continue;
    const normK = k.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (normK.includes(normTarget) || normTarget.includes(normK)) {
      return typeof v === "number" && !isNaN(v) ? v : null;
    }
  }

  return null;
}

export interface StudentEvaluationResult {
  isPassed: boolean;
  hasZeroInMandatory: boolean;
  isFinalBelowFloor: boolean;
  zeroComponentNames: string[];
  reason?: string;
}

export function evaluateStudentStatus(
  studentRow: {
    finalScore?: number | null;
    values: Record<string, number | null | undefined>;
  },
  columns?: GradebookColumnDef[],
): StudentEvaluationResult {
  const { values, finalScore } = studentRow;

  if (finalScore === null || finalScore === undefined) {
    return {
      isPassed: false,
      hasZeroInMandatory: false,
      isFinalBelowFloor: false,
      zeroComponentNames: [],
    };
  }

  // Condition 1: Final Score >= 5.0
  const isFinalScorePass = finalScore >= 5.0;

  // Condition 2: No zero scores in 7 mandatory components
  // Quiz 1, Quiz 2, Assignment, Practice, Project, Midterm, Final
  const zeroComponentNames: string[] = [];
  const mandatorySpecs: Array<{ name: string; label: string }> = [
    { name: "quiz1", label: "Quiz 1" },
    { name: "quiz2", label: "Quiz 2" },
    { name: "assignment", label: "Assignment" },
    { name: "practice", label: "Practice" },
    { name: "project", label: "Project" },
    { name: "midterm", label: "Midterm" },
    { name: "final", label: "Final" },
  ];

  for (const spec of mandatorySpecs) {
    const score = getScoreForComponent(values, spec.name, columns);
    if (score !== null && score === 0) {
      zeroComponentNames.push(spec.label);
    }
  }
  const hasZeroInMandatory = zeroComponentNames.length > 0;

  // Condition 3: Final Exam minimum floor score >= 4.0
  const finalExamScore = getScoreForComponent(values, "final", columns);
  const isFinalBelowFloor = finalExamScore !== null && finalExamScore < 4.0;

  const isPassed = isFinalScorePass && !hasZeroInMandatory && !isFinalBelowFloor;

  let reason = "";
  if (!isPassed) {
    const reasons: string[] = [];
    if (!isFinalScorePass) {
      reasons.push(`Final Score < 5.0 (${finalScore.toFixed(2)})`);
    }
    if (hasZeroInMandatory) {
      reasons.push(`Zero score in ${zeroComponentNames.join(", ")}`);
    }
    if (isFinalBelowFloor) {
      reasons.push(`Final Exam score < 4.0 (${finalExamScore})`);
    }
    reason = reasons.join("; ");
  }

  return {
    isPassed,
    hasZeroInMandatory,
    isFinalBelowFloor,
    zeroComponentNames,
    reason,
  };
}

export function isStudentPassed(
  studentRow: {
    finalScore?: number | null;
    values: Record<string, number | null | undefined>;
  },
  columns?: GradebookColumnDef[],
): boolean {
  return evaluateStudentStatus(studentRow, columns).isPassed;
}


export default function TopicMarkGradebookDemoPage() {
  const [searchParams] = useSearchParams();
  const classId = searchParams.get("classId") || undefined;
  const classCode = searchParams.get("classCode") || undefined;

  const backToUrl = classId
    ? `/classes/${classId}?tab=trainees`
    : classCode
      ? `/training-operations/class-details/${classCode}?tab=trainees`
      : null;

  const api = useMemo(
    () => (classId || classCode ? createTopicMarkGradebookApi(classId, classCode) : topicMarkGradebookApi),
    [classId, classCode],
  );

  const queryKey = ["topic-marks-gradebook", classId || "all", classCode || "all"];
  const { data: pageData, isPending, isError, error, refetch } = useQuery({
    queryKey,
    queryFn: () =>
      api.getPage(
        { page: 0, size: 100, sort: "fullName,asc" },
        undefined,
        { classId, classCode },
      ),
  });

  // Local state for rows, modified cells tracking, and active inline edit
  const [localRows, setLocalRows] = useState<EditableGradebookRow[]>([]);
  const [serverRows, setServerRows] = useState<EditableGradebookRow[]>([]);
  const [modifiedCells, setModifiedCells] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [editingCell, setEditingCell] = useState<{ rowId: string | number; columnKey: string } | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync server data when query loads
  useEffect(() => {
    if (pageData?.content) {
      const rows: EditableGradebookRow[] = (pageData.content as TopicMarkGradebookTableRow[]).map((row) => {
        const normalizedValues: Record<string, number | null> = {};
        for (const [k, v] of Object.entries(row.values || {})) {
          normalizedValues[k] = typeof v === "number" && !isNaN(v) ? v : null;
        }
        const calcFinal = calculateRowFinalScore(normalizedValues);
        const finalScore = row.finalScore != null ? Number(row.finalScore) : calcFinal;
        const passed = isStudentPassed({ finalScore, values: normalizedValues }, DEFAULT_GRADEBOOK_COLUMNS);
        const { hasZeroInMandatory } = evaluateStudentStatus({ finalScore, values: normalizedValues }, DEFAULT_GRADEBOOK_COLUMNS);

        return {
          id: row.id,
          userId: String(row.userId ?? row.id),
          fullName: row.fullName || "",
          email: row.email || "",
          values: normalizedValues,
          finalScore,
          isPassed: passed,
          hasZeroInMandatory,
        };
      });
      setServerRows(rows);
      setLocalRows(rows);
      setModifiedCells(new Set());
    }
  }, [pageData]);

  // Determine chronological columns
  const orderedColumns = useMemo<GradebookColumnDef[]>(() => {
    const rawColumns: GradebookColumnDef[] =
      (pageData as any)?.columns && (pageData as any).columns.length > 0
        ? (pageData as any).columns
        : DEFAULT_GRADEBOOK_COLUMNS;

    return [...rawColumns].sort((a, b) => {
      const pA = getColumnPriority(a.key, a.label);
      const pB = getColumnPriority(b.key, b.label);
      if (pA !== pB) return pA - pB;
      return a.label.localeCompare(b.label);
    });
  }, [pageData]);

  // Filtered rows by search query
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return localRows;
    return localRows.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q),
    );
  }, [localRows, searchQuery]);

  const totalTrainees = localRows.length;
  const hasChanges = modifiedCells.size > 0;

  // Inline cell edit handlers
  const handleStartEdit = (rowId: string | number, columnKey: string, currentValue: number | null) => {
    setEditingCell({ rowId, columnKey });
    setEditValue(currentValue != null ? String(currentValue) : "");
  };

  const handleCommitEdit = (rowId: string | number, columnKey: string) => {
    const trimmed = editValue.trim();
    let nextNum: number | null = null;

    if (trimmed !== "" && trimmed !== "-" && !isNaN(Number(trimmed))) {
      const parsed = Number(trimmed);
      // Clamp between 0 and 10
      nextNum = Math.round(Math.max(0, Math.min(10, parsed)) * 100) / 100;
    }

    setLocalRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const nextValues = { ...row.values, [columnKey]: nextNum };
        const newFinalScore = calculateRowFinalScore(nextValues);
        const newIsPassed = isStudentPassed({ finalScore: newFinalScore, values: nextValues }, orderedColumns);
        const { hasZeroInMandatory } = evaluateStudentStatus({ finalScore: newFinalScore, values: nextValues }, orderedColumns);

        return {
          ...row,
          values: nextValues,
          finalScore: newFinalScore,
          isPassed: newIsPassed,
          hasZeroInMandatory,
        };
      }),
    );

    // Track if modified compared to server baseline
    const serverRow = serverRows.find((r) => r.id === rowId);
    const serverVal = serverRow?.values[columnKey] ?? null;
    const cellKey = `${rowId}:${columnKey}`;

    setModifiedCells((prev) => {
      const next = new Set(prev);
      if (serverVal !== nextNum) {
        next.add(cellKey);
      } else {
        next.delete(cellKey);
      }
      return next;
    });

    setEditingCell(null);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowId: string | number,
    columnKey: string,
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCommitEdit(rowId, columnKey);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditingCell(null);
    }
  };

  // Discard all changes
  const handleDiscard = () => {
    setLocalRows(serverRows.map((r) => ({ ...r, values: { ...r.values } })));
    setModifiedCells(new Set());
    setEditingCell(null);
    toast.info("Discarded all unsaved score modifications.");
  };

  // Save changes
  const handleSaveChanges = () => {
    setServerRows(localRows.map((r) => ({ ...r, values: { ...r.values } })));
    setModifiedCells(new Set());
    setEditingCell(null);
    toast.success(
      `Saved all score updates for ${classCode ?? "class"} successfully!`,
    );
  };

  // Export to Excel
  const handleExport = () => {
    if (localRows.length === 0) {
      toast.error("No gradebook data to export.");
      return;
    }

    const exportRows = localRows.map((row, index) => {
      const rowItem: Record<string, unknown> = {
        "No.": index + 1,
        "Student": row.fullName,
        "Email": row.email,
      };

      for (const col of orderedColumns) {
        const val = row.values[col.key];
        rowItem[col.label] = val != null ? val : "—";
      }

      rowItem["Final Score"] = row.finalScore != null ? row.finalScore.toFixed(2) : "—";
      rowItem["Status"] = row.isPassed ? "Passed" : "Failed";

      return rowItem;
    });

    const worksheet = utils.json_to_sheet(exportRows);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, "Gradebook");
    const fileName = `${classCode || "Class"}_Topic_Marks.xlsx`;
    writeFile(workbook, fileName);
    toast.success(`Exported gradebook to ${fileName}`);
  };

  // Copy errors to clipboard
  const handleCopyErrors = () => {
    if (importErrors.length === 0) return;
    navigator.clipboard.writeText(importErrors.join("\n"));
    toast.success("Copied error log to clipboard");
  };

  // Import from Excel / CSV with Strict Validation & All-or-Nothing Rollback
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = read(buffer, { type: "array" });

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        setImportErrors(["File Error: The uploaded file contains no sheets."]);
        setIsErrorModalOpen(true);
        toast.error("Import failed: The file contains no sheets.");
        return;
      }

      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        setImportErrors(["File Error: The first sheet in the file is empty."]);
        setIsErrorModalOpen(true);
        toast.error("Import failed: Worksheet is empty.");
        return;
      }

      // Read raw rows as 2D array (header: 1)
      const rawSheet = utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: "" });
      if (!rawSheet || rawSheet.length === 0) {
        setImportErrors(["File Error: The uploaded file is empty."]);
        setIsErrorModalOpen(true);
        toast.error("Import failed: File is empty.");
        return;
      }

      // 1. Locate and validate header row
      const headerRow = (rawSheet[0] || []).map((h) => String(h ?? "").trim());
      const headerIndexMap: Record<string, number> = {};
      const missingColumns: string[] = [];

      for (const spec of REQUIRED_IMPORT_COLUMNS) {
        const foundIndex = headerRow.findIndex((colHeader) => {
          const normHeader = colHeader.toLowerCase().replace(/[^a-z0-9]/g, "");
          return spec.aliases.some(
            (alias) => normHeader === alias.toLowerCase().replace(/[^a-z0-9]/g, ""),
          );
        });

        if (foundIndex !== -1) {
          headerIndexMap[spec.canonical] = foundIndex;
        } else {
          missingColumns.push(spec.canonical);
        }
      }

      const validationErrors: string[] = [];

      if (missingColumns.length > 0) {
        validationErrors.push(
          `File Header Error: Missing required column(s): ${missingColumns.map((col) => `'${col}'`).join(", ")}`,
        );
        setImportErrors(validationErrors);
        setIsErrorModalOpen(true);
        toast.error(`Import failed: Missing ${missingColumns.length} required column(s).`);
        return;
      }

      // 2. Check for data rows
      const dataRowsWithIndex = rawSheet
        .slice(1)
        .map((row, idx) => ({ row, rowIndex: idx + 2 })) // Excel 1-based row number
        .filter(
          ({ row }) =>
            row &&
            row.some(
              (cell) => cell !== undefined && cell !== null && String(cell).trim() !== "",
            ),
        );

      if (dataRowsWithIndex.length === 0) {
        validationErrors.push("File Error: The uploaded file contains no data rows.");
        setImportErrors(validationErrors);
        setIsErrorModalOpen(true);
        toast.error("Import failed: No data rows found.");
        return;
      }

      // 3. Temporary buffer for atomic updates (All-or-Nothing)
      interface StagedRowUpdate {
        traineeId: string | number;
        scores: Record<string, number>;
      }
      const stagedUpdates: StagedRowUpdate[] = [];
      const seenStudentKeys = new Set<string>();

      for (const { row, rowIndex } of dataRowsWithIndex) {
        const rawStudent = row[headerIndexMap["Student"]];
        const rawEmail = row[headerIndexMap["Email"]];
        const studentName = String(rawStudent ?? "").trim();
        const email = String(rawEmail ?? "").trim();
        const studentDisplay = studentName || email || `Row ${rowIndex}`;

        if (!studentName && !email) {
          validationErrors.push(`Row ${rowIndex}: Student name and email cannot both be empty.`);
          continue;
        }

        // Student Matching against current class's Trainee List
        const matchedTrainee = localRows.find((trainee) => {
          const traineeEmail = trainee.email.trim().toLowerCase();
          const traineeName = trainee.fullName.trim().toLowerCase();
          const impEmail = email.toLowerCase();
          const impName = studentName.toLowerCase();
          if (impEmail && traineeEmail === impEmail) return true;
          if (impName && traineeName === impName) return true;
          return false;
        });

        if (!matchedTrainee) {
          validationErrors.push(
            `Row ${rowIndex} (${studentDisplay}): Student "${email || studentName}" does not exist in the current class's Trainee List.`,
          );
        }

        // Check for duplicate student rows in imported file
        const duplicateKey = matchedTrainee
          ? String(matchedTrainee.userId || matchedTrainee.id).toLowerCase()
          : (email || studentName).toLowerCase();

        if (seenStudentKeys.has(duplicateKey)) {
          validationErrors.push(
            `Row ${rowIndex} (${studentDisplay}): Duplicate student row found in the imported file.`,
          );
        } else {
          seenStudentKeys.add(duplicateKey);
        }

        // Score Value Validation for each assessment column
        const rowScores: Record<string, number> = {};
        const scoreSpecs = REQUIRED_IMPORT_COLUMNS.filter((col) => col.isScore);

        for (const spec of scoreSpecs) {
          const colIdx = headerIndexMap[spec.canonical];
          const rawVal = row[colIdx];
          const strVal = rawVal !== undefined && rawVal !== null ? String(rawVal).trim() : "";
          const isBlank = strVal === "" || strVal === "—" || strVal === "-";

          if (isBlank) {
            if (spec.requiredScore) {
              validationErrors.push(
                `Row ${rowIndex} (${studentDisplay}) - Column '${spec.canonical}': Score cannot be empty`,
              );
            } else {
              // Bonus defaults to 0 if blank
              rowScores[spec.field] = 0;
            }
            continue;
          }

          // Numeric check
          const num = Number(strVal);
          if (isNaN(num) || !Number.isFinite(num)) {
            validationErrors.push(
              `Row ${rowIndex} (${studentDisplay}) - Column '${spec.canonical}': Score '${strVal}' is not a valid number`,
            );
            continue;
          }

          // Range check (0 <= score <= 10)
          if (num < 0 || num > 10) {
            validationErrors.push(
              `Row ${rowIndex} (${studentDisplay}) - Column '${spec.canonical}': Score ${strVal} must be between 0 and 10`,
            );
            continue;
          }

          rowScores[spec.field] = Math.round(num * 100) / 100;
        }

        if (matchedTrainee) {
          stagedUpdates.push({
            traineeId: matchedTrainee.id,
            scores: rowScores,
          });
        }
      }

      // 4. All-or-Nothing Decision
      if (validationErrors.length > 0) {
        // 100% Rollback: keep existing table data untouched
        setImportErrors(validationErrors);
        setIsErrorModalOpen(true);
        toast.error(
          `Import rejected: Found ${validationErrors.length} validation error(s). No scores were updated.`,
        );
        return;
      }

      // 5. 100% Validated: Atomically apply updates to table state
      const updatesMap = new Map(stagedUpdates.map((u) => [u.traineeId, u.scores]));
      const nextModified = new Set(modifiedCells);

      setLocalRows((prevRows) =>
        prevRows.map((row) => {
          const updates = updatesMap.get(row.id);
          if (!updates) return row;

          const nextValues = { ...row.values, ...updates };
          for (const key of Object.keys(updates)) {
            nextModified.add(`${row.id}:${key}`);
          }

          const newFinal = calculateRowFinalScore(nextValues);
          const newIsPassed = isStudentPassed({ finalScore: newFinal, values: nextValues }, orderedColumns);
          const { hasZeroInMandatory } = evaluateStudentStatus({ finalScore: newFinal, values: nextValues }, orderedColumns);
          return {
            ...row,
            values: nextValues,
            finalScore: newFinal,
            isPassed: newIsPassed,
            hasZeroInMandatory,
          };
        }),
      );

      setModifiedCells(nextModified);
      toast.success(
        `Successfully validated and imported scores for ${stagedUpdates.length} trainee(s). Review and click "Save Changes" to persist.`,
      );
    } catch (err: any) {
      const msg = err.message || "Failed to parse file";
      setImportErrors([`File Parse Error: ${msg}`]);
      setIsErrorModalOpen(true);
      toast.error(`Import failed: ${msg}`);
    } finally {
      // Reset file input value after each attempt so user can re-upload immediately
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <MainLayout
      pathName={{
        "topic-marks": "Topic Marks",
        "gradebook-demo": "Topic Marks",
        ...(classCode ? { [classCode]: classCode } : {}),
      }}
    >
      <div className="space-y-4">
        {/* Top Header: Title + Trainees Badge + Back to Class Detail */}
        <header className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Topic Marks{classCode ? ` : ${classCode}` : ""}
            </h1>

            {/* Replaced duplicate [ClassCode] badge with total trainees badge */}
            <Badge
              variant="secondary"
              className="rounded-full bg-slate-100 px-3 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <Users className="mr-1 size-3.5" aria-hidden />
              {totalTrainees} {totalTrainees === 1 ? "Trainee" : "Trainees"}
            </Badge>

            {hasChanges ? (
              <Badge
                variant="secondary"
                className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
              >
                {modifiedCells.size} unsaved {modifiedCells.size === 1 ? "change" : "changes"}
              </Badge>
            ) : null}
          </div>

          {backToUrl ? (
            <Link
              to={backToUrl}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-blue-800 dark:hover:text-blue-300"
            >
              <ArrowLeft className="size-3.5" aria-hidden /> Back to Class Detail
            </Link>
          ) : null}
        </header>

        {/* Action Toolbar: Search on left, Actions on right */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search student or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-8 text-sm"
            />
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {hasChanges ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDiscard}
                  className="h-9 gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="size-3.5" />
                  <span>Discard</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveChanges}
                  className="h-9 gap-1.5 bg-[#283593] text-white hover:bg-[#1a237e] dark:bg-blue-600 dark:hover:bg-blue-500 shadow-xs"
                >
                  <Save className="size-3.5" />
                  <span>Save Changes</span>
                  <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-white/25 px-1 text-[10px] font-bold">
                    {modifiedCells.size}
                  </span>
                </Button>
              </>
            ) : null}

            {/* Export CSV/Excel */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="h-9 gap-1.5"
            >
              <Download className="size-3.5" />
              <span>Export Excel</span>
            </Button>

            {/* Import Scores */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-9 gap-1.5"
            >
              <Upload className="size-3.5" />
              <span>Import Scores</span>
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportFile}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />
          </div>
        </div>

        {/* Info banner */}
        <div className="flex items-center gap-2 rounded-lg border bg-blue-50/50 px-3.5 py-2 text-xs text-blue-900 dark:bg-blue-950/25 dark:text-blue-300">
          <Info className="size-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <span>
            Click on any score cell to edit. Final score and Passed/Failed status are calculated
            automatically in real-time.
          </span>
        </div>

        {/* Gradebook Table with Sticky Columns */}
        <section className="relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs">
          {isPending ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-6 w-48" />
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div className="p-6">
              <ApiErrorState
                error={error}
                resource="topic mark gradebook"
                onRetry={() => void refetch()}
              />
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Users className="mx-auto size-8 text-muted-foreground/60" />
              <p className="mt-2 text-sm font-medium">
                {searchQuery.trim()
                  ? "No students match your search query."
                  : "No trainees enrolled in this class."}
              </p>
            </div>
          ) : (
            <div className="max-h-[580px] overflow-auto">
              <Table className="border-collapse min-w-[1080px]">
                <TableHeader className="bg-muted/70">
                  <TableRow className="hover:bg-transparent">
                    {/* Sticky # column */}
                    <TableHead className="sticky left-0 top-0 z-30 w-12 min-w-[48px] max-w-[48px] border-r bg-muted text-center font-semibold text-foreground">
                      #
                    </TableHead>

                    {/* Sticky Student column */}
                    <TableHead className="sticky left-[48px] top-0 z-30 w-52 min-w-[210px] max-w-[250px] border-r bg-muted font-semibold text-foreground shadow-[2px_0_4px_-1px_rgba(0,0,0,0.08)]">
                      Student
                    </TableHead>

                    {/* Chronological assessment score columns */}
                    {orderedColumns.map((col) => (
                      <TableHead
                        key={col.key}
                        className="min-w-[95px] border-r px-2.5 text-center text-xs font-semibold text-foreground whitespace-nowrap"
                      >
                        {col.label}
                      </TableHead>
                    ))}

                    {/* Final Score column */}
                    <TableHead className="min-w-[105px] border-r px-3 text-center text-xs font-bold text-foreground whitespace-nowrap">
                      Final Score
                    </TableHead>

                    {/* Status (Passed/Failed) column */}
                    <TableHead className="min-w-[105px] px-3 text-center text-xs font-semibold text-foreground whitespace-nowrap">
                      Status
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredRows.map((row, index) => {
                    const hasRowModifications = orderedColumns.some((col) =>
                      modifiedCells.has(`${row.id}:${col.key}`),
                    );

                    return (
                      <TableRow
                        key={row.id}
                        className={cn(
                          "transition-colors",
                          hasRowModifications && "bg-amber-50/30 dark:bg-amber-950/15",
                        )}
                      >
                        {/* Sticky # Cell */}
                        <TableCell className="sticky left-0 z-20 w-12 min-w-[48px] max-w-[48px] border-r bg-card px-2 py-2.5 text-center text-xs font-medium text-muted-foreground">
                          {index + 1}
                        </TableCell>

                        {/* Sticky Student Cell */}
                        <TableCell className="sticky left-[48px] z-20 w-52 min-w-[210px] max-w-[250px] border-r bg-card px-3 py-2.5 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.08)]">
                          <div className="truncate text-sm font-semibold text-foreground">
                            {row.fullName || "—"}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {row.email || "—"}
                          </div>
                        </TableCell>

                        {/* Assessment score cells with inline edit */}
                        {orderedColumns.map((col) => {
                          const cellKey = `${row.id}:${col.key}`;
                          const isCellEditing =
                            editingCell?.rowId === row.id && editingCell?.columnKey === col.key;
                          const isCellModified = modifiedCells.has(cellKey);
                          const scoreVal = row.values[col.key];

                          const normColKey = (col.key || "").toLowerCase().replace(/[^a-z0-9]/g, "");
                          const normColLabel = (col.label || "").toLowerCase().replace(/[^a-z0-9]/g, "");
                          const isFinalExamCol =
                            (normColKey === "final" || normColLabel === "final") &&
                            !normColKey.includes("finalscore") &&
                            !normColLabel.includes("finalscore");

                          const isMandatory = isMandatoryScoreColumn(col.key, col.label);
                          const isZeroMandatoryScore =
                            isMandatory && scoreVal != null && Number(scoreVal) === 0;
                          const isFinalBelowFloor =
                            isFinalExamCol && scoreVal != null && Number(scoreVal) < 4.0;
                          const isViolatingCell = isZeroMandatoryScore || isFinalBelowFloor;

                          return (
                            <TableCell
                              key={col.key}
                              onClick={() => {
                                if (!isCellEditing) {
                                  handleStartEdit(row.id, col.key, scoreVal);
                                }
                              }}
                              className={cn(
                                "group relative min-w-[95px] border-r px-2 py-2 text-center text-sm font-medium cursor-pointer select-none transition-colors",
                                isCellModified
                                  ? "bg-amber-100/70 text-amber-900 font-bold dark:bg-amber-950/60 dark:text-amber-200"
                                  : isViolatingCell
                                    ? "bg-red-50 hover:bg-red-100/70 dark:bg-red-950/30 dark:hover:bg-red-950/50"
                                    : "hover:bg-muted/60",
                              )}
                              title={
                                isZeroMandatoryScore
                                  ? "Disqualifying: 0.0 in mandatory assessment component"
                                  : isFinalBelowFloor
                                    ? `Disqualifying: Final exam score (${scoreVal}) is below minimum floor of 4.0`
                                    : "Click to edit score (0 - 10)"
                              }
                            >
                              {isCellEditing ? (
                                <Input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max="10"
                                  autoFocus
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={() => handleCommitEdit(row.id, col.key)}
                                  onKeyDown={(e) => handleKeyDown(e, row.id, col.key)}
                                  className="h-7 w-16 mx-auto px-1.5 text-center text-xs font-bold ring-2 ring-blue-600 dark:ring-blue-400"
                                />
                              ) : (
                                <div className="flex items-center justify-center gap-1">
                                  <span
                                    className={cn(
                                      isViolatingCell &&
                                        "text-red-600 font-bold dark:text-red-400",
                                    )}
                                  >
                                    {scoreVal != null ? scoreVal.toFixed(1) : "—"}
                                  </span>
                                  <Pencil className="size-2.5 opacity-0 text-muted-foreground transition-opacity group-hover:opacity-60" />
                                </div>
                              )}
                            </TableCell>
                          );
                        })}

                        {/* Auto-calculated Final Score */}
                        <TableCell className="min-w-[105px] border-r px-3 py-2.5 text-center text-sm font-bold">
                          {row.finalScore != null ? (
                            <span
                              className={cn(
                                isStudentPassed(row, orderedColumns)
                                  ? "text-blue-700 dark:text-blue-300"
                                  : "text-rose-600 dark:text-rose-400",
                              )}
                            >
                              {row.finalScore.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground font-normal">—</span>
                          )}
                        </TableCell>

                        {/* Auto-calculated Status Badge (via isStudentPassed & evaluateStudentStatus) */}
                        <TableCell className="min-w-[105px] px-3 py-2.5 text-center">
                          {row.finalScore != null ? (
                            isStudentPassed(row, orderedColumns) ? (
                              <Badge
                                variant="secondary"
                                className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300"
                              >
                                Passed
                              </Badge>
                            ) : (
                              (() => {
                                const evalRes = evaluateStudentStatus(row, orderedColumns);
                                const failReason =
                                  evalRes.hasZeroInMandatory
                                    ? "Failed due to zero score in mandatory component"
                                    : evalRes.isFinalBelowFloor
                                      ? "Failed due to Final Exam score < 4.0"
                                      : evalRes.reason || "Failed due to Final Score < 5.0";

                                return (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge
                                        variant="secondary"
                                        title={failReason}
                                        className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap bg-rose-100 text-rose-800 hover:bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300 cursor-help"
                                      >
                                        Failed
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {failReason}
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              })()
                            )
                          ) : (
                            <Badge
                              variant="outline"
                              className="rounded-full text-muted-foreground font-normal px-2.5 py-0.5 text-[11px]"
                            >
                              —
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        {/* Import Validation Errors Modal (All-or-Nothing Rollback) */}
        <Dialog open={isErrorModalOpen} onOpenChange={setIsErrorModalOpen}>
          <DialogContent className="max-h-[85vh] sm:max-w-2xl flex flex-col p-6">
            <DialogHeader className="gap-1.5 pb-3 border-b">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="size-5 shrink-0" />
                <DialogTitle className="text-lg font-bold text-destructive">
                  Import Validation Failed
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                Because score imports require <strong>All-or-Nothing (Transactional Rollback)</strong>, zero scores were updated to prevent corrupt or partial data. Existing table data remains 100% untouched.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 flex-1 overflow-hidden flex flex-col min-h-0">
              <div className="flex items-center justify-between rounded-lg bg-destructive/10 px-3.5 py-2 text-xs font-medium text-destructive dark:bg-destructive/15">
                <span>Validation errors detected in spreadsheet:</span>
                <Badge variant="destructive" className="font-mono text-xs">
                  {importErrors.length} Error{importErrors.length > 1 ? "s" : ""}
                </Badge>
              </div>

              <div
                tabIndex={0}
                role="region"
                aria-label="Validation error list"
                className="flex-1 max-h-[320px] overflow-y-auto space-y-2 rounded-lg border bg-muted/20 p-3"
              >
                {importErrors.map((errMsg, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 rounded-md border border-destructive/20 bg-background px-3 py-2 text-xs shadow-2xs dark:border-destructive/30 dark:bg-card"
                  >
                    <span className="shrink-0 font-mono text-[11px] font-semibold text-destructive/80">
                      #{idx + 1}
                    </span>
                    <span className="font-mono text-[12px] leading-relaxed text-destructive dark:text-red-400">
                      {errMsg}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter className="mt-2 pt-3 border-t flex flex-row items-center justify-between sm:justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyErrors}
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <Copy className="size-3.5" />
                <span>Copy Errors</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsErrorModalOpen(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
