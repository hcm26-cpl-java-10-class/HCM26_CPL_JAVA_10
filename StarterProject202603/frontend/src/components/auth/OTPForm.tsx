import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import type { VerifyRequest } from "@/types";

const verifySchema = z.object({
    code: z.string().length(6, "Please enter the 6-digit code"),
    email: z.string().email(),
});

interface VerifyFormProps {
    onSubmit: (data: VerifyRequest) => void;
    loading: boolean;
    email: string;
    onBack: () => void;
}

export function VerifyForm({ onSubmit, loading, email, onBack }: VerifyFormProps) {
    const form = useForm<VerifyRequest>({
        resolver: zodResolver(verifySchema),
        defaultValues: { code: "", email: email },
    });

    const otpValue = form.watch("code");

    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="p-10 space-y-8 animate-in fade-in zoom-in-95 duration-300"
            >
                <div className="flex flex-col items-center text-center space-y-4">
                    <div className="bg-green-100 p-5 rounded-full text-green-600">
                        <ShieldCheck size={56} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Verify OTP</h2>
                    <p className="text-lg text-gray-500">
                        We sent a code to <br />
                        <span className="text-black font-semibold underline decoration-green-500 underline-offset-4">
                            {email}
                        </span>
                    </p>
                </div>

                <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                        <FormItem>
                            <FormControl>
                                <Input
                                    {...field}
                                    placeholder="000000"
                                    maxLength={6}
                                    className="w-full text-center text-2xl font-mono tracking-[12px] h-15 border-2 rounded-[12px] bg-gray-50"
                                />
                            </FormControl>
                            <FormMessage className="text-center" />
                        </FormItem>
                    )}
                />

                <div className="space-y-4">
                    <Button
                        type="submit"
                        disabled={loading || otpValue?.length < 6}
                        className="w-full h-10 text-lg font-bold rounded-xl bg-black"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : "Confirm & Verify"}
                    </Button>
                    <button
                        type="button"
                        onClick={onBack}
                        className="w-full text-base text-gray-400 hover:text-black font-medium"
                    >
                        ← Back to Registration
                    </button>
                </div>
            </form>
        </Form>
    );
}
