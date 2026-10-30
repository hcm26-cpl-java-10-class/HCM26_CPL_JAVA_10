import type { ExamAttemptQuestion } from '@/api/exam.api';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Save } from 'lucide-react';

interface EssayPopupProps {
    question: ExamAttemptQuestion;
    index: number;
    value: string;
    saved: boolean;
    isSaving: boolean;
    onChange: (value: string) => void;
    onSave: () => void;
    onClose: () => void;
}

/** Cửa sổ pop-up làm bài tự luận (thay cho trang riêng trước đây). */
export function EssayPopup({ question, index, value, saved, isSaving, onChange, onSave, onClose }: EssayPopupProps) {
    return (
        <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="flex max-h-[90vh] flex-col gap-4 sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Question {index + 1} — Essay</DialogTitle>
                    <DialogDescription className="max-h-32 overflow-y-auto whitespace-pre-wrap text-foreground">
                        {question.content}
                    </DialogDescription>
                </DialogHeader>
                {question.imageUrl?.trim() && (
                    <img
                        src={question.imageUrl}
                        alt={`Question ${index + 1} image`}
                        className="max-h-40 rounded-md border object-contain"
                    />
                )}
                <textarea
                    aria-label={`Answer for question ${index + 1}`}
                    autoFocus
                    className="min-h-[40vh] w-full flex-1 resize-y rounded-md border bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Type your answer here..."
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                />
                <DialogFooter className="items-center sm:justify-between">
                    <span className="text-xs text-muted-foreground">
                        {isSaving ? 'Saving...' : saved ? 'Saved' : `${value.length} ký tự · tự động lưu khi bạn gõ`}
                    </span>
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={onClose}>Close</Button>
                        <Button
                            type="button"
                            onClick={onSave}
                            className={saved ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-blue-600 text-white hover:bg-blue-700'}
                        >
                            <Save className="mr-1 h-4 w-4" /> {saved ? 'Saved' : 'Save Answer'}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
