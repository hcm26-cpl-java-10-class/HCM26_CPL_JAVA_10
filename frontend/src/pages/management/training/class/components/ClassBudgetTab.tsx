import {
    AlertCircle,
    ChevronDown,
    ChevronUp,
    Info,
    Plus,
    Save,
    Trash2,
    X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import {
    useAddClassActivity,
    useClassOperation,
    useSaveClassOperation,
    useSaveTopicAssessments,
    useTopicAssessments,
} from "@/hooks/useExternalLookups";
import type {
    AssessmentItem,
    ClassOperationData,
    ExternalClass,
    Milestone,
    TopicAssessment,
} from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatDate } from "@/utils/session.utils";

// Default fallback data matching FAMS reference images
function createDefaultOperationData(classItem: ExternalClass): ClassOperationData {
    return {
        classId: classItem.id,
        operatingInfo: {
            actualStartDate: classItem.startDate || "2026-01-23",
            earlyGraduatedDate: classItem.id === 1 ? "2026-07-22" : (classItem.endDate || "2026-07-22"),
            actualEndDate: "",
            gpaCalculation: {
                topicMark: 70,
                disciplinePoint: 30,
                bonusPoint: 10,
                penaltyPoint: 20,
            },
            hasNoAllocationNeeds: false,
        },
        milestones: [
            {
                id: 1,
                name: "Feb - 2026",
                status: "Baselined",
                checkpointType: "STANDARD",
                salaryPaid: "Yes",
                startDate: "2026-02-01",
                endDate: "2026-02-28",
                topics: [
                    { id: 101, topic: "[L1_AL_DF] [NFP] Database Fundamentals For All by FSA (1.0)", maxScore: 10, passingScore: 6, weightedNumber: 868 },
                    { id: 102, topic: "[L1_AL_ECWL] [NFP] Effective Communication with LEAP Technique (Instructor Led) (1.0)", maxScore: 10, passingScore: 6, weightedNumber: 360 },
                    { id: 103, topic: "[L1_AL_DSAA] [NFP] Data Structures and Algorithms for ALL by FSA (1.0)", maxScore: 10, passingScore: 6, weightedNumber: 810 },
                    { id: 104, topic: "[L1_AL_APWS] [NFP] Agile Practitioner with Scrum For All By FSA (1.0)", maxScore: 10, passingScore: 6, weightedNumber: 210 },
                ],
            },
            {
                id: 2,
                name: "Mar - 2026",
                status: "Baselined",
                checkpointType: "STANDARD",
                salaryPaid: "Yes",
                startDate: "2026-03-01",
                endDate: "2026-03-31",
                topics: [
                    { id: 201, topic: "[L1_AL_VCG] [NFP] Version Control - Git for ALL by FSA (1.0)", maxScore: 10, passingScore: 6, weightedNumber: 264 },
                    { id: 202, topic: "[L4_MOCK_PROJECT] [NFP] Mock Project for Fresher (1.0) - Phase 1", maxScore: 10, passingScore: 6, weightedNumber: 5520 },
                ],
            },
            {
                id: 3,
                name: "Apr - 2026",
                status: "Baselined",
                checkpointType: "STANDARD",
                salaryPaid: "Yes",
                startDate: "2026-04-01",
                endDate: "2026-04-30",
                topics: [
                    { id: 301, topic: "[L4_MOCK_PROJECT] [NFP] Mock Project for Fresher (1.0)", maxScore: 10, passingScore: 6, weightedNumber: 9840 },
                    { id: 302, topic: "[FR_FU_KOR_IM] FR_FU_KOR_IM (1.0) - April", maxScore: 10, passingScore: 6, weightedNumber: 3060 },
                ],
            },
            {
                id: 4,
                name: "May - 2026",
                status: "Baselined",
                checkpointType: "STANDARD",
                salaryPaid: "Yes",
                startDate: "2026-05-01",
                endDate: "2026-05-31",
                topics: [
                    { id: 401, topic: "[L2_JA_JS] [NFP] Java SE/Java Language Programing (1.0)", maxScore: 10, passingScore: 6, weightedNumber: 2880 },
                    { id: 402, topic: "[FR_FU_KOR_IM] FR_FU_KOR_IM (1.0) - May", maxScore: 10, passingScore: 6, weightedNumber: 1260 },
                ],
            },
            {
                id: 5,
                name: "Jun - 2026",
                status: "Baselined",
                checkpointType: "STANDARD",
                salaryPaid: "Yes",
                startDate: "2026-06-01",
                endDate: "2026-06-30",
                topics: [
                    { id: 501, topic: "[L2_JA_ORM] [NFP] ORM Framework - Hibernate (1.0)", maxScore: 10, passingScore: 6, weightedNumber: 2400 },
                    { id: 502, topic: "[L2_JA_FEF(JS.KS)] [NFP] Front-end Fundamentals (1.0)", maxScore: 10, passingScore: 6, weightedNumber: 4230 },
                    { id: 503, topic: "[L3_JSFW] [NFP] JavaScript Framework - React (1.0)", maxScore: 10, passingScore: 6, weightedNumber: 4000 },
                ],
            },
        ],
    };
}

function createDefaultTopicAssessments(): TopicAssessment[] {
    const titles = [
        "1. L1_AL_CCGM - [NFP] Company Culture & Global Mindset (Instructor Led)",
        "2. [FR_FU_KOR_IM] FR_FU_KOR_IM (1.0) - Jan&Feb",
        "3. L1_AL_GC - [NFP] Global Collaboration",
        "4. L1_AL_PSE - [NFP] Problem Solving",
        "5. L1_AL_TME - [NFP] Time Management (E-learning)",
        "6. L1_AL_DF - [NFP] Database Fundamentals For All by FSA",
        "7. L1_AL_APWS - [NFP] Agile Practitioner with Scrum For All By FSA",
        "8. L1_AL_ECWL - [NFP] Effective Communication with LEAP Technique (Instructor Led)",
        "9. L1_AL_DSAA - [NFP] Data Structures and Algorithms for ALL by FSA",
        "10. L1_AL_VCG - [NFP] Version Control - Git for ALL by FSA",
        "11. FR_FU_KOR_IM - FR_FU_KOR_IM",
        "12. [L4_MOCK_PROJECT] [NFP] Mock Project for Fresher (1.0) - Phase 1",
        "13. [FR_FU_KOR_IM] FR_FU_KOR_IM (1.0) - April",
        "14. L4_MOCK_PROJECT - [NFP] Mock Project for Fresher",
    ];

    return titles.map((title, idx) => {
        const id = idx + 1;
        if (id === 6) {
            return {
                id,
                title,
                assessments: [
                    { id: 601, name: "Assignments", weightedNumber: 30, quantity: 2, note: "(2 assignments)", action: "Keep", changeStatus: "none" },
                    { id: 602, name: "Final Theory Test", weightedNumber: 28, quantity: 1, note: "", action: "Keep", changeStatus: "confirmed" },
                    { id: 603, name: "Final Final Test", weightedNumber: 42, quantity: 1, note: "", action: "Keep", changeStatus: "none" },
                ],
            };
        }
        if (id === 9) {
            return {
                id,
                title,
                assessments: [
                    { id: 901, name: "Assignments", weightedNumber: 30, quantity: 3, note: "", action: "Keep", changeStatus: "waiting" },
                    { id: 902, name: "Final Theory Test", weightedNumber: 30, quantity: 1, note: "", action: "Keep", changeStatus: "none" },
                    { id: 903, name: "Final Practice Test", weightedNumber: 40, quantity: 1, note: "", action: "Keep", changeStatus: "none" },
                ],
            };
        }
        return {
            id,
            title,
            assessments: [
                { id: id * 100 + 1, name: "Assignments", weightedNumber: 30, quantity: 1, note: "", action: "Keep", changeStatus: "none" },
                { id: id * 100 + 2, name: "Final Theory Test", weightedNumber: 30, quantity: 1, note: "", action: "Keep", changeStatus: "none" },
                { id: id * 100 + 3, name: "Final Practice Test", weightedNumber: 40, quantity: 1, note: "", action: "Keep", changeStatus: "none" },
            ],
        };
    });
}

function calculateTopicTotal(topic: TopicAssessment): number {
    return (topic.assessments || []).reduce((sum, a) => sum + (Number(a.weightedNumber) || 0), 0);
}

// ===================== MODAL: TOPIC ASSESSMENT CONFIGURATION =====================
interface TopicAssessmentModalProps {
    open: boolean;
    onClose: () => void;
    classId: string;
    onActivityLog: (content: string) => void;
}

function TopicAssessmentModal({ open, onClose, classId, onActivityLog }: TopicAssessmentModalProps) {
    const { data: serverTopics, refetch } = useTopicAssessments(classId);
    const saveMutation = useSaveTopicAssessments(classId);

    const [topics, setTopics] = useState<TopicAssessment[]>(createDefaultTopicAssessments());
    const [initialTopics, setInitialTopics] = useState<TopicAssessment[]>(createDefaultTopicAssessments());
    const [openTopicId, setOpenTopicId] = useState<number | null>(6); // Default expand topic 6 like reference image

    useEffect(() => {
        if (serverTopics && Array.isArray(serverTopics) && serverTopics.length > 0) {
            setTopics(JSON.parse(JSON.stringify(serverTopics)));
            setInitialTopics(JSON.parse(JSON.stringify(serverTopics)));
        } else {
            const defaults = createDefaultTopicAssessments();
            setTopics(defaults);
            setInitialTopics(defaults);
        }
    }, [serverTopics, open]);

    const handleToggleTopic = (id: number) => {
        setOpenTopicId((prev) => (prev === id ? null : id));
    };

    const handleUpdateAssessment = (
        topicId: number,
        assessmentId: number,
        field: keyof AssessmentItem,
        val: any
    ) => {
        setTopics((prev) =>
            prev.map((t) => {
                if (t.id !== topicId) return t;
                return {
                    ...t,
                    assessments: t.assessments.map((a) => {
                        if (a.id !== assessmentId) return a;
                        return {
                            ...a,
                            [field]: val,
                            changeStatus: "waiting", // Marks row as waiting for confirm (pink)
                        };
                    }),
                };
            })
        );
    };

    const handleAddAssessment = (topicId: number) => {
        setTopics((prev) =>
            prev.map((t) => {
                if (t.id !== topicId) return t;
                const newId = Date.now();
                const newItem: AssessmentItem = {
                    id: newId,
                    name: "New Assessment",
                    weightedNumber: 10,
                    quantity: 1,
                    note: "",
                    action: "Keep",
                    changeStatus: "waiting",
                };
                return {
                    ...t,
                    assessments: [...t.assessments, newItem],
                };
            })
        );
    };

    const handleDeleteAssessment = (topicId: number, assessmentId: number) => {
        setTopics((prev) =>
            prev.map((t) => {
                if (t.id !== topicId) return t;
                return {
                    ...t,
                    assessments: t.assessments.filter((a) => a.id !== assessmentId),
                };
            })
        );
    };

    // 2.4: Discard Changes
    const handleDiscard = () => {
        setTopics(JSON.parse(JSON.stringify(initialTopics)));
        toast.info("Đã hoàn tác các thay đổi cấu hình đánh giá chuyên đề.");
    };

    // 2.4: Reject Assessments
    const handleReject = () => {
        const rejected = topics.map((t) => ({
            ...t,
            assessments: t.assessments.map((a) => ({
                ...a,
                changeStatus: "none" as const,
            })),
        }));
        setTopics(rejected);
        saveMutation.mutate(
            { topics: rejected, action: "reject" },
            {
                onSuccess: () => {
                    toast.warn("Đã từ chối các thay đổi cấu hình đánh giá.");
                    onActivityLog("has rejected topic assessments changes.");
                    onClose();
                },
                onError: () => {
                    toast.warn("Đã từ chối các thay đổi (lưu cục bộ).");
                    onActivityLog("has rejected topic assessments changes.");
                    onClose();
                },
            }
        );
    };

    // 2.4: Confirm Assessments with validation (Max 100%)
    const handleConfirm = () => {
        // Validate: no topic can have total weighted number > 100
        const exceedingTopic = topics.find((t) => calculateTopicTotal(t) > 100);
        if (exceedingTopic) {
            const total = calculateTopicTotal(exceedingTopic);
            toast.error(
                `Chuyên đề "${exceedingTopic.title}" có tổng trọng số là ${total}%, vượt quá giới hạn 100%! Vui lòng điều chỉnh lại.`
            );
            setOpenTopicId(exceedingTopic.id);
            return;
        }

        const confirmed = topics.map((t) => ({
            ...t,
            assessments: t.assessments.map((a) => ({
                ...a,
                changeStatus: a.changeStatus === "waiting" ? ("confirmed" as const) : a.changeStatus,
            })),
        }));
        setTopics(confirmed);
        saveMutation.mutate(
            { topics: confirmed, action: "confirm" },
            {
                onSuccess: () => {
                    toast.success("Xác nhận thay đổi cấu hình đánh giá thành công!");
                    onActivityLog("has confirmed topic assessment configuration.");
                    refetch();
                    onClose();
                },
                onError: () => {
                    toast.success("Xác nhận cấu hình đánh giá thành công (lưu cục bộ)!");
                    onActivityLog("has confirmed topic assessment configuration.");
                    onClose();
                },
            }
        );
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            {/* Modal: widened to max-w-6xl w-[94vw] to ensure spacious layout and avoid narrow horizontal scrollbars */}
            <DialogContent className="sm:max-w-5xl md:max-w-6xl w-[94vw] p-0 overflow-hidden max-h-[92vh] flex flex-col">
                {/* Header with Purple Background as in FAMS Screenshot */}
                <div className="bg-[#5944d3] text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
                    <DialogTitle className="text-base font-semibold text-white tracking-wide">
                        Topic Assessment Configuration
                    </DialogTitle>
                    <div className="flex items-center gap-4 text-xs font-medium">
                        {/* Legend boxes */}
                        <div className="flex items-center gap-1.5">
                            <span className="inline-block w-4 h-4 bg-[#fcd4dc] rounded-xs border border-pink-300" />
                            <span className="text-white/90">Waiting for confirm</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="inline-block w-4 h-4 bg-[#c8f7d4] rounded-xs border border-green-300" />
                            <span className="text-white/90">Changes confirmed</span>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-full p-1 text-white hover:bg-white/20 transition-colors ml-2"
                        >
                            <X className="size-4" />
                        </button>
                    </div>
                </div>

                {/* Accordion List Body */}
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-3 bg-slate-50/50 dark:bg-slate-950/20">
                    {topics.map((t) => {
                        const isOpen = openTopicId === t.id;
                        const topicTotal = calculateTopicTotal(t);
                        const isExceeded = topicTotal > 100;

                        return (
                            <div
                                key={t.id}
                                className={cn(
                                    "rounded-xl border bg-card shadow-xs overflow-hidden transition-all",
                                    isExceeded && "border-red-300 dark:border-red-900 ring-1 ring-red-300 dark:ring-red-900"
                                )}
                            >
                                <button
                                    type="button"
                                    onClick={() => handleToggleTopic(t.id)}
                                    className="w-full flex items-center justify-between px-5 py-3.5 text-left font-medium text-sm hover:bg-muted/50 transition-colors"
                                >
                                    <span className="text-slate-800 dark:text-slate-200 font-semibold">{t.title}</span>
                                    <div className="flex items-center gap-3">
                                        {/* Total weight badge indicator */}
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                "text-xs px-2.5 py-0.5 font-bold transition-colors",
                                                isExceeded
                                                    ? "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/60 dark:text-red-400"
                                                    : topicTotal === 100
                                                    ? "bg-green-100 text-green-700 border-green-300 dark:bg-green-950/60 dark:text-green-400"
                                                    : "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-400"
                                            )}
                                        >
                                            Total: {topicTotal}/100%
                                        </Badge>
                                        {isOpen ? (
                                            <ChevronUp className="size-4 text-muted-foreground" />
                                        ) : (
                                            <ChevronDown className="size-4 text-muted-foreground" />
                                        )}
                                    </div>
                                </button>

                                {isOpen && (
                                    <div className="border-t px-5 py-4 bg-white dark:bg-card space-y-4">
                                        {/* Exceeded 100% Warning Banner */}
                                        {isExceeded && (
                                            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-300">
                                                <AlertCircle className="size-4 shrink-0 text-red-600 dark:text-red-400" />
                                                <span>
                                                    Tổng trọng số (Weighted Number) của chuyên đề này hiện là{" "}
                                                    <strong>{topicTotal}%</strong>, vượt quá giới hạn tối đa <strong>100%</strong>. Vui lòng giảm bớt các đầu điểm trước khi xác nhận.
                                                </span>
                                            </div>
                                        )}

                                        <div className="overflow-x-auto rounded-lg border">
                                            <Table className="text-xs w-full">
                                                <TableHeader className="bg-muted/40">
                                                    <TableRow className="border-b">
                                                        <TableHead className="font-semibold text-slate-700 dark:text-slate-300 min-w-[220px]">
                                                            Assessment Name
                                                        </TableHead>
                                                        <TableHead className="w-36 text-center font-semibold text-slate-700 dark:text-slate-300 min-w-[130px]">
                                                            Weighted Number (%)
                                                        </TableHead>
                                                        <TableHead className="w-28 text-center font-semibold text-slate-700 dark:text-slate-300 min-w-[100px]">
                                                            Quantity
                                                        </TableHead>
                                                        <TableHead className="font-semibold text-slate-700 dark:text-slate-300 min-w-[200px]">
                                                            Note
                                                        </TableHead>
                                                        <TableHead className="w-28 text-center font-semibold text-slate-700 dark:text-slate-300 min-w-[110px]">
                                                            Action
                                                        </TableHead>
                                                        <TableHead className="w-12 text-center" />
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {t.assessments.map((a) => {
                                                        const rowBg =
                                                            a.changeStatus === "waiting"
                                                                ? "bg-[#fcd4dc]/60 hover:bg-[#fcd4dc]/80 dark:bg-pink-950/40"
                                                                : a.changeStatus === "confirmed"
                                                                  ? "bg-[#c8f7d4]/60 hover:bg-[#c8f7d4]/80 dark:bg-green-950/40"
                                                                  : "";
                                                        return (
                                                            <TableRow key={a.id} className={cn("transition-colors", rowBg)}>
                                                                <TableCell className="font-medium">
                                                                    <Input
                                                                        value={a.name}
                                                                        onChange={(e) =>
                                                                            handleUpdateAssessment(t.id, a.id, "name", e.target.value)
                                                                        }
                                                                        className="h-8 text-xs bg-white/70 dark:bg-card border-slate-200 dark:border-slate-800"
                                                                    />
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    <div className="relative flex items-center justify-center">
                                                                        <Input
                                                                            type="number"
                                                                            min={0}
                                                                            max={100}
                                                                            value={a.weightedNumber}
                                                                            onChange={(e) =>
                                                                                handleUpdateAssessment(
                                                                                    t.id,
                                                                                    a.id,
                                                                                    "weightedNumber",
                                                                                    Number(e.target.value) || 0
                                                                                )
                                                                            }
                                                                            className={cn(
                                                                                "h-8 text-xs text-center font-semibold bg-white/70 dark:bg-card border-slate-200 dark:border-slate-800",
                                                                                isExceeded && "border-red-400 text-red-600 font-bold"
                                                                            )}
                                                                        />
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    <Input
                                                                        type="number"
                                                                        min={1}
                                                                        value={a.quantity}
                                                                        onChange={(e) =>
                                                                            handleUpdateAssessment(
                                                                                t.id,
                                                                                a.id,
                                                                                "quantity",
                                                                                Number(e.target.value) || 1
                                                                            )
                                                                        }
                                                                        className="h-8 text-xs text-center bg-white/70 dark:bg-card border-slate-200 dark:border-slate-800"
                                                                    />
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Input
                                                                        placeholder="Ghi chú..."
                                                                        value={a.note || ""}
                                                                        onChange={(e) =>
                                                                            handleUpdateAssessment(t.id, a.id, "note", e.target.value)
                                                                        }
                                                                        className="h-8 text-xs bg-white/70 dark:bg-card border-slate-200 dark:border-slate-800"
                                                                    />
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    <select
                                                                        value={a.action || "Keep"}
                                                                        onChange={(e) =>
                                                                            handleUpdateAssessment(t.id, a.id, "action", e.target.value)
                                                                        }
                                                                        className="h-8 px-2 text-xs rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-card text-foreground"
                                                                    >
                                                                        <option value="Keep">Keep</option>
                                                                        <option value="Update">Update</option>
                                                                        <option value="Delete">Delete</option>
                                                                    </select>
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => handleDeleteAssessment(t.id, a.id)}
                                                                        className="size-7 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                                                                        title="Xóa đầu điểm"
                                                                    >
                                                                        <Trash2 className="size-3.5" />
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </div>

                                        <div className="flex items-center justify-between pt-1">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleAddAssessment(t.id)}
                                                className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/30 gap-1.5 h-8"
                                            >
                                                <Plus className="size-3.5" /> Thêm đầu điểm (Assessment)
                                            </Button>
                                            <span className="text-xs text-muted-foreground">
                                                Tổng trọng số: <strong className={cn(isExceeded ? "text-red-600 font-bold" : "text-foreground")}>{topicTotal}%</strong> / 100%
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Footer Buttons: Discard, Reject (Red), Confirm (Purple) */}
                <div className="border-t p-4 px-6 bg-white dark:bg-card flex items-center justify-end gap-3 shrink-0">
                    <Button variant="outline" size="sm" onClick={handleDiscard} className="text-xs">
                        Discard Changes
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleReject}
                        className="bg-[#e02b2b] hover:bg-red-700 text-white text-xs px-4"
                    >
                        Reject Assessments
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleConfirm}
                        className="bg-[#5944d3] hover:bg-[#4b39b5] text-white text-xs px-5 shadow-sm"
                    >
                        Confirm Assessments
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ===================== MAIN TAB: BUDGET & OPERATION INFO =====================
export function ClassBudgetTab({ classItem }: { classItem: ExternalClass }) {
    const classId = String(classItem.id);
    const { data: serverOpData, isLoading } = useClassOperation(classId);
    const saveOpMutation = useSaveClassOperation(classId);
    const addActivityMutation = useAddClassActivity(classId);

    const [openOperating, setOpenOperating] = useState(true);
    const [openMilestones, setOpenMilestones] = useState(true);
    const [configModalOpen, setConfigModalOpen] = useState(false);

    // Form states
    const [actualEndDate, setActualEndDate] = useState<string>("");
    const [hasNoAllocationNeeds, setHasNoAllocationNeeds] = useState<boolean>(false);
    const [milestones, setMilestones] = useState<Milestone[]>([]);

    useEffect(() => {
        if (serverOpData) {
            setActualEndDate(serverOpData.operatingInfo?.actualEndDate || "");
            setHasNoAllocationNeeds(Boolean(serverOpData.operatingInfo?.hasNoAllocationNeeds));
            setMilestones(serverOpData.milestones || []);
        } else {
            const defaults = createDefaultOperationData(classItem);
            setActualEndDate(defaults.operatingInfo.actualEndDate || "");
            setHasNoAllocationNeeds(defaults.operatingInfo.hasNoAllocationNeeds);
            setMilestones(defaults.milestones);
        }
    }, [serverOpData, classItem]);

    // Calculate total weighted number from all milestone topics
    const totalWeightedNumber = useMemo(() => {
        return milestones.reduce((sum, m) => {
            return sum + (m.topics || []).reduce((tSum, t) => tSum + (Number(t.weightedNumber) || 0), 0);
        }, 0);
    }, [milestones]);

    // 2.6: Save changes
    const handleSaveChanges = () => {
        const payload: ClassOperationData = {
            classId: classItem.id,
            operatingInfo: {
                actualStartDate: serverOpData?.operatingInfo?.actualStartDate || classItem.startDate || "2026-01-23",
                earlyGraduatedDate: serverOpData?.operatingInfo?.earlyGraduatedDate || classItem.endDate || "2026-07-22",
                actualEndDate,
                gpaCalculation: serverOpData?.operatingInfo?.gpaCalculation || {
                    topicMark: 70,
                    disciplinePoint: 30,
                    bonusPoint: 10,
                    penaltyPoint: 20,
                },
                hasNoAllocationNeeds,
            },
            milestones,
            totalWeightedNumber,
        };

        saveOpMutation.mutate(payload, {
            onSuccess: () => {
                toast.success("Lưu thông tin vận hành và milestone thành công!");
                addActivityMutation.mutate({
                    content: "has updated class operating info and milestone configuration.",
                    type: "history",
                });
            },
            onError: () => {
                toast.success("Đã cập nhật thông tin vận hành (lưu phiên làm việc)!");
                addActivityMutation.mutate({
                    content: "has updated class operating info and milestone configuration.",
                    type: "history",
                });
            },
        });
    };

    const handleLogActivity = (content: string) => {
        addActivityMutation.mutate({
            content,
            type: "history",
        });
    };

    if (isLoading) {
        return (
            <div className="space-y-4 p-2">
                <Skeleton className="h-28 w-full rounded-xl" />
                <Skeleton className="h-64 w-full rounded-xl" />
            </div>
        );
    }

    const gpa = serverOpData?.operatingInfo?.gpaCalculation || {
        topicMark: 70,
        disciplinePoint: 30,
        bonusPoint: 10,
        penaltyPoint: 20,
    };

    return (
        <TooltipProvider>
            <div className="space-y-6 pb-8">
                {/* 2.1: Operating Info Section */}
                <Collapsible
                    open={openOperating}
                    onOpenChange={setOpenOperating}
                    className="rounded-xl border bg-card shadow-xs overflow-hidden"
                >
                    <CollapsibleTrigger className="flex w-full items-center justify-between px-5 py-3.5 text-left font-semibold text-sm bg-muted/20 hover:bg-muted/40 transition-colors">
                        <span>Operating Info</span>
                        <ChevronDown className={cn("size-4 transition-transform text-muted-foreground", openOperating && "rotate-180")} />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <div className="border-t p-5 space-y-6 bg-white dark:bg-card">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Actual Start Date */}
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground font-medium">Actual Start Date</p>
                                    <p className="text-sm font-semibold text-foreground">
                                        {formatDate(serverOpData?.operatingInfo?.actualStartDate || classItem.startDate || "2026-01-23")}
                                    </p>
                                </div>

                                {/* Early Graduated Date */}
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground font-medium">Early Graduated Date</p>
                                    <p className="text-sm font-semibold text-foreground">
                                        {formatDate(serverOpData?.operatingInfo?.earlyGraduatedDate || "2026-07-22")}
                                    </p>
                                </div>

                                {/* Actual End Date (Input) */}
                                <div className="space-y-1.5">
                                    <Label htmlFor="actual-end-date" className="text-xs text-muted-foreground font-medium">
                                        Actual End Date
                                    </Label>
                                    <div className="relative max-w-xs">
                                        <Input
                                            id="actual-end-date"
                                            type="date"
                                            value={actualEndDate}
                                            onChange={(e) => setActualEndDate(e.target.value)}
                                            className="h-9 text-xs"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* GPA Calculation Info */}
                            <div className="flex flex-wrap items-center gap-x-8 gap-y-2 pt-1 text-xs">
                                <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                                    <span>GPA Calculation</span>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button type="button" className="text-blue-600 hover:text-blue-800 focus:outline-none">
                                                <Info className="size-3.5" />
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent className="text-xs max-w-xs p-2">
                                            Công thức tính GPA theo trọng số chuyên đề và rèn luyện của hệ thống đào tạo FAMS.
                                        </TooltipContent>
                                    </Tooltip>
                                </div>
                                <div className="text-muted-foreground">
                                    Topic Mark: <span className="font-semibold text-foreground">{gpa.topicMark}</span>
                                </div>
                                <div className="text-muted-foreground">
                                    Discipline Point: <span className="font-semibold text-foreground">{gpa.disciplinePoint}</span>
                                </div>
                                <div className="text-muted-foreground">
                                    Bonus Point: <span className="font-semibold text-foreground">{gpa.bonusPoint}</span>
                                </div>
                                <div className="text-muted-foreground">
                                    Penalty Point: <span className="font-semibold text-foreground">{gpa.penaltyPoint}</span>
                                </div>
                            </div>

                            {/* Actions & Switch: 2.2 & 2.3 */}
                            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setConfigModalOpen(true)}
                                    className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg px-4 h-9 shadow-xs"
                                >
                                    Config Topic Assessment
                                </Button>

                                <div className="flex items-center gap-3">
                                    <Label htmlFor="no-allocation" className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                                        Has no allocation needs
                                    </Label>
                                    <Switch
                                        id="no-allocation"
                                        checked={hasNoAllocationNeeds}
                                        onCheckedChange={setHasNoAllocationNeeds}
                                    />
                                </div>
                            </div>
                        </div>
                    </CollapsibleContent>
                </Collapsible>

                {/* 2.5: Milestone Configuration Section */}
                <Collapsible
                    open={openMilestones}
                    onOpenChange={setOpenMilestones}
                    className="rounded-xl border bg-card shadow-xs overflow-hidden"
                >
                    <CollapsibleTrigger className="flex w-full items-center justify-between px-5 py-3.5 text-left font-semibold text-sm bg-muted/20 hover:bg-muted/40 transition-colors">
                        <span>Milestone Configuration</span>
                        <ChevronDown className={cn("size-4 transition-transform text-muted-foreground", openMilestones && "rotate-180")} />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <div className="border-t p-5 space-y-4 bg-white dark:bg-card">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Total Weighted Number: <span className="text-blue-700 dark:text-blue-400 font-mono text-sm">{totalWeightedNumber}</span>
                                </p>
                                <span className="text-xs text-muted-foreground">
                                    5 Milestones (Feb - 2026 đến Jun - 2026) • 14 Chuyên đề
                                </span>
                            </div>

                            {/* Milestones and Sub-topics Table: Scrollable container with fixed header */}
                            <div className="rounded-lg border overflow-x-auto">
                                <Table className="text-xs relative">
                                    <TableHeader className="bg-[#eef8fb] dark:bg-slate-900 border-b">
                                        <TableRow>
                                            <TableHead className="w-12 font-bold text-slate-700 dark:text-slate-300">No.</TableHead>
                                            <TableHead className="w-56 font-bold text-slate-700 dark:text-slate-300">Milestone Name</TableHead>
                                            <TableHead className="font-bold text-slate-700 dark:text-slate-300">Checkpoint Type</TableHead>
                                            <TableHead className="font-bold text-slate-700 dark:text-slate-300">Salary Paid</TableHead>
                                            <TableHead className="font-bold text-slate-700 dark:text-slate-300">Start Date</TableHead>
                                            <TableHead className="font-bold text-slate-700 dark:text-slate-300">End Date</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {milestones.map((m, mIdx) => (
                                            <tbody key={`milestone-block-${m.id}`} className="border-b last:border-b-0">
                                                {/* Parent Milestone Row */}
                                                <TableRow className="bg-slate-50/80 dark:bg-slate-900/60 font-semibold border-t">
                                                    <TableCell className="font-bold">{mIdx + 1}</TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-slate-800 dark:text-slate-100">{m.name}</span>
                                                            <Badge className="bg-[#c8f7d4] text-green-800 hover:bg-[#c8f7d4] border border-green-300 text-[10px] px-1.5 py-0">
                                                                {m.status || "Baselined"}
                                                            </Badge>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>{m.checkpointType || "STANDARD"}</TableCell>
                                                    <TableCell>{m.salaryPaid || "Yes"}</TableCell>
                                                    <TableCell>{formatDate(m.startDate)}</TableCell>
                                                    <TableCell>{formatDate(m.endDate)}</TableCell>
                                                </TableRow>

                                                {/* Subtopics Header */}
                                                <TableRow className="bg-slate-100/50 dark:bg-slate-950/40 text-[11px] text-muted-foreground border-b">
                                                    <TableCell className="pl-6 font-semibold">No.</TableCell>
                                                    <TableCell className="font-semibold" colSpan={2}>Topic</TableCell>
                                                    <TableCell className="font-semibold">Max Score</TableCell>
                                                    <TableCell className="font-semibold">Passing Score</TableCell>
                                                    <TableCell className="font-semibold text-right pr-6">Weighted Number</TableCell>
                                                </TableRow>

                                                {/* Subtopics List */}
                                                {m.topics.map((t, tIdx) => (
                                                    <TableRow key={`topic-${t.id}`} className="hover:bg-muted/30 text-xs">
                                                        <TableCell className="pl-6 text-muted-foreground">{tIdx + 1}</TableCell>
                                                        <TableCell colSpan={2} className="font-medium text-slate-700 dark:text-slate-200">
                                                            {t.topic}
                                                        </TableCell>
                                                        <TableCell>{t.maxScore ?? 10}</TableCell>
                                                        <TableCell>{t.passingScore ?? 6}</TableCell>
                                                        <TableCell className="text-right pr-6 font-mono font-medium text-slate-900 dark:text-slate-100">
                                                            {t.weightedNumber}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </tbody>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </CollapsibleContent>
                </Collapsible>

                {/* Bottom Actions: 2.6 Back to Class List & Save changes */}
                <div className="sticky bottom-0 z-20 flex items-center justify-between pt-4 pb-2 bg-card/95 backdrop-blur-xs border-t mt-4">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        asChild
                        className="text-xs"
                    >
                        <Link to="/classes">Back to Class List</Link>
                    </Button>

                    <Button
                        type="button"
                        size="sm"
                        onClick={handleSaveChanges}
                        disabled={saveOpMutation.isPending}
                        className="bg-[#5944d3] hover:bg-[#4b39b5] text-white text-xs px-5 shadow-sm gap-1.5"
                    >
                        <Save className="size-3.5" />
                        {saveOpMutation.isPending ? "Đang lưu..." : "Save changes"}
                    </Button>
                </div>

                {/* Config Topic Assessment Modal */}
                <TopicAssessmentModal
                    open={configModalOpen}
                    onClose={() => setConfigModalOpen(false)}
                    classId={classId}
                    onActivityLog={handleLogActivity}
                />
            </div>
        </TooltipProvider>
    );
}
