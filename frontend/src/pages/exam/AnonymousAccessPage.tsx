import { invitationApi } from "@/api";
import type { AnonymousAccessResponse, AnonymousSessionResponse } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Clock3, Lock, QrCode, Scan } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

export default function AnonymousAccessPage() {
    const [accessCode, setAccessCode] = useState("");
    const [qrMode, setQrMode] = useState(false);
    const [sessionToken, setSessionToken] = useState<string | null>(null);
    const [sessionInfo, setSessionInfo] = useState<AnonymousSessionResponse | null>(null);

    // Read code from URL on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        if (code) setAccessCode(code.toUpperCase());
    }, []);

    const verifyMutation = useMutation({
        mutationFn: (code: string) => invitationApi.verifyAccessCode(code),
        onSuccess: (data) => {
            if (!data.valid) {
                toast.error(data.message ?? "Mã truy cập không hợp lệ.");
            } else {
                toast.success("Mã hợp lệ! Bạn có thể vào thi.");
            }
        },
        onError: () => toast.error("Không thể xác minh mã truy cập."),
    });

    const enterMutation = useMutation({
        mutationFn: (code: string) =>
            invitationApi.createAnonymousSession({ accessCode: code }),
        onSuccess: (data) => {
            if (!data.valid) {
                toast.error(data.message ?? "Không thể bắt đầu phiên thi.");
                return;
            }
            setSessionToken(data.sessionToken ?? null);
            setSessionInfo(data);

            // Store session for exam-taking page
            sessionStorage.setItem("anonymous_session_token", data.sessionToken ?? "");
            sessionStorage.setItem("anonymous_exam_title", data.examTitle ?? "");

            toast.success("Đã tạo phiên thi. Chuyển sang trang thi...");
        },
        onError: (err: any) => {
            toast.error(
                err?.response?.data?.message || "Không thể bắt đầu phiên thi.",
            );
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const code = accessCode.trim().toUpperCase();
        if (!code) {
            toast.error("Vui lòng nhập mã truy cập.");
            return;
        }
        verifyMutation.mutate(code);
        // Auto-enter on submit
        enterMutation.mutate(code);
    };

    const handleScan = (code: string) => {
        setAccessCode(code.toUpperCase());
        setQrMode(false);
        verifyMutation.mutate(code);
        enterMutation.mutate(code);
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 p-6">
            <div className="w-full max-w-md space-y-6">
                {/* Logo / Title */}
                <div className="text-center">
                    <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-primary/10">
                        <Lock className="size-7 text-primary" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">Truy cập kỳ thi</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Nhập mã được cung cấp bởi giáo viên để vào thi
                    </p>
                </div>

                {/* Session result */}
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
                            {sessionInfo.durationMinutes && (
                                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                    <Clock3 className="size-4" />
                                    Thời lượng: {sessionInfo.durationMinutes} phút
                                </div>
                            )}
                            <div className="space-y-2">
                                <Button
                                    className="w-full"
                                    onClick={() => {
                                        window.location.href = "/anonymous-exam";
                                    }}
                                >
                                    Vào phòng thi
                                </Button>
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => {
                                        setSessionToken(null);
                                        setSessionInfo(null);
                                        sessionStorage.removeItem("anonymous_session_token");
                                        sessionStorage.removeItem("anonymous_exam_title");
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
                            <CardTitle className="text-base">Nhập mã truy cập</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="flex gap-2">
                                    <Input
                                        className="text-center font-mono text-lg font-bold tracking-widest uppercase"
                                        placeholder="ABCD1234"
                                        maxLength={10}
                                        value={accessCode}
                                        onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
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

                                {verifyMutation.data && !verifyMutation.data.valid && (
                                    <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                        <AlertCircle className="size-4 shrink-0" />
                                        {verifyMutation.data.message}
                                    </div>
                                )}

                                {verifyMutation.data?.valid && !sessionToken && (
                                    <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                                        <CheckCircle2 className="size-4 shrink-0" />
                                        {verifyMutation.data.message}
                                    </div>
                                )}

                                <Button
                                    type="submit"
                                    className="w-full"
                                    disabled={
                                        !accessCode.trim() ||
                                        verifyMutation.isPending ||
                                        enterMutation.isPending
                                    }
                                >
                                    {enterMutation.isPending || verifyMutation.isPending ? (
                                        <span className="flex items-center gap-2">
                                            <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                            Đang xác minh...
                                        </span>
                                    ) : (
                                        "Xác minh & Vào thi"
                                    )}
                                </Button>
                            </form>

                            <p className="mt-4 text-center text-xs text-muted-foreground">
                                Bạn không cần tài khoản để thi. Mỗi mã chỉ dùng được số lần nhất định.
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* QR Scanner */}
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
                                <div className="aspect-square w-full overflow-hidden rounded-md border bg-muted flex items-center justify-center">
                                    {/* Placeholder — wire to html5-qrcode if needed */}
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