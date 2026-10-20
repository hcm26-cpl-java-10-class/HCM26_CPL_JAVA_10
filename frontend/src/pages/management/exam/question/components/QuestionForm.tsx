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
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export interface QuestionFormValues {
    content: string;
    type: QuestionType;
    difficulty: QuestionDifficulty;
    topic: string;
    points: number;
    isActive: boolean;
    options: QuestionOptionDTO[];
}

export const initialQuestionForm: QuestionFormValues = {
    content: "",
    type: "SINGLE_CHOICE",
    difficulty: "EASY",
    topic: "",
    points: 1,
    isActive: true,
    options: [
        { content: "", correct: false },
        { content: "", correct: false },
    ],
};

interface QuestionFormProps {
    form: QuestionFormValues;
    setForm: Dispatch<SetStateAction<QuestionFormValues>>;
    onSubmit: (values: QuestionFormValues) => void;
    isSaving: boolean;
    submitLabel: string;
}

export function QuestionForm({ form, setForm, onSubmit, isSaving, submitLabel }: QuestionFormProps) {
    const navigate = useNavigate();

    const updateOption = (index: number, patch: Partial<QuestionOptionDTO>) =>
        setForm((prev) => ({
            ...prev,
            options: prev.options.map((option, i) => (i === index ? { ...option, ...patch } : option)),
        }));

    const toggleCorrect = (index: number, checked: boolean) =>
        setForm((prev) => ({
            ...prev,
            options: prev.options.map((option, i) => {
                if (i === index) {
                    return { ...option, correct: checked };
                }
                // Single choice allows only one correct option
                return prev.type === "SINGLE_CHOICE" && checked ? { ...option, correct: false } : option;
            }),
        }));

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const content = form.content.trim();
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
        if (form.type === "ESSAY") {
            // Essay has no options: send an empty list so the backend clears any old ones
            onSubmit({ ...form, content, topic: form.topic.trim(), options: [] });
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
        if (form.type === "SINGLE_CHOICE" && correctCount !== 1) {
            toast.error("Single choice must have exactly one correct option.");
            return;
        }

        onSubmit({ ...form, content, topic: form.topic.trim(), options });
    };

    return (
        <form className="grid gap-5" onSubmit={handleSubmit}>
            <div className="grid gap-2">
                <Label htmlFor="question-content">Content</Label>
                <Textarea
                    id="question-content"
                    value={form.content}
                    onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
                    rows={4}
                    placeholder="Enter question content"
                    autoFocus
                />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                    <Label>Type</Label>
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
                                        : value === "SINGLE_CHOICE"
                                            ? prev.options.map((option) => ({ ...option, correct: false }))
                                            : prev.options.length >= 2
                                                ? prev.options
                                                : initialQuestionForm.options,
                            }))
                        }
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="SINGLE_CHOICE">Single choice</SelectItem>
                            <SelectItem value="MULTI_CHOICE">Multi choice</SelectItem>
                            <SelectItem value="ESSAY">Essay</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid gap-2">
                    <Label>Difficulty</Label>
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

                <div className="grid gap-2">
                    <Label htmlFor="question-topic">Topic</Label>
                    <Input
                        id="question-topic"
                        value={form.topic}
                        onChange={(event) => setForm((prev) => ({ ...prev, topic: event.target.value }))}
                        placeholder="Topic"
                    />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="question-points">Points</Label>
                    <Input
                        id="question-points"
                        type="number"
                        min={0}
                        step="any"
                        value={form.points}
                        onChange={(event) =>
                            setForm((prev) => ({ ...prev, points: Number(event.target.value) }))
                        }
                    />
                </div>
            </div>

            <div className="flex items-center gap-3">
                <Switch
                    id="question-active"
                    checked={form.isActive}
                    onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))}
                />
                <Label htmlFor="question-active">Active</Label>
            </div>

            {form.type === "ESSAY" ? (
                <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                    Essay questions have no options; they are graded manually.
                </p>
            ) : (
                <div className="grid gap-3">
                    <div className="flex items-center justify-between">
                        <Label>Options (tick the correct answer)</Label>
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
                            <Plus className="h-4 w-4" />
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
                            <Input
                                className="ml-8 w-auto"
                                value={option.imageUrl ?? ""}
                                onChange={(event) => updateOption(index, { imageUrl: event.target.value })}
                                placeholder="Image URL (optional, https://...)"
                            />
                            {option.imageUrl?.trim() && (
                                <img src={option.imageUrl} alt="" className="ml-8 max-h-32 rounded border object-contain" />
                            )}
                        </div>
                    ))}
                </div>
            )}

            <CardFooter className="px-0 pt-2 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => navigate("/questions")} disabled={isSaving}>
                    <ArrowLeft className="h-4 w-4" />
                    Back
                </Button>
                <Button type="submit" disabled={isSaving}>
                    <Save className="h-4 w-4" />
                    {isSaving ? "Saving..." : submitLabel}
                </Button>
            </CardFooter>
        </form>
    );
}