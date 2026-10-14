import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Mail, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import type { ForgotPasswordEmailRequest } from "@/types";

const emailSchema = z.object({
    email: z.string().email("Invalid email format"),
});

interface ForgotEmailFormProps {
    onSubmit: (data: ForgotPasswordEmailRequest) => void;
    loading: boolean;
}

export const ForgotEmailForm = ({ onSubmit, loading }: ForgotEmailFormProps) => {
    const form = useForm<ForgotPasswordEmailRequest>({
        resolver: zodResolver(emailSchema),
        defaultValues: { email: "" },
    });

    return (
        <div className="p-10 space-y-7">
            <div className="text-center space-y-3">
                <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">Forgot Password?</h1>
                <p className="text-lg text-gray-500">Enter your email to receive a reset link</p>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <div className="relative">
                                    <Mail
                                        className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                                        size={22}
                                    />
                                    <FormControl>
                                        <Input
                                            {...field}
                                            placeholder="Email Address"
                                            className="pl-12 h-14 text-lg rounded-2xl"
                                        />
                                    </FormControl>
                                </div>
                                <FormMessage className="ml-2" />
                            </FormItem>
                        )}
                    />

                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full h-13 text-xl font-bold rounded-2xl shadow-lg"
                    >
                        {loading ? (
                            <Loader2 className="animate-spin" />
                        ) : (
                            <>
                                Send Reset Link <ArrowRight className="ml-2" size={22} />
                            </>
                        )}
                    </Button>
                </form>
            </Form>
        </div>
    );
};
