import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { verifyExamPassword } from '@/api/exam.api';

interface ExamPasswordDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    examId: number | null;
    examTitle: string;
    onSuccess: (examId: number, password: string) => void;
}

export function ExamPasswordDialog({
    open,
    onOpenChange,
    examId,
    examTitle,
    onSuccess,
}: ExamPasswordDialogProps) {
    const [password, setPassword] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!examId) return;

        const trimmed = password.trim();
        if (!trimmed) {
            toast.error('Vui lòng nhập mật khẩu đề thi');
            return;
        }

        setIsVerifying(true);
        try {
            await verifyExamPassword(examId, trimmed);
            toast.success('Mật khẩu chính xác!');
            onSuccess(examId, trimmed);
            setPassword('');
            onOpenChange(false);
        } catch (error: any) {
            const message =
                error?.response?.data?.message ||
                'Mật khẩu không chính xác. Vui lòng kiểm tra lại.';
            toast.error(message);
        } finally {
            setIsVerifying(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                            <KeyRound className="size-6" />
                        </div>
                        <DialogTitle className="text-center text-lg">
                            Đề thi yêu cầu mật khẩu
                        </DialogTitle>
                        <DialogDescription className="text-center text-sm text-slate-500">
                            Bài thi <span className="font-semibold text-slate-800">"{examTitle}"</span> được bảo vệ bằng mã truy cập. Vui lòng nhập mật khẩu để vào thi.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4">
                        <Input
                            autoFocus
                            type="password"
                            placeholder="Nhập mật khẩu bài thi..."
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isVerifying}
                        />
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setPassword('');
                                onOpenChange(false);
                            }}
                            disabled={isVerifying}
                        >
                            Hủy
                        </Button>
                        <Button
                            type="submit"
                            className="bg-cyan-600 hover:bg-cyan-500"
                            disabled={isVerifying || !password.trim()}
                        >
                            {isVerifying ? 'Đang kiểm tra...' : 'Vào thi'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
