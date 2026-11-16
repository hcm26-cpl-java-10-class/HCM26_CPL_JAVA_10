import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { aiQuestionGeneratorApi } from "@/api";
import type {
  AiGeneratorStatus,
  GeneratedQuestion,
  GenerateRequest,
  QuestionTypeRequestItem,
} from "@/types/features/ai-question-generator";
import type { ExamType, QuestionDifficulty, QuestionType } from "@/types/features/exam";
import {
  Sparkles,
  FileText,
  Upload,
  Check,
  CheckCheck,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  HelpCircle,
  Code,
  BookOpen,
  ArrowLeft,
  X,
  FileCheck,
  Loader2,
  Lock,
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  examId?: number;
  examTitle?: string;
  examType?: ExamType;
  allowedTypes?: QuestionType[];
  courseId?: number | null;
  courseName?: string | null;
  onQuestionsAdded?: (questions: GeneratedQuestion[], createdIds?: number[]) => void;
}

const PRESET_TOPICS = [
  "Lập trình Hướng đối tượng Java (OOP)",
  "Cấu trúc Dữ liệu & Giải thuật",
  "Cơ sở Dữ liệu Quan hệ & SQL",
  "Kiểm thử Phần mềm & Đảm bảo Chất lượng (QA)",
  "Thiết kế Kiến trúc Phần mềm (Design Patterns)",
];

export function AiQuestionGeneratorDialog({
  open,
  onOpenChange,
  examId,
  examTitle = "",
  examType,
  allowedTypes,
  courseId,
  courseName = "",
  onQuestionsAdded,
}: Props) {
  const queryClient = useQueryClient();

  // Status of AI engine
  const statusQuery = useQuery<AiGeneratorStatus>({
    queryKey: ["ai-generator-status"],
    queryFn: aiQuestionGeneratorApi.getStatus,
    enabled: open,
  });

  // Calculate allowed question types based on exam type policy
  const effectiveAllowedTypes: QuestionType[] = useMemo(() => {
    if (allowedTypes && allowedTypes.length > 0) return allowedTypes;
    if (examType) {
      switch (examType) {
        case "MULTIPLE_CHOICE":
          return ["MULTIPLE_CHOICE"];
        case "CODING":
          return ["CODING"];
        case "ESSAY":
          return ["ESSAY"];
        case "MC_CODING":
          return ["MULTIPLE_CHOICE", "CODING"];
        case "MIXED":
        default:
          return ["MULTIPLE_CHOICE", "ESSAY", "CODING"];
      }
    }
    return ["MULTIPLE_CHOICE", "ESSAY", "CODING"];
  }, [examType, allowedTypes]);

  const canMc = effectiveAllowedTypes.includes("MULTIPLE_CHOICE");
  const canEssay = effectiveAllowedTypes.includes("ESSAY");
  const canCoding = effectiveAllowedTypes.includes("CODING");
  const isSingleType = effectiveAllowedTypes.length === 1;

  // Wizard state: 1 = Config/Input, 2 = Preview & Select
  const [step, setStep] = useState<1 | 2>(1);

  // Input mode
  const [mode, setMode] = useState<"PROMPT" | "DOCUMENT">("PROMPT");
  const [prompt, setPrompt] = useState("");
  const [documentContent, setDocumentContent] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedFileSize, setUploadedFileSize] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Context metadata
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState("vi");
  const [additionalInstructions, setAdditionalInstructions] = useState("");

  // Question configuration
  const [enableMc, setEnableMc] = useState(true);
  const [mcCount, setMcCount] = useState(3);
  const [mcDifficulty, setMcDifficulty] = useState<QuestionDifficulty>("MEDIUM");

  const [enableEssay, setEnableEssay] = useState(true);
  const [essayCount, setEssayCount] = useState(1);
  const [essayDifficulty, setEssayDifficulty] = useState<QuestionDifficulty>("HARD");

  const [enableCoding, setEnableCoding] = useState(false);
  const [codingCount, setCodingCount] = useState(1);
  const [codingDifficulty, setCodingDifficulty] = useState<QuestionDifficulty>("MEDIUM");

  // Preview & selection state
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [selectedTempIds, setSelectedTempIds] = useState<Set<string>>(new Set());
  const [expandedTempIds, setExpandedTempIds] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<"ALL" | QuestionType>("ALL");
  const [editingQuestion, setEditingQuestion] = useState<GeneratedQuestion | null>(null);
  const [regeneratingTempId, setRegeneratingTempId] = useState<string | null>(null);

  // Reset or initialize on open & enforce exam format policy
  useEffect(() => {
    if (open) {
      if (examTitle && !topic) {
        setTopic(examTitle);
      }
      if (isSingleType) {
        setEnableMc(canMc);
        setEnableEssay(canEssay);
        setEnableCoding(canCoding);
      } else {
        setEnableMc(canMc);
        setEnableEssay(canEssay);
        setEnableCoding(canCoding && !canMc && !canEssay);
        if (!canMc) setEnableMc(false);
        if (!canEssay) setEnableEssay(false);
        if (!canCoding) setEnableCoding(false);
      }
    } else {
      // Don't completely wipe state on accidental close, but if closed after step 2 commit:
      if (step === 2 && generatedQuestions.length === 0) {
        setStep(1);
      }
    }
  }, [open, examTitle, canMc, canEssay, canCoding, isSingleType]);

  // File extraction handler
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const res = await aiQuestionGeneratorApi.extractDocument(file);
      setDocumentContent(res.extractedText);
      setUploadedFileName(res.fileName);
      setUploadedFileSize(res.fileSize);
      toast.success(`Đã trích xuất ${res.charCount} ký tự từ file ${res.fileName}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Lỗi đọc tài liệu");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const handleClearFile = () => {
    setUploadedFileName(null);
    setUploadedFileSize(null);
    setDocumentContent("");
  };

  // Generate mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      const requests: QuestionTypeRequestItem[] = [];
      if (canMc && enableMc && mcCount > 0) {
        requests.push({ type: "MULTIPLE_CHOICE", count: mcCount, difficulty: mcDifficulty, points: 1 });
      }
      if (canEssay && enableEssay && essayCount > 0) {
        requests.push({ type: "ESSAY", count: essayCount, difficulty: essayDifficulty, points: 1 });
      }
      if (canCoding && enableCoding && codingCount > 0) {
        requests.push({ type: "CODING", count: codingCount, difficulty: codingDifficulty, points: 1 });
      }

      if (requests.length === 0) {
        throw new Error("Vui lòng chọn ít nhất một loại câu hỏi được phép để tạo");
      }

      const payload: GenerateRequest = {
        examId,
        mode,
        prompt: mode === "PROMPT" ? prompt : undefined,
        documentContent: mode === "DOCUMENT" ? documentContent : undefined,
        courseId: courseId ?? undefined,
        courseName: courseName ?? undefined,
        examTitle,
        topic: topic.trim() || undefined,
        language: language === "vi" ? "Vietnamese" : "English",
        additionalInstructions: additionalInstructions.trim() || undefined,
        requests,
      };

      return await aiQuestionGeneratorApi.generate(payload);
    },
    onSuccess: (data) => {
      setGeneratedQuestions(data.questions);
      // Select all by default
      setSelectedTempIds(new Set(data.questions.map((q) => q.tempId)));
      // Expand all by default
      setExpandedTempIds(new Set(data.questions.map((q) => q.tempId)));
      setStep(2);

      if (data.isFallback) {
        toast.info("Tạo câu hỏi ở chế độ Fallback", {
          description: data.message,
        });
      } else {
        toast.success("AI đã tạo câu hỏi thành công!", {
          description: `Đã tạo ${data.questions.length} câu hỏi theo yêu cầu.`,
        });
      }
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || "Tạo câu hỏi thất bại");
    },
  });

  // Regenerate single question
  const handleRegenerateSingle = async (q: GeneratedQuestion) => {
    setRegeneratingTempId(q.tempId);
    try {
      const refreshed = await aiQuestionGeneratorApi.regenerateSingle({
        question: q,
        instruction: "Làm mới câu hỏi, tăng tính thực tiễn và kiểm tra kiến thức chặt chẽ hơn",
        topic: topic || q.topic,
        language: language === "vi" ? "Vietnamese" : "English",
      });

      setGeneratedQuestions((prev) =>
        prev.map((item) => (item.tempId === q.tempId ? { ...refreshed, tempId: q.tempId } : item))
      );
      toast.success("Đã làm mới câu hỏi thành công!");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Lỗi làm mới câu hỏi");
    } finally {
      setRegeneratingTempId(null);
    }
  };

  // Delete question from preview
  const handleDeleteQuestion = (tempId: string) => {
    setGeneratedQuestions((prev) => prev.filter((q) => q.tempId !== tempId));
    setSelectedTempIds((prev) => {
      const next = new Set(prev);
      next.delete(tempId);
      return next;
    });
  };

  // Toggle selection
  const toggleSelect = (tempId: string) => {
    setSelectedTempIds((prev) => {
      const next = new Set(prev);
      if (next.has(tempId)) next.delete(tempId);
      else next.add(tempId);
      return next;
    });
  };

  const handleSelectAll = (select: boolean) => {
    if (select) {
      setSelectedTempIds(new Set(generatedQuestions.map((q) => q.tempId)));
    } else {
      setSelectedTempIds(new Set());
    }
  };

  // Commit selected to exam
  const commitMutation = useMutation({
    mutationFn: async () => {
      const selectedQuestions = generatedQuestions.filter((q) => selectedTempIds.has(q.tempId));
      if (selectedQuestions.length === 0) {
        throw new Error("Vui lòng chọn ít nhất một câu hỏi để thêm vào đề thi");
      }

      const disallowed = selectedQuestions.filter((q) => !effectiveAllowedTypes.includes(q.type));
      if (disallowed.length > 0) {
        throw new Error(`Đề thi không cho phép loại câu hỏi: ${disallowed.map((q) => q.type).join(", ")}`);
      }

      return await aiQuestionGeneratorApi.commitToExam({
        examId,
        questions: selectedQuestions,
      });
    },
    onSuccess: (data) => {
      if (examId) {
        void queryClient.invalidateQueries({ queryKey: ["exam-detail", examId] });
        void queryClient.invalidateQueries({ queryKey: ["exam-question-all-bank"] });
        void queryClient.invalidateQueries({ queryKey: ["exam-ai-questions", examId] });
        void queryClient.invalidateQueries({ queryKey: ["exam-management"] });
      }

      const selectedQuestions = generatedQuestions.filter((q) => selectedTempIds.has(q.tempId));
      onQuestionsAdded?.(selectedQuestions, data.questionIds);

      toast.success("Thành công!", {
        description: data.message || `Đã thêm ${selectedQuestions.length} câu hỏi vào đề thi.`,
      });

      onOpenChange(false);
      setStep(1);
      setGeneratedQuestions([]);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || "Lỗi lưu câu hỏi vào đề thi");
    },
  });

  // Filtered preview questions
  const filteredQuestions = generatedQuestions.filter((q) => {
    if (filterType === "ALL") return true;
    return q.type === filterType;
  });

  const mcCountInPreview = generatedQuestions.filter((q) => q.type === "MULTIPLE_CHOICE").length;
  const essayCountInPreview = generatedQuestions.filter((q) => q.type === "ESSAY").length;
  const codingCountInPreview = generatedQuestions.filter((q) => q.type === "CODING").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="bg-black/60 backdrop-blur-sm"
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex max-h-[90vh] h-[88vh] w-[95vw] sm:max-w-[950px] lg:max-w-[1050px] flex-col p-0 overflow-hidden rounded-2xl shadow-2xl border bg-background z-50"
      >
        {/* Header */}
        <DialogHeader className="p-5 pb-3.5 border-b shrink-0 bg-muted/20 pr-12">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-lg bg-indigo-600/10 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Sparkles className="size-4" />
                </div>
                <DialogTitle className="text-xl font-bold">
                  AI Question Generator – Tạo câu hỏi bằng AI
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                {step === 1
                  ? "Tự động tạo câu hỏi trắc nghiệm, tự luận và lập trình phù hợp chương trình học và đề thi FAMS LMS."
                  : "Bước 2: Xem trước và chọn câu hỏi được AI tạo ra để thêm vào đề thi."}
              </DialogDescription>
            </div>

            {/* AI Status Badge */}
            <div className="flex items-center gap-2">
              {statusQuery.data?.configured ? (
                <Badge variant="outline" className="border-indigo-400 bg-indigo-50/50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 gap-1.5 py-1 px-2.5 text-xs">
                  <Sparkles className="size-3 text-indigo-600 animate-pulse" />
                  <span>Gemini AI Active ({statusQuery.data.model})</span>
                </Badge>
              ) : (
                <Badge variant="outline" className="border-amber-400 bg-amber-50/50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 gap-1.5 py-1 px-2.5 text-xs">
                  <AlertCircle className="size-3 text-amber-600" />
                  <span>Academic Fallback Active</span>
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Body content */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {step === 1 ? (
            /* ================= STEP 1: CONFIGURATION & INPUT ================= */
            <div className="space-y-4">
              {/* Method selection tabs */}
              <div className="space-y-2.5">
                <Label className="text-sm font-semibold">1. Phương thức cung cấp dữ liệu & Dặn dò thêm</Label>
                <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="PROMPT" className="gap-2 text-xs">
                      <FileText className="size-4" />
                      Phương thức A – Giáo viên mô tả yêu cầu
                    </TabsTrigger>
                    <TabsTrigger value="DOCUMENT" className="gap-2 text-xs">
                      <Upload className="size-4" />
                      Phương thức B – Cung cấp nội dung giảng dạy
                    </TabsTrigger>
                  </TabsList>

                  {/* Mode A: Prompt Description */}
                  <TabsContent value="PROMPT" className="space-y-2.5 mt-2.5">
                    <div className="space-y-1.5">
                      <Label htmlFor="ai-prompt" className="text-xs text-muted-foreground">
                        Nhập chi tiết yêu cầu về kiến thức, bối cảnh, dạng bài tập cần kiểm tra:
                      </Label>
                      <Textarea
                        id="ai-prompt"
                        rows={3}
                        placeholder="Ví dụ: Đề nghị tạo 5 câu hỏi môn Lập trình Hướng đối tượng Java về 4 tính chất OOP (Kế thừa, Đóng gói, Đa hình, Trừu tượng), gồm 3 câu trắc nghiệm tình huống, 1 câu tự luận so sánh Interface và Abstract class, và 1 bài lập trình quản lý nhân sự..."
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="resize-none text-xs"
                      />
                    </div>

                    {/* Dặn dò thêm & Chủ đề & Ngôn ngữ */}
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="ai-instructions" className="text-xs text-muted-foreground font-medium">
                          Dặn dò thêm của giáo viên (tùy chọn):
                        </Label>
                        <Input
                          id="ai-instructions"
                          placeholder="Ví dụ: Tập trung vào các bẫy thường gặp, bài toán thực tế trong doanh nghiệp..."
                          value={additionalInstructions}
                          onChange={(e) => setAdditionalInstructions(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Chủ đề bài thi:</Label>
                          <Input
                            placeholder="e.g. Java OOP..."
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Ngôn ngữ:</Label>
                          <Select value={language} onValueChange={setLanguage}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="vi">Tiếng Việt</SelectItem>
                              <SelectItem value="en">English</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Quick prompt chips */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="text-[11px] text-muted-foreground">Gợi ý chủ đề nhanh:</span>
                      {PRESET_TOPICS.map((pt) => (
                        <button
                          key={pt}
                          type="button"
                          onClick={() => {
                            setPrompt(`Tạo câu hỏi toàn diện về chủ đề: ${pt}. Yêu cầu câu hỏi bám sát thực tế phát triển phần mềm.`);
                            setTopic(pt);
                          }}
                          className="rounded-full border border-border/80 bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50"
                        >
                          +{pt}
                        </button>
                      ))}
                    </div>
                  </TabsContent>

                  {/* Mode B: Teaching Material */}
                  <TabsContent value="DOCUMENT" className="space-y-2.5 mt-2.5">
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {/* File upload box */}
                      <div className="rounded-xl border-2 border-dashed border-border/80 p-3 text-center hover:border-indigo-400/80 transition-colors bg-card flex flex-col items-center justify-center min-h-[110px]">
                        <input
                          type="file"
                          id="file-upload"
                          className="hidden"
                          accept=".pdf,.docx,.pptx,.txt,.md"
                          onChange={handleFileUpload}
                          disabled={isUploading}
                        />
                        <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-1.5">
                          <div className="size-8 rounded-full bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600">
                            {isUploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                          </div>
                          <div>
                            <span className="text-xs font-medium text-indigo-600 hover:underline">
                              Tải lên tài liệu giảng dạy (PDF, DOCX, TXT)
                            </span>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Tối đa 10MB
                            </p>
                          </div>
                        </label>
                      </div>

                      {/* Upload status / file preview */}
                      <div className="rounded-xl border bg-card p-3 flex flex-col justify-between">
                        <div>
                          <Label className="text-[11px] font-semibold text-muted-foreground uppercase">
                            Trạng thái tài liệu
                          </Label>
                          {uploadedFileName ? (
                            <div className="mt-1 flex items-start gap-2 bg-emerald-50/50 dark:bg-emerald-950/20 p-2 rounded-lg border border-emerald-200 dark:border-emerald-900/40">
                              <FileCheck className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold truncate text-emerald-900 dark:text-emerald-200">{uploadedFileName}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  {uploadedFileSize ? `${(uploadedFileSize / 1024).toFixed(1)} KB · ` : ""}
                                  {documentContent.length} ký tự
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-5 text-muted-foreground hover:text-destructive"
                                onClick={handleClearFile}
                              >
                                <X className="size-3" />
                              </Button>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground mt-1 italic">
                              Chưa tải tập tin. Bạn có thể dán trực tiếp nội dung bài học vào ô bên dưới.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="doc-content" className="text-xs text-muted-foreground">
                          Nội dung tài liệu / Giáo trình chi tiết:
                        </Label>
                        {documentContent.length > 0 && (
                          <span className="text-[10px] font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                            {documentContent.length} ký tự
                          </span>
                        )}
                      </div>
                      <Textarea
                        id="doc-content"
                        rows={2}
                        placeholder="Dán nội dung bài giảng, tóm tắt lý thuyết hoặc nội dung trích xuất tại đây..."
                        value={documentContent}
                        onChange={(e) => setDocumentContent(e.target.value)}
                        className="resize-none text-xs font-mono"
                      />
                    </div>

                    {/* Dặn dò thêm & Chủ đề & Ngôn ngữ for Document mode */}
                    <div className="grid gap-2.5 sm:grid-cols-2 pt-0.5">
                      <div className="space-y-1">
                        <Label htmlFor="doc-instructions" className="text-xs text-muted-foreground font-medium">
                          Dặn dò thêm của giáo viên (tùy chọn):
                        </Label>
                        <Input
                          id="doc-instructions"
                          placeholder="Ví dụ: Tập trung vào các bẫy thường gặp, bài toán thực tế trong doanh nghiệp..."
                          value={additionalInstructions}
                          onChange={(e) => setAdditionalInstructions(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Chủ đề bài thi:</Label>
                          <Input
                            placeholder="e.g. Java OOP..."
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Ngôn ngữ:</Label>
                          <Select value={language} onValueChange={setLanguage}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="vi">Tiếng Việt</SelectItem>
                              <SelectItem value="en">English</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Question Types Configuration */}
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">2. Tùy chọn loại câu hỏi & Số lượng</Label>
                  {examType && (
                    <Badge variant="secondary" className="text-[11px] gap-1 font-normal bg-muted">
                      <Lock className="size-3 text-muted-foreground" />
                      Định dạng đề: <span className="font-semibold text-foreground">{examType}</span>
                    </Badge>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {/* Multiple Choice Card */}
                  <div
                    className={`rounded-xl border p-4 transition-all ${
                      !canMc
                        ? "opacity-50 bg-muted/20 border-dashed cursor-not-allowed"
                        : enableMc
                        ? "border-sky-500/60 bg-sky-50/20 dark:bg-sky-950/20"
                        : "opacity-60 bg-muted/20"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="type-mc"
                          checked={canMc && enableMc}
                          disabled={!canMc || isSingleType}
                          onCheckedChange={(checked) => canMc && !isSingleType && setEnableMc(Boolean(checked))}
                        />
                        <Label
                          htmlFor="type-mc"
                          className={`font-semibold text-sm flex items-center gap-1.5 ${
                            !canMc ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer"
                          }`}
                        >
                          <HelpCircle className="size-4 text-sky-600" />
                          Trắc nghiệm (MCQ)
                        </Label>
                      </div>
                      {!canMc ? (
                        <Badge variant="outline" className="text-[10px] border-amber-300 bg-amber-50/50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                          Khóa theo định dạng đề
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-sky-500/10 text-sky-700 dark:text-sky-300">
                          4 lựa chọn
                        </Badge>
                      )}
                    </div>

                    {!canMc ? (
                      <p className="mt-3 text-[11px] text-muted-foreground italic border-t pt-2 border-border/40">
                        Định dạng đề thi không cho phép loại câu hỏi này.
                      </p>
                    ) : enableMc ? (
                      <div className="mt-3.5 space-y-2.5 text-xs border-t pt-3 border-sky-200/40">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Số lượng:</span>
                          <Input
                            type="number"
                            min={1}
                            max={20}
                            className="w-20 h-7 text-xs text-right"
                            value={mcCount}
                            onChange={(e) => setMcCount(Math.max(1, Number(e.target.value)))}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Mức độ:</span>
                          <Select value={mcDifficulty} onValueChange={(v) => setMcDifficulty(v as QuestionDifficulty)}>
                            <SelectTrigger className="w-28 h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="EASY">Nhận biết</SelectItem>
                              <SelectItem value="MEDIUM">Thông hiểu</SelectItem>
                              <SelectItem value="HARD">Vận dụng</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* Essay Card */}
                  <div
                    className={`rounded-xl border p-4 transition-all ${
                      !canEssay
                        ? "opacity-50 bg-muted/20 border-dashed cursor-not-allowed"
                        : enableEssay
                        ? "border-purple-500/60 bg-purple-50/20 dark:bg-purple-950/20"
                        : "opacity-60 bg-muted/20"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="type-essay"
                          checked={canEssay && enableEssay}
                          disabled={!canEssay || isSingleType}
                          onCheckedChange={(checked) => canEssay && !isSingleType && setEnableEssay(Boolean(checked))}
                        />
                        <Label
                          htmlFor="type-essay"
                          className={`font-semibold text-sm flex items-center gap-1.5 ${
                            !canEssay ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer"
                          }`}
                        >
                          <BookOpen className="size-4 text-purple-600" />
                          Tự luận (Essay)
                        </Label>
                      </div>
                      {!canEssay ? (
                        <Badge variant="outline" className="text-[10px] border-amber-300 bg-amber-50/50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                          Khóa theo định dạng đề
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-700 dark:text-purple-300">
                          Rubric 100%
                        </Badge>
                      )}
                    </div>

                    {!canEssay ? (
                      <p className="mt-3 text-[11px] text-muted-foreground italic border-t pt-2 border-border/40">
                        Định dạng đề thi không cho phép loại câu hỏi này.
                      </p>
                    ) : enableEssay ? (
                      <div className="mt-3.5 space-y-2.5 text-xs border-t pt-3 border-purple-200/40">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Số lượng:</span>
                          <Input
                            type="number"
                            min={1}
                            max={10}
                            className="w-20 h-7 text-xs text-right"
                            value={essayCount}
                            onChange={(e) => setEssayCount(Math.max(1, Number(e.target.value)))}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Mức độ:</span>
                          <Select value={essayDifficulty} onValueChange={(v) => setEssayDifficulty(v as QuestionDifficulty)}>
                            <SelectTrigger className="w-28 h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="EASY">Nhận biết</SelectItem>
                              <SelectItem value="MEDIUM">Thông hiểu</SelectItem>
                              <SelectItem value="HARD">Vận dụng cao</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* Coding Card */}
                  <div
                    className={`rounded-xl border p-4 transition-all ${
                      !canCoding
                        ? "opacity-50 bg-muted/20 border-dashed cursor-not-allowed"
                        : enableCoding
                        ? "border-emerald-500/60 bg-emerald-50/20 dark:bg-emerald-950/20"
                        : "opacity-60 bg-muted/20"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="type-coding"
                          checked={canCoding && enableCoding}
                          disabled={!canCoding || isSingleType}
                          onCheckedChange={(checked) => canCoding && !isSingleType && setEnableCoding(Boolean(checked))}
                        />
                        <Label
                          htmlFor="type-coding"
                          className={`font-semibold text-sm flex items-center gap-1.5 ${
                            !canCoding ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer"
                          }`}
                        >
                          <Code className="size-4 text-emerald-600" />
                          Lập trình (Coding)
                        </Label>
                      </div>
                      {!canCoding ? (
                        <Badge variant="outline" className="text-[10px] border-amber-300 bg-amber-50/50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                          Khóa theo định dạng đề
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                          Judge0 Ready
                        </Badge>
                      )}
                    </div>

                    {!canCoding ? (
                      <p className="mt-3 text-[11px] text-muted-foreground italic border-t pt-2 border-border/40">
                        Định dạng đề thi không cho phép loại câu hỏi này.
                      </p>
                    ) : enableCoding ? (
                      <div className="mt-3.5 space-y-2.5 text-xs border-t pt-3 border-emerald-200/40">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Số lượng:</span>
                          <Input
                            type="number"
                            min={1}
                            max={5}
                            className="w-20 h-7 text-xs text-right"
                            value={codingCount}
                            onChange={(e) => setCodingCount(Math.max(1, Number(e.target.value)))}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Mức độ:</span>
                          <Select value={codingDifficulty} onValueChange={(v) => setCodingDifficulty(v as QuestionDifficulty)}>
                            <SelectTrigger className="w-28 h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="EASY">Dễ</SelectItem>
                              <SelectItem value="MEDIUM">Trung bình</SelectItem>
                              <SelectItem value="HARD">Khó</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ================= STEP 2: PREVIEW & SELECTION ================= */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-md border border-indigo-200 dark:border-indigo-800">
                  Bước 2: Xem trước và chọn câu hỏi
                </span>
              </div>
              {/* Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/30 p-3 rounded-xl border">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="select-all"
                      checked={
                        generatedQuestions.length > 0 &&
                        selectedTempIds.size === generatedQuestions.length
                      }
                      onCheckedChange={(checked) => handleSelectAll(Boolean(checked))}
                    />
                    <Label htmlFor="select-all" className="text-xs font-semibold cursor-pointer">
                      Chọn tất cả ({selectedTempIds.size}/{generatedQuestions.length})
                    </Label>
                  </div>

                  <span className="text-muted-foreground">|</span>

                  {/* Filter tabs */}
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant={filterType === "ALL" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 text-xs px-2.5"
                      onClick={() => setFilterType("ALL")}
                    >
                      Tất cả ({generatedQuestions.length})
                    </Button>
                    {mcCountInPreview > 0 && (
                      <Button
                        type="button"
                        variant={filterType === "MULTIPLE_CHOICE" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-7 text-xs px-2.5 text-sky-700 dark:text-sky-300"
                        onClick={() => setFilterType("MULTIPLE_CHOICE")}
                      >
                        Trắc nghiệm ({mcCountInPreview})
                      </Button>
                    )}
                    {essayCountInPreview > 0 && (
                      <Button
                        type="button"
                        variant={filterType === "ESSAY" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-7 text-xs px-2.5 text-purple-700 dark:text-purple-300"
                        onClick={() => setFilterType("ESSAY")}
                      >
                        Tự luận ({essayCountInPreview})
                      </Button>
                    )}
                    {codingCountInPreview > 0 && (
                      <Button
                        type="button"
                        variant={filterType === "CODING" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-7 text-xs px-2.5 text-emerald-700 dark:text-emerald-300"
                        onClick={() => setFilterType("CODING")}
                      >
                        Lập trình ({codingCountInPreview})
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => {
                      if (expandedTempIds.size === generatedQuestions.length) {
                        setExpandedTempIds(new Set());
                      } else {
                        setExpandedTempIds(new Set(generatedQuestions.map((q) => q.tempId)));
                      }
                    }}
                  >
                    {expandedTempIds.size === generatedQuestions.length ? (
                      <>
                        <ChevronUp className="size-3.5" /> Thu gọn tất cả
                      </>
                    ) : (
                      <>
                        <ChevronDown className="size-3.5" /> Mở rộng tất cả
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Questions list */}
              <div className="space-y-4">
                {filteredQuestions.map((q, idx) => {
                  const isSelected = selectedTempIds.has(q.tempId);
                  const isExpanded = expandedTempIds.has(q.tempId);
                  const isRegenerating = regeneratingTempId === q.tempId;

                  const typeColor =
                    q.type === "MULTIPLE_CHOICE"
                      ? "border-sky-300 dark:border-sky-800 bg-sky-50/10"
                      : q.type === "ESSAY"
                      ? "border-purple-300 dark:border-purple-800 bg-purple-50/10"
                      : "border-emerald-300 dark:border-emerald-800 bg-emerald-50/10";

                  return (
                    <Card
                      key={q.tempId}
                      className={`transition-all overflow-hidden ${typeColor} ${
                        isSelected ? "ring-1 ring-primary/40 shadow-sm" : "opacity-80"
                      }`}
                    >
                      <CardHeader className="p-3.5 pb-2 border-b bg-card/60 flex flex-row items-center justify-between gap-3 space-y-0">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(q.tempId)}
                          />
                          <span className="font-bold text-xs">Câu #{idx + 1}</span>

                          {q.type === "MULTIPLE_CHOICE" && (
                            <Badge className="bg-sky-600 text-white text-[10px] py-0 px-2">Trắc nghiệm</Badge>
                          )}
                          {q.type === "ESSAY" && (
                            <Badge className="bg-purple-600 text-white text-[10px] py-0 px-2">Tự luận</Badge>
                          )}
                          {q.type === "CODING" && (
                            <Badge className="bg-emerald-600 text-white text-[10px] py-0 px-2">Lập trình</Badge>
                          )}

                          <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                            {q.difficulty === "EASY" ? "Nhận biết" : q.difficulty === "MEDIUM" ? "Thông hiểu" : "Vận dụng cao"}
                          </Badge>

                          {q.topic && (
                            <span className="text-[11px] text-muted-foreground font-mono truncate max-w-[140px]">
                              #{q.topic}
                            </span>
                          )}
                        </div>

                        {/* Card actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground hover:bg-muted"
                            onClick={() => setEditingQuestion(q)}
                            title="Chỉnh sửa câu hỏi"
                          >
                            <Edit2 className="size-3.5" />
                            <span className="hidden sm:inline">Chỉnh sửa</span>
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                            disabled={isRegenerating}
                            onClick={() => handleRegenerateSingle(q)}
                            title="Yêu cầu AI tạo lại câu hỏi này"
                          >
                            {isRegenerating ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="size-3.5" />
                            )}
                            <span className="hidden sm:inline">Tạo lại</span>
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteQuestion(q.tempId)}
                            title="Xóa câu hỏi khỏi xem trước"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground"
                            onClick={() => {
                              setExpandedTempIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(q.tempId)) next.delete(q.tempId);
                                else next.add(q.tempId);
                                return next;
                              });
                            }}
                          >
                            {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                          </Button>
                        </div>
                      </CardHeader>

                      <CardContent className="p-4 space-y-3">
                        {/* Question content */}
                        <div className="text-sm font-medium whitespace-pre-wrap leading-relaxed">
                          {q.content}
                        </div>

                        {isExpanded && (
                          <div className="space-y-3 pt-2 border-t text-xs">
                            {/* Multiple choice options */}
                            {q.type === "MULTIPLE_CHOICE" && q.options && (
                              <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-muted-foreground">Phương án trả lời:</Label>
                                <div className="grid gap-1.5 sm:grid-cols-2">
                                  {q.options.map((opt, oIdx) => (
                                    <div
                                      key={oIdx}
                                      className={`p-2.5 rounded-lg border text-xs flex items-start gap-2 ${
                                        opt.correct
                                          ? "border-emerald-300 bg-emerald-50/70 text-emerald-950 font-medium dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800"
                                          : "border-border/60 bg-muted/20 text-foreground"
                                      }`}
                                    >
                                      <span className="font-bold">{String.fromCharCode(65 + oIdx)}.</span>
                                      <span className="flex-1">{opt.content}</span>
                                      {opt.correct && <Check className="size-4 text-emerald-600 shrink-0" />}
                                    </div>
                                  ))}
                                </div>
                                {q.explanation && (
                                  <div className="mt-2 p-2.5 rounded-lg bg-sky-50/60 dark:bg-sky-950/30 text-sky-900 dark:text-sky-200 border border-sky-200 text-xs">
                                    <span className="font-semibold">Giải thích:</span> {q.explanation}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Essay details */}
                            {q.type === "ESSAY" && (
                              <div className="space-y-3">
                                {q.studentInstructions && (
                                  <div className="p-2.5 rounded-lg bg-muted/40 border text-xs">
                                    <span className="font-semibold text-foreground">Hướng dẫn làm bài:</span>{" "}
                                    <span className="text-muted-foreground">{q.studentInstructions}</span>
                                  </div>
                                )}
                                {q.referenceAnswer && (
                                  <div className="p-2.5 rounded-lg bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 text-purple-900 dark:text-purple-200 text-xs">
                                    <span className="font-semibold">Đáp án tham khảo (Model Answer):</span>
                                    <p className="mt-1 whitespace-pre-wrap">{q.referenceAnswer}</p>
                                  </div>
                                )}
                                {q.gradingCriteria && q.gradingCriteria.length > 0 && (
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-muted-foreground">
                                      Rubric chấm điểm (Tổng: 100%):
                                    </Label>
                                    <div className="border rounded-lg overflow-hidden">
                                      <table className="w-full text-xs">
                                        <thead className="bg-muted/60 text-muted-foreground border-b font-semibold">
                                          <tr>
                                            <th className="p-2 text-left">Tiêu chí</th>
                                            <th className="p-2 text-left">Mô tả</th>
                                            <th className="p-2 text-right w-20">Trọng số</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                          {q.gradingCriteria.map((crit, cIdx) => (
                                            <tr key={cIdx}>
                                              <td className="p-2 font-medium">{crit.name}</td>
                                              <td className="p-2 text-muted-foreground">{crit.description || "—"}</td>
                                              <td className="p-2 text-right font-semibold text-purple-700">
                                                {crit.weightPercentage}%
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Coding details */}
                            {q.type === "CODING" && q.code && (
                              <div className="space-y-2.5">
                                <div className="flex flex-wrap items-center gap-3 text-xs bg-muted/40 p-2.5 rounded-lg border">
                                  <span>
                                    <strong>Hàm:</strong> <code className="text-emerald-700 font-mono">{q.code.functionName}()</code>
                                  </span>
                                  <span>
                                    <strong>Trả về:</strong> <code className="text-emerald-700 font-mono">{q.code.returnType}</code>
                                  </span>
                                  <span>
                                    <strong>Thời gian tối đa:</strong> {q.code.timeLimitSeconds ?? 5}s
                                  </span>
                                </div>

                                {q.code.tests && q.code.tests.length > 0 && (
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-muted-foreground">Test cases mẫu & ẩn:</Label>
                                    <div className="border rounded-lg overflow-hidden">
                                      <table className="w-full text-xs">
                                        <thead className="bg-muted/60 text-muted-foreground border-b font-semibold">
                                          <tr>
                                            <th className="p-2 text-left">Input</th>
                                            <th className="p-2 text-left">Expected</th>
                                            <th className="p-2 text-center w-24">Hiển thị</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y font-mono text-[11px]">
                                          {q.code.tests.map((tc, tIdx) => (
                                            <tr key={tIdx}>
                                              <td className="p-2 truncate max-w-[200px]">{tc.inputs?.join(", ") || "[]"}</td>
                                              <td className="p-2 truncate max-w-[150px] font-semibold text-emerald-700">{tc.expected}</td>
                                              <td className="p-2 text-center">
                                                {tc.visible ? (
                                                  <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300">Công khai</Badge>
                                                ) : (
                                                  <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-300">Ẩn</Badge>
                                                )}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <DialogFooter className="p-4 px-6 border-t shrink-0 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
          {step === 1 ? (
            <>
              <div className="text-xs text-muted-foreground">
                Tổng cộng: <strong>{(enableMc ? mcCount : 0) + (enableEssay ? essayCount : 0) + (enableCoding ? codingCount : 0)}</strong> câu hỏi dự kiến
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Đóng
                </Button>
                <Button
                  type="button"
                  className="bg-indigo-600 text-white hover:bg-indigo-700 gap-1.5"
                  disabled={
                    generateMutation.isPending ||
                    (mode === "PROMPT" && !prompt.trim()) ||
                    (mode === "DOCUMENT" && !documentContent.trim()) ||
                    (!enableMc && !enableEssay && !enableCoding)
                  }
                  onClick={() => generateMutation.mutate()}
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Đang tạo câu hỏi...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4" />
                      <span>Tạo câu hỏi bằng AI</span>
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setStep(1)}
              >
                <ArrowLeft className="size-4" />
                Quay lại thiết lập
              </Button>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                  Hủy bỏ
                </Button>
                <Button
                  type="button"
                  className="bg-indigo-600 text-white hover:bg-indigo-700 gap-1.5 font-semibold"
                  disabled={commitMutation.isPending || selectedTempIds.size === 0}
                  onClick={() => commitMutation.mutate()}
                >
                  {commitMutation.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Đang thêm vào đề thi...</span>
                    </>
                  ) : (
                    <>
                      <CheckCheck className="size-4" />
                      <span>Thêm {selectedTempIds.size} câu hỏi đã chọn vào đề thi</span>
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </DialogFooter>
      </DialogContent>

      {/* Inline / Sub Dialog for editing a single question before committing */}
      {editingQuestion && (
        <Dialog open={Boolean(editingQuestion)} onOpenChange={(open) => !open && setEditingQuestion(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit2 className="size-5 text-indigo-600" />
                Chỉnh sửa câu hỏi ({editingQuestion.type === "MULTIPLE_CHOICE" ? "Trắc nghiệm" : editingQuestion.type === "ESSAY" ? "Tự luận" : "Lập trình"})
              </DialogTitle>
              <DialogDescription>
                Chỉnh sửa nội dung và chi tiết câu hỏi trước khi thêm vào đề thi.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Nội dung câu hỏi / Đề bài:</Label>
                <Textarea
                  rows={4}
                  value={editingQuestion.content}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, content: e.target.value })}
                  className="text-xs leading-relaxed"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Chủ đề (Topic):</Label>
                <Input
                  value={editingQuestion.topic || ""}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, topic: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>

              {editingQuestion.type === "MULTIPLE_CHOICE" && editingQuestion.options && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Phương án trả lời:</Label>
                  <div className="space-y-2">
                    {editingQuestion.options.map((opt, oIdx) => (
                      <div key={oIdx} className="flex items-center gap-2">
                        <span className="font-bold text-xs w-5">{String.fromCharCode(65 + oIdx)}.</span>
                        <Input
                          value={opt.content}
                          onChange={(e) => {
                            const newOpts = [...editingQuestion.options!];
                            newOpts[oIdx] = { ...newOpts[oIdx], content: e.target.value };
                            setEditingQuestion({ ...editingQuestion, options: newOpts });
                          }}
                          className="h-8 text-xs flex-1"
                        />
                        <Button
                          type="button"
                          variant={opt.correct ? "default" : "outline"}
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => {
                            const newOpts = editingQuestion.options!.map((o, i) => ({
                              ...o,
                              correct: i === oIdx,
                            }));
                            setEditingQuestion({ ...editingQuestion, options: newOpts });
                          }}
                        >
                          {opt.correct ? "Đúng" : "Sai"}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {editingQuestion.type === "ESSAY" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Đáp án tham khảo mẫu:</Label>
                  <Textarea
                    rows={3}
                    value={editingQuestion.referenceAnswer || ""}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, referenceAnswer: e.target.value })}
                    className="text-xs leading-relaxed"
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingQuestion(null)}>
                Hủy
              </Button>
              <Button
                type="button"
                className="bg-indigo-600 text-white hover:bg-indigo-700"
                onClick={() => {
                  setGeneratedQuestions((prev) =>
                    prev.map((q) => (q.tempId === editingQuestion.tempId ? editingQuestion : q))
                  );
                  setEditingQuestion(null);
                  toast.success("Đã cập nhật câu hỏi!");
                }}
              >
                Lưu thay đổi
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}
