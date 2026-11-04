import { invitationApi } from "@/api";
import {
    SESSION_EMAIL_KEY,
    SESSION_NAME_KEY,
    SESSION_TOKEN_KEY,
} from "@/api/exam.api";
import type { AnonymousSessionResponse } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Clock3, Lock, Mail, QrCode, Scan, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ACCESS_CODE_KEY = "anonymous_access_code";

export default function AnonymousAccessPage() {
    const [accessCode, setAccessCode] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return (params.get("code") ?? "").toUpperCase();
    });
    const [studentName, setStudentName] = useState("");
    const [studentEmail, setStudentEmail] = useState("");
    const [qrMode, setQrMode] = useState(false);
    const [sessionInfo, setSessionInfo] = useState<AnonymousSessionResponse | null>(() => {
        const token = sessionStorage.getItem(SESSION_TOKEN_KEY);
        if (!token) return null;
        const name = sessionStorage.getItem(SESSION_NAME_KEY) ?? "";
        const email = sessionStorage.getItem(SESSION_EMAIL_KEY) ?? "";
        const title = sessionStorage.getItem("anonymous_exam_title") ?? "";
        const savedCode = sessionStorage.getItem(ACCESS_CODE_KEY) ?? "";
        const urlCode = (
            new URLSearchParams(window.location.search).get("code") ?? ""
        ).toUpperCase();
        if (urlCode && savedCode && urlCode !== savedCode) return null;
        if (!name && !email) return null;
        return {
            valid: true,
            sessionToken: token,
            studentName: name,
            studentEmail: email,
            examTitle: title,
        };
    });

    const verifyMutation = useMutation({
        mutationFn: (code: string) => invitationApi.verifyAccessCode(code),
        onSuccess: (data) => {
            if (!data.valid) {
                toast.error(data.message ?? "Mã truy cập không hợp lệ.");
            } else {
                if (data.studentName) setStudentName(data.studentName);
                toast.success("Mã hợp lệ! Vui lòng xác nhận thông tin của bạn.");
            }
        },
        onError: () => toast.error("Không thể xác minh mã truy cập."),
    });

    const enterMutation = useMutation({
        mutationFn: ({ code, name, email }: { code: string; name: string; email: string }) =>
            invitationApi.createAnonymousSession({
                accessCode: code,
                studentName: name,
                studentEmail: email,
            }),
        onSuccess: (data, variables) => {
            if (!data.valid) {
                toast.error(data.message ?? "Không thể bắt đầu phiên thi.");
                return;
            }
            if (!data.sessionToken) {
                toast.error("Không nhận được phiên thi. Vui lòng thử lại.");
                return;
            }
            setSessionInfo(data);

            sessionStorage.setItem(SESSION_TOKEN_KEY, data.sessionToken);
            sessionStorage.setItem("anonymous_exam_title", data.examTitle ?? "");
            sessionStorage.setItem(SESSION_NAME_KEY, variables.name);
            sessionStorage.setItem(SESSION_EMAIL_KEY, variables.email);
            sessionStorage.setItem(ACCESS_CODE_KEY, variables.code);

            toast.success("Đã xác nhận. Bạn có thể vào phòng thi.");
        },
        onError: (err: unknown) => {
            const message =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(message || "Không thể bắt đầu phiên thi.");
        },
    });

    const nameValid = studentName.trim().length > 0;
    const emailValid = EMAIL_PATTERN.test(studentEmail.trim());
    const canEnter = Boolean(accessCode.trim()) && nameValid && emailValid;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const code = accessCode.trim().toUpperCase();
        if (!code) {
            toast.error("Vui lòng nhập mã truy cập.");
            return;
        }
        if (!nameValid) {
            toast.error("Vui lòng nhập họ tên của bạn.");
            return;
        }
        if (!emailValid) {
            toast.error("Vui lòng nhập email hợp lệ để nhận kết quả bài thi.");
            return;
        }
        enterMutation.mutate({
            code,
            name: studentName.trim(),
            email: studentEmail.trim(),
        });
    };

    const handleScan = (code: string) => {
        setAccessCode(code.toUpperCase());
        setQrMode(false);
        verifyMutation.mutate(code.toUpperCase());
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 p-6">
            <div className="w-full max-w-md space-y-6">
                <div className="text-center">
                    <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-primary/10">
                        <Lock className="size-7 text-primary" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">Truy cập kỳ thi</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Nhập thông tin của bạn để vào thi — không cần tài khoản
                    </p>
                </div>

                {sessionInfo?.valid ? (
                    <Card className="border-green-200 bg-green-50">
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="size-5 text-green-600" />
                                <CardTitle className="text-base text-green-800">
                                    Đã xác nhận phiên thi
                                </CardTitle>
                            </div>
                            <CardDescription className="text-green-700">
                                Bạn đã được xác nhận tham gia kỳ thi
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="rounded-md border border-green-200 bg-white p-4 text-center">
                                <p className="text-sm text-muted-foreground">Kỳ thi</p>
                                <p className="text-lg font-semibold text-slate-900">{sessionInfo.examTitle}</p>
                            </div>
                            <div className="space-y-1 text-sm text-green-800">
                                <p className="flex items-center gap-2">
                                    <User className="size-4" />
                                    {studentName.trim()}
                                </p>
                                <p className="flex items-center gap-2">
                                    <Mail className="size-4" />
                                    Kết quả sẽ gửi về {studentEmail.trim()}
                                </p>
                            </div>
                            {sessionInfo.durationMinutes !== undefined && sessionInfo.durationMinutes > 0 && (
                                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                    <Clock3 className="size-4" />
                                    Thời lượng: {sessionInfo.durationMinutes} phút
                                </div>
                            )}
                            <div className="space-y-2">
                                <Button
                                    className="w-full"
                                    onClick={() => {
                                        window.location.href = "/anonymous-exam/take";
                                    }}
                                >
                                    Vào phòng thi
                                </Button>
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => {
                                        setSessionInfo(null);
                                        sessionStorage.removeItem(SESSION_TOKEN_KEY);
                                        sessionStorage.removeItem("anonymous_exam_title");
                                        sessionStorage.removeItem(SESSION_NAME_KEY);
                                        sessionStorage.removeItem(SESSION_EMAIL_KEY);
                                        sessionStorage.removeItem(ACCESS_CODE_KEY);
                                    }}
                                >
                                    Thi trên thiết bị khác
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
                        <CardHeader className="pb-4">
                            <CardTitle className="text-base">Thông tin của bạn</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="flex gap-2">
                                    <div className="flex-1 space-y-2">
                                        <Label htmlFor="access-code">Mã truy cập</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                id="access-code"
                                                className="text-center font-mono text-lg font-bold tracking-widest uppercase"
                                                placeholder="ABCD1234"
                                                maxLength={10}
                                                value={accessCode}
                                                onChange={(e) =>
                                                    setAccessCode(e.target.value.toUpperCase())
                                                }
                                                autoFocus
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => setQrMode(true)}
                                                title="Quét QR"
                                            >
                                                <QrCode className="size-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="student-name">Họ và tên</Label>
                                    <Input
                                        id="student-name"
                                        placeholder="Nguyễn Văn A"
                                        value={studentName}
                                        onChange={(e) => setStudentName(e.target.value)}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Tên sẽ hiển thị trong kết quả bài thi của bạn.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="student-email">Email nhận kết quả</Label>
                                    <Input
                                        id="student-email"
                                        type="email"
                                        placeholder="ban@example.com"
                                        value={studentEmail}
                                        onChange={(e) => setStudentEmail(e.target.value)}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Kết quả bài thi sẽ được gửi thẳng về email này sau khi bạn
                                        nộp bài.
                                    </p>
                                </div>

                                {verifyMutation.data && !verifyMutation.data.valid && (
                                    <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                        <AlertCircle className="size-4 shrink-0" />
                                        {verifyMutation.data.message}
                                    </div>
                                )}

                                <Button type="submit" className="w-full" disabled={!canEnter || enterMutation.isPending}>
                                    {enterMutation.isPending ? (
                                        <span className="flex items-center gap-2">
                                            <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                            Đang xác nhận...
                                        </span>
                                    ) : (
                                        "Xác nhận & Vào thi"
                                    )}
                                </Button>
                            </form>

                            <p className="mt-4 text-center text-xs text-muted-foreground">
                                Bạn không cần tài khoản để thi. Kết quả sẽ được gửi qua email.
                            </p>
                        </CardContent>
                    </Card>
                )}

                {qrMode && (
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base">Quét QR Code</CardTitle>
                                <Button variant="ghost" size="sm" onClick={() => setQrMode(false)}>
                                    Đóng
                                </Button>
                            </div>
                            <CardDescription>
                                Dùng camera để quét mã QR trên thiết bị của giáo viên
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-md border bg-muted">
                                    <div className="text-center text-muted-foreground">
                                        <Scan className="mx-auto size-10 opacity-30" />
                                        <p className="mt-2 text-sm">Camera sẽ hiển thị ở đây</p>
                                        <p className="text-xs">(Cần cài thư viện html5-qrcode)</p>
                                    </div>
                                </div>
                                <Label className="text-sm text-muted-foreground">
                                    Hoặc nhập mã từ QR bằng tay:
                                </Label>
                                <Input
                                    className="font-mono font-bold uppercase"
                                    placeholder="ABCD1234"
                                    value={accessCode}
                                    onChange={(e) => handleScan(e.target.value.toUpperCase())}
                                    autoFocus
                                />
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
