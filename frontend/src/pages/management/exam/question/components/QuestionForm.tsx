import { questionApi } from "@/api";
import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { QuestionDifficulty, QuestionOptionDTO, QuestionType } from "@/types";
import { useQuery } from "@tanstack/react-query";
import {
    ArrowLeft,
    Bold,
    Code,
    Eye,
    EyeOff,
    Image as ImageIcon,
    Italic,
    Plus,
    Quote,
    Save,
    Trash2,
} from "lucide-react";
import React, {
    useRef,
    useState,
    type Dispatch,
    type FormEvent,
    type SetStateAction,
} from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ImageUrlField } from "./ImageUrlField";

export interface QuestionFormValues {
    content: string;
    type: QuestionType;
    difficulty: QuestionDifficulty;
    topic: string;
    points: number;
    isActive: boolean;
    options: QuestionOptionDTO[];
    imageUrl?: string;
}

const defaultInitialQuestionForm: QuestionFormValues = {
    content: "",
    type: "MULTIPLE_CHOICE",
    difficulty: "EASY",
    topic: "",
    points: 1,
    isActive: true,
    imageUrl: "",
    options: [
        { content: "", correct: false },
        { content: "", correct: false },
    ],
};

export const initialQuestionForm = defaultInitialQuestionForm;

function parseInlineFormatting(text: string): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/;

    while (remaining) {
        const match = remaining.match(regex);
        if (!match || match.index === undefined) {
            parts.push(remaining);
            break;
        }

        if (match.index > 0) {
            parts.push(remaining.substring(0, match.index));
        }

        const fullMatch = match[0];
        if (fullMatch.startsWith("**")) {
            parts.push(
                <strong key={key++} className="font-bold text-foreground">
                    {match[2]}
                </strong>,
            );
        } else if (fullMatch.startsWith("*")) {
            parts.push(
                <em key={key++} className="italic text-foreground">
                    {match[3]}
                </em>,
            );
        } else if (fullMatch.startsWith("`")) {
            parts.push(
                <code
                    key={key++}
                    className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-primary"
                >
                    {match[4]}
                </code>,
            );
        }

        remaining = remaining.substring(match.index + fullMatch.length);
    }

    return parts;
}

function QuestionContentPreview({ content }: { content: string }) {
    if (!content.trim()) {
        return (
            <p className="text-sm italic text-muted-foreground">
                No content to preview. Type above or click B (Bold), I (Italic) to add formatting.
            </p>
        );
    }

    const lines = content.split("\n");
    return (
        <div className="space-y-2 text-sm text-foreground">
            {lines.map((line, idx) => {
                const imgMatch = line.match(/!\[(.*?)\]\((.*?)\)/);
                if (imgMatch) {
                    const altText = imgMatch[1] || "Question Image";
                    const imgSrc = imgMatch[2];
                    return (
                        <div key={idx} className="my-2">
                            <img
                                src={imgSrc}
                                alt={altText}
                                className="max-h-64 rounded border border-border object-contain shadow-sm"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).alt = "Image failed to load";
                                }}
                            />
                        </div>
                    );
                }
                if (line.startsWith(">")) {
                    return (
                        <blockquote
                            key={idx}
                            className="border-l-4 border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 py-1.5 pl-3 my-1 italic rounded-r text-foreground"
                        >
                            {parseInlineFormatting(line.replace(/^>\s*/, ""))}
                        </blockquote>
                    );
                }
                return (
                    <p key={idx} className="min-h-[1.25rem]">
                        {parseInlineFormatting(line)}
                    </p>
                );
            })}
        </div>
    );
}

interface QuestionFormProps {
    form: QuestionFormValues;
    setForm: Dispatch<SetStateAction<QuestionFormValues>>;
    onSubmit: (values: QuestionFormValues) => void;
    isSaving: boolean;
    submitLabel: string;
    showActive?: boolean;
    onCancel?: () => void;
}

export function QuestionForm({
                                 form,
                                 setForm,
                                 onSubmit,
                                 isSaving,
                                 submitLabel,
                                 showActive = false,
                                 onCancel,
                             }: QuestionFormProps) {
    const navigate = useNavigate();
    const contentRef = useRef<HTMLTextAreaElement>(null);
    const [isPreview, setIsPreview] = useState(false);

    // Topic state
    const [isAddingNewTopic, setIsAddingNewTopic] = useState(false);
    const [newTopicText, setNewTopicText] = useState("");
    const [localCustomTopics, setLocalCustomTopics] = useState<string[]>([]);

    // Fetch existing questions to provide topic suggestions
    const { data: questionPage } = useQuery({
        queryKey: ["question-topics"],
        queryFn: () => questionApi.getPage({ page: 0, size: 200 }),
        staleTime: 60_000,
    });

    const backendTopics = (questionPage?.content ?? [])
        .map((q) => q.topic?.trim())
        .filter((t): t is string => Boolean(t));

    const allTopics = Array.from(
        new Set([...backendTopics, ...localCustomTopics, form.topic].filter(Boolean)),
    ).sort();

    const handleConfirmNewTopic = () => {
        const trimmed = newTopicText.trim();
        if (!trimmed) {
            toast.error("Please enter a topic name.");
            return;
        }

        setLocalCustomTopics((prev) => Array.from(new Set([...prev, trimmed])));
        setForm((prev) => ({ ...prev, topic: trimmed }));
        setNewTopicText("");
        setIsAddingNewTopic(false);
        toast.success(`Topic "${trimmed}" added.`);
    };

    const insertFormatting = (prefix: string, suffix = "", defaultText = "") => {
        const textarea = contentRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentVal = form.content;
        const selected = currentVal.substring(start, end) || defaultText;

        const replacement = `${prefix}${selected}${suffix}`;
        const nextContent = currentVal.substring(0, start) + replacement + currentVal.substring(end);

        setForm((prev) => ({ ...prev, content: nextContent }));

        setTimeout(() => {
            textarea.focus();
            const cursorPos = start + prefix.length + selected.length;
            textarea.setSelectionRange(cursorPos, cursorPos);
        }, 0);
    };

    const handleInsertImageLink = () => {
        const url = window.prompt("Enter image web URL (https://...):", "https://");
        if (url && url.trim() !== "https://" && url.trim().length > 0) {
            const alt = window.prompt("Enter image description (optional):", "Diagram") || "Diagram";
            insertFormatting(`\n![${alt.trim()}](${url.trim()})\n`, "", "");
            toast.success("Image link inserted. Click Preview to view.");
        }
    };

    const updateOption = (index: number, patch: Partial<QuestionOptionDTO>) =>
        setForm((prev) => ({
            ...prev,
            options: prev.options.map((option, i) => (i === index ? { ...option, ...patch } : option)),
        }));

    const toggleCorrect = (index: number, checked: boolean) =>
        setForm((prev) => ({
            ...prev,
            options: prev.options.map((option, i) =>
                i === index ? { ...option, correct: checked } : option,
            ),
        }));

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const content = form.content.trim();
        const imageUrl = form.imageUrl?.trim() || "";
        const options = form.options.map((option) => ({
            ...option,
            content: option.content.trim(),
            imageUrl: option.imageUrl?.trim() || null,
        }));

        if (!content) {
            toast.error("Content is required.");
            return;
        }
        if (!form.type || !form.difficulty) {
            toast.error("Type and difficulty are required.");
            return;
        }
        if (!Number.isInteger(form.points) || form.points < 1) {
            toast.error("Points must be a whole number of at least 1.");
            return;
        }
        if (content.length > 2000) {
            toast.error("Content must be at most 2000 characters.");
            return;
        }
        if (form.type === "ESSAY") {
            onSubmit({ ...form, content, imageUrl, topic: form.topic.trim(), options: [] });
            return;
        }

        if (options.length < 2 || options.length > 6 || options.some((option) => !option.content)) {
            toast.error("Need 2-6 options and none may be empty.");
            return;
        }
        const texts = options.map((option) => option.content.toLowerCase());
        if (new Set(texts).size !== texts.length) {
            toast.error("Options must not be duplicated.");
            return;
        }
        const correctCount = options.filter((option) => option.correct).length;
        if (correctCount === 0) {
            toast.error("Select at least one correct option.");
            return;
        }

        onSubmit({ ...form, content, imageUrl, topic: form.topic.trim(), options });
    };

    return (
        <form className="grid gap-5" onSubmit={handleSubmit}>
            {/* 1. TOPIC ROW */}
            <div className="grid gap-2">
                <Label htmlFor="question-topic">Topic</Label>

                {isAddingNewTopic ? (
                    <div className="flex items-center gap-2">
                        <Input
                            autoFocus
                            placeholder="Enter new topic name..."
                            value={newTopicText}
                            onChange={(e) => setNewTopicText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleConfirmNewTopic();
                                }
                            }}
                        />
                        <Button type="button" size="sm" onClick={handleConfirmNewTopic}>
                            Save
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setIsAddingNewTopic(false);
                                setNewTopicText("");
                            }}
                        >
                            Cancel
                        </Button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <Select
                            value={form.topic}
                            onValueChange={(val) => {
                                if (val === "__ADD_NEW__") {
                                    setIsAddingNewTopic(true);
                                    setNewTopicText("");
                                } else {
                                    setForm((prev) => ({ ...prev, topic: val }));
                                }
                            }}
                        >
                            <SelectTrigger id="question-topic" className="w-full">
                                <SelectValue placeholder="Select a topic..." />
                            </SelectTrigger>
                            <SelectContent>
                                {allTopics.length === 0 && (
                                    <div className="p-2 text-xs text-muted-foreground text-center">
                                        No existing topics. Click &quot;Add Topic&quot; to create one.
                                    </div>
                                )}
                                {allTopics.map((topic) => (
                                    <SelectItem key={topic} value={topic}>
                                        {topic}
                                    </SelectItem>
                                ))}
                                <SelectItem value="__ADD_NEW__" className="font-medium text-primary">
                                    + Add new topic...
                                </SelectItem>
                            </SelectContent>
                        </Select>

                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            onClick={() => {
                                setIsAddingNewTopic(true);
                                setNewTopicText("");
                            }}
                        >
                            <Plus className="mr-1 h-3.5 w-3.5" />
                            Add Topic
                        </Button>
                    </div>
                )}
            </div>

            {/* 2. TYPE & DIFFICULTY */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                    <Label>Question Type</Label>
                    <Select
                        key={form.type}
                        value={form.type}
                        onValueChange={(value) =>
                            setForm((prev) => ({
                                ...prev,
                                type: value as QuestionType,
                                options:
                                    value === "ESSAY"
                                        ? []
                                        : prev.options.length >= 2
                                            ? prev.options
                                            : defaultInitialQuestionForm.options,
                            }))
                        }
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="MULTIPLE_CHOICE">Multiple Choice</SelectItem>
                            <SelectItem value="ESSAY">Essay</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid gap-2">
                    <Label>Difficulty Level</Label>
                    <Select
                        key={form.difficulty}
                        value={form.difficulty}
                        onValueChange={(value) =>
                            setForm((prev) => ({ ...prev, difficulty: value as QuestionDifficulty }))
                        }
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="EASY">Easy</SelectItem>
                            <SelectItem value="MEDIUM">Medium</SelectItem>
                            <SelectItem value="HARD">Hard</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* 3. QUESTION CONTENT */}
            <div className="grid gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label htmlFor="question-content">Question Content</Label>
                    <div className="flex items-center gap-1">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => insertFormatting("**", "**", "bold text")}
                            title="Bold (**text**)"
                        >
                            <Bold className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => insertFormatting("*", "*", "italic text")}
                            title="Italic (*text*)"
                        >
                            <Italic className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => insertFormatting("`", "`", "code")}
                            title="Code (`code`)"
                        >
                            <Code className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => insertFormatting("> Note: ", "\n", "Important note")}
                            title="Note (> Note: ...)"
                        >
                            <Quote className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 px-2"
                            onClick={handleInsertImageLink}
                            title="Insert Image URL"
                        >
                            <ImageIcon className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                            type="button"
                            variant={isPreview ? "default" : "ghost"}
                            size="sm"
                            className="h-8 px-2.5 text-xs"
                            onClick={() => setIsPreview(!isPreview)}
                        >
                            {isPreview ? (
                                <>
                                    <EyeOff className="mr-1 h-3.5 w-3.5" /> Edit
                                </>
                            ) : (
                                <>
                                    <Eye className="mr-1 h-3.5 w-3.5" /> Preview
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                {isPreview ? (
                    <div className="min-h-[140px] max-h-[260px] overflow-y-auto rounded-md border border-input bg-muted/20 p-3">
                        <QuestionContentPreview content={form.content} />
                    </div>
                ) : (
                    <Textarea
                        ref={contentRef}
                        id="question-content"
                        value={form.content}
                        onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
                        rows={5}
                        className="min-h-[140px] max-h-[260px] overflow-y-auto resize-y"
                        placeholder="Enter question content (highlight text and click B to bold, I to italic, or click Preview to test)..."
                        autoFocus
                    />
                )}

                <ImageUrlField
                    value={form.imageUrl}
                    onChange={(url) => setForm((prev) => ({ ...prev, imageUrl: url }))}
                    placeholder="Question image URL (optional, https://...)"
                />
                {form.imageUrl?.trim() && (
                    <img
                        src={form.imageUrl}
                        alt=""
                        className="max-h-48 rounded border object-contain"
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                        }}
                    />
                )}
            </div>

            {/* 4. ANSWER OPTIONS */}
            {form.type === "ESSAY" ? (
                <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                    Essay questions have no options; students type their answer in an editor and the teacher grades it manually.
                </p>
            ) : (
                <div className="grid gap-3 border-t pt-3">
                    <div className="flex items-center justify-between">
                        <div className="grid gap-0.5">
                            <Label>Options (tick the correct answer)</Label>
                            <p className="text-xs text-muted-foreground">
                                Select option checkbox for correct answers.
                            </p>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={form.options.length >= 6}
                            onClick={() =>
                                setForm((prev) => ({
                                    ...prev,
                                    options: [...prev.options, { content: "", correct: false }],
                                }))
                            }
                        >
                            <Plus className="mr-1 h-4 w-4" />
                            Add option
                        </Button>
                    </div>

                    {form.options.map((option, index) => (
                        <div key={index} className="grid gap-2">
                            <div className="flex items-center gap-3">
                                <Checkbox
                                    checked={option.correct}
                                    onCheckedChange={(checked) => toggleCorrect(index, checked === true)}
                                />
                                <Input
                                    value={option.content}
                                    onChange={(event) => updateOption(index, { content: event.target.value })}
                                    placeholder={`Option ${index + 1}`}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    disabled={form.options.length <= 2}
                                    onClick={() =>
                                        setForm((prev) => ({
                                            ...prev,
                                            options: prev.options.filter((_, i) => i !== index),
                                        }))
                                    }
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                            <ImageUrlField
                                className="ml-8"
                                value={option.imageUrl ?? ""}
                                onChange={(url) => updateOption(index, { imageUrl: url })}
                                placeholder="Image URL (optional, https://...)"
                            />
                            {option.imageUrl?.trim() && (
                                <img
                                    src={option.imageUrl}
                                    alt=""
                                    className="ml-8 max-h-32 rounded border object-contain"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = "none";
                                    }}
                                />
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* 5. POINTS ROW */}
            <div className="grid max-w-xs gap-2 border-t pt-3">
                <Label htmlFor="question-points">Points</Label>
                <Input
                    id="question-points"
                    type="number"
                    min={1}
                    step={1}
                    value={form.points}
                    onChange={(event) =>
                        setForm((prev) => ({ ...prev, points: Number(event.target.value) }))
                    }
                    placeholder="Points (e.g. 1)"
                />
            </div>

            {/* 6. BOTTOM ROW: Active switch + action buttons */}
            <CardFooter className="flex items-center justify-between border-t px-0 pt-4">
                <div>
                    {showActive && (
                        <div className="flex items-center gap-3">
                            <Switch
                                id="question-active"
                                checked={form.isActive}
                                onCheckedChange={(checked) =>
                                    setForm((prev) => ({ ...prev, isActive: checked }))
                                }
                            />
                            <Label htmlFor="question-active" className="cursor-pointer font-medium">
                                Active
                            </Label>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => (onCancel ? onCancel() : navigate("/questions"))}
                        disabled={isSaving}
                    >
                        <ArrowLeft className="mr-1 h-4 w-4" />
                        Back
                    </Button>
                    <Button type="submit" disabled={isSaving}>
                        <Save className="mr-1 h-4 w-4" />
                        {isSaving ? "Saving..." : submitLabel}
                    </Button>
                </div>
            </CardFooter>
        </form>
    );
}