// ===== NEW FILE: ô trả lời tự luận. Bấm vào ô để mở cửa sổ popup nhập văn bản (xuống dòng thoải mái như Notepad) =====
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { PencilLine } from 'lucide-react';
import { useState } from 'react';

interface EssayAnswerDialogProps {
    /** Ví dụ "Câu 3" — dùng làm tiêu đề popup và aria-label. */
    label: string;
    /** Nội dung câu hỏi, hiển thị trong popup để sinh viên đối chiếu khi viết. */
    questionContent: string;
    value: string;
    disabled?: boolean;
    onChange: (value: string) => void;
}

export function EssayAnswerDialog({ label, questionContent, value, disabled, onChange }: EssayAnswerDialogProps) {
    const [open, setOpen] = useState(false);
    const hasText = value.trim().length > 0;

    return (
        <>
            <button
                type="button"
                aria-label={`Mở ô trả lời ${label}`}
                disabled={disabled}
                onClick={() => setOpen(true)}
                className="mt-4 flex min-h-24 w-full items-start gap-3 rounded-md border border-dashed bg-background p-3 text-left transition hover:border-primary hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
                <PencilLine className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                {hasText ? (
                    <span className="line-clamp-4 whitespace-pre-wrap break-words text-sm">{value}</span>
                ) : (
                    <span className="text-sm text-muted-foreground">Bấm vào đây để nhập câu trả lời…</span>
                )}
            </button>
            {hasText && (
                <p className="mt-1 text-xs text-muted-foreground">{value.length} ký tự · bấm vào ô để xem/sửa</p>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="flex max-h-[90vh] flex-col gap-4 sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>{label} — Trả lời tự luận</DialogTitle>
                        <DialogDescription className="max-h-24 overflow-y-auto whitespace-pre-wrap">
                            {questionContent}
                        </DialogDescription>
                    </DialogHeader>
                    <textarea
                        aria-label={`Câu trả lời ${label}`}
                        autoFocus
                        className="min-h-[50vh] w-full flex-1 resize-y rounded-md border bg-background p-3 font-mono text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        placeholder="Nhập câu trả lời của bạn. Nhấn Enter để xuống dòng."
                        value={value}
                        onChange={(event) => onChange(event.target.value)}
                        disabled={disabled}
                    />
                    <DialogFooter className="items-center sm:justify-between">
                        <span className="text-xs text-muted-foreground">
                            {value.length} ký tự · tự động lưu khi bạn gõ
                        </span>
                        <Button type="button" onClick={() => setOpen(false)}>Xong</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
