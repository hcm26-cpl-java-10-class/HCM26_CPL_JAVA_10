import {
    AlertCircle,
    Check,
    ChevronDown,
    ChevronUp,
    Download,
    Upload,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { read, utils, writeFile } from "xlsx";
import { NativeSelect } from "@/components/common/NativeSelect";
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
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ExternalClass, Trainee } from "@/types";
import { autoFitWorksheetColumns } from "@/utils/trainee-import.utils";
import { normalizeTraineeStatus, resolveTraineeStatusBadge } from "./TraineeModal";

export interface TopicOption {
    code: string;
    name: string;
}

export const TOPIC_OPTIONS: TopicOption[] = [
    { code: "L1_AL_PSE", name: "Algorithm & Problem Solving" },
    { code: "L2_OOP_JAVA", name: "Object-Oriented Programming with Java" },
    { code: "L3_SPRING_BOOT", name: "Enterprise Application with Spring Boot" },
    { code: "L4_DATABASE", name: "Relational Database & SQL Optimization" },
];

export const TOPIC_GPA_PASS_THRESHOLD = 6.0;

export interface TopicComponentScores {
    quiz: number;
    assignment: number;
    practiceFinal: number;
    totalGpa: number;
}

type ClassTopicMarkStore = Record<string, Record<string, Record<number, TopicComponentScores>>>;

let classTopicMarkStore: ClassTopicMarkStore = {};

export function resetClassTopicMarkStoreForTest() {
    classTopicMarkStore = {};
}

export function calculateTopicGpa(quiz: number, assignment: number, practiceFinal: number): number {
    const raw = quiz * 0.2 + assignment * 0.3 + practiceFinal * 0.5;
    return Math.round(raw * 10) / 10;
}

/**
 * Generates an account handle from a trainee's Vietnamese full name and row index / Student ID
 * (e.g., "Vũ Mai Trang" -> "trangvm1", "Phan Phú Dũng" -> "dungpp2", "Hoàng Phương Bình" -> "binhhp1").
 */
export function resolveTraineeAccount(trainee: Trainee, rowIndex: number): string {
    const explicitAccount = (trainee as { account?: string }).account?.trim();
    if (explicitAccount && !/^[A-Z]{2}\d{6}$/i.test(explicitAccount)) {
        return explicitAccount.toLowerCase();
    }

    const fullName = (trainee.fullName ?? "").trim();
    if (fullName) {
        const normalized = fullName
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/gi, "d")
            .replace(/[^a-zA-Z0-9\s]/g, "")
            .trim()
            .toLowerCase();

        const parts = normalized.split(/\s+/).filter(Boolean);
        if (parts.length > 0) {
            const givenName = parts[parts.length - 1];
            const initials = parts
                .slice(0, -1)
                .map((word) => word[0] ?? "")
                .join("");
            return `${givenName}${initials}${rowIndex + 1}`;
        }
    }

    const email = (trainee.personalEmail ?? trainee.email ?? "").trim();
    if (email.includes("@")) {
        return email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    }

    return (trainee.fptAccount ?? trainee.code ?? `user${rowIndex + 1}`).toLowerCase();
}

const PRESET_SCORE_PROFILES: Array<{ quiz: number; assignment: number; practiceFinal: number }> = [
    { quiz: 8.5, assignment: 8.0, practiceFinal: 8.2 }, // GPA: 8.2
    { quiz: 5.0, assignment: 5.5, practiceFinal: 5.0 }, // GPA: 5.2 (< 6.0 Failure)
    { quiz: 7.5, assignment: 8.0, practiceFinal: 7.8 }, // GPA: 7.8
    { quiz: 9.0, assignment: 8.5, practiceFinal: 9.0 }, // GPA: 8.9
    { quiz: 7.0, assignment: 7.5, practiceFinal: 7.2 }, // GPA: 7.3
    { quiz: 4.5, assignment: 5.0, practiceFinal: 4.8 }, // GPA: 4.8 (< 6.0 Failure)
    { quiz: 8.0, assignment: 7.5, practiceFinal: 8.0 }, // GPA: 7.9
    { quiz: 6.5, assignment: 7.0, practiceFinal: 6.8 }, // GPA: 6.8
    { quiz: 8.5, assignment: 9.0, practiceFinal: 8.6 }, // GPA: 8.7
    { quiz: 5.5, assignment: 5.0, practiceFinal: 5.2 }, // GPA: 5.2 (< 6.0 Failure)
];

const TOPIC_SCORE_OFFSETS: Record<string, number> = {
    L1_AL_PSE: 0,
    L2_OOP_JAVA: 0.4,
    L3_SPRING_BOOT: -0.3,
    L4_DATABASE: 0.2,
};

function clampScore(value: number): number {
    return Math.round(Math.min(10, Math.max(0, value)) * 10) / 10;
}

function buildDefaultScoresForTrainee(index: number, topicCode: string): TopicComponentScores {
    const base = PRESET_SCORE_PROFILES[index % PRESET_SCORE_PROFILES.length];
    const offset = TOPIC_SCORE_OFFSETS[topicCode] ?? 0;
    const quiz = clampScore(base.quiz + offset);
    const assignment = clampScore(base.assignment + offset);
    const practiceFinal = clampScore(base.practiceFinal + offset);
    return {
        quiz,
        assignment,
        practiceFinal,
        totalGpa: calculateTopicGpa(quiz, assignment, practiceFinal),
    };
}

function ensureTopicScoresForClass(
    classKey: string,
    topicCode: string,
    trainees: Trainee[],
): Record<number, TopicComponentScores> {
    if (!classTopicMarkStore[classKey]) {
        classTopicMarkStore[classKey] = {};
    }
    if (!classTopicMarkStore[classKey][topicCode]) {
        classTopicMarkStore[classKey][topicCode] = {};
    }
    const existing = classTopicMarkStore[classKey][topicCode];
    const next: Record<number, TopicComponentScores> = { ...existing };

    trainees.forEach((trainee, index) => {
        if (!next[trainee.id]) {
            next[trainee.id] = buildDefaultScoresForTrainee(index, topicCode);
        }
    });

    classTopicMarkStore[classKey][topicCode] = next;
    return next;
}

const STICKY_HEADER_CELL_CLASS =
    "sticky top-0 z-20 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 shadow-[inset_0_-1px_0_#e2e8f0] dark:bg-slate-900 dark:text-slate-200 dark:shadow-[inset_0_-1px_0_#334155]";

export interface TraineeTopicMarkViewProps {
    classItem: ExternalClass;
    trainees: Trainee[];
    onBack: () => void;
}

export function TraineeTopicMarkView({ classItem, trainees, onBack }: TraineeTopicMarkViewProps) {
    const classKey = String(classItem.id ?? classItem.code ?? "default");
    const classCodeLabel = (classItem.code || classItem.name || classKey).trim();

    const [selectedTopicCode, setSelectedTopicCode] = useState<string>(TOPIC_OPTIONS[0].code);
    const [scoresByTraineeId, setScoresByTraineeId] = useState<Record<number, TopicComponentScores>>(() =>
        ensureTopicScoresForClass(classKey, TOPIC_OPTIONS[0].code, trainees),
    );
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
    const [importErrors, setImportErrors] = useState<string[]>([]);
    const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const synced = ensureTopicScoresForClass(classKey, selectedTopicCode, trainees);
        setScoresByTraineeId({ ...synced });
    }, [classKey, selectedTopicCode, trainees]);

    const rows = useMemo(() => {
        return trainees.map((trainee, index) => {
            const scores =
                scoresByTraineeId[trainee.id] ??
                buildDefaultScoresForTrainee(index, selectedTopicCode);
            const account = resolveTraineeAccount(trainee, index);
            const email = (trainee.personalEmail ?? trainee.email ?? "").trim();
            const status = normalizeTraineeStatus(trainee.status);
            const isFailed = scores.totalGpa < TOPIC_GPA_PASS_THRESHOLD;

            return {
                no: index + 1,
                trainee,
                account,
                email,
                status,
                scores,
                isFailed,
            };
        });
    }, [trainees, scoresByTraineeId, selectedTopicCode]);

    const handleTopicChange = (nextTopic: string) => {
        setSelectedTopicCode(nextTopic);
        const loaded = ensureTopicScoresForClass(classKey, nextTopic, trainees);
        setScoresByTraineeId({ ...loaded });
    };

    const toggleExpandDetail = (traineeId: number) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(traineeId)) {
                next.delete(traineeId);
            } else {
                next.add(traineeId);
            }
            return next;
        });
    };

    const handleDownloadTemplate = () => {
        const headers = [
            "No",
            "Full Name",
            "Personal Email",
            "Account",
            "Topic Code",
            "Quiz",
            "Assignment",
            "Practice / Final",
            "Total Topic GPA",
        ];
        const dataRows = rows.map((row) => [
            row.no,
            row.trainee.fullName,
            row.email,
            row.account,
            selectedTopicCode,
            row.scores.quiz,
            row.scores.assignment,
            row.scores.practiceFinal,
            row.scores.totalGpa,
        ]);

        const worksheet = autoFitWorksheetColumns(utils.aoa_to_sheet([headers, ...dataRows]), {
            No: 6,
            "Full Name": 25,
            "Personal Email": 30,
            Account: 16,
            "Topic Code": 16,
            Quiz: 12,
            Assignment: 14,
            "Practice / Final": 18,
            "Total Topic GPA": 16,
        });
        const workbook = utils.book_new();
        utils.book_append_sheet(workbook, worksheet, "Topic Mark Template");
        writeFile(workbook, `${classCodeLabel}_${selectedTopicCode}_Mark_Template.xlsx`);
        toast.success(`Downloaded Topic Mark template for ${selectedTopicCode}.`);
    };

    const handleExportMark = () => {
        const headers = [
            "No",
            "Full Name",
            "Personal Email",
            "Account",
            "Status",
            "Topic Code",
            "Quiz (20%)",
            "Assignment (30%)",
            "Practice / Final (50%)",
            "Total Topic GPA",
            "Evaluation",
        ];
        const dataRows = rows.map((row) => [
            row.no,
            row.trainee.fullName,
            row.email,
            row.account,
            row.status,
            selectedTopicCode,
            row.scores.quiz.toFixed(1),
            row.scores.assignment.toFixed(1),
            row.scores.practiceFinal.toFixed(1),
            row.scores.totalGpa.toFixed(1),
            row.isFailed ? "Topic GPA Failure (< 6.0)" : "Passed",
        ]);

        const worksheet = autoFitWorksheetColumns(utils.aoa_to_sheet([headers, ...dataRows]), {
            No: 6,
            "Full Name": 25,
            "Personal Email": 30,
            Account: 16,
            Status: 12,
            "Topic Code": 16,
            "Quiz (20%)": 14,
            "Assignment (30%)": 16,
            "Practice / Final (50%)": 20,
            "Total Topic GPA": 16,
            Evaluation: 24,
        });
        const workbook = utils.book_new();
        utils.book_append_sheet(workbook, worksheet, "Topic Marks");
        writeFile(workbook, `${classCodeLabel}_${selectedTopicCode}_Topic_Marks.xlsx`);
        toast.success(`Exported ${rows.length} topic mark records for ${selectedTopicCode}.`);
    };

    const handleImportMarkFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const buffer = await file.arrayBuffer();
            const workbook = read(buffer, { type: "array" });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = firstSheetName ? workbook.Sheets[firstSheetName] : undefined;

            if (!worksheet) {
                setImportErrors(["The uploaded Excel file contains no readable worksheet."]);
                setIsErrorModalOpen(true);
                return;
            }

            const rawMatrix = utils.sheet_to_json<unknown[]>(worksheet, {
                header: 1,
                defval: "",
                blankrows: false,
            });

            if (rawMatrix.length < 2) {
                setImportErrors(["The uploaded file contains no trainee mark rows to import."]);
                setIsErrorModalOpen(true);
                return;
            }

            const headerRow = (rawMatrix[0] ?? []).map((cell) =>
                String(cell ?? "")
                    .trim()
                    .toLowerCase(),
            );

            const findColIdx = (candidates: string[]) =>
                headerRow.findIndex((h) => candidates.some((c) => h === c || h.includes(c)));

            const nameIdx = findColIdx(["full name", "fullname", "student", "trainee"]);
            const emailIdx = findColIdx(["personal email", "email"]);
            const accountIdx = findColIdx(["account", "fpt account"]);
            const quizIdx = findColIdx(["quiz"]);
            const assignmentIdx = findColIdx(["assignment"]);
            const practiceIdx = findColIdx(["practice", "final"]);
            const gpaIdx = findColIdx(["total topic gpa", "topic gpa", "gpa"]);

            if (quizIdx === -1 && assignmentIdx === -1 && practiceIdx === -1 && gpaIdx === -1) {
                setImportErrors([
                    "Missing score columns. Expected 'Quiz', 'Assignment', 'Practice / Final', or 'Total Topic GPA'.",
                ]);
                setIsErrorModalOpen(true);
                return;
            }

            const errors: string[] = [];
            const stagedUpdates: Record<number, TopicComponentScores> = {
                ...scoresByTraineeId,
            };

            const parseScoreCell = (
                rawVal: unknown,
                colLabel: string,
                excelRowNumber: number,
                traineeLabel: string,
            ): number | null => {
                const str = String(rawVal ?? "").trim();
                if (!str) {
                    errors.push(
                        `Row ${excelRowNumber} (${traineeLabel}) — Column '${colLabel}': Score cannot be empty.`,
                    );
                    return null;
                }
                const num = Number(str);
                if (Number.isNaN(num)) {
                    errors.push(
                        `Row ${excelRowNumber} (${traineeLabel}) — Column '${colLabel}': Score '${str}' is not a valid number.`,
                    );
                    return null;
                }
                if (num < 0 || num > 10) {
                    errors.push(
                        `Row ${excelRowNumber} (${traineeLabel}) — Column '${colLabel}': Score ${num} must be between 0 and 10.`,
                    );
                    return null;
                }
                return Math.round(num * 10) / 10;
            };

            for (let i = 1; i < rawMatrix.length; i++) {
                const rowCells = rawMatrix[i] ?? [];
                const excelRowNum = i + 1;
                const rawName = nameIdx >= 0 ? String(rowCells[nameIdx] ?? "").trim() : "";
                const rawEmail = emailIdx >= 0 ? String(rowCells[emailIdx] ?? "").trim().toLowerCase() : "";
                const rawAccount = accountIdx >= 0 ? String(rowCells[accountIdx] ?? "").trim().toLowerCase() : "";

                if (!rawName && !rawEmail && !rawAccount) continue;

                const matchedRow = rows.find(
                    (r) =>
                        (rawEmail && r.email.toLowerCase() === rawEmail) ||
                        (rawAccount && r.account.toLowerCase() === rawAccount) ||
                        (rawName && (r.trainee.fullName ?? "").trim().toLowerCase() === rawName.toLowerCase()),
                );

                const label = rawName || rawEmail || rawAccount || `Row ${excelRowNum}`;
                if (!matchedRow) {
                    errors.push(
                        `Row ${excelRowNum} (${label}): Trainee does not exist in the current class's Trainee List.`,
                    );
                    continue;
                }

                const existingScores = stagedUpdates[matchedRow.trainee.id] ?? matchedRow.scores;
                let quiz = existingScores.quiz;
                let assignment = existingScores.assignment;
                let practiceFinal = existingScores.practiceFinal;
                let rowValid = true;

                if (quizIdx >= 0 && assignmentIdx >= 0 && practiceIdx >= 0) {
                    const qVal = parseScoreCell(rowCells[quizIdx], "Quiz", excelRowNum, label);
                    const aVal = parseScoreCell(rowCells[assignmentIdx], "Assignment", excelRowNum, label);
                    const pVal = parseScoreCell(
                        rowCells[practiceIdx],
                        "Practice / Final",
                        excelRowNum,
                        label,
                    );
                    if (qVal === null || aVal === null || pVal === null) {
                        rowValid = false;
                    } else {
                        quiz = qVal;
                        assignment = aVal;
                        practiceFinal = pVal;
                    }
                } else if (gpaIdx >= 0) {
                    const gVal = parseScoreCell(rowCells[gpaIdx], "Total Topic GPA", excelRowNum, label);
                    if (gVal === null) {
                        rowValid = false;
                    } else {
                        quiz = gVal;
                        assignment = gVal;
                        practiceFinal = gVal;
                    }
                }

                if (rowValid) {
                    stagedUpdates[matchedRow.trainee.id] = {
                        quiz,
                        assignment,
                        practiceFinal,
                        totalGpa: calculateTopicGpa(quiz, assignment, practiceFinal),
                    };
                }
            }

            if (errors.length > 0) {
                setImportErrors(errors);
                setIsErrorModalOpen(true);
                return;
            }

            if (!classTopicMarkStore[classKey]) {
                classTopicMarkStore[classKey] = {};
            }
            classTopicMarkStore[classKey][selectedTopicCode] = stagedUpdates;
            setScoresByTraineeId({ ...stagedUpdates });
            toast.success(`Successfully imported Topic Marks for ${selectedTopicCode}.`);
        } catch {
            setImportErrors(["Failed to parse the Excel file. Please use the provided template."]);
            setIsErrorModalOpen(true);
        } finally {
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    return (
        <div
            data-testid="topic-mark-view"
            className="flex flex-1 min-h-0 flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-950"
        >
            <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                aria-label="Import Mark File"
                className="hidden"
                onChange={handleImportMarkFile}
            />

            {/* 1. Top Header Bar */}
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    Topic Mark {classCodeLabel}
                </h2>

                <div className="flex flex-wrap items-center gap-5">
                    <button
                        type="button"
                        onClick={handleDownloadTemplate}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 transition-colors hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                    >
                        <Download className="size-3.5" aria-hidden />
                        Download Template
                    </button>
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 transition-colors hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                    >
                        <Upload className="size-3.5" aria-hidden />
                        Import Mark
                    </button>
                    <button
                        type="button"
                        onClick={handleExportMark}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 transition-colors hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                    >
                        <Download className="size-3.5" aria-hidden />
                        Export Mark
                    </button>
                </div>
            </div>

            {/* 2. Sub-header Bar: Topic Code Selector (Left) & Topic GPA Failure Legend (Right) */}
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 py-1">
                <div className="flex items-center gap-3">
                    <label
                        htmlFor="topic-code-select"
                        className="text-sm font-medium text-slate-700 dark:text-slate-300"
                    >
                        Topic Code
                    </label>
                    <div className="w-48">
                        <NativeSelect
                            id="topic-code-select"
                            aria-label="Topic Code"
                            value={selectedTopicCode}
                            onChange={(e) => handleTopicChange(e.target.value)}
                            className="h-9 font-medium"
                        >
                            {TOPIC_OPTIONS.map((topic) => (
                                <option key={topic.code} value={topic.code}>
                                    {topic.code}
                                </option>
                            ))}
                        </NativeSelect>
                    </div>
                </div>

                <div
                    className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400"
                    title={`Trainees with Total Topic GPA below ${TOPIC_GPA_PASS_THRESHOLD.toFixed(1)} are highlighted`}
                >
                    <span
                        aria-hidden
                        className="inline-block size-4 rounded-[3px] border border-red-200 bg-red-100 dark:border-red-800 dark:bg-red-950/70"
                    />
                    <span>Topic GPA Failure</span>
                </div>
            </div>

            {/* 3. Full-Width Sticky Header Table (No Horizontal Scrollbar) */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden rounded-lg border border-slate-200 bg-white fams-scrollbar dark:border-slate-800 dark:bg-slate-950">
                <table
                    aria-label="Topic Mark Table"
                    className="w-full table-fixed caption-bottom text-sm border-collapse"
                >
                    <TableHeader>
                        <TableRow className="border-b border-slate-200 hover:bg-transparent dark:border-slate-800">
                            <TableHead className={cn(STICKY_HEADER_CELL_CLASS, "w-[6%] text-center")}>
                                No
                            </TableHead>
                            <TableHead className={cn(STICKY_HEADER_CELL_CLASS, "w-[20%] text-left")}>
                                Full Name
                            </TableHead>
                            <TableHead className={cn(STICKY_HEADER_CELL_CLASS, "w-[24%] text-left")}>
                                Personal Email
                            </TableHead>
                            <TableHead className={cn(STICKY_HEADER_CELL_CLASS, "w-[13%] text-left")}>
                                Account
                            </TableHead>
                            <TableHead className={cn(STICKY_HEADER_CELL_CLASS, "w-[11%] text-center")}>
                                Status
                            </TableHead>
                            <TableHead className={cn(STICKY_HEADER_CELL_CLASS, "w-[15%] text-center")}>
                                Total Topic GPA
                            </TableHead>
                            <TableHead className={cn(STICKY_HEADER_CELL_CLASS, "w-[11%] text-center")}>
                                Action
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={7}
                                    className="h-32 text-center text-sm text-muted-foreground"
                                >
                                    No trainees enrolled in this class yet.
                                </TableCell>
                            </TableRow>
                        ) : (
                            rows.map((row) => {
                                const isExpanded = expandedIds.has(row.trainee.id);
                                const statusBadge = resolveTraineeStatusBadge(row.status);

                                return (
                                    <Fragment key={row.trainee.id}>
                                        <TableRow
                                            className={cn(
                                                "border-b border-slate-100 transition-colors hover:bg-slate-50/80 dark:border-slate-800/70 dark:hover:bg-slate-900/40",
                                                row.isFailed && "bg-red-50/40 hover:bg-red-50/70 dark:bg-red-950/20",
                                            )}
                                        >
                                            <TableCell className="px-3 py-2.5 text-center text-sm text-slate-700 dark:text-slate-300">
                                                {row.no}
                                            </TableCell>
                                            <TableCell className="px-3 py-2.5 text-left">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleExpandDetail(row.trainee.id)}
                                                    className="truncate text-left text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer dark:text-blue-400"
                                                    title="Click to toggle component score details"
                                                >
                                                    {row.trainee.fullName}
                                                </button>
                                            </TableCell>
                                            <TableCell
                                                className="truncate px-3 py-2.5 text-left text-sm font-normal text-gray-800 dark:text-slate-200"
                                                title={row.email}
                                            >
                                                {row.email || "—"}
                                            </TableCell>
                                            <TableCell className="truncate px-3 py-2.5 text-left text-sm font-normal text-gray-800 dark:text-slate-200">
                                                {row.account}
                                            </TableCell>
                                            <TableCell className="px-3 py-2.5 text-center">
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "rounded-full px-2.5 py-0.5 text-xs font-medium",
                                                        statusBadge.className,
                                                    )}
                                                >
                                                    {statusBadge.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell
                                                data-testid={`gpa-cell-${row.trainee.id}`}
                                                className={cn(
                                                    "px-3 py-2.5 text-center text-sm",
                                                    row.isFailed
                                                        ? "bg-red-50 text-red-700 font-semibold dark:bg-red-950/50 dark:text-red-300"
                                                        : "font-medium text-slate-800 dark:text-slate-200",
                                                )}
                                            >
                                                <span>{row.scores.totalGpa.toFixed(1)}</span>
                                            </TableCell>
                                            <TableCell className="px-3 py-2.5 text-center">
                                                <button
                                                    type="button"
                                                    aria-expanded={isExpanded}
                                                    aria-label={`Detail for ${row.trainee.fullName}`}
                                                    onClick={() => toggleExpandDetail(row.trainee.id)}
                                                    className="inline-flex items-center justify-center gap-1 text-xs font-medium text-blue-600 transition-colors hover:text-blue-800 cursor-pointer dark:text-blue-400"
                                                >
                                                    <span>Detail</span>
                                                    {isExpanded ? (
                                                        <ChevronUp className="size-3.5" aria-hidden />
                                                    ) : (
                                                        <ChevronDown className="size-3.5" aria-hidden />
                                                    )}
                                                </button>
                                            </TableCell>
                                        </TableRow>

                                        {isExpanded && (
                                            <TableRow
                                                data-testid={`detail-row-${row.trainee.id}`}
                                                className="border-b border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/50"
                                            >
                                                <TableCell colSpan={7} className="px-6 py-3">
                                                    <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
                                                        <div className="font-semibold text-slate-700 dark:text-slate-300">
                                                            Component Assessment Scores ({selectedTopicCode}) —{" "}
                                                            <span className="text-blue-600 dark:text-blue-400">
                                                                {row.trainee.fullName}
                                                            </span>
                                                        </div>

                                                        <div className="flex flex-wrap items-center gap-6">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-slate-600 dark:text-slate-400">
                                                                    Quiz (20%):
                                                                </span>
                                                                <span className="font-semibold text-slate-900 dark:text-slate-100">
                                                                    {row.scores.quiz.toFixed(1)}
                                                                </span>
                                                            </div>

                                                            <div className="flex items-center gap-2">
                                                                <span className="text-slate-600 dark:text-slate-400">
                                                                    Assignment (30%):
                                                                </span>
                                                                <span className="font-semibold text-slate-900 dark:text-slate-100">
                                                                    {row.scores.assignment.toFixed(1)}
                                                                </span>
                                                            </div>

                                                            <div className="flex items-center gap-2">
                                                                <span className="text-slate-600 dark:text-slate-400">
                                                                    Practice / Final (50%):
                                                                </span>
                                                                <span className="font-semibold text-slate-900 dark:text-slate-100">
                                                                    {row.scores.practiceFinal.toFixed(1)}
                                                                </span>
                                                            </div>

                                                            <div className="flex items-center gap-1.5 border-l border-slate-200 pl-4 dark:border-slate-700">
                                                                <span className="text-slate-500">Calculated GPA:</span>
                                                                <span
                                                                    className={cn(
                                                                        "rounded px-1.5 py-0.5 font-bold",
                                                                        row.isFailed
                                                                            ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                                                                            : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
                                                                    )}
                                                                >
                                                                    {row.scores.totalGpa.toFixed(1)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </Fragment>
                                );
                            })
                        )}
                    </TableBody>
                </table>
            </div>

            {/* 4. Footer Controls: Back to Trainee List (Bottom-Left) */}
            <div className="flex shrink-0 items-center justify-start pt-2">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onBack}
                    className="h-9 rounded-md border-slate-300 px-4 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200"
                >
                    Back to Trainee List
                </Button>
            </div>

            {/* All-or-Nothing Import Validation Error Modal */}
            <Dialog open={isErrorModalOpen} onOpenChange={setIsErrorModalOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertCircle className="size-5" aria-hidden />
                            Import Validation Failed
                        </DialogTitle>
                        <DialogDescription>
                            All-or-Nothing validation rejected the file because one or more rows contained invalid data.
                            No marks were modified.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-60 overflow-y-auto rounded-md border border-red-200 bg-red-50/60 p-3 text-xs text-red-800 space-y-1.5">
                        {importErrors.map((err, idx) => (
                            <div key={idx} className="flex items-start gap-1.5">
                                <span className="font-bold">•</span>
                                <span>{err}</span>
                            </div>
                        ))}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsErrorModalOpen(false)}>
                            <Check className="mr-1.5 size-3.5" aria-hidden />
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
export default TraineeTopicMarkView;

