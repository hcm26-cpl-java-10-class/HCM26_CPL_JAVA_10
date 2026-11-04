import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Mail, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Link } from "react-router-dom";
import type { ForgotPasswordEmailRequest } from "@/types";

const emailSchema = z.object({
    email: z.string().email("Vui lòng nhập địa chỉ email hợp lệ."),
});

interface ForgotEmailFormProps {
    onSubmit: (data: ForgotPasswordEmailRequest) => Promise<void>;
    loading: boolean;
    cooldownSeconds: number;
}

export const ForgotEmailForm = ({ onSubmit, loading, cooldownSeconds }: ForgotEmailFormProps) => {
    const form = useForm<ForgotPasswordEmailRequest>({
        resolver: zodResolver(emailSchema),
        defaultValues: { email: "" },
    });

    return (
        <div className="space-y-7 p-8 sm:p-10">
            <div className="space-y-3 text-center">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Quên mật khẩu?</h1>
                <p className="text-sm text-slate-600">
                    Nhập email công ty để nhận hướng dẫn khôi phục mật khẩu.
                </p>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <label htmlFor="company-email" className="mb-2 block text-sm font-medium text-slate-900">
                                    Email công ty
                                </label>
                                <div className="relative">
                                    <Mail
                                        aria-hidden="true"
                                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                        size={20}
                                    />
                                    <FormControl>
                                        <Input
                                            {...field}
                                            id="company-email"
                                            type="email"
                                            autoComplete="email"
                                            placeholder="trainer@fams.edu.vn"
                                            className="h-11 rounded-lg border-slate-300 bg-white pl-10 focus-visible:border-orange-600 focus-visible:ring-orange-500"
                                        />
                                    </FormControl>
                                </div>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <Button
                        type="submit"
                        disabled={loading || cooldownSeconds > 0}
                        className="h-11 w-full rounded-lg bg-orange-600 font-semibold text-white hover:bg-orange-700"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="animate-spin" aria-hidden="true" />
                                Đang gửi yêu cầu...
                            </>
                        ) : cooldownSeconds > 0 ? (
                            `Gửi lại sau ${cooldownSeconds} giây`
                        ) : (
                            <>
                                Gửi yêu cầu khôi phục
                                <ArrowRight className="ml-2" size={18} aria-hidden="true" />
                            </>
                        )}
                    </Button>
                </form>
            </Form>

            {cooldownSeconds > 0 && (
                <p aria-live="polite" className="text-center text-sm text-slate-600">
                    Bạn có thể gửi yêu cầu mới sau {cooldownSeconds} giây.
                </p>
            )}

            <div className="text-center">
                <Link
                    to="/login"
                    className="text-sm font-medium text-orange-600 hover:text-orange-700 hover:underline"
                >
                    Quay lại Đăng nhập
                </Link>
            </div>
        </div>
    );
};
